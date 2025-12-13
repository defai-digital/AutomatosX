/**
 * MCP Tool: run_agent (v10.6.0 - Smart Routing + MCP Client Pool)
 *
 * Executes an AutomatosX agent with a task.
 * Uses Smart Routing to optimize for same-provider calls:
 * - mode='auto' (default): Returns context if caller == best provider, otherwise spawns
 * - mode='context': Always returns context for AI assistant to execute
 * - mode='execute': Always spawns provider (cross-provider execution)
 *
 * v10.6.0: Cross-provider execution uses MCP Client Pool for faster subsequent calls.
 * Falls back to CLI spawn if MCP connection fails.
 *
 * v12.9.0: Added iterate mode with auto-answer support for autonomous execution.
 */

import type { ToolHandler, RunAgentInput, RunAgentOutput, McpSession } from '../types.js';
import { AgentExecutor } from '../../agents/executor.js';
import { ContextManager } from '../../agents/context-manager.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { AgentSelector } from '../../agents/agent-selector.js';
import { Router } from '../../core/router/router.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../shared/logging/logger.js';
import { formatError } from '../../shared/errors/error-formatter.js';
import { validateAgentName, validateStringParameter } from '../utils/validation.js';
import { mapMcpProviderToActual, mapActualProviderToMcp, mapNormalizedCallerToActual } from '../utils/provider-mapping.js';
import { McpClientPool } from '../../providers/mcp/pool-manager.js';
import type { CrossProviderResult, ExecutionMode } from '../../providers/mcp/types.js';
import { TIMEOUTS } from '../../core/validation-limits.js';
import { sendMcpProgress } from '../streaming-notifier.js';
// v12.9.0: Iterate mode support
import { IterateModeController } from '../../core/iterate/iterate-mode-controller.js';
import { DEFAULT_MUST_PAUSE_PATTERNS } from '../../core/iterate/question-responder.js';
import type { IterateConfig } from '../../types/iterate.js';

/**
 * v12.5.3: Helper to check if request was cancelled
 * Reduces duplicated abort checks throughout the handler
 */
function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Request was cancelled');
  }
}

/**
 * Provider-specific MCP tool names
 *
 * External providers with MCP servers expose different tools:
 * - Codex: 'codex' tool for task execution
 * - Claude: 'Task' tool for agent-like tasks
 * - Gemini: 'execute' tool for tasks
 *
 * Note: These map to provider-specific tool interfaces, not 'run_agent'
 * which is an AutomatosX-specific tool.
 *
 * **SDK-based providers NOT supported via MCP pool:**
 * - ax-glm (GLM/Zhipu AI): Uses direct SDK, no MCP server
 * - ax-grok (Grok/xAI): Uses direct SDK, no MCP server
 * - glm: Alias for ax-glm
 * - grok: Alias for ax-grok
 *
 * These providers should fall through to CLI spawn, which internally
 * uses the SDK adapter for direct API calls.
 */
const PROVIDER_MCP_TOOLS: Record<string, { tool: string; buildArgs: (agent: string, task: string) => Record<string, unknown> }> = {
  codex: {
    tool: 'codex',
    buildArgs: (_agent: string, task: string) => ({ prompt: task })
  },
  openai: {
    tool: 'codex',
    buildArgs: (_agent: string, task: string) => ({ prompt: task })
  },
  claude: {
    tool: 'Task',
    buildArgs: (agent: string, task: string) => ({
      description: `Execute ${agent} task`,
      prompt: task,
      subagent_type: 'general-purpose'
    })
  },
  'claude-code': {
    tool: 'Task',
    buildArgs: (agent: string, task: string) => ({
      description: `Execute ${agent} task`,
      prompt: task,
      subagent_type: 'general-purpose'
    })
  },
  gemini: {
    tool: 'execute',
    buildArgs: (_agent: string, task: string) => ({ task })
  },
  'gemini-cli': {
    tool: 'execute',
    buildArgs: (_agent: string, task: string) => ({ task })
  }
  // ax-glm, ax-grok, glm, grok: NOT listed here - intentionally fall through to CLI spawn
};

/**
 * Execute task via MCP Client Pool (cross-provider execution)
 *
 * v12.5.6: Fixed to call provider-specific tools instead of 'run_agent'
 * External providers (Codex, Claude, Gemini) don't have 'run_agent' tool -
 * that's an AutomatosX-specific tool.
 */
