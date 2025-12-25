/**
 * Discuss Command - Multi-model discussion orchestration
 *
 * Usage: ax discuss <topic>
 *        ax discuss --providers claude,glm,qwen "Design a REST API"
 *        ax discuss --pattern debate "Is microservices better than monolith?"
 *
 * Enables multiple AI models to discuss a topic from their unique perspectives,
 * building consensus through various patterns and mechanisms.
 */

import type { CommandResult, CLIOptions } from '../types.js';

// Bootstrap imports - composition root provides adapter access
import {
  createProvider,
  PROVIDER_CONFIGS,
  type CLIProviderConfig,
  type CompletionRequest,
} from '../bootstrap.js';

// Discussion domain imports
import {
  DiscussionExecutor,
  RecursiveDiscussionExecutor,
  parseParticipantList,
  type DiscussionProviderExecutor,
  type ProviderExecuteRequest,
  type ProviderExecuteResult,
  type DiscussionProgressEvent,
  type RecursiveDiscussionResult,
} from '@defai.digital/discussion-domain';

// Contract types
import {
  DEFAULT_PROVIDERS,
  DEFAULT_PROVIDER_TIMEOUT,
  DEFAULT_TOTAL_BUDGET_MS,
  DEFAULT_ROUNDS,
  DEFAULT_DISCUSSION_DEPTH,
  DEFAULT_MAX_TOTAL_CALLS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_AGENT_WEIGHT_MULTIPLIER,
  type DiscussionPattern,
  type ConsensusMethod,
  type DiscussStepConfig,
  type TimeoutStrategy,
  type DiscussionParticipant,
} from '@defai.digital/contracts';

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const ICONS = {
  check: `${COLORS.green}\u2713${COLORS.reset}`,
  cross: `${COLORS.red}\u2717${COLORS.reset}`,
  arrow: `${COLORS.cyan}\u2192${COLORS.reset}`,
  bullet: `${COLORS.dim}\u2022${COLORS.reset}`,
  discuss: `${COLORS.magenta}\u2630${COLORS.reset}`,
};

// Pattern display names
const PATTERN_NAMES: Record<DiscussionPattern, string> = {
  'round-robin': 'Round Robin',
  synthesis: 'Synthesis',
  debate: 'Debate',
  critique: 'Critique',
  voting: 'Voting',
};

// Consensus method display names
const CONSENSUS_NAMES: Record<ConsensusMethod, string> = {
  synthesis: 'Synthesis',
  voting: 'Voting',
  moderator: 'Moderator',
  unanimous: 'Unanimous',
  majority: 'Majority',
};

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed discuss command arguments
 */
interface ParsedDiscussArgs {
  topic: string | undefined;
  providers: string[];
  pattern: DiscussionPattern;
  rounds: number;
  consensus: ConsensusMethod;
  synthesizer: string | undefined;
  context: string | undefined;
  timeout: number;
  // Participant options (agents and providers)
  participants: DiscussionParticipant[] | undefined;
  agentWeight: number;
  // Recursive discussion options
  recursive: boolean;
  maxDepth: number;
  timeoutStrategy: TimeoutStrategy;
  totalBudget: number;
  maxCalls: number;
  earlyExit: boolean;
  confidenceThreshold: number;
}

// ============================================================================
// Provider Bridge
// ============================================================================

/**
 * Creates a DiscussionProviderExecutor that bridges to CLI providers
 */
