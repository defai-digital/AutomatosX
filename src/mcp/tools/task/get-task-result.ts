/**
 * MCP Tool: get_task_result
 *
 * Retrieves the result of a completed task.
 * Does not execute the task - use run_task for that.
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module mcp/tools/task/get-task-result
 * @version 1.0.0
 */

import type { ToolHandler } from '../../types.js';
import { getTaskEngine } from '../../../core/task-engine/index.js';
import { logger } from '../../../shared/logging/logger.js';

/**
 * get_task_result tool input
 */
export interface GetTaskResultToolInput {
  /** Task ID to retrieve */
  task_id: string;
  /** Include full payload in response */
  include_payload?: boolean;
}

/**
 * get_task_result tool output
 */
export interface GetTaskResultToolOutput {
  /** Task ID */
  task_id: string;
  /** Current task status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  /** Task type */
  type: string;
  /** Task result (null if not completed) */
  result: Record<string, unknown> | null;
  /** Original payload (if requested) */
  payload?: Record<string, unknown>;
  /** Engine that executed (null if not run) */
  engine: string | null;
  /** Task creation time (ISO 8601) */
  created_at: string;
  /** Task completion time (ISO 8601, null if not completed) */
  completed_at: string | null;
  /** Task expiration time (ISO 8601) */
  expires_at: string;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Create the get_task_result tool handler
 */
export function createGetTaskResultHandler(): ToolHandler<GetTaskResultToolInput, GetTaskResultToolOutput> {
  return async (input: GetTaskResultToolInput): Promise<GetTaskResultToolOutput> => {
    logger.info('[get_task_result] Retrieving task', {
      taskId: input.task_id,
      includePayload: input.include_payload
    });

    try {
      const taskEngine = getTaskEngine();
      const task = taskEngine.getTask(input.task_id);

      if (!task) {
        throw new Error(`Task not found: ${input.task_id}`);
      }

      const output: GetTaskResultToolOutput = {
        task_id: task.id,
        status: task.status,
        type: task.type,
        result: task.result,
        engine: task.engine,
        created_at: new Date(task.createdAt).toISOString(),
        completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        expires_at: new Date(task.expiresAt).toISOString()
      };

      if (input.include_payload) {
        output.payload = task.payload;
      }

      if (task.error) {
        output.error = {
          code: task.error.code,
          message: task.error.message
        };
      }

      logger.info('[get_task_result] Task retrieved', {
        taskId: task.id,
        status: task.status
      });

      return output;
    } catch (error) {
      logger.error('[get_task_result] Failed to retrieve task', {
        error: error instanceof Error ? error.message : String(error),
        taskId: input.task_id
      });
      throw error;
    }
  };
}

/**
 * Static schema for get_task_result tool
 */
export const getTaskResultSchema = {
  name: 'get_task_result',
  description: 'Retrieve the result of a task. Does not execute - use run_task for execution.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      task_id: {
        type: 'string',
        description: 'Task ID to retrieve'
      },
      include_payload: {
        type: 'boolean',
        default: false,
        description: 'Include original payload in response'
      }
    },
    required: ['task_id']
  }
};