async function executeViaMcpPool(
  provider: string,
  agent: string,
  task: string,
  pool: McpClientPool
): Promise<CrossProviderResult> {
  const startTime = Date.now();
  const client = await pool.acquire(provider);

  // Get provider-specific tool configuration
  const providerConfig = PROVIDER_MCP_TOOLS[provider];
  if (!providerConfig) {
    pool.release(provider, client);
    throw new Error(`MCP pool execution not supported for provider: ${provider}. Use CLI spawn instead.`);
  }

  try {
    const result = await client.callTool(
      providerConfig.tool,
      providerConfig.buildArgs(agent, task)
    );

    const content = (result.content ?? [])
      .filter((c): c is { type: 'text'; text: string } => c?.type === 'text')
      .map(c => c.text ?? '')
      .join('\n');

    return {
      content,
      executionMode: 'mcp_pooled',
      latencyMs: Date.now() - startTime,
      provider
    };
  } finally {
    pool.release(provider, client);
  }
}

/**
 * Default timeout for MCP-initiated agent executions
 * v12.5.3: Uses centralized TIMEOUTS.MCP_AGENT_EXECUTION (30 minutes)
 * This prevents agent processes from hanging indefinitely when called via MCP.
 * Can be overridden by explicit timeout in execution config.
 */
const MCP_DEFAULT_AGENT_TIMEOUT_MS = TIMEOUTS.MCP_AGENT_EXECUTION;

/**
 * Iterate mode options for MCP execution
 * v12.9.0: Added for autonomous iterate mode support
 */
interface IterateModeOptions {
  /** Number of iterations */
  iterations: number;
  /** Enable auto-answer for technical questions */
  autoAnswer?: boolean;
  /** Provider for auto-answering questions */
  autoAnswerProvider?: 'gemini' | 'claude' | 'openai' | 'glm' | 'grok';
  /** Confidence threshold for auto-answers */
  autoAnswerThreshold?: number;
}

/**
 * Execute task via CLI spawn (traditional execution)
 * v12.9.0: Added iterate mode support with auto-answer
 */
