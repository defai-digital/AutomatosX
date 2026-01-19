import type { MCPTool, ToolHandler } from '../types.js';
import { randomUUID } from 'crypto';
import { getErrorMessage, LIMIT_ORCHESTRATION, LIMIT_POLICIES } from '@defai.digital/contracts';

/**
 * Task submit tool definition
 */
export const taskSubmitTool: MCPTool = {
  name: 'task_submit',
  description: 'Submit a new task to the orchestration queue',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      queueId: {
        type: 'string',
        description: 'Queue ID to submit to (uses default if not specified)',
      },
      name: {
        type: 'string',
        description: 'Task name',
      },
      description: {
        type: 'string',
        description: 'Task description',
      },
      type: {
        type: 'string',
        description: 'Task type',
        enum: ['sequential', 'parallel', 'conditional', 'loop', 'retry', 'timeout', 'wait', 'callback', 'other'],
        default: 'sequential',
      },
      priority: {
        type: 'string',
        description: 'Task priority',
        enum: ['critical', 'high', 'medium', 'low', 'background'],
        default: 'medium',
      },
      agentId: {
        type: 'string',
        description: 'Agent ID to assign the task to',
      },
      input: {
        type: 'object',
        description: 'Input data for the task',
      },
      dependencies: {
        type: 'array',
        description: 'List of task IDs that must complete first',
        items: { type: 'string' },
      },
      scheduledAt: {
        type: 'string',
        description: 'ISO datetime for scheduled execution',
      },
      tags: {
        type: 'array',
        description: 'Task tags for filtering',
        items: { type: 'string' },
      },
    },
    required: ['name'],
  },
};

/**
 * Task status tool definition
 */
export const taskStatusTool: MCPTool = {
  name: 'task_status',
  description: 'Get the status of a task',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID to check',
      },
    },
    required: ['taskId'],
  },
};

/**
 * Task list tool definition
 */
export const taskListTool: MCPTool = {
  name: 'task_list',
  description: 'List tasks with optional filters',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      queueId: {
        type: 'string',
        description: 'Filter by queue ID',
      },
      status: {
        type: 'array',
        description: 'Filter by status',
        items: {
          type: 'string',
          enum: ['pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timeout'],
        },
      },
      priority: {
        type: 'array',
        description: 'Filter by priority',
        items: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'background'],
        },
      },
      agentId: {
        type: 'string',
        description: 'Filter by agent ID',
      },
      tags: {
        type: 'array',
        description: 'Filter by tags',
        items: { type: 'string' },
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return',
        default: 50,
      },
    },
  },
};

/**
 * Task cancel tool definition
 */
export const taskCancelTool: MCPTool = {
  name: 'task_cancel',
  description: 'Cancel a running or pending task',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID to cancel',
      },
      reason: {
        type: 'string',
        description: 'Cancellation reason',
      },
      force: {
        type: 'boolean',
        description: 'Force cancel even if running',
        default: false,
      },
    },
    required: ['taskId'],
  },
};

/**
 * Task retry tool definition
 */
export const taskRetryTool: MCPTool = {
  name: 'task_retry',
  description: 'Retry a failed task',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID to retry',
      },
      resetAttempts: {
        type: 'boolean',
        description: 'Reset attempt counter',
        default: false,
      },
    },
    required: ['taskId'],
  },
};

/**
 * Queue create tool definition
 */
export const queueCreateTool: MCPTool = {
  name: 'queue_create',
  description: 'Create a new task queue',
  idempotent: false,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Queue name',
      },
      description: {
        type: 'string',
        description: 'Queue description',
      },
      maxConcurrency: {
        type: 'number',
        description: 'Maximum concurrent tasks',
        default: 5,
      },
      defaultPriority: {
        type: 'string',
        description: 'Default priority for tasks',
        enum: ['critical', 'high', 'medium', 'low', 'background'],
        default: 'medium',
      },
    },
    required: ['name'],
  },
};

/**
 * Queue list tool definition
 */
export const queueListTool: MCPTool = {
  name: 'queue_list',
  description: 'List all task queues',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum results',
        default: 20,
      },
    },
  },
};

// In-memory storage
const taskStore = new Map<string, TaskRecord>();
const queueStore = new Map<string, QueueRecord>();