function createProviderBridge(
  providerConfigs: Record<string, CLIProviderConfig>
): DiscussionProviderExecutor {
  // Cache of provider adapters
  const adapterCache = new Map<string, ReturnType<typeof createProvider>>();

  function getAdapter(providerId: string): ReturnType<typeof createProvider> | undefined {
    if (adapterCache.has(providerId)) {
      return adapterCache.get(providerId);
    }

    const config = providerConfigs[providerId];
    if (config === undefined) {
      return undefined;
    }

    const adapter = createProvider(config);
    adapterCache.set(providerId, adapter);
    return adapter;
  }

  return {
    async execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
      const startTime = Date.now();
      const adapter = getAdapter(request.providerId);

      if (adapter === undefined) {
        return {
          success: false,
          error: `Provider ${request.providerId} not found`,
          retryable: false,
          durationMs: Date.now() - startTime,
        };
      }

      try {
        const config = providerConfigs[request.providerId];
        const completionRequest: CompletionRequest = {
          requestId: crypto.randomUUID(),
          messages: [{ role: 'user', content: request.prompt }],
          model: config?.models.find(m => m.isDefault)?.modelId ?? config?.models[0]?.modelId ?? 'default',
          systemPrompt: request.systemPrompt,
        };

        const response = await adapter.complete(completionRequest);

        if (!response.success) {
          return {
            success: false,
            error: response.error?.message ?? 'Unknown error',
            retryable: response.error?.shouldRetry ?? true,
            durationMs: Date.now() - startTime,
          };
        }

        return {
          success: true,
          content: response.content,
          durationMs: Date.now() - startTime,
          tokenCount: response.usage?.totalTokens,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
          durationMs: Date.now() - startTime,
        };
      }
    },

    async isAvailable(providerId: string): Promise<boolean> {
      const adapter = getAdapter(providerId);
      if (adapter === undefined) {
        return false;
      }

      try {
        return await adapter.isAvailable();
      } catch {
        return false;
      }
    },

    async getAvailableProviders(): Promise<string[]> {
      const available: string[] = [];

      for (const providerId of Object.keys(providerConfigs)) {
        const adapter = getAdapter(providerId);
        if (adapter !== undefined) {
          try {
            const isAvail = await adapter.isAvailable();
            if (isAvail) {
              available.push(providerId);
            }
          } catch {
            // Provider not available
          }
        }
      }

      return available;
    },
  };
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parses discuss command arguments
 */
function parseDiscussArgs(args: string[], _options: CLIOptions): ParsedDiscussArgs {
  let topic: string | undefined;
  let providers: string[] = [];
  let pattern: DiscussionPattern = 'synthesis';
  let rounds = DEFAULT_ROUNDS;
  let consensus: ConsensusMethod = 'synthesis';
  let synthesizer: string | undefined;
  let context: string | undefined;
  let timeout = DEFAULT_PROVIDER_TIMEOUT;
  // Participant options
  let participants: DiscussionParticipant[] | undefined;
  let agentWeight = DEFAULT_AGENT_WEIGHT_MULTIPLIER; // (INV-DISC-642)
  // Recursive options
  let recursive = false;
  let maxDepth = DEFAULT_DISCUSSION_DEPTH;
  let timeoutStrategy: TimeoutStrategy = 'cascade';
  let totalBudget = DEFAULT_TOTAL_BUDGET_MS;
  let maxCalls = DEFAULT_MAX_TOTAL_CALLS;
  let earlyExit = true;
  let confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--providers' && i + 1 < args.length) {
      const providerStr = args[++i];
      providers = providerStr?.split(',').map(p => p.trim()) ?? [];
    } else if (arg === '--pattern' && i + 1 < args.length) {
      pattern = args[++i] as DiscussionPattern;
    } else if (arg === '--rounds' && i + 1 < args.length) {
      const parsed = parseInt(args[++i] ?? '2', 10);
      if (!isNaN(parsed)) rounds = parsed;
    } else if (arg === '--consensus' && i + 1 < args.length) {
      consensus = args[++i] as ConsensusMethod;
    } else if (arg === '--synthesizer' && i + 1 < args.length) {
      synthesizer = args[++i];
    } else if (arg === '--context' && i + 1 < args.length) {
      context = args[++i];
    } else if (arg === '--timeout' && i + 1 < args.length) {
      const parsed = parseInt(args[++i] ?? '60000', 10);
      if (!isNaN(parsed)) timeout = parsed;
    }
    // Participant options (agents and providers)
    else if (arg === '--participants' && i + 1 < args.length) {
      // Parse participant list: "claude,glm,reviewer:agent,security:agent"
      const participantStr = args[++i] ?? '';
      participants = parseParticipantList(participantStr);
    } else if (arg === '--agent-weight' && i + 1 < args.length) {
      // Agent weight multiplier (0.5 - 3.0)
      const parsed = parseFloat(args[++i] ?? String(DEFAULT_AGENT_WEIGHT_MULTIPLIER));
      if (!isNaN(parsed)) agentWeight = Math.max(0.5, Math.min(3.0, parsed));
    }
    // Recursive discussion options
    else if (arg === '--recursive' || arg === '-r') {
      recursive = true;
    } else if (arg === '--max-depth' && i + 1 < args.length) {
      const parsed = parseInt(args[++i] ?? '2', 10);
      if (!isNaN(parsed)) maxDepth = parsed;
      recursive = true; // Implies recursive
    } else if (arg === '--timeout-strategy' && i + 1 < args.length) {
      timeoutStrategy = args[++i] as TimeoutStrategy;
    } else if (arg === '--budget' && i + 1 < args.length) {
      // Parse budget like "180s" or "180000"
      const budgetStr = args[++i] ?? '180000';
      let parsed: number;
      if (budgetStr.endsWith('s')) {
        parsed = parseInt(budgetStr.slice(0, -1), 10) * 1000;
      } else if (budgetStr.endsWith('m')) {
        parsed = parseInt(budgetStr.slice(0, -1), 10) * 60000;
      } else {
        parsed = parseInt(budgetStr, 10);
      }
      if (!isNaN(parsed)) totalBudget = parsed;
    } else if (arg === '--max-calls' && i + 1 < args.length) {
      const parsed = parseInt(args[++i] ?? '20', 10);
      if (!isNaN(parsed)) maxCalls = parsed;
    } else if (arg === '--early-exit') {
      earlyExit = true;
    } else if (arg === '--no-early-exit') {
      earlyExit = false;
    } else if (arg === '--confidence-threshold' && i + 1 < args.length) {
      const parsed = parseFloat(args[++i] ?? '0.9');
      if (!isNaN(parsed)) confidenceThreshold = parsed;
    } else if (arg !== undefined && !arg.startsWith('-')) {
      // Positional argument is the topic
      if (topic === undefined) {
        // Collect remaining non-flag args as topic
        const topicParts: string[] = [];
        for (let j = i; j < args.length; j++) {
          const part = args[j];
          if (part?.startsWith('-')) break;
          topicParts.push(part ?? '');
        }
        topic = topicParts.join(' ');
        break;
      }
    }
  }

  // Default providers if none specified
  if (providers.length === 0) {
    providers = [...DEFAULT_PROVIDERS];
  }

  return {
    topic,
    providers,
    pattern,
    rounds,
    consensus,
    synthesizer,
    context,
    timeout,
    participants,
    agentWeight,
    recursive,
    maxDepth,
    timeoutStrategy,
    totalBudget,
    maxCalls,
    earlyExit,
    confidenceThreshold,
  };
}

