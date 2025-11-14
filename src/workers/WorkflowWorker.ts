/**
 * WorkflowWorker.ts
 *
 * Background worker process for executing queued workflows
 * Phase 5 Week 2: Distributed Execution
 */

import { EventEmitter } from 'events';
import { WorkflowQueue, QueueItem } from '../queue/WorkflowQueue.js';
import { WorkflowEngine } from '../services/WorkflowEngine.js';
import { WorkflowCache } from '../cache/WorkflowCache.js';
import { randomUUID } from 'crypto';

/**
 * Worker status
 */
export type WorkerStatus = 'idle' | 'busy' | 'paused' | 'stopped';

/**
 * Worker statistics
 */
export interface WorkerStats {
  id: string;
  status: WorkerStatus;
  tasksProcessed: number;
  tasksFailed: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  uptime: number;
  lastTaskAt?: number;
}

/**
 * WorkflowWorker - Process workflows from queue
 */
export class WorkflowWorker extends EventEmitter {
  private id: string;
  private queue: WorkflowQueue;
  private engine: WorkflowEngine;
  private cache: WorkflowCache;
  private status: WorkerStatus;
  private isRunning: boolean;
  private currentItem?: QueueItem;

  // Statistics
  private tasksProcessed: number = 0;
  private tasksFailed: number = 0;
  private totalProcessingTime: number = 0;
  private startedAt: number;
  private lastTaskAt?: number;

  constructor(queue: WorkflowQueue, engine: WorkflowEngine, cache: WorkflowCache) {
    super();
    this.id = `worker_${randomUUID().substring(0, 8)}`;
    this.queue = queue;
    this.engine = engine;
    this.cache = cache;
    this.status = 'idle';
    this.isRunning = false;
    this.startedAt = Date.now();
  }

  /**
   * Start worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.status = 'idle';
    this.emit('started', { id: this.id });

    // Start processing loop
    this.processLoop();
  }

  /**
   * Stop worker (graceful shutdown)
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.status = 'stopped';

    // Wait for current task to complete
    if (this.currentItem) {
      await new Promise(resolve => {
        this.once('task_completed', resolve);
        this.once('task_failed', resolve);
      });
    }

    this.emit('stopped', { id: this.id });
  }

  /**
   * Pause worker
   */
  pause(): void {
    if (this.status !== 'busy') {
      this.status = 'paused';
      this.emit('paused', { id: this.id });
    }
  }

  /**
   * Resume worker
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'idle';
      this.emit('resumed', { id: this.id });
      this.processLoop();
    }
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning && this.status !== 'paused') {
      try {
        // Dequeue next item
        const item = this.queue.dequeue(this.id);

        if (!item) {
          // No items available, wait a bit
          this.status = 'idle';
          await this.sleep(1000);
          continue;
        }

        // Process item
        await this.processItem(item);

      } catch (error) {
        this.emit('error', { id: this.id, error });
        await this.sleep(5000); // Wait before retrying
      }
    }
  }

  /**
   * Process single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    this.currentItem = item;
    this.status = 'busy';
    const startTime = Date.now();

    this.emit('task_started', { id: this.id, itemId: item.id, workflow: item.workflowDefinition.name });

    try {
      // Check cache first
      const cached = this.cache.get(item.workflowDefinition.name, item.options.context || {});

      let result;
      if (cached) {
        result = cached;
        this.emit('cache_hit', { id: this.id, itemId: item.id });
      } else {
        // Execute workflow
        result = await this.engine.executeWorkflow(item.workflowDefinition, item.options);

        // Cache result
        this.cache.set(item.workflowDefinition.name, item.options.context || {}, result);
      }

      // Mark as completed
      this.queue.complete(item.id, result);

      const duration = Date.now() - startTime;
      this.tasksProcessed++;
      this.totalProcessingTime += duration;
      this.lastTaskAt = Date.now();

      this.emit('task_completed', { id: this.id, itemId: item.id, duration });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark as failed
      this.queue.fail(item.id, errorMessage);

      this.tasksFailed++;
      this.emit('task_failed', { id: this.id, itemId: item.id, error: errorMessage });

    } finally {
      this.currentItem = undefined;
      this.status = 'idle';
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    return {
      id: this.id,
      status: this.status,
      tasksProcessed: this.tasksProcessed,
      tasksFailed: this.tasksFailed,
      totalProcessingTime: this.totalProcessingTime,
      averageProcessingTime: this.tasksProcessed > 0 ? this.totalProcessingTime / this.tasksProcessed : 0,
      uptime: Date.now() - this.startedAt,
      lastTaskAt: this.lastTaskAt,
    };
  }

  /**
   * Get worker ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get worker status
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