interface TaskRecord {
  taskId: string;
  queueId: string;
  name: string;
  description: string | undefined;
  type: string;
  priority: string;
  status: string;
  agentId: string | undefined;
  input: Record<string, unknown> | undefined;
  output: Record<string, unknown> | undefined;
  dependencies: string[];
  tags: string[];
  attempt: number;
  error: string | undefined;
  scheduledAt: string | undefined;
  startedAt: string | undefined;
  completedAt: string | undefined;
  createdAt: string;
}

interface QueueRecord {
  queueId: string;
  name: string;
  description: string | undefined;
  maxConcurrency: number;
  defaultPriority: string;
  isPaused: boolean;
  createdAt: string;
}

// Create default queue
const defaultQueueId = randomUUID();
queueStore.set(defaultQueueId, {
  queueId: defaultQueueId,
  name: 'default',
  description: 'Default task queue',
  maxConcurrency: 5,
  defaultPriority: 'medium',
  isPaused: false,
  createdAt: new Date().toISOString(),
});

/**
 * Handler for task_submit tool
 */
export const handleTaskSubmit: ToolHandler = async (args) => {
  const queueId = (args.queueId as string) ?? defaultQueueId;
  const name = args.name as string;
  const description = args.description as string | undefined;
  const type = (args.type as string) ?? 'sequential';
  const priority = (args.priority as string) ?? 'medium';
  const agentId = args.agentId as string | undefined;
  const input = args.input as Record<string, unknown> | undefined;
  const dependencies = (args.dependencies as string[]) ?? [];
  const scheduledAt = args.scheduledAt as string | undefined;
  const tags = (args.tags as string[]) ?? [];

  try {
    // Validate queue exists
    const queue = queueStore.get(queueId);
    if (queue === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'QUEUE_NOT_FOUND',
              message: `Queue with ID "${queueId}" not found`,
              queueId,
            }),
          },
        ],
        isError: true,
      };
    }

    const taskId = randomUUID();
    const task: TaskRecord = {
      taskId,
      queueId,
      name,
      description,
      type,
      priority,
      status: scheduledAt !== undefined ? 'pending' : 'queued',
      agentId,
      input,
      output: undefined,
      dependencies,
      tags,
      attempt: 1,
      error: undefined,
      scheduledAt,
      startedAt: undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
    };

    taskStore.set(taskId, task);

    // Calculate queue position
    const queuedTasks = Array.from(taskStore.values()).filter(
      (t) => t.queueId === queueId && t.status === 'queued'
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              taskId,
              queueId,
              status: task.status,
              position: queuedTasks.length,
              submittedAt: task.createdAt,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'SUBMIT_FAILED',
            message,
            name,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for task_status tool
 */
export const handleTaskStatus: ToolHandler = async (args) => {
  const taskId = args.taskId as string;

  try {
    const task = taskStore.get(taskId);

    if (task === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'TASK_NOT_FOUND',
              message: `Task with ID "${taskId}" not found`,
              taskId,
            }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(task, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'STATUS_FAILED',
            message,
            taskId,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for task_list tool
 */
export const handleTaskList: ToolHandler = async (args) => {
  const queueId = args.queueId as string | undefined;
  const statusFilter = args.status as string[] | undefined;
  const priorityFilter = args.priority as string[] | undefined;
  const agentId = args.agentId as string | undefined;
  const tagsFilter = args.tags as string[] | undefined;
  // Clamp limit to valid range [1, LIMIT_ORCHESTRATION]
  const rawLimit = (args.limit as number | undefined) ?? LIMIT_ORCHESTRATION;
  const limit = Math.max(1, Math.min(rawLimit, LIMIT_ORCHESTRATION));

  try {
    let tasks = Array.from(taskStore.values());

    if (queueId !== undefined) {
      tasks = tasks.filter((t) => t.queueId === queueId);
    }
    if (statusFilter !== undefined && statusFilter.length > 0) {
      tasks = tasks.filter((t) => statusFilter.includes(t.status));
    }
    if (priorityFilter !== undefined && priorityFilter.length > 0) {
      tasks = tasks.filter((t) => priorityFilter.includes(t.priority));
    }
    if (agentId !== undefined) {
      tasks = tasks.filter((t) => t.agentId === agentId);
    }
    if (tagsFilter !== undefined && tagsFilter.length > 0) {
      tasks = tasks.filter((t) => tagsFilter.some((tag) => t.tags.includes(tag)));
    }

    // Sort by createdAt desc
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    tasks = tasks.slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              tasks,
              total: tasks.length,
              hasMore: tasks.length === limit,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for task_cancel tool
 */
export const handleTaskCancel: ToolHandler = async (args) => {
  const taskId = args.taskId as string;
  const reason = args.reason as string | undefined;
  const force = (args.force as boolean) ?? false;

  try {
    const task = taskStore.get(taskId);

    if (task === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'TASK_NOT_FOUND',
              message: `Task with ID "${taskId}" not found`,
              taskId,
            }),
          },
        ],
        isError: true,
      };
    }

    // Check if task can be cancelled
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_STATE',
              message: `Task is already ${task.status}`,
              taskId,
              currentStatus: task.status,
            }),
          },
        ],
        isError: true,
      };
    }

    if (task.status === 'running' && !force) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_STATE',
              message: 'Task is running. Set force=true to cancel.',
              taskId,
              currentStatus: task.status,
            }),
          },
        ],
        isError: true,
      };
    }

    task.status = 'cancelled';
    task.error = reason ?? 'Cancelled by user';
    task.completedAt = new Date().toISOString();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              taskId,
              status: 'cancelled',
              reason: task.error,
              cancelledAt: task.completedAt,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'CANCEL_FAILED',
            message,
            taskId,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for task_retry tool
 */