async function executeViaCli(
  agent: string,
  task: string,
  actualProvider: string | undefined,
  no_memory: boolean | undefined,
  deps: RunAgentDependencies,
  isFallback: boolean,
  signal?: AbortSignal,
  timeout?: number,
  iterateOptions?: IterateModeOptions
): Promise<RunAgentOutput> {
  const context = await deps.contextManager.createContext(agent, task, {
    provider: actualProvider,
    skipMemory: no_memory
  });

  const executor = new AgentExecutor(deps.executorConfig);
  const startTime = Date.now();

  // v12.5.3: Apply default timeout for MCP-initiated executions to prevent hangs
  const effectiveTimeout = timeout ?? MCP_DEFAULT_AGENT_TIMEOUT_MS;

  // v12.9.0: Set up iterate mode if enabled
  let iterateController: IterateModeController | undefined;
  let iterateStats: RunAgentOutput['iterateStats'];

  if (iterateOptions && iterateOptions.iterations > 0) {
    const iterateConfig: IterateConfig = {
      enabled: true,
      defaults: {
        maxDurationMinutes: 120,
        maxTotalTokens: 1000000,
        maxTokensPerIteration: 50000,
        warnAtTokenPercent: [75, 90],
        maxIterationsPerRun: iterateOptions.iterations,
        maxIterationsPerStage: Math.min(50, iterateOptions.iterations),
        maxAutoResponsesPerStage: 30,
        autoConfirmCheckpoints: true
      },
      classifier: {
        patternLibraryPath: '', // Empty = use semantic scoring only
        strictness: 'balanced',
        enableSemanticScoring: true,
        semanticScoringThreshold: 0.80,
        contextWindowMessages: 10
      },
      safety: {
        enableDangerousOperationGuard: true,
        riskTolerance: 'balanced',
        dangerousOperations: {
          fileDelete: 'MEDIUM',
          gitForce: 'HIGH',
          writeOutsideWorkspace: 'HIGH',
          secretsInCode: 'HIGH',
          shellCommands: 'MEDIUM',
          packageInstall: 'MEDIUM',
          databaseDrop: 'HIGH',
          databaseTruncate: 'HIGH',
          databaseDelete: 'HIGH'
        },
        enableTimeTracking: true,
        enableIterationTracking: true
      },
      telemetry: {
        level: 'info',
        logAutoResponses: true,
        logClassifications: true,
        logSafetyChecks: true,
        emitMetrics: true
      },
      notifications: {
        warnAtTimePercent: [75, 90],
        pauseOnGenuineQuestion: true,
        pauseOnHighRiskOperation: true
      },
      // v12.9.0: Question responder configuration
      questionResponder: iterateOptions.autoAnswer ? {
        enabled: true,
        provider: iterateOptions.autoAnswerProvider || 'gemini',
        confidenceThreshold: iterateOptions.autoAnswerThreshold || 0.7,
        maxAutoAnswers: 50,
        timeout: 30000,
        mustPausePatterns: DEFAULT_MUST_PAUSE_PATTERNS
      } : undefined
    };

    iterateController = new IterateModeController(iterateConfig);

    // Set up provider executor for question answering if auto-answer is enabled
    if (iterateOptions.autoAnswer) {
      const questionAnswerProvider = iterateOptions.autoAnswerProvider || 'gemini';
      sendMcpProgress(`Setting up auto-answer with ${questionAnswerProvider}...`);

      const providerConfig = {
        name: questionAnswerProvider,
        enabled: true,
        priority: 1,
        timeout: 30000
      };

      // Dynamic import providers based on selection to avoid loading all providers
      let qaProvider;
      switch (questionAnswerProvider) {
        case 'claude': {
          const { ClaudeProvider } = await import('../../providers/claude-provider.js');
          qaProvider = new ClaudeProvider(providerConfig);
          break;
        }
        case 'openai': {
          const { OpenAIProvider } = await import('../../providers/openai-provider.js');
          qaProvider = new OpenAIProvider(providerConfig);
          break;
        }
        case 'glm': {
          const { GLMProvider } = await import('../../providers/glm-provider.js');
          qaProvider = new GLMProvider(providerConfig);
          break;
        }
        case 'grok': {
          const { GrokProvider } = await import('../../providers/grok-provider.js');
          qaProvider = new GrokProvider(providerConfig);
          break;
        }
        case 'gemini':
        default: {
          const { GeminiProvider } = await import('../../providers/gemini-provider.js');
          qaProvider = new GeminiProvider(providerConfig);
          break;
        }
      }

      const sessionId = `mcp-qa-${Date.now()}`;
      iterateController.setProviderExecutor(
        async (request) => qaProvider.execute(request),
        sessionId
      );
    }

    sendMcpProgress(`Running ${iterateOptions.iterations} iteration(s) with ${iterateOptions.autoAnswer ? 'auto-answer' : 'manual'} mode...`);
  }

  const result = await executor.execute(context, {
    showProgress: false,
    verbose: false,
    signal,
    timeout: effectiveTimeout,
    // v12.9.0: Pass iterate hooks if controller is set up
    hooks: iterateController ? {
      onPostResponse: async (response) => iterateController!.handleResponse(response)
    } : undefined
  });
  const latencyMs = Date.now() - startTime;

  // v12.9.0: Collect iterate stats if controller was used
  if (iterateController) {
    const stats = iterateController.getStats();
    const qrStats = stats.questionResponder;
    iterateStats = {
      iterations: stats.totalIterations || 1,
      autoAnswered: qrStats?.autoAnswered || 0,
      pausedForUser: qrStats?.pausedForUser || 0,
      tokensUsed: qrStats?.tokensUsed || 0
    };
  }

  const executionMode: ExecutionMode = isFallback ? 'cli_fallback' : 'cli_spawn';

  return {
    content: result.response.content,
    agent: context.agent.name,
    tokens: result.response.tokensUsed
      ? {
          prompt: result.response.tokensUsed.prompt,
          completion: result.response.tokensUsed.completion,
          total: result.response.tokensUsed.total
        }
      : undefined,
    latencyMs,
    routingDecision: 'executed',
    executionMode,
    iterateStats
  };
}

export interface RunAgentDependencies {
  contextManager: ContextManager;
  executorConfig: {
    sessionManager?: any;
    workspaceManager?: any;
    contextManager?: ContextManager;
    profileLoader?: any;
  };
  // v10.5.0: Smart Routing dependencies
  getSession?: () => McpSession | null;
  router?: Router;
  profileLoader?: ProfileLoader;
  memoryManager?: IMemoryManager;
  // v10.6.0: MCP Client Pool for cross-provider execution
  mcpPool?: McpClientPool;
  /** Cross-provider execution mode: 'mcp' | 'cli' | 'auto' (default: 'auto') */
  crossProviderMode?: 'mcp' | 'cli' | 'auto';
}


