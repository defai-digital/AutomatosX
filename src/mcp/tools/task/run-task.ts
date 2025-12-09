/**
 * MCP Tool: run_task
 *
 * Executes a previously created task and returns results.
 * Blocks until completion or timeout.
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module mcp/tools/task/run-task
 * @version 1.0.0
 */

import type { ToolHandler, McpSession } from '../../types.js';
import { getTaskEngine, type RunTaskOptions, type TaskEngineType, type OriginClient } from '../../../core/task-engine/index.js';
import { logger } from '../../../shared/logging/logger.js';

/**
 * run_task tool input
 */
export interface RunTaskToolInput {
  /** Task ID to execute */
  task_id: string;
  /** Override the estimated engine */
  engine_override?: 'gemini' | 'claude' | 'codex' | 'glm' | 'grok';
  /** Custom timeout in milliseconds (default: 30000) */
  timeout_ms?: number;
  /** Skip cache and force re-execution */
  skip_cache?: boolean;
}

/**
 * run_task tool output
 */
export interface RunTaskToolOutput {
  /** Task ID */
  task_id: string;
  /** Final task status */
  status: 'completed' | 'failed';
  /** Task result (null if failed) */
  result: Record<string, unknown> | null;
  /** Engine that executed the task */
  engine: string;
  /** Execution metrics */
  metrics: {
    duration_ms: number;
    tokens_prompt: number | null;
    tokens_completion: number | null;
  };
  /** Whether result was from cache */
  cache_hit: boolean;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Dependencies for run_task handler
 */
export interface RunTaskDependencies {
  /** Function to get current MCP session */
  getSession: () => McpSession | null;
}

/**
 * Create the run_task tool handler
 */
export function createRunTaskHandler(deps: RunTaskDependencies): ToolHandler<RunTaskToolInput, RunTaskToolOutput> {
  return async (input: RunTaskToolInput, context?: { signal?: AbortSignal }): Promise<RunTaskToolOutput> => {
    const startTime = Date.now();

    if (context?.signal?.aborted) {
      throw new Error('Request was cancelled');
    }

    logger.info('[run_task] Executing task', {
      taskId: input.task_id,
      engineOverride: input.engine_override,
      timeoutMs: input.timeout_ms,
      skipCache: input.skip_cache
    });

    try {
      const taskEngine = getTaskEngine();

      // Build run options
      const options: RunTaskOptions = {
        engineOverride: input.engine_override as Exclude<TaskEngineType, 'auto'> | undefined,
        timeoutMs: input.timeout_ms,
        skipCache: input.skip_cache,
        abortSignal: context?.signal
      };

      const result = await taskEngine.runTask(input.task_id, options);

      const output: RunTaskToolOutput = {
        task_id: result.taskId,
        status: result.status as 'completed' | 'failed',
        result: result.result,
        engine: result.engine,
        metrics: {
          duration_ms: result.metrics?.durationMs ?? 0,
          tokens_prompt: result.metrics?.tokensPrompt ?? null,
          tokens_completion: result.metrics?.tokensCompletion ?? null
        },
        cache_hit: result.cacheHit
      };

      if (result.error) {
        output.error = {
          code: result.error.code,
          message: result.error.message
        };
      }

      logger.info('[run_task] Task execution completed', {
        taskId: result.taskId,
        status: result.status,
        engine: result.engine,
        cacheHit: result.cacheHit,
        durationMs: Date.now() - startTime
      });

      return output;
    } catch (error) {
      logger.error('[run_task] Failed to execute task', {
        error: error instanceof Error ? error.message : String(error),
        taskId: input.task_id
      });
      throw error;
    }
  };
}

/**
 * Map normalized MCP provider to origin client ID
 */
function mapNormalizedProviderToOriginClient(provider: string): OriginClient {
  const mapping: Record<string, OriginClient> = {
    'claude': 'claude-code',
    'gemini': 'gemini-cli',
    'codex': 'codex-cli',
    'glm': 'glm',
    'grok': 'grok',
    'unknown': 'unknown'
  };
  return mapping[provider] ?? 'unknown';
}

/**
 * Static schema for run_task tool
 */
export const runTaskSchema = {
  name: 'run_task',
  description: 'Execute a previously created task and return results. Blocks until completion or timeout.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      task_id: {
        type: 'string',
        description: 'Task ID to execute'
      },
      engine_override: {
        type: 'string',
        enum: ['gemini', 'claude', 'codex', 'glm', 'grok'],
        description: 'Override the estimated engine'
      },
      timeout_ms: {
        type: 'integer',
        minimum: 1000,
        maximum: 300000,
        default: 30000,
        description: 'Custom timeout in milliseconds'
      },
      skip_cache: {
        type: 'boolean',
        default: false,
        description: 'Skip cache and force re-execution'
      }
    },
    required: ['task_id']
  }
};