export const handleTaskRetry: ToolHandler = async (args) => {
  const taskId = args.taskId as string;
  const resetAttempts = (args.resetAttempts as boolean) ?? false;

  try {
    const task = taskStore.get(taskId);

    if (task === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'TASK_NOT_FOUND',
              message: `Task with ID "${taskId}" not found`,
              taskId,
            }),
          },
        ],
        isError: true,
      };
    }

    if (!['failed', 'cancelled', 'timeout'].includes(task.status)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_STATE',
              message: `Can only retry failed, cancelled, or timed out tasks. Current status: ${task.status}`,
              taskId,
              currentStatus: task.status,
            }),
          },
        ],
        isError: true,
      };
    }

    task.status = 'queued';
    task.attempt = resetAttempts ? 1 : task.attempt + 1;
    task.error = undefined;
    task.completedAt = undefined;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              taskId,
              status: 'queued',
              attempt: task.attempt,
              retriedAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'RETRY_FAILED',
            message,
            taskId,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for queue_create tool
 */
export const handleQueueCreate: ToolHandler = async (args) => {
  const name = args.name as string;
  const description = args.description as string | undefined;
  const maxConcurrency = (args.maxConcurrency as number) ?? 5;
  const defaultPriority = (args.defaultPriority as string) ?? 'medium';

  try {
    // Check for duplicate name
    const existing = Array.from(queueStore.values()).find((q) => q.name === name);
    if (existing !== undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'QUEUE_EXISTS',
              message: `Queue with name "${name}" already exists`,
              existingQueueId: existing.queueId,
            }),
          },
        ],
        isError: true,
      };
    }

    const queueId = randomUUID();
    const queue: QueueRecord = {
      queueId,
      name,
      description,
      maxConcurrency,
      defaultPriority,
      isPaused: false,
      createdAt: new Date().toISOString(),
    };

    queueStore.set(queueId, queue);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(queue, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'CREATE_FAILED',
            message,
            name,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for queue_list tool
 */
export const handleQueueList: ToolHandler = async (args) => {
  // Clamp limit to valid range [1, LIMIT_POLICIES]
  const rawLimit = (args.limit as number | undefined) ?? LIMIT_POLICIES;
  const limit = Math.max(1, Math.min(rawLimit, LIMIT_POLICIES));

  try {
    const queues = Array.from(queueStore.values())
      .slice(0, limit)
      .map((q) => {
        const tasks = Array.from(taskStore.values()).filter((t) => t.queueId === q.queueId);
        return {
          ...q,
          stats: {
            pending: tasks.filter((t) => t.status === 'pending').length,
            queued: tasks.filter((t) => t.status === 'queued').length,
            running: tasks.filter((t) => t.status === 'running').length,
            completed: tasks.filter((t) => t.status === 'completed').length,
            failed: tasks.filter((t) => t.status === 'failed').length,
          },
        };
      });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              queues,
              total: queues.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};
