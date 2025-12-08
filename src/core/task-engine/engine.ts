/**
 * Task Engine - Core Orchestration
 *
 * Orchestrates task execution with:
 * - Loop prevention via LoopGuard
 * - Persistent storage via TaskStore
 * - Routing via existing Router
 * - Retry and fallback logic
 * - Result caching
 *
 * @module core/task-engine/engine
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/logging/logger.js';
import { LoopGuard, createLoopGuard } from './loop-guard.js';
import { createTaskStore, type TaskStoreLike } from './store.js';
import {
  type Task,
  type TaskContext,
  type TaskEngineConfig,
  type TaskEngineStats,
  type CreateTaskInput,
  type CreateTaskResult,
  type RunTaskOptions,
  type TaskResult,
  type TaskFilter,
  type TaskEngine as TaskEngineType,
  type TaskMetrics,
  type LoopGuardConfig,
  type TaskStoreConfig,
  TaskEngineError,
  LoopPreventionError,
  isLoopPreventionError
} from './types.js';

/**
 * Default engine configuration
 * Phase 5: Scaled to 50 concurrent tasks (full scale)
 */
const DEFAULT_CONFIG: Required<TaskEngineConfig> = {
  store: {},
  loopGuard: {},
  maxConcurrent: 50, // Phase 5: Increased from 36 to 50
  defaultTimeoutMs: 120000,
  maxRetries: 3,
  retryDelayMs: 1000,
  cacheEnabled: true,
  cacheTtlMs: 3600000 // 1 hour
};

/**
 * Task execution event types
 */
export interface TaskEngineEvents {
  'task:created': (task: CreateTaskResult) => void;
  'task:started': (taskId: string, engine: TaskEngineType) => void;
  'task:completed': (taskId: string, result: TaskResult) => void;
  'task:failed': (taskId: string, error: Error) => void;
  'task:retry': (taskId: string, attempt: number, error: Error) => void;
  'loop:prevented': (taskId: string, context: TaskContext, targetEngine: string) => void;
}

/**
 * TaskEngine - Core task orchestration
 *
 * @example
 * ```typescript
 * const engine = new TaskEngine({
 *   maxConcurrent: 12,
 *   defaultTimeoutMs: 120000
 * });
 *
 * // Create and run a task
 * const createResult = await engine.createTask({
 *   type: 'web_search',
 *   payload: { query: 'AI news' }
 * });
 *
 * const runResult = await engine.runTask(createResult.id);
 * console.log(runResult.result);
 *
 * // Cleanup
 * await engine.shutdown();
 * ```
 */
export class TaskEngine extends EventEmitter {
  private config: Required<TaskEngineConfig>;
  private loopGuard: LoopGuard;
  private store: TaskStoreLike;
  private runningTasks = new Map<string, AbortController>();
  private closed = false;

  // Statistics
  private stats = {
    totalCreated: 0,
    completed: 0,
    failed: 0,
    expired: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalDurationMs: 0
  };

  constructor(config: Partial<TaskEngineConfig> = {}) {
    super();

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      store: { ...DEFAULT_CONFIG.store, ...config.store },
      loopGuard: { ...DEFAULT_CONFIG.loopGuard, ...config.loopGuard }
    };

    // Initialize components
    this.loopGuard = createLoopGuard(this.config.loopGuard);
    this.store = createTaskStore(this.config.store);

