/**
 * MCP Tool: run_agent
 *
 * Executes an AutomatosX agent with a task.
 * Wraps the existing CLI run command logic.
 */

import type { ToolHandler, RunAgentInput, RunAgentOutput } from '../types.js';
import { AgentExecutor } from '../../agents/executor.js';
import { ContextManager } from '../../agents/context-manager.js';
import { logger } from '../../utils/logger.js';
import { formatError } from '../../utils/error-formatter.js';
import { validateAgentName, validateStringParameter } from '../utils/validation.js';
import { mapMcpProviderToActual } from '../utils/provider-mapping.js';

export interface RunAgentDependencies {
  contextManager: ContextManager;
  executorConfig: {
    sessionManager?: any;
    workspaceManager?: any;
    contextManager?: ContextManager;
    profileLoader?: any;
  };
}

export function createRunAgentHandler(
  deps: RunAgentDependencies
): ToolHandler<RunAgentInput, RunAgentOutput> {
  return async (input: RunAgentInput): Promise<RunAgentOutput> => {
    const { agent, task, provider, no_memory } = input;

    // Validate inputs to prevent security issues
    validateAgentName(agent);
    validateStringParameter(task, 'task', {
      required: true,
      minLength: 1,
      maxLength: 10000
    });

    // Map MCP provider name to actual provider name
    // MCP uses: 'gemini', 'claude', 'openai'
    // System uses: 'gemini-cli', 'claude-code', 'openai'
    const actualProvider = mapMcpProviderToActual(provider);

    logger.info('[MCP] run_agent called', {
      agent,
      task,
      mcpProvider: provider,
      actualProvider,
      no_memory
    });

    try {
      // Build execution context (same as CLI run command)
      const context = await deps.contextManager.createContext(agent, task, {
        provider: actualProvider,
        skipMemory: no_memory
      });

      // Execute agent with progress/verbose disabled to prevent stdout pollution
      const executor = new AgentExecutor(deps.executorConfig);

      const startTime = Date.now();
      const result = await executor.execute(context, {
        showProgress: false,
        verbose: false
      });
      const latencyMs = Date.now() - startTime;

      logger.info('[MCP] run_agent completed', {
        agent,
        latencyMs,
        tokensUsed: result.response.tokensUsed?.total
      });

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
        latencyMs
      };
    } catch (error) {
      logger.error('[MCP] run_agent failed', { agent, error });
      throw new Error(formatError(error as Error));
    }
  };
}