// ============================================================================
// Progress Display
// ============================================================================

/**
 * Creates a progress handler for verbose output
 */
function createProgressHandler(verbose: boolean): (event: DiscussionProgressEvent) => void {
  if (!verbose) {
    return () => {}; // No-op
  }

  return (event: DiscussionProgressEvent) => {
    switch (event.type) {
      case 'round_start':
        console.log(`\n${COLORS.bold}Round ${event.round}${COLORS.reset}`);
        break;

      case 'provider_start':
        process.stdout.write(`  ${ICONS.bullet} ${event.provider}: `);
        break;

      case 'provider_complete':
        console.log(`${ICONS.check} ${COLORS.dim}(${event.message ?? 'done'})${COLORS.reset}`);
        break;

      case 'round_complete':
        console.log(`  ${ICONS.arrow} Round ${event.round} complete`);
        break;

      case 'synthesis_start':
        console.log(`\n${COLORS.bold}Synthesizing...${COLORS.reset}`);
        break;

      case 'synthesis_complete':
        console.log(`${ICONS.check} Synthesis complete`);
        break;
    }
  };
}

/**
 * Formats the discussion result for text output
 */
function formatDiscussionResult(
  result: Awaited<ReturnType<DiscussionExecutor['execute']>> | RecursiveDiscussionResult,
  verbose: boolean
): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${COLORS.bold}${ICONS.discuss} Discussion Results${COLORS.reset}`);
  lines.push('─'.repeat(50));

  // Pattern and status
  const patternName = PATTERN_NAMES[result.pattern] ?? result.pattern;
  lines.push(`Pattern: ${COLORS.cyan}${patternName}${COLORS.reset}`);
  lines.push(`Status: ${result.success ? `${ICONS.check} Success` : `${ICONS.cross} Failed`}`);

  // Providers
  lines.push(`Providers: ${result.participatingProviders.join(', ')}`);
  if (result.failedProviders.length > 0) {
    lines.push(`Failed: ${COLORS.red}${result.failedProviders.join(', ')}${COLORS.reset}`);
  }

  // Duration
  const durationSec = (result.totalDurationMs / 1000).toFixed(1);
  lines.push(`Duration: ${durationSec}s`);

  // Recursive discussion info
  const recursiveResult = result as RecursiveDiscussionResult;
  if (recursiveResult.totalProviderCalls !== undefined) {
    lines.push(`Total Calls: ${recursiveResult.totalProviderCalls}`);
  }
  if (recursiveResult.maxDepthReached !== undefined && recursiveResult.maxDepthReached > 0) {
    lines.push(`Max Depth: ${recursiveResult.maxDepthReached}`);
  }
  if (recursiveResult.subDiscussions && recursiveResult.subDiscussions.length > 0) {
    lines.push(`Sub-discussions: ${recursiveResult.subDiscussions.length}`);
  }

  // Consensus result
  if (result.consensus !== undefined) {
    lines.push('');
    lines.push(`${COLORS.bold}Consensus${COLORS.reset}`);
    const consensusName = CONSENSUS_NAMES[result.consensus.method] ?? result.consensus.method;
    lines.push(`  Method: ${consensusName}`);

    if (result.consensus.synthesizer !== undefined) {
      lines.push(`  Synthesizer: ${result.consensus.synthesizer}`);
    }
    if (result.consensus.agreementScore !== undefined) {
      const scorePercent = (result.consensus.agreementScore * 100).toFixed(0);
      lines.push(`  Agreement: ${scorePercent}%`);
    }
  }

  // Voting results (for voting pattern)
  if (result.votingResults !== undefined) {
    lines.push(`  Winner: ${COLORS.green}${result.votingResults.winner}${COLORS.reset}`);
    const marginPercent = (result.votingResults.margin * 100).toFixed(0);
    lines.push(`  Margin: ${marginPercent}%`);
    if (result.votingResults.unanimous) {
      lines.push(`  ${ICONS.check} Unanimous`);
    }
  }

  // Sub-discussions (for recursive mode)
  if (verbose && recursiveResult.subDiscussions && recursiveResult.subDiscussions.length > 0) {
    lines.push('');
    lines.push(`${COLORS.bold}Sub-discussions${COLORS.reset}`);
    for (const sub of recursiveResult.subDiscussions) {
      lines.push(`  ${COLORS.cyan}Depth ${sub.depth}${COLORS.reset}: ${sub.topic.substring(0, 50)}...`);
      lines.push(`    Providers: ${sub.participatingProviders.join(', ')}`);
      lines.push(`    Duration: ${(sub.durationMs / 1000).toFixed(1)}s`);
    }
  }

  // Verbose: show rounds
  if (verbose && result.rounds.length > 0) {
    lines.push('');
    lines.push(`${COLORS.bold}Rounds${COLORS.reset}`);

    for (const round of result.rounds) {
      lines.push(`  Round ${round.roundNumber}:`);
      for (const response of round.responses) {
        const preview = response.content.substring(0, 80).replace(/\n/g, ' ');
        lines.push(`    ${response.provider}: ${COLORS.dim}${preview}...${COLORS.reset}`);
      }
    }
  }

  // Synthesis
  lines.push('');
  lines.push(`${COLORS.bold}Synthesis${COLORS.reset}`);
  lines.push('─'.repeat(50));
  lines.push(result.synthesis);

  return lines.join('\n');
}

// ============================================================================
// Help
// ============================================================================

/**
 * Shows discuss command help
 */
function showDiscussHelp(): CommandResult {
  const availableProviders = Object.keys(PROVIDER_CONFIGS).join(', ');
  const patterns = Object.keys(PATTERN_NAMES).join(', ');
  const consensusMethods = Object.keys(CONSENSUS_NAMES).join(', ');

  const helpText = `