    logger.info('TaskEngine initialized', {
      maxConcurrent: this.config.maxConcurrent,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      cacheEnabled: this.config.cacheEnabled
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
    this.ensureOpen();

    try {
      const result = this.store.createTask(input);

      this.stats.totalCreated++;
      this.emit('task:created', result);

      logger.debug('Task created via engine', { taskId: result.id });

      return result;
    } catch (error) {
      if (error instanceof TaskEngineError) {
        throw error;
      }
      throw new TaskEngineError(
        `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORE_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Run a task
   */
  async runTask(taskId: string, options: RunTaskOptions = {}): Promise<TaskResult> {
    this.ensureOpen();

    // Check concurrency limit
    if (this.runningTasks.size >= this.config.maxConcurrent) {
      throw new TaskEngineError(
        `Maximum concurrent tasks reached: ${this.config.maxConcurrent}`,
        'EXECUTION_FAILED',
        { runningCount: this.runningTasks.size, limit: this.config.maxConcurrent }
      );
    }

    // Get the task
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new TaskEngineError(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    }

    // Respect external cancellation before starting
    if (options.abortSignal?.aborted) {
      throw new TaskEngineError('Task execution aborted', 'EXECUTION_TIMEOUT');
    }

    // Check task status
    if (task.status === 'running') {
      throw new TaskEngineError(
        `Task is already running: ${taskId}`,
        'TASK_ALREADY_RUNNING'
      );
    }

    if (task.status === 'completed') {
      // Return cached result
      if (task.result) {
        this.stats.cacheHits++;
        return {
          taskId,
          status: 'completed',
          result: task.result,
          engine: task.engine ?? 'auto',
          metrics: task.metrics,
          error: null,
          cacheHit: true
        };
      }
    }

    if (task.status === 'expired') {
      throw new TaskEngineError(`Task has expired: ${taskId}`, 'TASK_EXPIRED');
    }

    // Check expiration
    if (Date.now() > task.expiresAt) {
      this.store.updateTaskStatus(taskId, 'expired');
      throw new TaskEngineError(`Task has expired: ${taskId}`, 'TASK_EXPIRED');
    }

    // Determine target engine
    const targetEngine = options.engineOverride ?? task.engine ?? this.estimateEngine(task.type);

    // Validate loop prevention
    const loopContext = this.buildLoopContext(task, options.loopContext);

    try {
      this.loopGuard.validateExecution(loopContext, targetEngine);
    } catch (error) {
      if (isLoopPreventionError(error)) {
        this.emit('loop:prevented', taskId, loopContext, targetEngine);
        logger.warn('Loop prevented', {
          taskId,
          targetEngine,
          callChain: error.callChain
        });
      }
      throw error;
    }

    // Execute the task
    return this.executeTask(task, targetEngine, loopContext, options);
  }

  /**
   * Get task result (without running)
   */
  getTaskResult(taskId: string): TaskResult | null {
    this.ensureOpen();

    const task = this.store.getTask(taskId);
    if (!task) {
      return null;
    }

    if (task.status !== 'completed') {
      return null;
    }

    return {
      taskId,
      status: 'completed',
      result: task.result,
      engine: task.engine ?? 'auto',
      metrics: task.metrics,
      error: null,
      cacheHit: true
    };
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | null {
    this.ensureOpen();
    return this.store.getTask(taskId);
  }

  /**
   * List tasks with pagination info
   */
  listTasks(filter?: TaskFilter): { tasks: Task[]; total: number } {
    this.ensureOpen();
    const tasks = this.store.listTasks(filter);
    const total = this.store.countTasks(filter);
    return { tasks, total };
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string, force = false): boolean {
    this.ensureOpen();

    const task = this.store.getTask(taskId);
    if (!task) {
      return false;
    }

    // Check if running
    if (task.status === 'running' && !force) {
      throw new TaskEngineError(
        `Cannot delete running task: ${taskId}. Use force=true to override.`,
        'TASK_ALREADY_RUNNING'
      );
    }

    // Cancel if running
    if (task.status === 'running') {
      const controller = this.runningTasks.get(taskId);
      if (controller) {
        controller.abort();
        this.runningTasks.delete(taskId);
      }
    }

    return this.store.deleteTask(taskId);
  }

  /**
   * Get engine statistics
   */
  getStats(): TaskEngineStats {
    this.ensureOpen();

    const storeStats = this.store.getStats();
    const cacheTotal = this.stats.cacheHits + this.stats.cacheMisses;

    return {
      totalCreated: this.stats.totalCreated,
      runningCount: this.runningTasks.size,
      completedCount: storeStats.byStatus.completed,
      failedCount: storeStats.byStatus.failed,
      expiredCount: storeStats.byStatus.expired,
      cache: {
        hits: this.stats.cacheHits,
        misses: this.stats.cacheMisses,
        hitRate: cacheTotal > 0 ? this.stats.cacheHits / cacheTotal : 0
      },
      avgDurationMs: this.stats.completed > 0
        ? this.stats.totalDurationMs / this.stats.completed
        : 0
    };
  }

  /**
   * Cleanup expired tasks
   */
  cleanupExpired(): number {
    this.ensureOpen();

    const cleaned = this.store.cleanupExpired();
    this.stats.expired += cleaned;

    return cleaned;
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    if (this.closed) return;

    logger.info('TaskEngine shutting down', {
      runningTasks: this.runningTasks.size
    });

    // Cancel all running tasks
    for (const [taskId, controller] of this.runningTasks) {
      controller.abort();
      logger.debug('Cancelled running task', { taskId });
    }
    this.runningTasks.clear();

    // Close store
    this.store.close();
    this.closed = true;

    logger.info('TaskEngine shutdown complete');
  }

  /**
   * Check if engine is healthy
   */
  isHealthy(): boolean {
    return !this.closed && this.runningTasks.size < this.config.maxConcurrent;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async executeTask(
    task: Task,
    targetEngine: TaskEngineType,
    context: TaskContext,
    options: RunTaskOptions
  ): Promise<TaskResult> {
    const taskId = task.id;
    const abortController = new AbortController();
    let timeoutTriggered = false;
    let externalCancelled = false;

    const externalAbort = options.abortSignal
      ? () => {
          externalCancelled = true;
          abortController.abort();
        }
      : null;
    if (options.abortSignal && externalAbort) {
      options.abortSignal.addEventListener('abort', externalAbort, { once: true });
    }
    const startTime = Date.now();

    // Track running task
    this.runningTasks.set(taskId, abortController);

    // Update status to running
    this.store.updateTaskStatus(taskId, 'running');
    this.emit('task:started', taskId, targetEngine);

    // Set up timeout
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      abortController.abort();
    }, timeoutMs);

    try {
      // Execute with retry
      const result = await this.executeWithRetry(
        task,
        targetEngine,
        context,
        abortController.signal
      );

      const durationMs = Date.now() - startTime;

      // Update store with result
      this.store.updateTaskResult(taskId, result, {
        durationMs,
        tokensPrompt: null,
        tokensCompletion: null
      });

      // Update stats
      this.stats.completed++;
      this.stats.cacheMisses++;
      this.stats.totalDurationMs += durationMs;

      const taskResult: TaskResult = {
        taskId,
        status: 'completed',
        result,
        engine: targetEngine,
        metrics: { durationMs, tokensPrompt: null, tokensCompletion: null },
        error: null,
        cacheHit: false
      };

      this.emit('task:completed', taskId, taskResult);
      logger.debug('Task completed', { taskId, durationMs, engine: targetEngine });

      return taskResult;

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // Check if aborted (timeout or external cancel)
      if (abortController.signal.aborted) {
        const taskError = externalCancelled
          ? { code: 'CANCELLED', message: 'Task was cancelled by caller' }
          : { code: 'TIMEOUT', message: `Task timed out after ${timeoutMs}ms` };
        this.store.updateTaskFailed(taskId, taskError, durationMs);

        this.stats.failed++;
        this.emit('task:failed', taskId, new TaskEngineError(taskError.message, 'EXECUTION_TIMEOUT'));

        return {
          taskId,
          status: 'failed',
          result: null,
          engine: targetEngine,
          metrics: { durationMs, tokensPrompt: null, tokensCompletion: null },
          error: taskError,
          cacheHit: false
        };
      }

      // Handle other errors
      const taskError = {
        code: error instanceof TaskEngineError ? error.code : 'EXECUTION_FAILED',
        message: errorObj.message
      };

      this.store.updateTaskFailed(taskId, taskError, durationMs);
      this.stats.failed++;
      this.emit('task:failed', taskId, errorObj);

      logger.error('Task failed', { taskId, error: errorObj.message, durationMs });

      return {
        taskId,
        status: 'failed',
        result: null,
        engine: targetEngine,
        metrics: { durationMs, tokensPrompt: null, tokensCompletion: null },
        error: taskError,
        cacheHit: false
      };

    } finally {
      clearTimeout(timeoutId);
      this.runningTasks.delete(taskId);
      if (options.abortSignal && externalAbort) {
        options.abortSignal.removeEventListener('abort', externalAbort);
      }
    }
  }

  private async executeWithRetry(
    task: Task,
    engine: TaskEngineType,
    context: TaskContext,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (signal.aborted) {
        throw new TaskEngineError('Task execution aborted', 'EXECUTION_TIMEOUT');
      }

      try {
        // Execute the actual task
        // In Phase 1, we simulate execution
        // In Phase 2+, this will call the Router
        return await this.executeOnEngine(task, engine, context, signal);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on loop prevention errors
        if (isLoopPreventionError(error)) {
          throw error;
        }

        // Don't retry if aborted
        if (signal.aborted) {
          throw error;
        }

        // Check if retryable
        if (attempt < this.config.maxRetries && this.isRetryableError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);

          this.store.incrementRetry(task.id);
          this.emit('task:retry', task.id, attempt + 1, lastError);

          logger.debug('Retrying task', {
            taskId: task.id,
            attempt: attempt + 1,
            delay,
            error: lastError.message
          });

          // Pass abort signal so retry delay respects timeout
          await this.sleep(delay, signal);
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new TaskEngineError('Task execution failed', 'EXECUTION_FAILED');
  }

  /**
   * Execute task on target engine
   *
   * Phase 1: Simulated execution (returns mock result)
   * Phase 2+: Will integrate with Router for actual execution
   */
  private async executeOnEngine(
    task: Task,
    engine: TaskEngineType,
    context: TaskContext,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    // Phase 1: Simulated execution
    // In production, this will call the Router to execute on actual engines
    logger.debug('Executing task on engine', {
      taskId: task.id,
      engine,
      type: task.type,
      callChain: context.callChain
    });

    // Simulate some processing time (respects abort signal)
    await this.sleep(100, signal);

    // Return simulated result based on task type
    switch (task.type) {
      case 'web_search':
        return {
          query: (task.payload.query as string) ?? 'unknown',
          results: [
            { title: 'Result 1', url: 'https://example.com/1', snippet: 'Sample result 1' },
            { title: 'Result 2', url: 'https://example.com/2', snippet: 'Sample result 2' }
          ],
          engine,
          timestamp: Date.now()
        };

      case 'code_review':
        return {
          file: (task.payload.file as string) ?? 'unknown.ts',
          issues: [],
          suggestions: ['Consider adding type annotations'],
          engine,
          timestamp: Date.now()
        };

      case 'code_generation':
        return {
          prompt: (task.payload.prompt as string) ?? '',
          code: '// Generated code placeholder',
          language: (task.payload.language as string) ?? 'typescript',
          engine,
          timestamp: Date.now()
        };

      case 'analysis':
        return {
          input: task.payload.input ?? {},
          analysis: 'Analysis result placeholder',
          confidence: 0.95,
          engine,
          timestamp: Date.now()
        };

      case 'custom':
      default:
        return {
          payload: task.payload,
          result: 'Custom task completed',
          engine,
          timestamp: Date.now()
        };
    }
  }

  private buildLoopContext(task: Task, incomingContext?: TaskContext): TaskContext {
    if (incomingContext) {
      return this.loopGuard.mergeContext(incomingContext);
    }

    return {
      taskId: task.id,
      originClient: task.context.originClient,
      callChain: task.context.callChain.length > 0
        ? task.context.callChain
        : [task.context.originClient],
      depth: task.context.depth,
      maxDepth: this.loopGuard.getConfig().maxDepth,
      createdAt: task.createdAt
    };
  }

  private estimateEngine(type: string): TaskEngineType {
    switch (type) {
      case 'web_search':
        return 'gemini';
      case 'code_review':
      case 'code_generation':
        return 'claude';
      case 'analysis':
        return 'claude';
      default:
        return 'claude';
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof TaskEngineError) {
      // Don't retry these errors
      const nonRetryable: string[] = [
        'TASK_NOT_FOUND',
        'TASK_EXPIRED',
        'PAYLOAD_TOO_LARGE',
        'LOOP_DETECTED',
        'DEPTH_EXCEEDED',
        'CHAIN_TOO_LONG',
        'BLOCKED_PATTERN'
      ];
      return !nonRetryable.includes(error.code);
    }

    // Retry on generic errors
    return true;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new TaskEngineError('TaskEngine is closed', 'EXECUTION_FAILED');
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }

      // Create named handler so we can remove it on normal completion
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new Error('Aborted'));
      };

      const timeoutId = setTimeout(() => {
        // Remove abort listener on normal completion to prevent memory leak
        signal?.removeEventListener('abort', abortHandler);
        resolve();
      }, ms);

      signal?.addEventListener('abort', abortHandler, { once: true });
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Default task engine instance (singleton)
 */
let defaultTaskEngine: TaskEngine | null = null;

/**
 * Get the default task engine instance
 */
export function getTaskEngine(config?: Partial<TaskEngineConfig>): TaskEngine {
  if (!defaultTaskEngine) {
    defaultTaskEngine = new TaskEngine(config);
  }
  return defaultTaskEngine;
}

/**
 * Reset the default task engine (for testing)
 */
export async function resetTaskEngine(): Promise<void> {
  if (defaultTaskEngine) {
    await defaultTaskEngine.shutdown();
    defaultTaskEngine = null;
  }
}

/**
 * Create a new task engine with custom configuration
 */
export function createTaskEngine(config?: Partial<TaskEngineConfig>): TaskEngine {
  return new TaskEngine(config);
}
