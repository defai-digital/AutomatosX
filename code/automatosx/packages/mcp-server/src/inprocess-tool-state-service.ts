export interface QueueRecord {
  queueId: string;
  maxSize: number;
  items: unknown[];
  createdAt: string;
}

export interface McpServerRecord {
  serverId: string;
  command: string;
  args: string[];
  description: string;
  registeredAt: string;
}

export interface DesignArtifact {
  type: string;
  domain: string;
  content: string;
  createdAt: string;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskRecord {
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  error?: string | undefined;
}

export interface MetricSample {
  ts: string;
  value: number;
  tags: string[];
}

export interface McpInProcessToolStateService {
  startTimer(name: string): { success: true; data: { name: string; startedAt: string } }
    | { success: false; error: string };
  stopTimer(name: string): { success: true; data: { name: string; elapsedMs: number } }
    | { success: false; error: string };
  createQueue(queueId: string, maxSize: number): { success: true; data: { queueId: string; maxSize: number } }
    | { success: false; error: string };
  listQueues(): { success: true; data: { queues: Array<{ queueId: string; size: number; maxSize: number; createdAt: string }> } };
  listServers(): { success: true; data: { servers: McpServerRecord[] } };
  registerServer(input: {
    serverId: string;
    command: string;
    args: string[];
    description: string;
  }): { success: true; data: McpServerRecord };
  unregisterServer(serverId: string): { success: true; data: { serverId: string; removed: boolean } };
  storeDesignArtifact(artifact: DesignArtifact): void;
  listDesignArtifacts(domain?: string): { success: true; data: { artifacts: DesignArtifact[]; count: number } };
  recordMetric(name: string, value: number, tags: string[]): { success: true; data: { name: string; value: number } };
  incrementMetric(name: string, amount: number, tags: string[]): { success: true; data: { name: string; value: number } };
  listMetrics(): { success: true; data: { metrics: string[] } };
  queryMetric(name: string): { success: true; data: { name: string; samples: MetricSample[] } };
  summarizeMetrics(): { success: true; data: { summary: Record<string, { count: number; sum: number; avg: number; min: number; max: number }> } };
  submitTask(input: {
    taskId: string;
    type: string;
    payload: Record<string, unknown>;
    priority: number;
  }): { success: true; data: TaskRecord } | { success: false; error: string };
  getTask(taskId: string): { success: true; data: TaskRecord } | { success: false; error: string };
  listTasks(status: string | undefined, limit: number): { success: true; data: { tasks: TaskRecord[]; total: number } }
    | { success: false; error: string };
  cancelTask(taskId: string): { success: true; data: TaskRecord } | { success: false; error: string };
  retryTask(taskId: string): { success: true; data: TaskRecord } | { success: false; error: string };
}

const MAX_ACTIVE_TIMERS = 1000;
const TIMER_TTL_MS = 60 * 60 * 1000;
const VALID_TASK_STATUSES: TaskStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
];

