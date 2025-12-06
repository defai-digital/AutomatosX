/**
 * Task MCP Tools Index
 *
 * Exports all task-related MCP tools for the Task Engine.
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module mcp/tools/task
 * @version 1.0.0
 */

// Import schemas for taskToolSchemas array
import { createTaskSchema as _createTaskSchema } from './create-task.js';
import { runTaskSchema as _runTaskSchema } from './run-task.js';
import { getTaskResultSchema as _getTaskResultSchema } from './get-task-result.js';
import { listTasksSchema as _listTasksSchema } from './list-tasks.js';
import { deleteTaskSchema as _deleteTaskSchema } from './delete-task.js';

// Create Task
export {
  createCreateTaskHandler,
  createTaskSchema,
  type CreateTaskToolInput,
  type CreateTaskToolOutput,
  type CreateTaskDependencies
} from './create-task.js';

// Run Task
export {
  createRunTaskHandler,
  runTaskSchema,
  type RunTaskToolInput,
  type RunTaskToolOutput,
  type RunTaskDependencies
} from './run-task.js';

// Get Task Result
export {
  createGetTaskResultHandler,
  getTaskResultSchema,
  type GetTaskResultToolInput,
  type GetTaskResultToolOutput
} from './get-task-result.js';

// List Tasks
export {
  createListTasksHandler,
  listTasksSchema,
  type ListTasksToolInput,
  type ListTasksToolOutput,
  type TaskSummary
} from './list-tasks.js';

// Delete Task
export {
  createDeleteTaskHandler,
  deleteTaskSchema,
  type DeleteTaskToolInput,
  type DeleteTaskToolOutput
} from './delete-task.js';

/**
 * All task tool schemas for MCP registration
 */
export const taskToolSchemas = [
  _createTaskSchema,
  _runTaskSchema,
  _getTaskResultSchema,
  _listTasksSchema,
  _deleteTaskSchema
] as const;