/** Memory result type for context building */
type MemoryResult = { id: number; content: string; similarity: number };

/**
 * Search memory for relevant context (silently fails)
 */
async function searchMemoryForContext(
  memoryManager: IMemoryManager | undefined,
  task: string,
  limit = 5
): Promise<MemoryResult[]> {
  if (!memoryManager) return [];

  try {
    const results = await memoryManager.search({ text: task, limit });
    return results.map(r => ({
      id: r.entry.id,
      content: r.entry.content.substring(0, 500),
      similarity: r.similarity || 0
    }));
  } catch (error) {
    logger.debug('[Smart Routing] Memory search failed', { error });
    return [];
  }
}

/**
 * Build enhanced prompt from system prompt, memory, and task
 */
function buildEnhancedPrompt(
  systemPrompt: string,
  memory: MemoryResult[],
  task: string
): string {
  const memoryContext = memory.length > 0
    ? `\n\nRelevant context from memory:\n${memory.map(m => `- ${m.content}`).join('\n')}`
    : '';
  return `${systemPrompt}${memoryContext}\n\n---\n\nTask: ${task}`;
}

/**
 * Build agent context for Smart Routing response
 */
async function buildAgentContext(
  agentName: string,
  task: string,
  deps: RunAgentDependencies,
  callerProvider: string,
  bestProvider: string
): Promise<RunAgentOutput['agentContext']> {
  const startTime = Date.now();

  // Load profile and search memory concurrently
  const [profile, relevantMemory] = await Promise.all([
    deps.profileLoader?.loadProfile(agentName) ?? null,
    searchMemoryForContext(deps.memoryManager, task)
  ]);

  const systemPrompt = profile?.systemPrompt || `You are ${agentName}, a specialized AI assistant.`;
  const expertise = profile?.abilities || [];
  const enhancedPrompt = buildEnhancedPrompt(systemPrompt, relevantMemory, task);

  const duration = Date.now() - startTime;
  logger.debug('[Smart Routing] Built agent context', {
    agentName,
    profileFound: !!profile,
    memoryResults: relevantMemory.length,
    duration: `${duration}ms`
  });

  return {
    agentProfile: {
      name: agentName,
      role: profile?.role || agentName,
      expertise,
      systemPrompt
    },
    relevantMemory,
    enhancedPrompt,
    detectedCaller: callerProvider,
    recommendedProvider: bestProvider
  };
}