${COLORS.bold}Discuss Command${COLORS.reset} - Multi-model discussion orchestration

${COLORS.bold}Usage:${COLORS.reset}
  ax discuss <topic>
  ax discuss --providers <providers> <topic>
  ax discuss --pattern <pattern> <topic>
  ax discuss --recursive <topic>

${COLORS.bold}Arguments:${COLORS.reset}
  <topic>           The topic or question for discussion

${COLORS.bold}Basic Options:${COLORS.reset}
  --providers       Comma-separated list of providers (default: claude,glm,qwen,gemini)
  --pattern         Discussion pattern: ${patterns}
  --rounds          Number of discussion rounds (default: 2)
  --consensus       Consensus method: ${consensusMethods}
  --synthesizer     Provider for synthesis (default: claude)
  --context         Additional context for the discussion
  --timeout         Per-provider timeout in ms (default: 180000, max: 30 min)
  --verbose, -v     Show detailed progress
  --format          Output format: text (default) or json

${COLORS.bold}Recursive Discussion Options:${COLORS.reset}
  --recursive, -r       Enable recursive sub-discussions
  --max-depth           Maximum discussion depth (default: 2, max: 4)
  --timeout-strategy    Timeout strategy: fixed, cascade, budget (default: cascade)
  --budget              Total timeout budget (e.g., 180s, 3m, 180000)
  --max-calls           Maximum total provider calls (default: 20)
  --early-exit          Enable early exit on high confidence (default: true)
  --no-early-exit       Disable early exit
  --confidence-threshold  Confidence threshold for early exit (default: 0.9)

