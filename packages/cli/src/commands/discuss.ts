/**
 * Discuss Command - Multi-model discussion orchestration
 *
 * Usage: ax discuss <topic>
 *        ax discuss --providers claude,grok,gemini "Design a REST API"
 *        ax discuss --pattern debate "Is microservices better than monolith?"
 *
 * Enables multiple AI models to discuss a topic from their unique perspectives,
 * building consensus through various patterns and mechanisms.
 * Traces are emitted to SQLite for dashboard visibility.
 */

import { randomUUID } from 'node:crypto';
import type { CommandResult, CLIOptions } from '../types.js';

// Bootstrap imports - composition root provides adapter access
import {
  bootstrap,
  createProvider,
  getTraceStore,
  PROVIDER_CONFIGS,
  type CLIProviderConfig,
  type CompletionRequest,
} from '../bootstrap.js';
import type { TraceEvent } from '@defai.digital/contracts';

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
  DEFAULT_PROVIDER_TIMEOUT,
  DEFAULT_TOTAL_BUDGET_MS,
  DEFAULT_ROUNDS,
  DEFAULT_DISCUSSION_DEPTH,
  MAX_DISCUSSION_DEPTH,
  DEFAULT_MAX_TOTAL_CALLS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_AGENT_WEIGHT_MULTIPLIER,
  type DiscussionPattern,
  type ConsensusMethod,
  type DiscussStepConfig,
  type TimeoutStrategy,
  type DiscussionParticipant,
  getErrorMessage,
} from '@defai.digital/contracts';
import { COLORS, ICONS } from '../utils/terminal.js';

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
  providersExplicitlySpecified: boolean; // Track if user specified providers
  pattern: DiscussionPattern;
  rounds: number;
  consensus: ConsensusMethod;
  synthesizer: string | undefined;
  context: string | undefined;
  timeout: number;
  // Participant options (agents and providers)
  participants: DiscussionParticipant[] | undefined;
  agentWeight: number;
  // Performance optimization options
  fastMode: boolean;
  roundEarlyExit: boolean;
  roundAgreementThreshold: number;
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
// Model Selection
// ============================================================================

/**
 * Safely gets the default model for a provider
 * Returns the provider's default model, or first available, or 'default' placeholder
 */
function getModelForProviderConfig(
  config: CLIProviderConfig | undefined
): string {
  if (!config?.models || config.models.length === 0) {
    return 'default';
  }

  const defaultModel = config.models.find(m => m.isDefault);
  if (defaultModel !== undefined) {
    return defaultModel.modelId;
  }

  return config.models[0]?.modelId ?? 'default';
}

// ============================================================================
// Smart Provider Selection
// ============================================================================

/**
 * Randomly selects N items from an array (Fisher-Yates shuffle)
 */
function randomSelect<T>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];

  // Fisher-Yates shuffle
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled.slice(0, count);
}

/**
 * Result of smart provider selection
 */
interface SmartProviderSelectionResult {
  providers: string[];
  skipDiscussion: boolean;
  singleProvider?: string;
  error?: string;
}

/**
 * Smart provider selection:
 * - If providers specified: use them (checking availability)
 * - If not specified and ≥3 available: randomly pick 3
 * - If not specified and exactly 2 available: use both
 * - If not specified and exactly 1 available: skip discussion, use single provider
 * - If not specified and 0 available: error
 */
