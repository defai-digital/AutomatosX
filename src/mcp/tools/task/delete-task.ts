/**
 * MCP Tool: delete_task
 *
 * Deletes a task and its associated data.
 * Cannot delete running tasks.
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module mcp/tools/task/delete-task
 * @version 1.0.0
 */

import type { ToolHandler } from '../../types.js';
import { getTaskEngine } from '../../../core/task-engine/index.js';
import { logger } from '../../../shared/logging/logger.js';

/**
 * delete_task tool input
 */
export interface DeleteTaskToolInput {
  /** Task ID to delete */
  task_id: string;
  /** Force delete even if running (default: false) */
  force?: boolean;
}

/**
 * delete_task tool output
 */
export interface DeleteTaskToolOutput {
  /** Task ID that was deleted */
  task_id: string;
  /** Whether deletion was successful */
  deleted: boolean;
  /** Status of task before deletion */
  previous_status: string;
  /** Message describing the result */
  message: string;
}

/**
 * Create the delete_task tool handler
 */
export function createDeleteTaskHandler(): ToolHandler<DeleteTaskToolInput, DeleteTaskToolOutput> {
  return async (input: DeleteTaskToolInput): Promise<DeleteTaskToolOutput> => {
    logger.info('[delete_task] Deleting task', {
      taskId: input.task_id,
      force: input.force
    });

    try {
      const taskEngine = getTaskEngine();

      // Get task to check status
      const task = taskEngine.getTask(input.task_id);

      if (!task) {
        return {
          task_id: input.task_id,
          deleted: false,
          previous_status: 'unknown',
          message: `Task not found: ${input.task_id}`
        };
      }

      // Check if running and force is not set
      if (task.status === 'running' && !input.force) {
        return {
          task_id: input.task_id,
          deleted: false,
          previous_status: task.status,
          message: 'Cannot delete running task. Use force=true to override.'
        };
      }

      // Delete the task
      const deleted = taskEngine.deleteTask(input.task_id);

      const output: DeleteTaskToolOutput = {
        task_id: input.task_id,
        deleted,
        previous_status: task.status,
        message: deleted
          ? `Task ${input.task_id} deleted successfully`
          : `Failed to delete task ${input.task_id}`
      };

      logger.info('[delete_task] Task deletion result', {
        taskId: input.task_id,
        deleted,
        previousStatus: task.status
      });

      return output;
    } catch (error) {
      logger.error('[delete_task] Failed to delete task', {
        error: error instanceof Error ? error.message : String(error),
        taskId: input.task_id
      });
      throw error;
    }
  };
}

/**
 * Static schema for delete_task tool
 */
export const deleteTaskSchema = {
  name: 'delete_task',
  description: `Delete a task and its associated data. Cannot delete running tasks unless force=true.

**When to use**: Clean up completed tasks, remove failed tasks, or cancel pending tasks.

**Safety**: Running tasks are protected - use force=true to delete anyway.

**Returns**:
- deleted: Whether deletion succeeded
- previous_status: Status before deletion
- message: Human-readable result

**Examples**:
- delete_task({ task_id: "abc-123" }) - Delete completed task
- delete_task({ task_id: "abc-123", force: true }) - Force delete running task`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      task_id: {
        type: 'string',
        description: 'Task ID to delete'
      },
      force: {
        type: 'boolean',
        default: false,
        description: 'Force delete even if task is running'
      }
    },
    required: ['task_id']
  }
};