export function createMcpInProcessToolStateService(): McpInProcessToolStateService {
  const timerStore = new Map<string, number>();
  const namedQueues = new Map<string, QueueRecord>();
  const mcpServerRegistry = new Map<string, McpServerRecord>();
  const designArtifacts: DesignArtifact[] = [];
  const taskQueue = new Map<string, TaskRecord>();
  const metricsStore = new Map<string, MetricSample[]>();

  function cleanupTimers(): void {
    const now = Date.now();
    for (const [name, startedAt] of timerStore) {
      if (now - startedAt > TIMER_TTL_MS) {
        timerStore.delete(name);
      }
    }
  }

  function appendMetric(name: string, value: number, tags: string[]): void {
    const samples = metricsStore.get(name) ?? [];
    samples.push({ ts: new Date().toISOString(), value, tags });
    metricsStore.set(name, samples);
  }

  return {
    startTimer(name) {
      cleanupTimers();
      if (!timerStore.has(name) && timerStore.size >= MAX_ACTIVE_TIMERS) {
        return {
          success: false,
          error: 'Maximum active timers reached; stop existing timers before starting more.',
        };
      }
      timerStore.set(name, Date.now());
      return {
        success: true,
        data: {
          name,
          startedAt: new Date().toISOString(),
        },
      };
    },

    stopTimer(name) {
      cleanupTimers();
      const start = timerStore.get(name);
      if (start === undefined) {
        return {
          success: false,
          error: `Timer "${name}" not found`,
        };
      }
      const elapsedMs = Date.now() - start;
      timerStore.delete(name);
      return {
        success: true,
        data: { name, elapsedMs },
      };
    },

    createQueue(queueId, maxSize) {
      if (namedQueues.has(queueId)) {
        return {
          success: false,
          error: `Queue "${queueId}" already exists`,
        };
      }
      const queue: QueueRecord = {
        queueId,
        maxSize,
        items: [],
        createdAt: new Date().toISOString(),
      };
      namedQueues.set(queueId, queue);
      return {
        success: true,
        data: { queueId, maxSize: queue.maxSize },
      };
    },

    listQueues() {
      return {
        success: true,
        data: {
          queues: [...namedQueues.values()].map((queue) => ({
            queueId: queue.queueId,
            size: queue.items.length,
            maxSize: queue.maxSize,
            createdAt: queue.createdAt,
          })),
        },
      };
    },

    listServers() {
      return {
        success: true,
        data: { servers: [...mcpServerRegistry.values()] },
      };
    },

    registerServer(input) {
      const record: McpServerRecord = {
        serverId: input.serverId,
        command: input.command,
        args: input.args,
        description: input.description,
        registeredAt: new Date().toISOString(),
      };
      mcpServerRegistry.set(input.serverId, record);
      return {
        success: true,
        data: record,
      };
    },

    unregisterServer(serverId) {
      return {
        success: true,
        data: {
          serverId,
          removed: mcpServerRegistry.delete(serverId),
        },
      };
    },

    storeDesignArtifact(artifact) {
      designArtifacts.push(artifact);
    },

    listDesignArtifacts(domain) {
      const artifacts = domain === undefined
        ? designArtifacts
        : designArtifacts.filter((artifact) => artifact.domain === domain);
      return {
        success: true,
        data: {
          artifacts,
          count: artifacts.length,
        },
      };
    },

    recordMetric(name, value, tags) {
      appendMetric(name, value, tags);
      return {
        success: true,
        data: { name, value },
      };
    },

    incrementMetric(name, amount, tags) {
      const existing = metricsStore.get(name) ?? [];
      const previous = existing.length > 0 ? (existing[existing.length - 1]?.value ?? 0) : 0;
      const value = previous + amount;
      appendMetric(name, value, tags);
      return {
        success: true,
        data: { name, value },
      };
    },

    listMetrics() {
      return {
        success: true,
        data: { metrics: [...metricsStore.keys()] },
      };
    },

    queryMetric(name) {
      return {
        success: true,
        data: { name, samples: metricsStore.get(name) ?? [] },
      };
    },

    summarizeMetrics() {
      const summary: Record<string, { count: number; sum: number; avg: number; min: number; max: number }> = {};
      for (const [name, samples] of metricsStore) {
        if (samples.length === 0) {
          continue;
        }
        const values = samples.map((sample) => sample.value);
        const sum = values.reduce((total, value) => total + value, 0);
        summary[name] = {
          count: samples.length,
          sum,
          avg: sum / samples.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
      return {
        success: true,
        data: { summary },
      };
    },

    submitTask(input) {
      if (taskQueue.has(input.taskId)) {
        return {
          success: false,
          error: `Task "${input.taskId}" already exists`,
        };
      }
      const now = new Date().toISOString();
      const task: TaskRecord = {
        taskId: input.taskId,
        type: input.type,
        payload: input.payload,
        priority: input.priority,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      taskQueue.set(input.taskId, task);
      return {
        success: true,
        data: task,
      };
    },

    getTask(taskId) {
      const task = taskQueue.get(taskId);
      if (task === undefined) {
        return {
          success: false,
          error: `Task "${taskId}" not found`,
        };
      }
      return {
        success: true,
        data: task,
      };
    },

    listTasks(status, limit) {
      if (status !== undefined && !VALID_TASK_STATUSES.includes(status as TaskStatus)) {
        return {
          success: false,
          error: `Invalid status filter: ${status}. Valid values: ${VALID_TASK_STATUSES.join(', ')}`,
        };
      }
      let tasks = [...taskQueue.values()];
      if (status !== undefined) {
        tasks = tasks.filter((task) => task.status === status);
      }
      tasks.sort((left, right) => right.priority - left.priority);
      return {
        success: true,
        data: {
          tasks: tasks.slice(0, limit),
          total: tasks.length,
        },
      };
    },

    cancelTask(taskId) {
      const task = taskQueue.get(taskId);
      if (task === undefined) {
        return {
          success: false,
          error: `Task "${taskId}" not found`,
        };
      }
      if (task.status !== 'pending') {
        return {
          success: false,
          error: `Cannot cancel task with status "${task.status}"`,
        };
      }
      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
      return {
        success: true,
        data: task,
      };
    },

    retryTask(taskId) {
      const task = taskQueue.get(taskId);
      if (task === undefined) {
        return {
          success: false,
          error: `Task "${taskId}" not found`,
        };
      }
      if (task.status !== 'failed') {
        return {
          success: false,
          error: `Can only retry failed tasks, got status "${task.status}"`,
        };
      }
      task.status = 'pending';
      task.updatedAt = new Date().toISOString();
      delete task.error;
      return {
        success: true,
        data: task,
      };
    },
  };
}