${COLORS.bold}Available Providers:${COLORS.reset}
  ${availableProviders}

${COLORS.bold}Discussion Patterns:${COLORS.reset}
  synthesis    All models discuss, one synthesizes final answer
  debate       Structured debate with proponent/opponent roles
  critique     One proposes, others critique, then revision
  voting       Models vote on options with confidence levels
  round-robin  Sequential turns with each building on previous

${COLORS.bold}Timeout Strategies:${COLORS.reset}
  fixed      Each level gets equal timeout
  cascade    Each level gets half of parent (recommended)
  budget     Total budget divided across levels

${COLORS.bold}Examples:${COLORS.reset}
  ax discuss "What is the best approach for microservices?"
  ax discuss --providers claude,glm,qwen "Design a REST API"
  ax discuss --pattern debate "Is functional programming better than OOP?"
  ax discuss --pattern voting "Which framework: React, Vue, or Angular?"
  ax discuss --verbose --rounds 3 "Optimize database queries"

  ${COLORS.cyan}# Recursive discussions${COLORS.reset}
  ax discuss --recursive "Complex architectural decision"
  ax discuss --recursive --max-depth 3 "Design a distributed system"
  ax discuss --recursive --budget 5m --max-calls 30 "Research topic"
`.trim();

  return {
    success: true,
    message: helpText,
    data: undefined,
    exitCode: 0,
  };
}

// ============================================================================
// Main Command Handler
// ============================================================================

/**
 * Discuss command handler
 */
export async function discussCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Show help if requested
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return showDiscussHelp();
  }

  // Handle 'quick' subcommand - use quick synthesis with 2-3 providers
  if (args[0] === 'quick') {
    const quickArgs = args.slice(1);
    const topic = quickArgs.join(' ');

    if (topic.trim() === '') {
      return {
        success: false,
        message: 'Error: Topic is required.\n\nUsage: ax discuss quick <topic>',
        data: undefined,
        exitCode: 1,
      };
    }

    // For quick mode, use 3 providers and 2 rounds with synthesis
    return discussCommand(
      [
        '--providers', 'claude,glm,qwen',
        '--pattern', 'synthesis',
        '--rounds', '2',
        topic,
      ],
      options
    );
  }

  const parsed = parseDiscussArgs(args, options);

  // Validate topic
  if (parsed.topic === undefined || parsed.topic.trim() === '') {
    return {
      success: false,
      message: 'Error: Topic is required.\n\nRun "ax discuss help" for usage.',
      data: undefined,
      exitCode: 1,
    };
  }

  // Validate providers
  const invalidProviders = parsed.providers.filter(p => PROVIDER_CONFIGS[p] === undefined);
  if (invalidProviders.length > 0) {
    const available = Object.keys(PROVIDER_CONFIGS).join(', ');
    return {
      success: false,
      message: `Error: Unknown provider(s): ${invalidProviders.join(', ')}\nAvailable: ${available}`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Validate minimum providers
  if (parsed.providers.length < 2) {
    return {
      success: false,
      message: 'Error: At least 2 providers are required for discussion.',
      data: undefined,
      exitCode: 1,
    };
  }

  // Create provider bridge
  const providerBridge = createProviderBridge(PROVIDER_CONFIGS);

  // Check provider availability
  if (options.verbose) {
    console.log(`${COLORS.bold}Checking provider availability...${COLORS.reset}`);
  }

  const availableProviders: string[] = [];
  for (const providerId of parsed.providers) {
    const isAvailable = await providerBridge.isAvailable(providerId);
    if (isAvailable) {
      availableProviders.push(providerId);
      if (options.verbose) {
        console.log(`  ${ICONS.check} ${providerId}`);
      }
    } else {
      if (options.verbose) {
        console.log(`  ${ICONS.cross} ${providerId} ${COLORS.dim}(not available)${COLORS.reset}`);
      }
    }
  }

  if (availableProviders.length < 2) {
    return {
      success: false,
      message: `Error: Only ${availableProviders.length} providers available. Need at least 2.\nRun "ax doctor" to check provider status.`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Build discussion config
  const config: DiscussStepConfig = {
    pattern: parsed.pattern,
    rounds: parsed.rounds,
    providers: availableProviders,
    prompt: parsed.topic,
    context: parsed.context,
    verbose: options.verbose,
    consensus: {
      method: parsed.consensus,
      synthesizer: parsed.synthesizer ?? 'claude',
      threshold: 0.5,
      includeDissent: true,
    },
    providerTimeout: parsed.timeout,
    continueOnProviderFailure: true,
    minProviders: 2,
    temperature: 0.7,
    agentWeightMultiplier: parsed.agentWeight,
    // Include participants if specified via --participants option
    ...(parsed.participants !== undefined && { participants: parsed.participants }),
  };

  // Show discussion start
  if (options.verbose) {
    console.log('');
    console.log(`${COLORS.bold}Starting Discussion${COLORS.reset}`);
    console.log(`  Topic: ${parsed.topic.substring(0, 60)}${parsed.topic.length > 60 ? '...' : ''}`);
    console.log(`  Pattern: ${PATTERN_NAMES[parsed.pattern] ?? parsed.pattern}`);
    console.log(`  Providers: ${availableProviders.join(', ')}`);
    console.log(`  Rounds: ${parsed.rounds}`);
    if (parsed.participants !== undefined && parsed.participants.length > 0) {
      const agentCount = parsed.participants.filter(p => p.type === 'agent').length;
      const providerCount = parsed.participants.filter(p => p.type === 'provider').length;
      console.log(`  Participants: ${providerCount} providers, ${agentCount} agents`);
      console.log(`  Agent Weight: ${parsed.agentWeight}x`);
    }
    if (parsed.recursive) {
      console.log(`  ${COLORS.cyan}Recursive: enabled${COLORS.reset}`);
      console.log(`  Max Depth: ${parsed.maxDepth}`);
      console.log(`  Timeout Strategy: ${parsed.timeoutStrategy}`);
      console.log(`  Budget: ${(parsed.totalBudget / 1000).toFixed(0)}s`);
      console.log(`  Max Calls: ${parsed.maxCalls}`);
    }
  } else {
    // Simple progress indicator for non-verbose mode
    const recursiveLabel = parsed.recursive ? ' (recursive)' : '';
    process.stdout.write(`${ICONS.discuss} Discussing with ${availableProviders.length} providers${recursiveLabel}... `);
  }

  try {
    // Choose executor based on recursive flag
    let result: Awaited<ReturnType<DiscussionExecutor['execute']>> | RecursiveDiscussionResult;

    if (parsed.recursive) {
      // Use recursive executor
      const recursiveExecutor = new RecursiveDiscussionExecutor({
        providerExecutor: providerBridge,
        defaultTimeoutMs: parsed.timeout,
        checkProviderHealth: false, // Already checked above
        recursive: {
          enabled: true,
          maxDepth: parsed.maxDepth,
          allowSubDiscussions: true,
        },
        timeout: {
          strategy: parsed.timeoutStrategy,
          totalBudgetMs: parsed.totalBudget,
          minSynthesisMs: 10000,
        },
        cost: {
          maxTotalCalls: parsed.maxCalls,
          cascadingConfidence: {
            enabled: parsed.earlyExit,
            threshold: parsed.confidenceThreshold,
            minProviders: 2,
          },
        },
      });

      result = await recursiveExecutor.execute(config, {
        onProgress: createProgressHandler(options.verbose),
      });
    } else {
      // Use standard executor
      const discussionExecutor = new DiscussionExecutor({
        providerExecutor: providerBridge,
        defaultTimeoutMs: parsed.timeout,
        checkProviderHealth: false, // Already checked above
      });

      result = await discussionExecutor.execute(config, {
        onProgress: createProgressHandler(options.verbose),
      });
    }

    // Clear simple progress indicator if not verbose
    if (!options.verbose) {
      console.log(result.success ? ICONS.check : ICONS.cross);
    }

    // Handle JSON output
    if (options.format === 'json') {
      return {
        success: result.success,
        message: undefined,
        data: result,
        exitCode: result.success ? 0 : 1,
      };
    }

    // Format text output
    const message = formatDiscussionResult(result, options.verbose);

    return {
      success: result.success,
      message,
      data: result,
      exitCode: result.success ? 0 : 1,
    };
  } catch (error) {
    // Clear simple progress indicator if not verbose
    if (!options.verbose) {
      console.log(ICONS.cross);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Error during discussion: ${errorMessage}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
