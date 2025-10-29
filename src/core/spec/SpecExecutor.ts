/**
 * SpecExecutor - Executes tasks defined in spec files
 *
 * Orchestrates task execution according to dependency graph,
 * manages state, checkpoints, and integrates with AgentExecutor.
 *
 * Phase 1 (v5.8.10): Native agent execution (no subprocess)
 * Phase 2 (v5.10.0): Streaming progress & event bus
 *
 * @module core/spec/SpecExecutor
 */

import { spawn, type ChildProcess } from 'child_process';
import { writeFile, readFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { constants } from 'fs';
import pLimit from 'p-limit';
import { Mutex } from 'async-mutex';
import type {
  ParsedSpec,
  SpecExecutorOptions,
  SpecExecutionResult,
  TaskExecutionResult,
  SpecRunState,
  TaskExecutionState,
  TaskStatus,
  SpecTask
} from '../../types/spec.js';
import { SpecError as SpecErrorClass, SpecErrorCode } from '../../types/spec.js';
import { SpecGraphBuilder } from './SpecGraphBuilder.js';
import { SessionManager } from '../session-manager.js';
import { AgentExecutionService } from '../../agents/agent-execution-service.js';
import { SpecEventEmitter } from './SpecEventEmitter.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { logger } from '../../utils/logger.js';
import { LazyMemoryManager } from '../lazy-memory-manager.js';

/**
 * SpecExecutor class
 * Executes tasks according to dependency graph
 *
 * Phase 1 (v5.9.0): Uses native agent execution for 10x performance improvement
 */
export class SpecExecutor {
  private spec: ParsedSpec;
  private options: SpecExecutorOptions;
  private sessionManager: SessionManager;
  private runState: SpecRunState;
  private graphBuilder: SpecGraphBuilder;
  private abortController: AbortController;

  // Phase 1: Native execution service (replaces subprocess spawning)
  private agentService?: AgentExecutionService;
  private useNativeExecution: boolean;

  // Phase 2: Event emitter for real-time progress (v5.10.0)
  public events?: SpecEventEmitter;

  // Phase 3: Memory manager for context sharing (v5.12.0)
  private memoryManager?: LazyMemoryManager;
  private enableContextSharing: boolean;

  // Phase 3: Concurrency control (v5.12.0)
  private concurrencyLimit: number;
  private limiter: ReturnType<typeof pLimit>;

  // BUG FIX (v5.12.1): Mutex to serialize tasks.md file writes
  private taskFileMutex = new Mutex();

  // BUG FIX (v5.12.1): Track child processes to prevent leaks
  private activeChildren: Set<ChildProcess> = new Set();

  constructor(
    spec: ParsedSpec,
    options: SpecExecutorOptions,
    sessionManager: SessionManager
  ) {
    this.spec = spec;
    this.options = options;
    this.sessionManager = sessionManager;
    this.abortController = new AbortController();

    // Phase 1: Enable native execution by default (10x faster!)
    // Can be disabled with SPEC_LEGACY_EXECUTION=1 for debugging
    this.useNativeExecution = process.env.SPEC_LEGACY_EXECUTION !== '1';

    // Phase 3: Initialize defaults for all paths
    this.enableContextSharing = false;
    this.concurrencyLimit = 4;
    this.limiter = pLimit(4); // Temporary, will be re-initialized with config value

    // Build dependency graph
    this.graphBuilder = new SpecGraphBuilder();
    this.spec.graph = SpecGraphBuilder.build(spec.tasks);

    // Initialize run state
    this.runState = this.initializeRunState();

    // Phase 2: Initialize event emitter for streaming progress (v5.10.0)
    this.events = new SpecEventEmitter(
      spec.metadata.id,
      options.sessionId
    );

    // Phase 1: Initialize native execution service
    if (this.useNativeExecution && options.config) {
      this.agentService = new AgentExecutionService({
        projectDir: spec.metadata.workspacePath,
        config: options.config
      });

      // Phase 3: Initialize memory manager for context sharing
      this.enableContextSharing = this.options.config?.execution?.stages?.memorySharing?.enabled ?? true;

      if (this.enableContextSharing && this.useNativeExecution) {
        this.memoryManager = new LazyMemoryManager({
          dbPath: join(spec.metadata.workspacePath, '.automatosx/memory/memories.db'),
          maxEntries: this.options.config?.memory?.maxEntries ?? 10000
        });

        logger.info('SpecExecutor: Context sharing ENABLED', {
          sessionId: options.sessionId
        });
      }

      // Phase 3: Initialize concurrency limiter
      this.concurrencyLimit = this.options.concurrency || this.options.config?.execution?.concurrency?.maxConcurrentAgents || 4;
      this.limiter = pLimit(this.concurrencyLimit);

      logger.debug('SpecExecutor concurrency limit initialized', {
        limit: this.concurrencyLimit
      });

      logger.info('SpecExecutor initialized with NATIVE execution', {
        specId: spec.metadata.id,
        sessionId: options.sessionId,
        totalTasks: spec.tasks.length,
        parallel: options.parallel ?? false,
        nativeExecution: true
      });
    } else {
      logger.warn('SpecExecutor initialized with LEGACY subprocess execution', {
        specId: spec.metadata.id,
        sessionId: options.sessionId,
        totalTasks: spec.tasks.length,
        parallel: options.parallel ?? false,
        nativeExecution: false,
        reason: 'SPEC_LEGACY_EXECUTION=1'
      });
    }
  }

  /**
   * Initialize run state
   */
  private initializeRunState(): SpecRunState {
    const tasks = new Map<string, TaskExecutionState>();

    // Initialize state for all tasks
    for (const task of this.spec.tasks) {
      // Skip if filtered out
      if (!this.shouldExecuteTask(task)) {
        continue;
      }

      tasks.set(task.id, {
        taskId: task.id,
        status: task.status === 'completed' ? 'completed' : 'pending',
        retryCount: 0
      });
    }

    const completedCount = Array.from(tasks.values()).filter(
      t => t.status === 'completed'
    ).length;

    return {
      specId: this.spec.metadata.id,
      sessionId: this.options.sessionId,
      workspacePath: this.spec.metadata.workspacePath,
      tasks,
      metadata: {
        totalTasks: tasks.size,
        completedTasks: completedCount,
        failedTasks: 0,
        parallel: this.options.parallel ?? false,
        continueOnError: this.options.continueOnError ?? false
      },
      startedAt: new Date(),
      status: 'running'
    };
  }

  /**
   * Check if task should be executed based on filter
   */
  private shouldExecuteTask(task: SpecTask): boolean {
    if (!this.options.taskFilter) {
      return true;
    }

    const filter = this.options.taskFilter;

    // Filter by task IDs
    if (filter.taskIds && filter.taskIds.length > 0) {
      if (!filter.taskIds.includes(task.id)) {
        return false;
      }
    }

    // Filter by labels
    if (filter.labels && filter.labels.length > 0) {
      if (!task.labels?.some(l => filter.labels?.includes(l))) {
        return false;
      }
    }

    // Filter by agent hint
    if (filter.agentHint) {
      if (task.assigneeHint !== filter.agentHint) {
        return false;
      }
    }

    // Filter by status
    if (filter.status && filter.status.length > 0) {
      if (!filter.status.includes(task.status)) {
        return false;
      }
    }

    // Custom filter
    if (filter.customFilter) {
      if (!filter.customFilter(task)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute all tasks according to dependency graph
   */
  async execute(): Promise<SpecExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting spec execution', {
        specId: this.spec.metadata.id,
        totalTasks: this.runState.metadata.totalTasks,
        parallel: this.options.parallel ?? false,
        nativeExecution: this.useNativeExecution
      });

      // BUG FIX (v5.12.1): Load checkpoint if resuming from previous run
      if (this.options.checkpointInterval) {
        const loaded = await this.loadCheckpoint();
        if (loaded) {
          logger.info('Resuming from checkpoint', {
            completedTasks: this.runState.metadata.completedTasks,
            remainingTasks: this.runState.metadata.totalTasks - this.runState.metadata.completedTasks
          });
        }
      }

      // Phase 2B: Emit spec:started event
      this.events?.emitSpecStarted({
        totalTasks: this.runState.metadata.totalTasks,
        workspacePath: this.spec.metadata.workspacePath,
        parallel: this.options.parallel ?? false
      });

      if (!this.spec.graph) {
        throw new SpecErrorClass(
          SpecErrorCode.EXECUTION_FAILED,
          'Dependency graph not built'
        );
      }

      // Check for cycles
      if (this.spec.graph.metadata.hasCycles) {
        throw new SpecErrorClass(
          SpecErrorCode.CYCLIC_DEPENDENCY,
          'Cannot execute spec with cyclic dependencies',
          { cycles: this.spec.graph.metadata.cycles }
        );
      }

      const taskResults: TaskExecutionResult[] = [];

      if (this.options.parallel) {
        // Parallel execution (level by level)
        taskResults.push(...(await this.executeParallel()));
      } else {
        // Sequential execution (topological order)
        taskResults.push(...(await this.executeSequential()));
      }

      const duration = Date.now() - startTime;

      // Update run state
      this.runState.completedAt = new Date();
      this.runState.status =
        this.runState.metadata.failedTasks > 0 ? 'failed' : 'completed';

      logger.info('Spec execution completed', {
        specId: this.spec.metadata.id,
        duration,
        completed: this.runState.metadata.completedTasks,
        failed: this.runState.metadata.failedTasks
      });

      // Phase 2B: Emit spec:completed event
      const skippedCount = Array.from(this.runState.tasks.values()).filter(
        t => t.status === 'skipped'
      ).length;

      this.events?.emitSpecCompleted({
        completedTasks: this.runState.metadata.completedTasks,
        failedTasks: this.runState.metadata.failedTasks,
        skippedTasks: skippedCount,
        totalTasks: this.runState.metadata.totalTasks
      });

      // Phase 1: Cleanup agent service
      await this.cleanup();

      return {
        specId: this.spec.metadata.id,
        sessionId: this.options.sessionId,
        totalTasks: this.runState.metadata.totalTasks,
        completedTasks: this.runState.metadata.completedTasks,
        failedTasks: this.runState.metadata.failedTasks,
        skippedTasks: skippedCount,
        duration,
        taskResults,
        runState: this.runState
      };
    } catch (error) {
      logger.error('Spec execution failed', {
        error: (error as Error).message,
        specId: this.spec.metadata.id
      });

      this.runState.status = 'failed';

      // Phase 2B: Emit spec:failed event
      this.events?.emitSpecFailed({
        error: {
          message: (error as Error).message,
          code: (error as any).code,
          stack: (error as Error).stack
        },
        completedTasks: this.runState.metadata.completedTasks,
        failedTasks: this.runState.metadata.failedTasks
      });

      // Phase 1: Cleanup even on failure
      await this.cleanup();

      throw error;
    }
  }

  /**
   * Cleanup resources (Phase 1: v5.8.10)
   *
   * Cleans up AgentExecutionService and aborts any pending operations.
   * Called automatically after execution completes.
   */
  async cleanup(): Promise<void> {
    // Abort any pending operations
    this.abortController.abort();

    // BUG FIX (v5.12.1): Kill tracked child processes to prevent leaks
    for (const child of this.activeChildren) {
      if (!child.killed) {
        logger.debug('Killing active child process', { pid: child.pid });
        child.kill('SIGTERM');
      }
    }
    this.activeChildren.clear();

    // Cleanup agent service
    if (this.agentService) {
      try {
        await this.agentService.cleanup();
        logger.debug('SpecExecutor cleanup complete');
      } catch (error) {
        logger.warn('SpecExecutor cleanup failed', {
          error: (error as Error).message
        });
      }
    }

    // Phase 3: Cleanup memory manager (fix memory leak)
    if (this.memoryManager) {
      try {
        await this.memoryManager.close();
        logger.debug('SpecExecutor memory manager closed');
      } catch (error) {
        logger.warn('SpecExecutor memory manager cleanup failed', {
          error: (error as Error).message
        });
      }
    }

    // Phase 2B: Cleanup event emitter (fix memory leak)
    if (this.events) {
      try {
        await this.events.cleanup();
        logger.debug('SpecExecutor event emitter cleanup complete');
      } catch (error) {
        logger.warn('SpecExecutor event emitter cleanup failed', {
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Execute tasks sequentially in topological order
   */
  private async executeSequential(): Promise<TaskExecutionResult[]> {
    if (!this.spec.graph) {
      throw new SpecErrorClass(
        SpecErrorCode.EXECUTION_FAILED,
        'Dependency graph not built'
      );
    }

    const results: TaskExecutionResult[] = [];
    const taskIds = this.spec.graph.sortedTaskIds;

    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i];
      if (!taskId) continue;
      const state = this.runState.tasks.get(taskId);

      if (!state) {
        // Task filtered out
        continue;
      }

      // Skip if already completed
      if (state.status === 'completed') {
        logger.debug('Skipping already completed task', { taskId });
        continue;
      }

      // Check dependencies
      if (!this.areDependenciesCompleted(taskId)) {
        logger.warn('Skipping task due to failed dependencies', { taskId });
        state.status = 'skipped';
        continue;
      }

      // Execute task
      const result = await this.executeTask(taskId, i + 1, taskIds.length);
      results.push(result);

      // Update state
      state.status = result.status;
      state.output = result.output;
      state.error = result.error;
      state.completedAt = new Date();
      state.executedBy = result.executedBy;
      state.retryCount = result.retryCount;

      // Update metadata
      if (result.status === 'completed') {
        this.runState.metadata.completedTasks++;
      } else if (result.status === 'failed') {
        this.runState.metadata.failedTasks++;

        // Stop if not continuing on error
        if (!this.options.continueOnError) {
          logger.error('Stopping execution due to task failure', { taskId });
          break;
        }
      }

      // Checkpoint if needed
      if (
        this.options.checkpointInterval &&
        (i + 1) % this.options.checkpointInterval === 0
      ) {
        await this.saveCheckpoint();
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel (level by level)
   */
  private async executeParallel(): Promise<TaskExecutionResult[]> {
    if (!this.spec.graph) {
      throw new SpecErrorClass(
        SpecErrorCode.EXECUTION_FAILED,
        'Dependency graph not built'
      );
    }

    const results: TaskExecutionResult[] = [];
    const levels = this.computeLevels();

    for (const [levelIndex, taskIds] of levels.entries()) {
      logger.info(`Executing level ${levelIndex + 1}/${levels.length}`, {
        tasksInLevel: taskIds.length
      });

      const levelStartTime = Date.now();

      // Phase 2B: Emit level:started event
      this.events?.emitLevelStarted({
        level: levelIndex,
        totalLevels: levels.length,
        taskCount: taskIds.length,
        taskIds
      });

      // Execute all tasks in this level in parallel
      // Phase 3: Apply concurrency control with p-limit
      const levelResults = await Promise.all(
        taskIds.map((taskId, i) =>
          this.limiter(async () => {
            const state = this.runState.tasks.get(taskId);

            if (!state) {
              return null;
            }

            // Skip if already completed
            if (state.status === 'completed') {
              return null;
            }

            // Check dependencies
            if (!this.areDependenciesCompleted(taskId)) {
              state.status = 'skipped';
              return null;
            }

            // Execute task
            const result = await this.executeTask(
              taskId,
              i + 1,
              taskIds.length
            );

            // Update state
            state.status = result.status;
            state.output = result.output;
            state.error = result.error;
            state.completedAt = new Date();
            state.executedBy = result.executedBy;
            state.retryCount = result.retryCount;

            // Update metadata
            if (result.status === 'completed') {
              this.runState.metadata.completedTasks++;
            } else if (result.status === 'failed') {
              this.runState.metadata.failedTasks++;
            }

            return result;
          })
        )
      );

      // Add non-null results
      results.push(...levelResults.filter((r): r is TaskExecutionResult => r !== null));

      const levelDuration = Date.now() - levelStartTime;
      const completedInLevel = levelResults.filter(r => r?.status === 'completed').length;
      const failedInLevel = levelResults.filter(r => r?.status === 'failed').length;

      // Phase 2B: Emit level:completed event
      this.events?.emitLevelCompleted({
        level: levelIndex,
        totalLevels: levels.length,
        duration: levelDuration,
        completedTasks: completedInLevel,
        failedTasks: failedInLevel
      });

      // Stop if any task failed and not continuing on error
      if (
        !this.options.continueOnError &&
        levelResults.some(r => r?.status === 'failed')
      ) {
        logger.error('Stopping execution due to task failure in parallel level');
        break;
      }
    }

    return results;
  }

  /**
   * Compute execution levels for parallel execution
   * Tasks in the same level have no dependencies between them
   */
  private computeLevels(): string[][] {
    if (!this.spec.graph) {
      throw new SpecErrorClass(
        SpecErrorCode.EXECUTION_FAILED,
        'Dependency graph not built'
      );
    }

    const levels: string[][] = [];
    const taskLevels = new Map<string, number>();

    // Compute level for each task (BFS)
    const queue: string[] = [];

    // Start with tasks that have no dependencies
    for (const taskId of this.spec.graph.sortedTaskIds) {
      const deps = this.spec.graph.reverseAdjacencyList.get(taskId) || [];
      if (deps.length === 0) {
        taskLevels.set(taskId, 0);
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {
      const taskId = queue.shift();
      if (!taskId) continue;

      const currentLevel = taskLevels.get(taskId) ?? 0;
      const dependents = this.spec.graph.adjacencyList.get(taskId) || [];

      for (const depId of dependents) {
        const deps = this.spec.graph.reverseAdjacencyList.get(depId) || [];
        const maxDepLevel = Math.max(
          ...deps.map(d => taskLevels.get(d) ?? 0)
        );
        const newLevel = maxDepLevel + 1;

        if (!taskLevels.has(depId) || newLevel > (taskLevels.get(depId) ?? 0)) {
          taskLevels.set(depId, newLevel);
          queue.push(depId);
        }
      }
    }

    // Group tasks by level
    const maxLevel = Math.max(...Array.from(taskLevels.values()));
    for (let level = 0; level <= maxLevel; level++) {
      const tasksInLevel = Array.from(taskLevels.entries())
        .filter(([, l]) => l === level)
        .map(([id]) => id)
        .filter(id => this.runState.tasks.has(id));

      if (tasksInLevel.length > 0) {
        levels.push(tasksInLevel);
      }
    }

    return levels;
  }

  /**
   * Check if all dependencies are completed
   */
  private areDependenciesCompleted(taskId: string): boolean {
    if (!this.spec.graph) {
      return true;
    }

    const deps = this.spec.graph.reverseAdjacencyList.get(taskId) || [];

    for (const depId of deps) {
      const depState = this.runState.tasks.get(depId);

      if (!depState || depState.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    taskId: string,
    index: number,
    total: number
  ): Promise<TaskExecutionResult> {
    const task = this.spec.tasks.find(t => t.id === taskId);

    if (!task) {
      throw new SpecErrorClass(
        SpecErrorCode.EXECUTION_FAILED,
        `Task not found: ${taskId}`
      );
    }

    logger.info(`[${index}/${total}] Executing task: ${taskId}`, {
      title: task.title,
      ops: task.ops
    });

    const startTime = Date.now();

    // Phase 3: Join task to session
    if (this.options.sessionId) {
      try {
        await this.sessionManager.joinTask(this.options.sessionId, {
          taskId: task.id,
          taskTitle: task.title,
          agent: task.assigneeHint
        });
      } catch (error) {
        logger.warn('Failed to join task to session', {
          taskId: task.id,
          error: (error as Error).message
        });
      }
    }

    // Phase 2B: Emit task:started event
    this.events?.emitTaskStarted({
      taskId: task.id,
      taskTitle: task.title,
      agent: task.assigneeHint,
      level: 0 // Will be updated in parallel execution
    });

    // Dry run mode
    if (this.options.dryRun) {
      logger.info('Dry run mode - task simulated', { taskId });
      return {
        taskId,
        status: 'completed',
        output: '[DRY RUN] Task simulated successfully',
        duration: Date.now() - startTime,
        retryCount: 0
      };
    }

    try {
      // Phase 3: Retrieve prior task context
      const priorContext = await this.getPriorTaskContext(task.id);

      // Phase 3: Build context-enriched prompt
      const enrichedOps = this.buildContextPrompt(task.ops, priorContext);

      // Execute the ops command with enriched context
      const output = await this.executeOpsCommand(enrichedOps);

      // Phase 3: Save task output to memory
      await this.saveTaskOutput(task.id, task.title, output, Date.now() - startTime);

      // Update task status in tasks.md
      await this.updateTaskStatus(taskId, 'completed');

      const duration = Date.now() - startTime;

      // Phase 3: Mark task as completed in session
      if (this.options.sessionId) {
        try {
          await this.sessionManager.completeTask(
            this.options.sessionId,
            task.id,
            duration
          );
        } catch (error) {
          logger.warn('Failed to complete task in session', {
            taskId: task.id,
            error: (error as Error).message
          });
        }
      }

      // Phase 2B: Emit task:completed event
      this.events?.emitTaskCompleted({
        taskId: task.id,
        taskTitle: task.title,
        duration,
        output
      });

      return {
        taskId,
        status: 'completed',
        output,
        duration,
        executedBy: task.assigneeHint,
        retryCount: 0
      };
    } catch (error) {
      logger.error('Task execution failed', {
        taskId,
        error: (error as Error).message
      });

      // Update task status in tasks.md
      await this.updateTaskStatus(taskId, 'failed');

      const duration = Date.now() - startTime;

      // Phase 2B: Emit task:failed event
      this.events?.emitTaskFailed({
        taskId: task.id,
        taskTitle: task.title,
        duration,
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack
        }
      });

      return {
        taskId,
        status: 'failed',
        error: (error as Error).message,
        duration,
        executedBy: task.assigneeHint,
        retryCount: 0
      };
    }
  }

  /**
   * Get prior task context from memory (Phase 3)
   *
   * @param currentTaskId - Current task ID
   * @returns Array of prior task outputs
   */
  private async getPriorTaskContext(currentTaskId: string): Promise<Array<{
    id: string;
    title: string;
    output: string;
    timestamp: string;
  }>> {
    if (!this.memoryManager || !this.enableContextSharing || !this.options.sessionId) {
      return [];
    }

    try {
      // Search for prior task outputs in this session
      const results = await this.memoryManager.search({
        text: `session:${this.options.sessionId}`,
        limit: 5,
        filters: {
          type: 'task',
          sessionId: this.options.sessionId
        }
      });

      return results.map((result) => ({
        id: result.entry.metadata.taskId as string,
        title: result.entry.metadata.taskTitle as string,
        output: result.entry.content,
        timestamp: result.entry.createdAt.toISOString()
      }));
    } catch (error) {
      logger.warn('Failed to retrieve prior task context', {
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Build context-enriched prompt (Phase 3)
   * Supports both JSON format and old string format
   *
   * @param originalOps - Original ops command
   * @param priorContext - Prior task outputs
   * @returns Enriched ops command
   */
  private buildContextPrompt(
    originalOps: string,
    priorContext: Array<{ id: string; title: string; output: string; timestamp: string }>
  ): string {
    if (priorContext.length === 0) {
      return originalOps;
    }

    // Build context section
    const contextSection = priorContext
      .map(prior => `
### Prior Task: ${prior.title}
**Completed:** ${prior.timestamp}
**Output:**
${prior.output.slice(0, 500)}${prior.output.length > 500 ? '...' : ''}
`)
      .join('\n');

    const contextPrompt = `

## Context from Prior Tasks

You have access to outputs from previously completed tasks in this workflow:
${contextSection}

Use this context to:
- Maintain consistency with prior decisions
- Build upon prior work without redundancy
- Reference earlier outputs when relevant
`;

    // Handle JSON format
    if (originalOps.startsWith('{')) {
      try {
        const parsed = JSON.parse(originalOps);
        // Append context to the first argument
        if (parsed.args && Array.isArray(parsed.args) && parsed.args[0]) {
          parsed.args[0] = parsed.args[0] + contextPrompt;
          return JSON.stringify(parsed);
        }
      } catch {
        // Fall through to string format
      }
    }

    // Fallback: String format
    return originalOps + contextPrompt;
  }

  /**
   * Save task output to memory (Phase 3)
   *
   * @param taskId - Task ID
   * @param taskTitle - Task title
   * @param output - Task output
   * @param duration - Task duration in ms
   */
  private async saveTaskOutput(
    taskId: string,
    taskTitle: string,
    output: string,
    duration: number
  ): Promise<void> {
    if (!this.memoryManager || !this.enableContextSharing || !this.options.sessionId) {
      return;
    }

    try {
      await this.memoryManager.add(
        output,
        null, // No embedding needed
        {
          type: 'task',
          source: 'spec-executor',
          tags: [
            `session:${this.options.sessionId}`,
            `task:${taskId}`,
            `spec:${this.spec.metadata.id}`
          ],
          sessionId: this.options.sessionId,
          specId: this.spec.metadata.id,
          taskId,
          taskTitle,
          duration,
          timestamp: new Date().toISOString()
        }
      );

      logger.debug('Task output saved to memory', {
        taskId,
        sessionId: this.options.sessionId,
        outputLength: output.length
      });
    } catch (error) {
      logger.warn('Failed to save task output to memory', {
        taskId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Execute ops command (ax run ...)
   * Supports both JSON format and old string format
   *
   * Phase 1 (v5.9.0): Native execution (10x faster!)
   * - Uses AgentExecutionService for in-process execution
   * - Reuses providers, memory, config across tasks
   * - Falls back to subprocess if native execution disabled
   */
  private async executeOpsCommand(ops: string): Promise<string> {
    let agent: string;
    let task: string;

    // Try JSON format first
    if (ops.startsWith('{')) {
      try {
        const parsed = JSON.parse(ops);
        agent = parsed.agent;
        task = parsed.args?.[0];

        if (!agent || !task) {
          throw new Error('Invalid JSON ops format: missing agent or args[0]');
        }
      } catch (error) {
        throw new Error(`Invalid JSON ops format: ${(error as Error).message}`);
      }
    } else {
      // Fallback: String format
      // ops format: ax run <agent> "<task>" or ax run <agent> '<task>'
      // Support both single and double quotes for robustness
      const parts = ops.match(/ax\s+run\s+([\w-]+)\s+["']([^"']+)["']/);

      if (!parts || !parts[1] || !parts[2]) {
        throw new Error(`Invalid ops format: ${ops}`);
      }

      agent = parts[1];
      task = parts[2];
    }

    logger.debug('Executing ops command', {
      agent,
      task: task.substring(0, 50) + (task.length > 50 ? '...' : ''),
      method: this.useNativeExecution ? 'native' : 'subprocess'
    });

    // Phase 1: Use native execution if enabled
    if (this.useNativeExecution && this.agentService) {
      const result = await this.agentService.execute({
        agentName: agent,
        task,
        sessionId: this.options.sessionId,
        saveMemory: true,
        timeout: this.options.timeout,
        verbose: false
      });

      if (!result.success) {
        throw result.error || new Error('Agent execution failed');
      }

      return result.output;
    }

    // Legacy: Fallback to subprocess execution
    return this.executeOpsCommandLegacy(ops, agent, task);
  }

  /**
   * Legacy subprocess execution (kept for backward compatibility)
   * BUG FIX (v5.12.1): Track children, remove shell:true, implement cleanup
   */
  private async executeOpsCommandLegacy(ops: string, agent: string, task: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // BUG FIX: Use shell:false to prevent argument tokenization issues
      const child = spawn('ax', ['run', agent, task], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // BUG FIX: Track child process for cleanup
      this.activeChildren.add(child);

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      child.on('error', (error: Error) => {
        this.activeChildren.delete(child);
        reject(error);
      });

      child.on('close', (code: number | null) => {
        // BUG FIX: Remove from tracking when process exits
        this.activeChildren.delete(child);

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Update task status in tasks.md
   *
   * IMPORTANT: Re-reads file before updating to prevent stale state corruption
   * where concurrent task completions could overwrite each other's updates.
   */
  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    try {
      const tasksPath = this.spec.metadata.files.tasks;

      // BUG FIX (v5.12.1): Serialize file writes to prevent parallel race conditions
      // Without mutex: parallel tasks read same state → last writer wins → earlier updates lost
      await this.taskFileMutex.runExclusive(async () => {
        // CRITICAL FIX: Re-read file to get latest state
        // This prevents stale in-memory state from overwriting recent updates
        const { readFile } = await import('fs/promises');
        const currentContent = await readFile(tasksPath, 'utf8');

        // Find the task line and update status
        const lines = currentContent.split('\n');
        const updatedLines = lines.map(line => {
          // Match task ID
          if (line.includes(`id:${taskId}`)) {
            // Update status marker
            if (status === 'completed') {
              return line.replace(/^-\s*\[\s*\]/, '- [x]').replace(/^-\s*\[x\]/i, '- [x]');
            } else {
              return line.replace(/^-\s*\[x\]/i, '- [ ]');
            }
          }
          return line;
        });

        const updatedContent = updatedLines.join('\n');

        // Write back to file
        await writeFile(tasksPath, updatedContent, 'utf8');

        // CRITICAL FIX: Update in-memory copy to keep it in sync
        this.spec.content.tasks = updatedContent;
      });

      logger.debug('Task status updated in tasks.md', { taskId, status });
    } catch (error) {
      logger.error('Failed to update task status', {
        taskId,
        status,
        error: (error as Error).message
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Load checkpoint from disk (if exists)
   * BUG FIX (v5.12.1): Add missing checkpoint restoration feature
   */
  private async loadCheckpoint(): Promise<boolean> {
    try {
      const checkpointPath = join(
        this.spec.metadata.workspacePath,
        '.automatosx/checkpoints',
        `${this.runState.specId}-${this.runState.sessionId}.json`
      );

      // Check if checkpoint exists
      try {
        await access(checkpointPath, constants.F_OK);
      } catch {
        // Checkpoint doesn't exist
        return false;
      }

      // Load checkpoint
      const data = await readFile(checkpointPath, 'utf8');
      const checkpoint = JSON.parse(data);

      // Restore task states (convert object back to Map)
      if (checkpoint.tasks) {
        this.runState.tasks = new Map(Object.entries(checkpoint.tasks));
      }

      // Restore metadata
      if (checkpoint.metadata) {
        this.runState.metadata = checkpoint.metadata;
      }

      logger.info('Checkpoint loaded successfully', {
        specId: this.runState.specId,
        sessionId: this.runState.sessionId,
        completedTasks: this.runState.metadata.completedTasks,
        totalTasks: this.runState.metadata.totalTasks
      });

      return true;
    } catch (error) {
      logger.error('Failed to load checkpoint', {
        error: (error as Error).message
      });
      // Don't throw - just continue without checkpoint
      return false;
    }
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(): Promise<void> {
    try {
      const checkpointPath = join(
        this.spec.metadata.workspacePath,
        '.automatosx/checkpoints',
        `${this.runState.specId}-${this.runState.sessionId}.json`
      );

      // BUG FIX (v5.12.1): Ensure checkpoint directory exists before writing
      // Prevents ENOENT error on fresh workspaces
      const checkpointDir = dirname(checkpointPath);
      await mkdir(checkpointDir, { recursive: true });

      // Serialize run state (convert Map to object)
      const serialized = {
        ...this.runState,
        tasks: Object.fromEntries(this.runState.tasks)
      };

      await writeFile(checkpointPath, JSON.stringify(serialized, null, 2), 'utf8');

      logger.info('Checkpoint saved', {
        specId: this.runState.specId,
        sessionId: this.runState.sessionId,
        completedTasks: this.runState.metadata.completedTasks
      });
    } catch (error) {
      logger.error('Failed to save checkpoint', {
        error: (error as Error).message
      });
      throw new SpecErrorClass(
        SpecErrorCode.CHECKPOINT_FAILED,
        'Failed to save checkpoint',
        { error: (error as Error).message }
      );
    }
  }

}
