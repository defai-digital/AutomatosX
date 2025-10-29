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

import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
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
    if (this.useNativeExecution) {
      this.agentService = new AgentExecutionService({
        projectDir: spec.metadata.workspacePath,
        config: options.config
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
      const levelResults = await Promise.all(
        taskIds.map(async (taskId, i) => {
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
      // Execute the ops command (ax run <agent> "task")
      const output = await this.executeOpsCommand(task.ops);

      // Update task status in tasks.md
      await this.updateTaskStatus(taskId, 'completed');

      const duration = Date.now() - startTime;

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
   * Execute ops command (ax run ...)
   *
   * Phase 1 (v5.9.0): Native execution (10x faster!)
   * - Uses AgentExecutionService for in-process execution
   * - Reuses providers, memory, config across tasks
   * - Falls back to subprocess if native execution disabled
   */
  private async executeOpsCommand(ops: string): Promise<string> {
    // Extract command and args
    // ops format: ax run <agent> "<task>" or ax run <agent> '<task>'
    // Support both single and double quotes for robustness
    const parts = ops.match(/ax\s+run\s+([\w-]+)\s+["']([^"']+)["']/);

    if (!parts) {
      throw new Error(`Invalid ops format: ${ops}`);
    }

    const [, agent, task] = parts;

    if (!agent || !task) {
      throw new Error('Missing agent or task');
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
   */
  private async executeOpsCommandLegacy(ops: string, agent: string, task: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Execute as child process
      const child = spawn('ax', ['run', agent, task], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

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
        reject(error);
      });

      child.on('close', (code: number | null) => {
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
   * Save checkpoint
   */
  private async saveCheckpoint(): Promise<void> {
    try {
      const checkpointPath = join(
        this.spec.metadata.workspacePath,
        '.automatosx/checkpoints',
        `${this.runState.specId}-${this.runState.sessionId}.json`
      );

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
