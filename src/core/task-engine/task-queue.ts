/**
 * Task Queue Manager
 *
 * Manages task scheduling and execution for 50 concurrent tasks.
 * Uses priority-based scheduling with fair queuing.
 *
 * Features:
 * - Priority queue with 10 priority levels
 * - Fair scheduling across clients
 * - Concurrency limiting
 * - Task timeout handling
 * - Retry with exponential backoff
 *
 * Part of Phase 5: Full Scale
 *
 * @module core/task-engine/task-queue
 * @version 1.0.0
 */

import { EventEmitter } from 'node:events';
import { logger } from '../../shared/logging/logger.js';

/**
 * Task queue item
 */
export interface QueuedTask {
  /** Task ID */
  taskId: string;
  /** Task priority (1-10, higher = more urgent) */
  priority: number;
  /** Client ID for fair scheduling */
  clientId: string;
  /** Task payload */
  payload: Record<string, unknown>;
  /** Target engine */
  engine?: string;
  /** Queued timestamp */
  queuedAt: number;
  /** Retry count */
  retryCount: number;
  /** Max retries */
  maxRetries: number;
  /** Timeout in ms */
  timeoutMs: number;
  /** Current execution ID (incremented on each retry to invalidate old executions) */
  executionId: number;
  /** Execution callback */
  execute: () => Promise<unknown>;
  /** Resolve promise */
  resolve: (result: unknown) => void;
  /** Reject promise */
  reject: (error: Error) => void;
}

/**
 * Queue configuration
 */
export interface TaskQueueConfig {
  /** Max concurrent executions (default: 50) */
  maxConcurrent?: number;
  /** Max queue size (default: 10000) */
  maxQueueSize?: number;
  /** Default task timeout in ms (default: 120000) */
  defaultTimeoutMs?: number;
  /** Default max retries (default: 3) */
  defaultMaxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBaseDelayMs?: number;
  /** Max delay for exponential backoff in ms (default: 30000) */
  retryMaxDelayMs?: number;
  /** Enable fair scheduling across clients (default: true) */
  enableFairScheduling?: boolean;
}

/**
 * Queue statistics
 */
export interface TaskQueueStats {
  /** Tasks currently in queue */
  queuedTasks: number;
  /** Tasks currently executing */
  runningTasks: number;
  /** Total tasks processed */
  totalProcessed: number;
  /** Total tasks succeeded */
  totalSucceeded: number;
  /** Total tasks failed */
  totalFailed: number;
  /** Total retries */
  totalRetries: number;
  /** Average wait time in ms */
  averageWaitTimeMs: number;
  /** Average execution time in ms */
  averageExecutionTimeMs: number;
  /** Tasks by priority */
  tasksByPriority: Record<number, number>;
  /** Tasks by client */
  tasksByClient: Record<string, number>;
}

/**
 * Queue events
 */
export interface TaskQueueEvents {
  'task:queued': (taskId: string, priority: number) => void;
  'task:started': (taskId: string) => void;
  'task:completed': (taskId: string, durationMs: number) => void;
  'task:failed': (taskId: string, error: Error) => void;
  'task:retry': (taskId: string, attempt: number) => void;
  'task:timeout': (taskId: string) => void;
  'queue:empty': () => void;
  'queue:full': () => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TaskQueueConfig> = {
  maxConcurrent: 50,
  maxQueueSize: 10000,
  defaultTimeoutMs: 120000,
  defaultMaxRetries: 3,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 30000,
  enableFairScheduling: true
};

/**
 * TaskQueueManager - Task scheduling and execution
 *
 * @example
 * ```typescript
 * const queue = new TaskQueueManager({ maxConcurrent: 50 });
 *
 * // Add task to queue
 * const result = await queue.enqueue({
 *   taskId: 'task_123',
 *   priority: 5,
 *   clientId: 'claude-code',
 *   execute: async () => {
 *     // Task execution logic
 *     return { success: true };
 *   }
 * });
 *
 * // Shutdown
 * await queue.shutdown();
 * ```
 */
export class TaskQueueManager extends EventEmitter {
  private readonly config: Required<TaskQueueConfig>;
  private queues: Map<number, QueuedTask[]> = new Map();
  private running: Map<string, QueuedTask> = new Map();
  private clientTaskCount: Map<string, number> = new Map();
  private closed = false;
  private processing = false;

  // Statistics
  private stats = {
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalRetries: 0,
    totalWaitTimeMs: 0,
    totalExecutionTimeMs: 0
  };

  constructor(config: TaskQueueConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize priority queues
    for (let p = 1; p <= 10; p++) {
      this.queues.set(p, []);
    }

    logger.debug('[TaskQueueManager] Initialized', {
      maxConcurrent: this.config.maxConcurrent
    });
  }