async function selectProvidersForCLI(
  specifiedProviders: string[],
  providersExplicitlySpecified: boolean,
  providerBridge: DiscussionProviderExecutor,
  verbose: boolean
): Promise<SmartProviderSelectionResult> {
  // If providers were explicitly specified, check their availability
  if (providersExplicitlySpecified && specifiedProviders.length > 0) {
    const availableProviders: string[] = [];
    for (const providerId of specifiedProviders) {
      const isAvailable = await providerBridge.isAvailable(providerId);
      if (isAvailable) {
        availableProviders.push(providerId);
        if (verbose) {
          console.log(`  ${ICONS.check} ${providerId}`);
        }
      } else if (verbose) {
        console.log(`  ${ICONS.cross} ${providerId} ${COLORS.dim}(not available)${COLORS.reset}`);
      }
    }

    if (availableProviders.length === 0) {
      return {
        providers: [],
        skipDiscussion: false,
        error: 'No specified providers are available. Run "ax doctor" to check provider status.',
      };
    }

    if (availableProviders.length === 1) {
      const singleProvider = availableProviders[0];
      if (singleProvider === undefined) {
        return {
          providers: [],
          skipDiscussion: false,
          error: 'No specified providers are available.',
        };
      }
      return {
        providers: [],
        skipDiscussion: true,
        singleProvider,
      };
    }

    return {
      providers: availableProviders,
      skipDiscussion: false,
    };
  }

  // No providers specified - get all available and use smart selection
  const allAvailable = await providerBridge.getAvailableProviders();

  if (allAvailable.length === 0) {
    return {
      providers: [],
      skipDiscussion: false,
      error: 'No providers available. Run "ax doctor" to check provider status.',
    };
  }

  if (allAvailable.length === 1) {
    const singleProvider = allAvailable[0];
    if (singleProvider === undefined) {
      return {
        providers: [],
        skipDiscussion: false,
        error: 'No providers available.',
      };
    }
    if (verbose) {
      console.log(`  ${ICONS.bullet} Only ${singleProvider} is available - using direct mode`);
    }
    return {
      providers: [],
      skipDiscussion: true,
      singleProvider,
    };
  }

  if (allAvailable.length === 2) {
    if (verbose) {
      console.log(`  ${ICONS.bullet} Using both available providers: ${allAvailable.join(', ')}`);
    }
    return {
      providers: allAvailable,
      skipDiscussion: false,
    };
  }

  // 3 or more available - randomly pick 3
  const selected = randomSelect(allAvailable, 3);
  if (verbose) {
    console.log(`  ${ICONS.bullet} Randomly selected from ${allAvailable.length} available: ${selected.join(', ')}`);
  }
  return {
    providers: selected,
    skipDiscussion: false,
  };
}

/**
 * Call a single provider directly (when only 1 provider available)
 */
async function callSingleProviderCLI(
  topic: string,
  providerId: string,
  providerBridge: DiscussionProviderExecutor,
  timeout: number,
  options: CLIOptions,
  traceStore: ReturnType<typeof getTraceStore>,
  traceId: string,
  _startTime: string // Kept for API consistency, used in caller for trace start event
): Promise<CommandResult> {
  const callStartTime = Date.now();

  if (!options.verbose) {
    process.stdout.write(`${ICONS.discuss} Asking ${providerId} directly... `);
  }

  try {
    const result = await providerBridge.execute({
      providerId,
      prompt: topic,
      timeoutMs: timeout,
    });

    if (!options.verbose) {
      console.log(result.success ? ICONS.check : ICONS.cross);
    }

    const durationMs = Date.now() - callStartTime;

    // Emit trace event
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'discussion.end',
      timestamp: new Date().toISOString(),
      durationMs,
      status: result.success ? 'success' : 'failure',
      context: { providerId },
      payload: {
        success: result.success,
        command: 'ax discuss',
        pattern: 'direct',
        providers: [providerId],
        singleProviderMode: true,
        durationMs,
      },
    });

    if (!result.success) {
      return {
        success: false,
        message: `Provider ${providerId} failed: ${result.error}`,
        data: undefined,
        exitCode: 1,
      };
    }

    const lines: string[] = [];
    lines.push('');
    lines.push(`${COLORS.bold}${ICONS.discuss} Direct Response${COLORS.reset}`);
    lines.push('─'.repeat(50));
    lines.push(`Provider: ${COLORS.cyan}${providerId}${COLORS.reset}`);
    lines.push(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
    lines.push(`${COLORS.dim}(Only 1 provider available - discussion skipped)${COLORS.reset}`);
    lines.push('');
    lines.push(`${COLORS.bold}Response${COLORS.reset}`);
    lines.push('─'.repeat(50));
    lines.push(result.content ?? '');

    if (options.format === 'json') {
      const response = {
        success: true,
        pattern: 'direct',
        topic,
        participatingProviders: [providerId],
        failedProviders: [],
        synthesis: result.content ?? '',
        totalDurationMs: durationMs,
        consensus: { method: 'direct', synthesizer: providerId, agreementScore: 1.0 },
        metadata: { singleProviderMode: true },
      };
      return {
        success: true,
        message: undefined,
        data: response,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { success: true, synthesis: result.content, provider: providerId, durationMs },
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (!options.verbose) {
      console.log(ICONS.cross);
    }

    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'discussion.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - callStartTime,
      status: 'failure',
      context: { providerId },
      payload: {
        success: false,
        command: 'ax discuss',
        providers: [providerId],
        singleProviderMode: true,
        error: errorMessage,
      },
    });

    return {
      success: false,
      message: `Error calling ${providerId}: ${errorMessage}`,
      data: undefined,
      exitCode: 1,
    };
  }
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
          requestId: randomUUID(),
          messages: [{ role: 'user', content: request.prompt }],
          model: getModelForProviderConfig(config),
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
          error: getErrorMessage(error),
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
 * Helper to parse integer with warning on invalid input
 */