export function createRunAgentHandler(
  deps: RunAgentDependencies
): ToolHandler<RunAgentInput, RunAgentOutput> {
  return async (input: RunAgentInput, context?: { signal?: AbortSignal }): Promise<RunAgentOutput> => {
    const {
      task,
      provider,
      no_memory,
      mode = 'auto',
      // v12.9.0: Iterate mode parameters
      iterate,
      autoAnswer,
      autoAnswerProvider,
      autoAnswerThreshold
    } = input;
    let { agent } = input;

    checkAborted(context?.signal);

    // Validate task first
    validateStringParameter(task, 'task', {
      required: true,
      minLength: 1,
      maxLength: 10000
    });

    // v12.5.1: Auto-select agent if not provided
    let autoSelected = false;
    if (!agent && deps.profileLoader) {
      sendMcpProgress('Auto-selecting best agent...');
      const selector = new AgentSelector(deps.profileLoader);
      const selection = await selector.selectAgent(task);
      agent = selection.agent;
      autoSelected = true;
      sendMcpProgress(`Selected: ${agent} (${selection.confidence} confidence)`);
      logger.info('[MCP] run_agent auto-selected agent', {
        task: task.substring(0, 100),
        selectedAgent: agent,
        confidence: selection.confidence,
        score: selection.score,
        rationale: selection.rationale
      });
    }

    // Validate agent name (now guaranteed to exist)
    if (!agent) {
      throw new Error('Agent name is required when profileLoader is not available');
    }
    validateAgentName(agent);

    // Map MCP provider name to actual provider name
    const actualProvider = mapMcpProviderToActual(provider);

    // v10.5.0: Get session for Smart Routing
    const session = deps.getSession?.() || null;
    const callerProvider = session?.normalizedProvider || 'unknown';
    const callerActual = mapNormalizedCallerToActual(callerProvider);

    logger.info('[MCP] run_agent called (Smart Routing v10.5.0)', {
      agent,
      autoSelected,
      task: task.substring(0, 100),
      mcpProvider: provider,
      actualProvider,
      mode,
      callerProvider,
      callerActual,
      no_memory,
      // v12.9.0: Iterate mode logging
      iterate,
      autoAnswer,
      autoAnswerProvider
    });

    // Determine best provider (from router or use specified)
    let bestProvider = actualProvider || 'claude-code';
    if (!actualProvider && deps.router) {
      // Let router select best provider
      const selectedProvider = await deps.router.selectProvider();
      bestProvider = selectedProvider?.name || 'claude-code';
    }

    // v10.5.0: Smart Routing Decision
    const shouldReturnContext =
      mode === 'context' ||
      (mode === 'auto' && callerActual === bestProvider && callerProvider !== 'unknown');

    checkAborted(context?.signal);

    logger.info('[Smart Routing] Decision', {
      mode,
      callerProvider,
      callerActual,
      bestProvider,
      shouldReturnContext,
      decision: shouldReturnContext ? 'context_returned' : 'executed'
    });

    // Context Mode: Return context for AI assistant to execute
    if (shouldReturnContext) {
      sendMcpProgress(`Building context for ${agent}...`);
      const startTime = Date.now();
      const agentContext = await buildAgentContext(
        agent,
        task,
        deps,
        callerProvider,
        mapActualProviderToMcp(bestProvider) || bestProvider
      );
      const latencyMs = Date.now() - startTime;

      logger.info('[MCP] run_agent completed (context mode)', {
        agent,
        latencyMs,
        routingDecision: 'context_returned'
      });

      return {
        content: `Agent context prepared for ${agent}. The calling AI assistant should execute this task directly using the provided context.`,
        agent,
        latencyMs,
        routingDecision: 'context_returned',
        agentContext
      };
    }

    // Execute Mode: Cross-provider execution
    // v10.6.0: Try MCP Client Pool first for faster subsequent calls
    const crossProviderMode = deps.crossProviderMode || 'auto';
    const shouldTryMcp = crossProviderMode === 'mcp' || (crossProviderMode === 'auto' && !!deps.mcpPool);

    if (shouldTryMcp && deps.mcpPool) {
      try {
        checkAborted(context?.signal);
        sendMcpProgress(`Executing via MCP pool (${bestProvider})...`);

        const result = await executeViaMcpPool(
          bestProvider,
          agent,
          task,
          deps.mcpPool
        );

        logger.info('[MCP] run_agent completed (MCP pool mode)', {
          agent,
          latencyMs: result.latencyMs,
          executionMode: result.executionMode,
          routingDecision: 'executed'
        });

        return {
          content: result.content,
          agent,
          tokens: result.tokens,
          latencyMs: result.latencyMs,
          routingDecision: 'executed',
          executionMode: result.executionMode
        };
      } catch (mcpError) {
        // MCP pool failed, fall back to CLI spawn
        sendMcpProgress('MCP pool failed, falling back to CLI...');
        logger.warn('[MCP] MCP pool failed, falling back to CLI spawn', {
          agent,
          provider: bestProvider,
          error: mcpError instanceof Error ? mcpError.message : String(mcpError)
        });
        // Continue to CLI spawn below
      }
    }

    // CLI Spawn: Traditional execution via AgentExecutor
    try {
      checkAborted(context?.signal);
      sendMcpProgress(`Spawning ${agent} agent via CLI...`);

      // v12.9.0: Build iterate options if iterate mode is enabled
      const iterateOptions: IterateModeOptions | undefined = iterate && iterate > 0
        ? {
            iterations: iterate,
            autoAnswer,
            autoAnswerProvider,
            autoAnswerThreshold
          }
        : undefined;

      const result = await executeViaCli(agent, task, actualProvider, no_memory, deps, shouldTryMcp, context?.signal, MCP_DEFAULT_AGENT_TIMEOUT_MS, iterateOptions);

      logger.info('[MCP] run_agent completed (CLI spawn mode)', {
        agent,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokens?.total,
        routingDecision: 'executed',
        executionMode: result.executionMode
      });

      return result;
    } catch (error) {
      logger.error('[MCP] run_agent failed', { agent, error });
      throw new Error(formatError(error as Error));
    }
  };
}