  /**
   * Enqueue a task for execution
   */
  async enqueue(options: {
    taskId: string;
    priority?: number;
    clientId: string;
    payload?: Record<string, unknown>;
    engine?: string;
    timeoutMs?: number;
    maxRetries?: number;
    execute: () => Promise<unknown>;
  }): Promise<unknown> {
    if (this.closed) {
      throw new Error('TaskQueueManager is closed');
    }

    const totalQueued = this.getTotalQueuedCount();
    if (totalQueued >= this.config.maxQueueSize) {
      this.emit('queue:full');
      throw new Error('Task queue is full');
    }

    const priority = Math.min(10, Math.max(1, options.priority ?? 5));

    return new Promise((resolve, reject) => {
      const task: QueuedTask = {
        taskId: options.taskId,
        priority,
        clientId: options.clientId,
        payload: options.payload ?? {},
        engine: options.engine,
        queuedAt: Date.now(),
        retryCount: 0,
        maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
        timeoutMs: options.timeoutMs ?? this.config.defaultTimeoutMs,
        executionId: 0,
        execute: options.execute,
        resolve,
        reject
      };

      // Add to priority queue
      const queue = this.queues.get(priority)!;
      queue.push(task);

      // Track client tasks
      const clientCount = this.clientTaskCount.get(options.clientId) ?? 0;
      this.clientTaskCount.set(options.clientId, clientCount + 1);

      this.emit('task:queued', task.taskId, priority);

      logger.debug('[TaskQueueManager] Task queued', {
        taskId: task.taskId,
        priority,
        queueLength: queue.length
      });

      // Trigger processing
      this.processQueue();
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): TaskQueueStats {
    const totalProcessed = this.stats.totalProcessed || 1;
    const tasksByPriority: Record<number, number> = {};
    const tasksByClient: Record<string, number> = {};

    // Count tasks by priority
    for (const [priority, queue] of this.queues) {
      tasksByPriority[priority] = queue.length;
    }

    // Count tasks by client
    for (const [clientId, count] of this.clientTaskCount) {
      tasksByClient[clientId] = count;
    }

    return {
      queuedTasks: this.getTotalQueuedCount(),
      runningTasks: this.running.size,
      totalProcessed: this.stats.totalProcessed,
      totalSucceeded: this.stats.totalSucceeded,
      totalFailed: this.stats.totalFailed,
      totalRetries: this.stats.totalRetries,
      averageWaitTimeMs: this.stats.totalWaitTimeMs / totalProcessed,
      averageExecutionTimeMs: this.stats.totalExecutionTimeMs / totalProcessed,
      tasksByPriority,
      tasksByClient
    };
  }

  /**
   * Get running task count
   */
  getRunningCount(): number {
    return this.running.size;
  }

  /**
   * Get queued task count
   */
  getQueuedCount(): number {
    return this.getTotalQueuedCount();
  }

  /**
   * Check if a task is running
   */
  isTaskRunning(taskId: string): boolean {
    return this.running.has(taskId);
  }

  /**
   * Cancel a queued task
   */
  cancel(taskId: string): boolean {
    for (const [, queue] of this.queues) {
      const index = queue.findIndex((t) => t.taskId === taskId);
      if (index !== -1) {
        const task = queue.splice(index, 1)[0];
        if (task) {
          task.reject(new Error('Task cancelled'));
          this.decrementClientCount(task.clientId);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all queued tasks
   */
  clear(): number {
    let count = 0;

    for (const [priority, queue] of this.queues) {
      for (const task of queue) {
        task.reject(new Error('Queue cleared'));
        this.decrementClientCount(task.clientId);
        count++;
      }
      this.queues.set(priority, []);
    }

    this.emit('queue:empty');
    return count;
  }

  /**
   * Shutdown the queue manager
   */
  async shutdown(graceful = true): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    if (graceful) {
      // Wait for running tasks to complete
      const timeout = 30000;
      const start = Date.now();

      while (this.running.size > 0 && Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // Reject remaining queued tasks
    this.clear();

    // Reject running tasks
    for (const [taskId, task] of this.running) {
      task.reject(new Error('TaskQueueManager shutting down'));
      this.running.delete(taskId);
    }

    logger.debug('[TaskQueueManager] Shutdown complete', {
      totalProcessed: this.stats.totalProcessed
    });
  }

  /**
   * Process the queue
   */
  private processQueue(): void {
    if (this.processing || this.closed) return;

    this.processing = true;

    try {
      while (this.running.size < this.config.maxConcurrent) {
        const task = this.getNextTask();
        if (!task) break;

        this.executeTask(task);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get the next task to execute
   */
  private getNextTask(): QueuedTask | null {
    if (this.config.enableFairScheduling) {
      return this.getNextTaskFair();
    }
    return this.getNextTaskPriority();
  }

  /**
   * Get next task using strict priority ordering
   */
  private getNextTaskPriority(): QueuedTask | null {
    // Process highest priority first (10 down to 1)
    for (let p = 10; p >= 1; p--) {
      const queue = this.queues.get(p)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  /**
   * Get next task using fair scheduling
   * Balances across clients while respecting priority
   */
  private getNextTaskFair(): QueuedTask | null {
    // Find client with most queued tasks at highest priority
    const clientCounts = new Map<string, { priority: number; count: number }>();

    for (let p = 10; p >= 1; p--) {
      const queue = this.queues.get(p)!;
      for (const task of queue) {
        const running = Array.from(this.running.values()).filter(
          (t) => t.clientId === task.clientId
        ).length;

        // Skip if client has too many running
        if (running >= Math.ceil(this.config.maxConcurrent / 4)) {
          continue;
        }

        const existing = clientCounts.get(task.clientId);
        if (!existing || p > existing.priority) {
          clientCounts.set(task.clientId, { priority: p, count: 1 });
        } else if (p === existing.priority) {
          existing.count++;
        }
      }
    }

    // Pick task from client with highest priority and most queued
    let bestClient: string | null = null;
    let bestPriority = 0;
    let bestCount = 0;

    for (const [clientId, info] of clientCounts) {
      if (
        info.priority > bestPriority ||
        (info.priority === bestPriority && info.count > bestCount)
      ) {
        bestClient = clientId;
        bestPriority = info.priority;
        bestCount = info.count;
      }
    }

    if (!bestClient) {
      return this.getNextTaskPriority();
    }

    // Find task from best client
    for (let p = 10; p >= 1; p--) {
      const queue = this.queues.get(p)!;
      const index = queue.findIndex((t) => t.clientId === bestClient);
      if (index !== -1) {
        return queue.splice(index, 1)[0] ?? null;
      }
    }

    return null;
  }

  /**
   * Execute a task
   */
  private executeTask(task: QueuedTask): void {
    // Increment execution ID to invalidate any pending callbacks from previous attempts
    task.executionId++;
    const currentExecutionId = task.executionId;

    this.running.set(task.taskId, task);
    this.emit('task:started', task.taskId);

    const startTime = Date.now();
    const waitTime = startTime - task.queuedAt;
    this.stats.totalWaitTimeMs += waitTime;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      // Only handle timeout if this execution is still current
      if (this.running.has(task.taskId) && task.executionId === currentExecutionId) {
        this.running.delete(task.taskId);
        this.emit('task:timeout', task.taskId);
        this.handleFailure(task, new Error('Task timeout'));
      }
    }, task.timeoutMs);

    // Execute
    task
      .execute()
      .then((result) => {
        clearTimeout(timeoutId);
        // Only process if this execution is still current (not timed out or retried)
        if (!this.running.has(task.taskId) || task.executionId !== currentExecutionId) return;

        this.running.delete(task.taskId);
        this.decrementClientCount(task.clientId);

        const duration = Date.now() - startTime;
        this.stats.totalExecutionTimeMs += duration;
        this.stats.totalProcessed++;
        this.stats.totalSucceeded++;

        this.emit('task:completed', task.taskId, duration);
        task.resolve(result);

        logger.debug('[TaskQueueManager] Task completed', {
          taskId: task.taskId,
          durationMs: duration
        });

        // Process more tasks
        this.processQueue();

        if (this.getTotalQueuedCount() === 0 && this.running.size === 0) {
          this.emit('queue:empty');
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        // Only process if this execution is still current (not timed out or retried)
        if (!this.running.has(task.taskId) || task.executionId !== currentExecutionId) return;

        this.running.delete(task.taskId);
        this.handleFailure(task, error);

        // Process more tasks
        this.processQueue();
      });
  }

  /**
   * Handle task failure
   */
  private handleFailure(task: QueuedTask, error: Error): void {
    if (task.retryCount < task.maxRetries) {
      // Schedule retry
      task.retryCount++;
      this.stats.totalRetries++;

      const delay = this.calculateRetryDelay(task.retryCount);

      logger.debug('[TaskQueueManager] Scheduling retry', {
        taskId: task.taskId,
        attempt: task.retryCount,
        delayMs: delay
      });

      this.emit('task:retry', task.taskId, task.retryCount);

      setTimeout(() => {
        if (this.closed) {
          task.reject(error);
          return;
        }

        // Re-queue with same priority
        const queue = this.queues.get(task.priority)!;
        queue.unshift(task);
        this.processQueue();
      }, delay);
    } else {
      // Final failure
      this.decrementClientCount(task.clientId);
      this.stats.totalProcessed++;
      this.stats.totalFailed++;

      this.emit('task:failed', task.taskId, error);
      task.reject(error);

      logger.warn('[TaskQueueManager] Task failed', {
        taskId: task.taskId,
        error: error.message
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * delay;
    return Math.min(delay + jitter, this.config.retryMaxDelayMs);
  }

  /**
   * Get total queued count
   */
  private getTotalQueuedCount(): number {
    let count = 0;
    for (const [, queue] of this.queues) {
      count += queue.length;
    }
    return count;
  }

  /**
   * Decrement client task count
   */
  private decrementClientCount(clientId: string): void {
    const count = this.clientTaskCount.get(clientId) ?? 0;
    if (count > 1) {
      this.clientTaskCount.set(clientId, count - 1);
    } else {
      this.clientTaskCount.delete(clientId);
    }
  }
}

/**
 * Create a task queue manager instance
 */
export function createTaskQueueManager(
  config?: TaskQueueConfig
): TaskQueueManager {
  return new TaskQueueManager(config);
}
