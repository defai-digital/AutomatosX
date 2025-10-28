/**
 * SpecExecutor - Executes tasks defined in spec files
 *
 * Orchestrates task execution according to dependency graph,
 * manages state, checkpoints, and integrates with AgentExecutor.
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
import { logger } from '../../utils/logger.js';

/**
 * SpecExecutor class
 * Executes tasks according to dependency graph
 */
export class SpecExecutor {
  private spec: ParsedSpec;
  private options: SpecExecutorOptions;
  private sessionManager: SessionManager;
  private runState: SpecRunState;
  private graphBuilder: SpecGraphBuilder;
  private abortController: AbortController;

  constructor(
    spec: ParsedSpec,
    options: SpecExecutorOptions,
    sessionManager: SessionManager
  ) {
    this.spec = spec;
    this.options = options;
    this.sessionManager = sessionManager;
    this.abortController = new AbortController();

    // Build dependency graph
    this.graphBuilder = new SpecGraphBuilder();
    this.spec.graph = SpecGraphBuilder.build(spec.tasks);

    // Initialize run state
    this.runState = this.initializeRunState();

    logger.info('SpecExecutor initialized', {
      specId: spec.metadata.id,
      sessionId: options.sessionId,
      totalTasks: spec.tasks.length,
      parallel: options.parallel ?? false
    });
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

      return {
        specId: this.spec.metadata.id,
        sessionId: this.options.sessionId,
        totalTasks: this.runState.metadata.totalTasks,
        completedTasks: this.runState.metadata.completedTasks,
        failedTasks: this.runState.metadata.failedTasks,
        skippedTasks: Array.from(this.runState.tasks.values()).filter(
          t => t.status === 'skipped'
        ).length,
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
      throw error;
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

      return {
        taskId,
        status: 'completed',
        output,
        duration: Date.now() - startTime,
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

      return {
        taskId,
        status: 'failed',
        error: (error as Error).message,
        duration: Date.now() - startTime,
        executedBy: task.assigneeHint,
        retryCount: 0
      };
    }
  }

  /**
   * Execute ops command (ax run ...)
   */
  private async executeOpsCommand(ops: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Extract command and args
      // ops format: ax run <agent> "<task>"
      const parts = ops.match(/ax\s+run\s+([\w-]+)\s+"([^"]+)"/);

      if (!parts) {
        reject(new Error(`Invalid ops format: ${ops}`));
        return;
      }

      const [, agent, task] = parts;

      if (!agent || !task) {
        reject(new Error('Missing agent or task'));
        return;
      }

      logger.debug('Executing ops command', { agent, task });

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
   */
  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    try {
      const tasksPath = this.spec.metadata.files.tasks;
      const content = this.spec.content.tasks;

      // Find the task line and update status
      const lines = content.split('\n');
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

      // Write back to file
      await writeFile(tasksPath, updatedLines.join('\n'), 'utf8');

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

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.abortController.abort();
  }
}
