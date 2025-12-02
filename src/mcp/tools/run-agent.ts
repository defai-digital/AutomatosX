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
 */

import type { ToolHandler, RunAgentInput, RunAgentOutput, McpSession } from '../types.js';
import { AgentExecutor } from '../../agents/executor.js';
import { ContextManager } from '../../agents/context-manager.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { Router } from '../../core/router.js';
import type { IMemoryManager } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { formatError } from '../../utils/error-formatter.js';
import { validateAgentName, validateStringParameter } from '../utils/validation.js';
import { mapMcpProviderToActual, mapActualProviderToMcp, mapNormalizedCallerToActual } from '../utils/provider-mapping.js';
import { McpClientPool } from '../../providers/mcp/pool-manager.js';
import type { CrossProviderResult, ExecutionMode } from '../../providers/mcp/types.js';

/**
 * Execute task via MCP Client Pool (cross-provider execution)
 */
async function executeViaMcpPool(
  provider: string,
  agent: string,
  task: string,
  pool: McpClientPool
): Promise<CrossProviderResult> {
  const startTime = Date.now();
  const client = await pool.acquire(provider);

  try {
    const result = await client.callTool('run_agent', {
      agent,
      task,
      mode: 'execute'
    });

    const content = result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
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
 * Execute task via CLI spawn (traditional execution)
 */
async function executeViaCli(
  agent: string,
  task: string,
  actualProvider: string | undefined,
  no_memory: boolean | undefined,
  deps: RunAgentDependencies,
  isFallback: boolean
): Promise<RunAgentOutput> {
  const context = await deps.contextManager.createContext(agent, task, {
    provider: actualProvider,
    skipMemory: no_memory
  });

  const executor = new AgentExecutor(deps.executorConfig);
  const startTime = Date.now();
  const result = await executor.execute(context, {
    showProgress: false,
    verbose: false
  });
  const latencyMs = Date.now() - startTime;

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
    executionMode
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
  return async (input: RunAgentInput): Promise<RunAgentOutput> => {
    const { agent, task, provider, no_memory, mode = 'auto' } = input;

    // Validate inputs to prevent security issues
    validateAgentName(agent);
    validateStringParameter(task, 'task', {
      required: true,
      minLength: 1,
      maxLength: 10000
    });

    // Map MCP provider name to actual provider name
    const actualProvider = mapMcpProviderToActual(provider);

    // v10.5.0: Get session for Smart Routing
    const session = deps.getSession?.() || null;
    const callerProvider = session?.normalizedProvider || 'unknown';
    const callerActual = mapNormalizedCallerToActual(callerProvider);

    logger.info('[MCP] run_agent called (Smart Routing v10.5.0)', {
      agent,
      task: task.substring(0, 100),
      mcpProvider: provider,
      actualProvider,
      mode,
      callerProvider,
      callerActual,
      no_memory
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
      const result = await executeViaCli(agent, task, actualProvider, no_memory, deps, shouldTryMcp);

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
