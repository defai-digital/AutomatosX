/**
 * Worker Pool - Offload CPU-intensive tasks to worker threads
 * v5.6.13: Phase 3.1 - Worker pool for delegation parsing and FTS5 operations
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { logger } from '../shared/logging/logger.js';
import { createSafeInterval } from '../shared/utils/safe-timers.js';

export interface WorkerTask<T = any> {
  id: string;
  type: 'delegation-parse' | 'fts5-tokenize' | 'memory-import';
  data: T;
  priority?: number; // Higher = more urgent (default: 0)
}

export interface WorkerResult<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
}

interface QueuedTask<T> {
  task: WorkerTask<T>;
  resolve: (result: WorkerResult<T>) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  taskId?: string;
  startTime?: number;
  taskTimeout?: NodeJS.Timeout;  // Timeout for current task
}

export interface WorkerPoolConfig {
  minWorkers?: number;    // Minimum workers (default: 1)
  maxWorkers?: number;    // Maximum workers (default: CPU count - 1)
  idleTimeout?: number;   // Idle worker timeout in ms (default: 30000)
  taskTimeout?: number;   // Task timeout in ms (default: 60000)
}

/**
 * Worker Pool Manager
 *
 * Manages a pool of worker threads for CPU-intensive tasks.
 * Features:
 * - Dynamic scaling (spawn workers on demand, terminate idle workers)
 * - Priority queue (high priority tasks executed first)
 * - Task timeout (prevent stuck workers)
 * - Health monitoring (restart crashed workers)
 */
export class WorkerPool {
  private workers: WorkerInfo[] = [];
  private queue: QueuedTask<any>[] = [];
  private pendingTasks: Map<string, QueuedTask<any>> = new Map(); // Track pending tasks by ID
  private config: Required<WorkerPoolConfig>;
  private workerScript: string;
  private shutdownRequested = false;
  private idleCheckCleanup?: () => void;

  constructor(workerScript: string, config: WorkerPoolConfig = {}) {
    this.workerScript = workerScript;

    // Default configuration
    const cpuCount = cpus().length;
    this.config = {
      minWorkers: config.minWorkers ?? 1,
      maxWorkers: config.maxWorkers ?? Math.max(1, cpuCount - 1),
      idleTimeout: config.idleTimeout ?? 30000,  // 30 seconds
      taskTimeout: config.taskTimeout ?? 60000   // 60 seconds
    };

    // Validate configuration
    if (this.config.minWorkers > this.config.maxWorkers) {
      throw new Error('minWorkers cannot exceed maxWorkers');
    }

    try {
      // Initialize minimum workers
      this.initializeMinWorkers();

      // Start idle worker cleanup AFTER successful initialization
      this.startIdleCleanup();

      logger.info('Worker pool initialized', {
        workerScript,
        minWorkers: this.config.minWorkers,
        maxWorkers: this.config.maxWorkers,
        cpuCount
      });
    } catch (error) {
      // CRITICAL FIX: Clean up on initialization failure
      this.cleanup();
      throw error;
    }
  }

  /**
   * Execute a task on the worker pool
   */
  async execute<T = any, R = any>(task: WorkerTask<T>): Promise<WorkerResult<R>> {
    if (this.shutdownRequested) {
      throw new Error('Worker pool is shutting down');
    }

    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask<T> = {
        task,
        resolve: resolve as any,
        reject,
        createdAt: Date.now()
      };

      // Add to priority queue
      this.enqueueTask(queuedTask);

      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const busyWorkers = this.workers.filter(w => w.busy).length;

    return {
      totalWorkers: this.workers.length,
      busyWorkers,
      idleWorkers: this.workers.length - busyWorkers,
      queuedTasks: this.queue.length,
      config: this.config
    };
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    this.shutdownRequested = true;

    // Clear idle cleanup interval using safe timer cleanup
    if (this.idleCheckCleanup) {
      this.idleCheckCleanup();
    }

    // Reject all queued tasks
    for (const queuedTask of this.queue) {
      queuedTask.reject(new Error('Worker pool shutting down'));
    }
    this.queue = [];

    // Reject all pending tasks
    for (const [taskId, queuedTask] of this.pendingTasks.entries()) {
      queuedTask.reject(new Error('Worker pool shutting down'));
    }
    this.pendingTasks.clear();

    // Terminate all workers
    const terminatePromises = this.workers.map(workerInfo =>
      workerInfo.worker.terminate()
    );

    await Promise.all(terminatePromises);
    this.workers = [];

    logger.info('Worker pool shut down');
  }