function parseIntWithWarning(value: string | undefined, defaultValue: number, argName: string): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Warning: Invalid value "${value}" for ${argName}, using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Helper to parse float with warning on invalid input
 */
function parseFloatWithWarning(value: string | undefined, defaultValue: number, argName: string): number {
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(`Warning: Invalid value "${value}" for ${argName}, using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Parses discuss command arguments
 */
function parseDiscussArgs(args: string[], _options: CLIOptions): ParsedDiscussArgs {
  let topic: string | undefined;
  let providers: string[] = [];
  let providersExplicitlySpecified = false;
  let pattern: DiscussionPattern = 'synthesis';
  let rounds = DEFAULT_ROUNDS;
  let consensus: ConsensusMethod = 'synthesis';
  let synthesizer: string | undefined;
  let context: string | undefined;
  let timeout = DEFAULT_PROVIDER_TIMEOUT;
  // Participant options
  let participants: DiscussionParticipant[] | undefined;
  let agentWeight = DEFAULT_AGENT_WEIGHT_MULTIPLIER; // (INV-DISC-642)
  // Performance optimization options
  let fastMode = false;
  let roundEarlyExit = true; // Enabled by default
  let roundAgreementThreshold = 0.85;
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
      providersExplicitlySpecified = true;
    } else if (arg === '--pattern' && i + 1 < args.length) {
      pattern = args[++i] as DiscussionPattern;
    } else if (arg === '--rounds' && i + 1 < args.length) {
      const rawValue = args[++i];
      rounds = parseIntWithWarning(rawValue, DEFAULT_ROUNDS, '--rounds');
    } else if (arg === '--consensus' && i + 1 < args.length) {
      consensus = args[++i] as ConsensusMethod;
    } else if (arg === '--synthesizer' && i + 1 < args.length) {
      synthesizer = args[++i];
    } else if (arg === '--context' && i + 1 < args.length) {
      context = args[++i];
    } else if (arg === '--timeout' && i + 1 < args.length) {
      const rawValue = args[++i];
      timeout = parseIntWithWarning(rawValue, DEFAULT_PROVIDER_TIMEOUT, '--timeout');
    }
    // Participant options (agents and providers)
    else if (arg === '--participants' && i + 1 < args.length) {
      // Parse participant list: "claude,grok,reviewer:agent,security:agent"
      const participantStr = args[++i] ?? '';
      participants = parseParticipantList(participantStr);
    } else if (arg === '--agent-weight' && i + 1 < args.length) {
      // Agent weight multiplier (0.5 - 3.0)
      const rawValue = args[++i];
      const parsed = parseFloatWithWarning(rawValue, DEFAULT_AGENT_WEIGHT_MULTIPLIER, '--agent-weight');
      agentWeight = Math.max(0.5, Math.min(3.0, parsed));
    }
    // Performance optimization options
    else if (arg === '--fast' || arg === '-f') {
      // Fast mode: single round, skip cross-discussion
      fastMode = true;
      rounds = 1; // Override to single round
    } else if (arg === '--no-round-early-exit') {
      // Disable round-level early exit
      roundEarlyExit = false;
    } else if (arg === '--round-threshold' && i + 1 < args.length) {
      // Agreement threshold for round early exit (0.5-1.0)
      const rawValue = args[++i];
      const parsed = parseFloatWithWarning(rawValue, 0.85, '--round-threshold');
      roundAgreementThreshold = Math.max(0.5, Math.min(1.0, parsed));
    }
    // Recursive discussion options
    else if (arg === '--recursive' || arg === '-r') {
      recursive = true;
    } else if (arg === '--max-depth' && i + 1 < args.length) {
      const rawValue = args[++i];
      maxDepth = parseIntWithWarning(rawValue, DEFAULT_DISCUSSION_DEPTH, '--max-depth');
      // Validate max-depth is within bounds (1-4)
      if (maxDepth < 1 || maxDepth > MAX_DISCUSSION_DEPTH) {
        console.warn(`Warning: --max-depth must be between 1 and ${MAX_DISCUSSION_DEPTH}. Clamping to valid range.`);
        maxDepth = Math.max(1, Math.min(maxDepth, MAX_DISCUSSION_DEPTH));
      }
      recursive = true; // Implies recursive
    } else if (arg === '--timeout-strategy' && i + 1 < args.length) {
      timeoutStrategy = args[++i] as TimeoutStrategy;
    } else if (arg === '--budget' && i + 1 < args.length) {
      // Parse budget like "180s", "3m", or "180000"
      const budgetStr = args[++i] ?? '';
      let parsed: number;
      if (budgetStr.endsWith('s')) {
        const numPart = budgetStr.slice(0, -1);
        parsed = parseInt(numPart, 10) * 1000;
        if (isNaN(parsed)) {
          console.warn(`Warning: Invalid budget format "${budgetStr}", expected format like "180s", "3m", or "180000". Using default.`);
          parsed = DEFAULT_TOTAL_BUDGET_MS;
        }
      } else if (budgetStr.endsWith('m')) {
        const numPart = budgetStr.slice(0, -1);
        parsed = parseInt(numPart, 10) * 60000;
        if (isNaN(parsed)) {
          console.warn(`Warning: Invalid budget format "${budgetStr}", expected format like "180s", "3m", or "180000". Using default.`);
          parsed = DEFAULT_TOTAL_BUDGET_MS;
        }
      } else {
        parsed = parseInt(budgetStr, 10);
        if (isNaN(parsed)) {
          console.warn(`Warning: Invalid budget format "${budgetStr}", expected format like "180s", "3m", or "180000". Using default.`);
          parsed = DEFAULT_TOTAL_BUDGET_MS;
        }
      }
      totalBudget = parsed;
    } else if (arg === '--max-calls' && i + 1 < args.length) {
      const rawValue = args[++i];
      maxCalls = parseIntWithWarning(rawValue, DEFAULT_MAX_TOTAL_CALLS, '--max-calls');
    } else if (arg === '--early-exit') {
      earlyExit = true;
    } else if (arg === '--no-early-exit') {
      earlyExit = false;
    } else if (arg === '--confidence-threshold' && i + 1 < args.length) {
      const rawValue = args[++i];
      confidenceThreshold = parseFloatWithWarning(rawValue, DEFAULT_CONFIDENCE_THRESHOLD, '--confidence-threshold');
    } else if (arg !== undefined && !arg.startsWith('-')) {
      // Positional argument is the topic
      if (topic === undefined) {
        // Collect consecutive non-flag args as topic, then continue parsing remaining flags
        const topicParts: string[] = [];
        let j = i;
        for (; j < args.length; j++) {
          const part = args[j];
          if (part?.startsWith('-')) break;
          topicParts.push(part ?? '');
        }
        topic = topicParts.join(' ');
        // Skip over the topic parts we just consumed (minus 1 because the for loop will increment i)
        i = j - 1;
      }
    }
  }

  // Note: providers are NOT defaulted here - smart selection happens in the command handler
  return {
    topic,
    providers,
    providersExplicitlySpecified,
    pattern,
    rounds,
    consensus,
    synthesizer,
    context,
    timeout,
    participants,
    agentWeight,
    fastMode,
    roundEarlyExit,
    roundAgreementThreshold,
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
 * Trace context for progress handler
 */
interface ProgressTraceContext {
  traceStore: Awaited<ReturnType<typeof getTraceStore>>;
  traceId: string;
}

/**
 * Creates a progress handler for verbose output and trace event emission (Phase 2)
 * Emits granular trace events: discussion.provider, discussion.round, discussion.consensus
 */
function createProgressHandler(
  verbose: boolean,
  traceContext?: ProgressTraceContext
): (event: DiscussionProgressEvent) => void {
  return (event: DiscussionProgressEvent) => {
    // Console output for verbose mode
    if (verbose) {
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
    }

    // Emit trace events for dashboard visibility (Phase 2: Granular Events)
    if (traceContext) {
      const { traceStore, traceId } = traceContext;

      switch (event.type) {
        case 'provider_complete':
          // Emit discussion.provider trace event with conversation content
          if (event.provider && event.round !== undefined) {
            traceStore.write({
              eventId: randomUUID(),
              traceId,
              type: 'discussion.provider',
              timestamp: event.timestamp,
              durationMs: event.durationMs,
              status: event.success ? 'success' : 'failure',
              context: {
                providerId: event.provider,
              },
              payload: {
                providerId: event.provider,
                roundNumber: event.round,
                success: event.success ?? false,
                durationMs: event.durationMs ?? 0,
                tokenCount: event.tokenCount,
                role: event.role,
                error: event.error,
                // Conversation content for dashboard visibility
                prompt: event.prompt,
                content: event.content,
              },
            }).catch((err) => {
              // Fire-and-forget with error logging
              console.error('[discuss] Failed to write provider trace event:', err);
            });
          }
          break;

        case 'round_complete':
          // Emit discussion.round trace event
          if (event.round !== undefined) {
            traceStore.write({
              eventId: randomUUID(),
              traceId,
              type: 'discussion.round',
              timestamp: event.timestamp,
              durationMs: event.durationMs,
              context: {},
              payload: {
                roundNumber: event.round,
                participatingProviders: event.participatingProviders ?? [],
                failedProviders: event.failedProviders,
                responseCount: event.responseCount ?? 0,
                durationMs: event.durationMs ?? 0,
              },
            }).catch((err) => {
              console.error('[discuss] Failed to write round trace event:', err);
            });
          }
          break;

        case 'consensus_complete':
          // Emit discussion.consensus trace event
          traceStore.write({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.consensus',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            status: event.success ? 'success' : 'failure',
            context: {},
            payload: {
              method: event.consensusMethod ?? 'synthesis',
              success: event.success ?? false,
              winner: event.winner,
              confidence: event.confidence,
              votes: event.votes,
              durationMs: event.durationMs ?? 0,
            },
          }).catch((err) => {
            console.error('[discuss] Failed to write consensus trace event:', err);
          });
          break;
      }
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
  --providers       Comma-separated list of providers (default: claude,grok,gemini)
  --pattern         Discussion pattern: ${patterns}
  --rounds          Number of discussion rounds (default: 2)
  --consensus       Consensus method: ${consensusMethods}
  --synthesizer     Provider for synthesis (default: claude)
  --context         Additional context for the discussion
  --timeout         Per-provider timeout in ms (default: 600000/10min, max: 30 min)
  --verbose, -v     Show detailed progress
  --format          Output format: text (default) or json

${COLORS.bold}Performance Options:${COLORS.reset}
  --fast, -f            Fast mode: single round, skip cross-discussion (~50% faster)
  --no-round-early-exit Disable round-level early exit on high agreement
  --round-threshold     Agreement threshold for round early exit (default: 0.85)

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
  ax discuss --providers claude,grok,gemini "Design a REST API"
  ax discuss --pattern debate "Is functional programming better than OOP?"
  ax discuss --pattern voting "Which framework: React, Vue, or Angular?"
  ax discuss --verbose --rounds 3 "Optimize database queries"

  ${COLORS.cyan}# Fast mode (single round, ~50% faster)${COLORS.reset}
  ax discuss --fast "What is TypeScript?"
  ax discuss -f "Explain microservices"

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
 * Discuss command handler with trace integration
 */
export async function discussCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Show help if requested
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return showDiscussHelp();
  }

  // Initialize bootstrap to get SQLite trace store
  await bootstrap();

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
        '--providers', 'claude,grok,gemini',
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

  // Validate explicitly specified providers
  if (parsed.providersExplicitlySpecified) {
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
  }

  // Create provider bridge
  const providerBridge = createProviderBridge(PROVIDER_CONFIGS);

  // Create trace for dashboard visibility
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();

  // Smart provider selection
  if (options.verbose) {
    console.log(`${COLORS.bold}Selecting providers...${COLORS.reset}`);
  }

  const selection = await selectProvidersForCLI(
    parsed.providers,
    parsed.providersExplicitlySpecified,
    providerBridge,
    options.verbose
  );

  // Handle selection errors
  if (selection.error) {
    return {
      success: false,
      message: `Error: ${selection.error}`,
      data: undefined,
      exitCode: 1,
    };
  }

  // If only 1 provider available, skip discussion and call directly
  if (selection.skipDiscussion && selection.singleProvider) {
    // Emit run.start trace event
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'discussion.start',
      timestamp: startTime,
      context: { providerId: selection.singleProvider },
      payload: {
        command: 'ax discuss',
        topic: parsed.topic,
        pattern: 'direct',
        providers: [selection.singleProvider],
        singleProviderMode: true,
      },
    });

    return callSingleProviderCLI(
      parsed.topic,
      selection.singleProvider,
      providerBridge,
      parsed.timeout,
      options,
      traceStore,
      traceId,
      startTime
    );
  }

  const availableProviders = selection.providers;

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
    // Performance optimization options
    fastMode: parsed.fastMode,
    roundEarlyExit: {
      enabled: parsed.roundEarlyExit,
      agreementThreshold: parsed.roundAgreementThreshold,
      minRounds: 1,
    },
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
    if (parsed.fastMode) {
      console.log(`  ${COLORS.cyan}Fast Mode: enabled (single round)${COLORS.reset}`);
    }
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
    const fastLabel = parsed.fastMode ? ' (fast)' : '';
    const recursiveLabel = parsed.recursive ? ' (recursive)' : '';
    process.stdout.write(`${ICONS.discuss} Discussing with ${availableProviders.length} providers${fastLabel}${recursiveLabel}... `);
  }

  // Emit run.start trace event with full topic
  // INV-TR-010: Include participating providers for drill-down
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'discussion.start',
    timestamp: startTime,
    context: {
      // For discussions with multiple providers, store first provider as primary
      // All providers are listed in payload.providers
      providerId: availableProviders[0], // Primary provider for filtering
    },
    payload: {
      command: 'ax discuss',
      topic: parsed.topic, // Full topic for dashboard
      topicLength: parsed.topic.length,
      pattern: parsed.pattern,
      consensus: parsed.consensus,
      providers: availableProviders,
      rounds: parsed.rounds,
      recursive: parsed.recursive,
      maxDepth: parsed.recursive ? parsed.maxDepth : undefined,
      context: parsed.context,
    },
  };
  await traceStore.write(startEvent);

  const discussStartTime = Date.now();

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
        onProgress: createProgressHandler(options.verbose, { traceStore, traceId }),
      });
    } else {
      // Use standard executor
      const discussionExecutor = new DiscussionExecutor({
        providerExecutor: providerBridge,
        defaultTimeoutMs: parsed.timeout,
        checkProviderHealth: false, // Already checked above
      });

      result = await discussionExecutor.execute(config, {
        onProgress: createProgressHandler(options.verbose, { traceStore, traceId }),
      });
    }

    // Clear simple progress indicator if not verbose
    if (!options.verbose) {
      console.log(result.success ? ICONS.check : ICONS.cross);
    }

    // Emit discussion.end trace event with full details
    const durationMs = Date.now() - discussStartTime;

    // Extract provider responses from rounds for dashboard
    const providerResponses: Record<string, string[]> = {};
    if (result.rounds) {
      for (const round of result.rounds) {
        for (const response of round.responses ?? []) {
          const providerId = response.provider ?? 'unknown';
          if (!providerResponses[providerId]) {
            providerResponses[providerId] = [];
          }
          providerResponses[providerId].push(response.content ?? '');
        }
      }
    }

    // INV-TR-010: Include participating providers for drill-down
    const endEvent: TraceEvent = {
      eventId: randomUUID(),
      traceId,
      type: 'discussion.end',
      timestamp: new Date().toISOString(),
      durationMs,
      status: result.success ? 'success' : 'failure',
      context: {
        providerId: availableProviders[0], // Primary provider for filtering
      },
      payload: {
        success: result.success,
        command: 'ax discuss',
        pattern: parsed.pattern,
        providers: availableProviders,
        roundCount: result.rounds?.length ?? parsed.rounds,
        durationMs,
        consensusReached: result.consensus !== undefined,
        consensus: result.consensus, // Consensus metadata (method, agreementScore, etc.)
        synthesis: result.synthesis, // Final synthesized text for dashboard
        responses: providerResponses, // Provider responses by provider ID
        // Summary for quick view
        totalResponses: Object.values(providerResponses).flat().length,
      },
    };
    await traceStore.write(endEvent);

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

    // Emit error trace event
    // INV-TR-010: Include participating providers for drill-down
    const durationMs = Date.now() - discussStartTime;
    const errorMessage = getErrorMessage(error);
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'discussion.end',
      timestamp: new Date().toISOString(),
      durationMs,
      status: 'failure',
      context: {
        providerId: availableProviders[0], // Primary provider for filtering
      },
      payload: {
        success: false,
        command: 'ax discuss',
        providers: availableProviders,
        error: errorMessage,
      },
    });

    return {
      success: false,
      message: `Error during discussion: ${errorMessage}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
