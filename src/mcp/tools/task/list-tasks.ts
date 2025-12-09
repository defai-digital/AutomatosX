/**
 * MCP Tool: list_tasks
 *
 * Lists tasks with optional filtering by status, type, and engine.
 * Supports pagination for large result sets.
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module mcp/tools/task/list-tasks
 * @version 1.0.0
 */

import type { ToolHandler } from '../../types.js';
import { getTaskEngine, type TaskFilter } from '../../../core/task-engine/index.js';
import { logger } from '../../../shared/logging/logger.js';

/**
 * list_tasks tool input
 */
export interface ListTasksToolInput {
  /** Filter by status */
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  /** Filter by task type */
  type?: 'web_search' | 'code_review' | 'code_generation' | 'analysis' | 'custom';
  /** Filter by engine */
  engine?: 'gemini' | 'claude' | 'codex' | 'glm' | 'grok';
  /** Maximum results (default: 20, max: 100) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Task summary for list response
 */
export interface TaskSummary {
  /** Task ID */
  task_id: string;
  /** Task type */
  type: string;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  /** Assigned/executed engine */
  engine: string | null;
  /** Task priority */
  priority: number;
  /** Creation time (ISO 8601) */
  created_at: string;
  /** Expiration time (ISO 8601) */
  expires_at: string;
  /** Whether task has result */
  has_result: boolean;
}

/**
 * list_tasks tool output
 */
export interface ListTasksToolOutput {
  /** List of task summaries */
  tasks: TaskSummary[];
  /** Total matching tasks (before pagination) */
  total: number;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
  /** Whether more results exist */
  has_more: boolean;
}

/**
 * Create the list_tasks tool handler
 */
export function createListTasksHandler(): ToolHandler<ListTasksToolInput, ListTasksToolOutput> {
  return async (input: ListTasksToolInput): Promise<ListTasksToolOutput> => {
    const limit = Math.min(input.limit ?? 20, 100);
    const offset = input.offset ?? 0;

    logger.info('[list_tasks] Listing tasks', {
      status: input.status,
      type: input.type,
      engine: input.engine,
      limit,
      offset
    });

    try {
      const taskEngine = getTaskEngine();

      // Build filter
      const filter: TaskFilter = {
        status: input.status,
        type: input.type,
        engine: input.engine,
        limit,
        offset
      };

      const result = taskEngine.listTasks(filter);

      const tasks: TaskSummary[] = result.tasks.map(task => ({
        task_id: task.id,
        type: task.type,
        status: task.status,
        engine: task.engine,
        priority: task.priority,
        created_at: new Date(task.createdAt).toISOString(),
        expires_at: new Date(task.expiresAt).toISOString(),
        has_result: task.result !== null
      }));

      const output: ListTasksToolOutput = {
        tasks,
        total: result.total,
        offset,
        limit,
        has_more: offset + tasks.length < result.total
      };

      logger.info('[list_tasks] Tasks listed', {
        returned: tasks.length,
        total: result.total,
        hasMore: output.has_more
      });

      return output;
    } catch (error) {
      logger.error('[list_tasks] Failed to list tasks', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
}

/**
 * Static schema for list_tasks tool
 */
export const listTasksSchema = {
  name: 'list_tasks',
  description: `List tasks with optional filtering. Supports pagination.

**When to use**: Browse task queue, find tasks to execute, or monitor task status.

**Filters**:
- status: pending, running, completed, failed, expired
- type: web_search, code_review, code_generation, analysis, custom
- engine: gemini, claude, codex, glm, grok

**Returns**: Array of task summaries with pagination info:
- tasks: [{task_id, type, status, engine, priority, created_at, expires_at, has_result}]
- total: Total matching tasks
- has_more: Whether more pages exist

**Examples**:
- list_tasks({}) - List all tasks
- list_tasks({ status: "pending" }) - Find pending tasks
- list_tasks({ type: "code_review", limit: 50 }) - List code reviews`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'expired'],
        description: 'Filter by task status'
      },
      type: {
        type: 'string',
        enum: ['web_search', 'code_review', 'code_generation', 'analysis', 'custom'],
        description: 'Filter by task type'
      },
      engine: {
        type: 'string',
        enum: ['gemini', 'claude', 'codex', 'glm', 'grok'],
        description: 'Filter by engine'
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Maximum results to return'
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description: 'Offset for pagination'
      }
    },
    required: []
  }
};