  /**
   * Internal cleanup (for initialization failures)
   * Similar to shutdown() but without async operations
   */
  private cleanup(): void {
    // Clear idle cleanup interval using safe timer cleanup
    if (this.idleCheckCleanup) {
      this.idleCheckCleanup();
      this.idleCheckCleanup = undefined;
    }

    // Terminate all workers (synchronously)
    for (const workerInfo of this.workers) {
      try {
        workerInfo.worker.terminate();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.workers = [];

    logger.debug('Worker pool cleaned up after initialization failure');
  }

  /**
   * Initialize minimum workers
   */
  private initializeMinWorkers(): void {
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.spawnWorker();
    }
  }

  /**
   * Spawn a new worker
   */
  private spawnWorker(): WorkerInfo {
    const worker = new Worker(this.workerScript);
    const workerInfo: WorkerInfo = {
      worker,
      busy: false
    };

    // Handle worker messages
    worker.on('message', (result: WorkerResult) => {
      this.handleWorkerResult(workerInfo, result);
    });

    // Handle worker errors
    worker.on('error', (error) => {
      logger.error('Worker error', {
        taskId: workerInfo.taskId,
        error: error.message
      });

      // If worker was busy, fail the task
      if (workerInfo.busy && workerInfo.taskId) {
        this.handleWorkerResult(workerInfo, {
          id: workerInfo.taskId,
          success: false,
          error: error.message,
          duration: Date.now() - (workerInfo.startTime || Date.now())
        });
      }

      // Remove crashed worker
      this.removeWorker(workerInfo);

      // Spawn replacement if below minimum
      if (this.workers.length < this.config.minWorkers) {
        this.spawnWorker();
      }
    });

    // Handle worker exit
    worker.on('exit', (code) => {
      if (code !== 0 && !this.shutdownRequested) {
        logger.warn('Worker exited unexpectedly', { code });

        // Bug #11: Clear taskTimeout before removing worker to prevent resource leak
        // Previous code referenced wrong property name 'timeout' instead of 'taskTimeout'
        if (workerInfo.taskTimeout) {
          clearTimeout(workerInfo.taskTimeout);
          workerInfo.taskTimeout = undefined;
        }

        // If worker was busy, fail the task
        if (workerInfo.busy && workerInfo.taskId) {
          const pendingTask = this.pendingTasks.get(workerInfo.taskId);
          if (pendingTask) {
            this.pendingTasks.delete(workerInfo.taskId);
            pendingTask.reject(new Error(`Worker exited unexpectedly with code ${code}`));
          }
        }

        this.removeWorker(workerInfo);

        // Spawn replacement if below minimum
        if (this.workers.length < this.config.minWorkers) {
          this.spawnWorker();
        }

        // Process next task
        this.processQueue();
      }
    });

    this.workers.push(workerInfo);

    logger.debug('Worker spawned', {
      totalWorkers: this.workers.length,
      maxWorkers: this.config.maxWorkers
    });

    return workerInfo;
  }

  /**
   * Remove a worker from the pool
   */
  private removeWorker(workerInfo: WorkerInfo): void {
    const index = this.workers.indexOf(workerInfo);
    if (index !== -1) {
      this.workers.splice(index, 1);

      logger.debug('Worker removed', {
        totalWorkers: this.workers.length
      });
    }
  }

  /**
   * Enqueue a task (priority queue)
   */
  private enqueueTask(queuedTask: QueuedTask<any>): void {
    const priority = queuedTask.task.priority || 0;

    // Insert in priority order (higher priority first)
    // Use findIndex for cleaner insertion logic
    const insertIndex = this.queue.findIndex(
      item => (item.task.priority || 0) < priority
    );

    if (insertIndex !== -1) {
      this.queue.splice(insertIndex, 0, queuedTask);
    } else {
      this.queue.push(queuedTask);
    }

    logger.debug('Task enqueued', {
      taskId: queuedTask.task.id,
      priority,
      queueLength: this.queue.length
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    // Find idle worker
    let workerInfo = this.workers.find(w => !w.busy);

    // If no idle workers and below max, spawn a new one
    if (!workerInfo && this.workers.length < this.config.maxWorkers && this.queue.length > 0) {
      workerInfo = this.spawnWorker();
    }

    // If we have an idle worker and queued tasks, assign task
    while (workerInfo && this.queue.length > 0) {
      const queuedTask = this.queue.shift()!;
      this.assignTask(workerInfo, queuedTask);

      // Find next idle worker
      workerInfo = this.workers.find(w => !w.busy);
    }
  }

  /**
   * Assign a task to a worker
   */
  private assignTask(workerInfo: WorkerInfo, queuedTask: QueuedTask<any>): void {
    workerInfo.busy = true;
    workerInfo.taskId = queuedTask.task.id;
    workerInfo.startTime = Date.now();

    // Track pending task
    this.pendingTasks.set(queuedTask.task.id, queuedTask);

    // Set task timeout
    const timeout = setTimeout(() => {
      if (workerInfo.busy && workerInfo.taskId === queuedTask.task.id) {
        logger.warn('Task timeout', {
          taskId: queuedTask.task.id,
          timeout: this.config.taskTimeout
        });

        // Clean up pending task
        this.pendingTasks.delete(queuedTask.task.id);

        // Terminate hung worker
        workerInfo.worker.terminate();
        this.removeWorker(workerInfo);

        // Fail the task
        queuedTask.reject(new Error(`Task timeout after ${this.config.taskTimeout}ms`));

        // Spawn replacement if below minimum
        if (this.workers.length < this.config.minWorkers) {
          this.spawnWorker();
        }

        // Process next task
        this.processQueue();
      }
    }, this.config.taskTimeout);

    // Send task to worker
    workerInfo.worker.postMessage(queuedTask.task);

    // Store timeout reference
    workerInfo.taskTimeout = timeout;

    logger.debug('Task assigned to worker', {
      taskId: queuedTask.task.id,
      type: queuedTask.task.type,
      queuedFor: Date.now() - queuedTask.createdAt
    });
  }

  /**
   * Handle worker result
   */
  private handleWorkerResult(workerInfo: WorkerInfo, result: WorkerResult): void {
    // Clear timeout
    if (workerInfo.taskTimeout) {
      clearTimeout(workerInfo.taskTimeout);
      workerInfo.taskTimeout = undefined;
    }

    // Mark worker as idle
    workerInfo.busy = false;
    workerInfo.taskId = undefined;
    workerInfo.startTime = undefined;

    // Find and resolve/reject the corresponding pending task
    const pendingTask = this.pendingTasks.get(result.id);
    if (pendingTask) {
      this.pendingTasks.delete(result.id);

      if (result.success) {
        pendingTask.resolve(result);
      } else {
        pendingTask.reject(new Error(result.error || 'Worker task failed'));
      }
    }

    logger.debug('Worker result received', {
      taskId: result.id,
      success: result.success,
      duration: result.duration
    });

    // Process next task
    this.processQueue();
  }

  /**
   * Start idle worker cleanup
   * v12.4.0: Uses createSafeInterval to prevent process hang on exit
   */
  private startIdleCleanup(): void {
    this.idleCheckCleanup = createSafeInterval(() => {
      const idleWorkers = this.workers.filter(w => !w.busy);

      // FIXED (v6.5.13 Bug #131): Ensure safe calculation of workers to terminate
      // We should only terminate idle workers, and never go below minWorkers
      const excessCount = this.workers.length - this.config.minWorkers;
      if (excessCount > 0 && idleWorkers.length > 0) {
        // Calculate how many idle workers we can safely terminate
        const canTerminate = Math.min(excessCount, idleWorkers.length);

        // Terminate workers (slice creates a copy, so removing from this.workers is safe)
        const workersToTerminate = idleWorkers.slice(0, canTerminate);
        for (const workerInfo of workersToTerminate) {
          workerInfo.worker.terminate();
          this.removeWorker(workerInfo);

          logger.debug('Idle worker terminated', {
            totalWorkers: this.workers.length
          });
        }
      }
    }, this.config.idleTimeout, { name: 'worker-pool-idle-cleanup' });
  }
}
