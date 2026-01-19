/**
 * Parallel Agent Orchestrator
 *
 * Main orchestration logic for executing multiple agents in parallel
 * with DAG-based dependency management.
 *
 * Invariants:
 * - INV-APE-001: Concurrent agents MUST NOT exceed maxConcurrentAgents
 * - INV-APE-002: Dependencies honored (DAG ordering)
 * - INV-APE-003: Shared context immutable during execution
 * - INV-APE-004: Result aggregation follows configured strategy
 * - INV-APE-005: Timeout enforced per-agent independently
 */

import {
  type AgentParallelTask,
  type AgentParallelTaskResult,
  type AgentParallelGroupResult,
  type AgentParallelExecutionConfig,
  type ExecutionPlan,
  type ExecutionLayer,
  createDefaultAgentParallelExecutionConfig,
  ParallelExecutionErrorCodes,
  getErrorMessage,
} from '@defai.digital/contracts';

import type {
  AgentParallelOrchestrator,
  AgentParallelOrchestratorOptions,
  ParallelProgressEvent,
  TaskLayer,
} from './types.js';

import { createDAGAnalyzer, DAGAnalysisError } from './dag-analyzer.js';
import { createContextManager } from './context-manager.js';
import { createResultAggregator } from './result-aggregator.js';

/**
 * Error thrown during parallel execution
 */
export class ParallelExecutionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly taskId?: string
  ) {
    super(message);
    this.name = 'ParallelExecutionError';
  }
}

/**
 * Creates a parallel agent orchestrator
 */
export function createAgentParallelOrchestrator(
  options: AgentParallelOrchestratorOptions
): AgentParallelOrchestrator {
  const { agentExecutor, defaultConfig, onProgress } = options;

  const dagAnalyzer = createDAGAnalyzer();
  const contextManager = createContextManager();
  const resultAggregator = createResultAggregator();

  const config: AgentParallelExecutionConfig = {
    ...createDefaultAgentParallelExecutionConfig(),
    ...defaultConfig,
  };

  // Track active executions for proper cancellation scoping
  // Each execution has its own cancelled state to prevent cross-execution interference
  const activeExecutions = new Map<string, { cancelled: boolean }>();
  let currentGroupId: string | null = null;

  /**
   * Check if a specific execution is cancelled
   */
  function isCancelled(groupId: string): boolean {
    return activeExecutions.get(groupId)?.cancelled ?? false;
  }

  /**
   * Mark an execution as cancelled
   */
  function setCancelled(groupId: string): void {
    const execution = activeExecutions.get(groupId);
    if (execution) {
      execution.cancelled = true;
    }
  }

  /**
   * Emit progress event
   */
  function emitProgress(event: Omit<ParallelProgressEvent, 'timestamp' | 'groupId'>, groupId?: string): void {
    const gId = groupId ?? currentGroupId;
    if (onProgress && gId) {
      onProgress({
        ...event,
        timestamp: new Date().toISOString(),
        groupId: gId,
      });
    }
  }

  /**
   * Execute a single task with timeout
   * INV-APE-005: Timeout enforced independently
   */
  async function executeTask(
    task: AgentParallelTask,
    sharedContext: Record<string, unknown> | undefined,
    taskConfig: AgentParallelExecutionConfig,
    layerIndex: number,
    groupId: string
  ): Promise<AgentParallelTaskResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    emitProgress({
      type: 'task.started',
      taskId: task.taskId,
      agentId: task.agentId,
      layerIndex,
    }, groupId);

    // Task-specific timeout or default
    const timeout = task.timeout ?? taskConfig.agentTimeout;

    try {
      // Check cancellation (scoped to this execution)
      if (isCancelled(groupId)) {
        return {
          taskId: task.taskId,
          agentId: task.agentId,
          status: 'cancelled',
          success: false,
          errorCode: ParallelExecutionErrorCodes.CANCELLED,
          durationMs: Date.now() - startTime,
          layer: layerIndex,
          startedAt,
          completedAt: new Date().toISOString(),
          retryCount: 0,
        };
      }

      // Check if agent exists
      const exists = await agentExecutor.exists(task.agentId);
      if (!exists) {
        const errorMsg = `Agent "${task.agentId}" not found`;
        const result: AgentParallelTaskResult = {
          taskId: task.taskId,
          agentId: task.agentId,
          status: 'failed',
          success: false,
          error: errorMsg,
          errorCode: ParallelExecutionErrorCodes.AGENT_NOT_FOUND,
          durationMs: Date.now() - startTime,
          layer: layerIndex,
          startedAt,
          completedAt: new Date().toISOString(),
          retryCount: 0,
        };

        emitProgress({
          type: 'task.failed',
          taskId: task.taskId,
          agentId: task.agentId,
          layerIndex,
          message: errorMsg,
        });

        return result;
      }

      // Build input with shared context
      const input = taskConfig.shareContext && sharedContext
        ? { ...sharedContext, __taskInput: task.input }
        : task.input;

      // Execute with timeout
      // Build execution request, only include optional fields if defined
      const execRequest: Parameters<typeof agentExecutor.execute>[0] = {
        agentId: task.agentId,
        input,
        timeout,
      };
      if (task.provider) execRequest.provider = task.provider;
      if (task.model) execRequest.model = task.model;

      const executePromise = agentExecutor.execute(execRequest);

      // Create timeout with cleanup to prevent memory leak
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Task timeout after ${timeout}ms`));
        }, timeout);
      });

      let execResult;
      try {
        execResult = await Promise.race([executePromise, timeoutPromise]);
      } finally {
        // Clean up timeout to prevent memory leak
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      if (execResult.success) {
        emitProgress({
          type: 'task.completed',
          taskId: task.taskId,
          agentId: task.agentId,
          layerIndex,
        });

        return {
          taskId: task.taskId,
          agentId: task.agentId,
          status: 'completed',
          success: true,
          output: execResult.output,
          durationMs,
          layer: layerIndex,
          startedAt,
          completedAt,
          retryCount: 0,
        };
      } else {
        emitProgress({
          type: 'task.failed',
          taskId: task.taskId,
          agentId: task.agentId,
          layerIndex,
          message: execResult.error ?? 'Task execution failed',
        });

        return {
          taskId: task.taskId,
          agentId: task.agentId,
          status: 'failed',
          success: false,
          error: execResult.error,
          errorCode: execResult.errorCode ?? ParallelExecutionErrorCodes.TASK_FAILED,
          durationMs,
          layer: layerIndex,
          startedAt,
          completedAt,
          retryCount: 0,
        };
      }
    } catch (error) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');

      emitProgress({
        type: 'task.failed',
        taskId: task.taskId,
        agentId: task.agentId,
        layerIndex,
        message: getErrorMessage(error),
      });

      return {
        taskId: task.taskId,
        agentId: task.agentId,
        status: isTimeout ? 'timeout' : 'failed',
        success: false,
        error: getErrorMessage(error),
        errorCode: isTimeout
          ? ParallelExecutionErrorCodes.TASK_TIMEOUT
          : ParallelExecutionErrorCodes.TASK_FAILED,
        durationMs,
        layer: layerIndex,
        startedAt,
        completedAt,
        retryCount: 0,
      };
    }
  }

  /**
   * Execute a layer of tasks with concurrency limit
   * INV-APE-001: Respects maxConcurrentAgents
   */
  async function executeLayer(
    layer: TaskLayer,
    sharedContext: Record<string, unknown> | undefined,
    taskConfig: AgentParallelExecutionConfig,
    failedTaskIds: Set<string>,
    groupId: string
  ): Promise<AgentParallelTaskResult[]> {
    const results: AgentParallelTaskResult[] = [];
    const pending = new Set<Promise<void>>();

    emitProgress({
      type: 'layer.started',
      layerIndex: layer.index,
      totalTasks: layer.tasks.length,
    }, groupId);

    // Filter out tasks whose dependencies failed
    // INV-APE-201: Dependency cascading
    const tasksToExecute: AgentParallelTask[] = [];
    const skippedTasks: AgentParallelTask[] = [];

    for (const task of layer.tasks) {
      const dependencyFailed = task.dependencies.some((depId) => failedTaskIds.has(depId));
      if (dependencyFailed) {
        skippedTasks.push(task);
      } else {
        tasksToExecute.push(task);
      }
    }

    // Mark skipped tasks
    for (const task of skippedTasks) {
      const now = new Date().toISOString();
      const result: AgentParallelTaskResult = {
        taskId: task.taskId,
        agentId: task.agentId,
        status: 'skipped',
        success: false,
        error: 'Dependency failed',
        errorCode: ParallelExecutionErrorCodes.DEPENDENCY_FAILED,
        durationMs: 0,
        layer: layer.index,
        startedAt: now,
        completedAt: now,
        retryCount: 0,
      };
      results.push(result);
      failedTaskIds.add(task.taskId);

      emitProgress({
        type: 'task.skipped',
        taskId: task.taskId,
        agentId: task.agentId,
        layerIndex: layer.index,
        message: 'Dependency failed',
      }, groupId);
    }

    // Execute remaining tasks with concurrency control
    let taskIndex = 0;

    async function executeAndCollect(task: AgentParallelTask): Promise<void> {
      const result = await executeTask(task, sharedContext, taskConfig, layer.index, groupId);
      results.push(result);

      if (!result.success) {
        failedTaskIds.add(task.taskId);

        // Handle failFast strategy (scoped to this execution)
        if (taskConfig.failureStrategy === 'failFast' && !isCancelled(groupId)) {
          setCancelled(groupId);
        }
      }
    }

    // INV-APE-001: Concurrency limit enforcement
    while (taskIndex < tasksToExecute.length || pending.size > 0) {
      // Check cancellation (scoped to this execution)
      if (isCancelled(groupId) && taskConfig.failureStrategy === 'failFast') {
        // Mark remaining as cancelled
        while (taskIndex < tasksToExecute.length) {
          const task = tasksToExecute[taskIndex++]!;
          const now = new Date().toISOString();
          results.push({
            taskId: task.taskId,
            agentId: task.agentId,
            status: 'cancelled',
            success: false,
            errorCode: ParallelExecutionErrorCodes.CANCELLED,
            durationMs: 0,
            layer: layer.index,
            startedAt: now,
            completedAt: now,
            retryCount: 0,
          });
        }
        break;
      }

      // Start new tasks up to concurrency limit
      while (
        pending.size < taskConfig.maxConcurrentAgents &&
        taskIndex < tasksToExecute.length
      ) {
        const task = tasksToExecute[taskIndex++]!;
        const promise = executeAndCollect(task).finally(() => {
          pending.delete(promise);
        });
        pending.add(promise);
      }

      // Wait for at least one to complete
      if (pending.size > 0) {
        await Promise.race(pending);
      }
    }

    emitProgress({
      type: 'layer.completed',
      layerIndex: layer.index,
      completedTasks: results.filter((r) => r.success).length,
      failedTasks: results.filter((r) => !r.success).length,
    }, groupId);

    return results;
  }

  return {
    getConfig(): AgentParallelExecutionConfig {
      return { ...config };
    },

    buildExecutionPlan(tasks: AgentParallelTask[]): ExecutionPlan {
      const planId = crypto.randomUUID();
      const analysis = dagAnalyzer.analyze(tasks);

      const layers: ExecutionLayer[] = analysis.layers.map((layer) => ({
        index: layer.index,
        tasks: layer.tasks,
        taskCount: layer.tasks.length,
      }));

      return {
        planId,
        layers,
        totalTasks: tasks.length,
        totalLayers: analysis.totalLayers,
        maxParallelism: analysis.maxParallelism,
        hasCycles: analysis.hasCycles,
        createdAt: new Date().toISOString(),
      };
    },

    async executeParallel(
      tasks: AgentParallelTask[],
      configOverride?: Partial<AgentParallelExecutionConfig>,
      sharedContext?: Record<string, unknown>
    ): Promise<AgentParallelGroupResult> {
      const groupId = crypto.randomUUID();
      currentGroupId = groupId;
      // Register this execution with its own cancellation state
      activeExecutions.set(groupId, { cancelled: false });
      const startTime = Date.now();
      const startedAt = new Date().toISOString();

      // Merge config
      const taskConfig: AgentParallelExecutionConfig = {
        ...config,
        ...configOverride,
      };

      // Setup context if provided
      // INV-APE-003: Context frozen before execution
      // INV-APE-300: Context snapshot timing
      if (sharedContext && taskConfig.shareContext) {
        contextManager.create(sharedContext);
      }

      emitProgress({
        type: 'execution.started',
        totalTasks: tasks.length,
      }, groupId);

      try {
        // Analyze DAG
        // INV-APE-002: Dependencies honored
        // INV-APE-200: Cycles detected
        const analysis = dagAnalyzer.analyze(tasks);

        // Track failed tasks for dependency cascading
        const failedTaskIds = new Set<string>();

        // Execute layers sequentially, tasks within layers in parallel
        const allResults: AgentParallelTaskResult[] = [];
        let peakConcurrency = 0;

        for (const layer of analysis.layers) {
          if (isCancelled(groupId) && taskConfig.failureStrategy === 'failFast') {
            // Mark remaining layers as cancelled
            for (const task of layer.tasks) {
              const now = new Date().toISOString();
              allResults.push({
                taskId: task.taskId,
                agentId: task.agentId,
                status: 'cancelled',
                success: false,
                errorCode: ParallelExecutionErrorCodes.CANCELLED,
                durationMs: 0,
                layer: layer.index,
                startedAt: now,
                completedAt: now,
                retryCount: 0,
              });
            }
            continue;
          }

          const layerResults = await executeLayer(
            layer,
            sharedContext,
            taskConfig,
            failedTaskIds,
            groupId
          );
          allResults.push(...layerResults);

          // Track peak concurrency
          const layerConcurrency = Math.min(layer.tasks.length, taskConfig.maxConcurrentAgents);
          if (layerConcurrency > peakConcurrency) {
            peakConcurrency = layerConcurrency;
          }
        }

        // Aggregate results
        // INV-APE-004: Follows configured strategy
        const aggregatedOutput = resultAggregator.aggregate(allResults, {
          strategy: taskConfig.resultAggregation,
        });

        const completedAt = new Date().toISOString();
        const totalDurationMs = Date.now() - startTime;

        const failedTasks = allResults
          .filter((r) => !r.success && r.status !== 'cancelled' && r.status !== 'skipped')
          .map((r) => r.taskId);

        const cancelledTasks = allResults
          .filter((r) => r.status === 'cancelled')
          .map((r) => r.taskId);

        const skippedTasks = allResults
          .filter((r) => r.status === 'skipped')
          .map((r) => r.taskId);

        emitProgress({
          type: 'execution.completed',
          totalTasks: tasks.length,
          completedTasks: allResults.filter((r) => r.success).length,
          failedTasks: failedTasks.length,
        }, groupId);

        return {
          groupId,
          taskResults: allResults,
          aggregatedOutput,
          allSucceeded: failedTasks.length === 0 && cancelledTasks.length === 0,
          failedTasks,
          cancelledTasks: cancelledTasks.length > 0 ? cancelledTasks : undefined,
          skippedTasks: skippedTasks.length > 0 ? skippedTasks : undefined,
          totalDurationMs,
          tasksExecuted: allResults.filter((r) => r.status !== 'skipped' && r.status !== 'cancelled').length,
          tasksSkipped: skippedTasks.length + cancelledTasks.length,
          layerCount: analysis.totalLayers,
          peakConcurrency,
          config: taskConfig,
          startedAt,
          completedAt,
        };
      } catch (error) {
        // Handle DAG analysis errors
        if (error instanceof DAGAnalysisError) {
          throw new ParallelExecutionError(
            error.code,
            error.message
          );
        }
        throw error;
      } finally {
        // Cleanup - remove execution state to prevent memory leak
        contextManager.clear();
        activeExecutions.delete(groupId);
        currentGroupId = null;
      }
    },

    cancel(): void {
      // Cancel all active executions
      for (const [gId, state] of activeExecutions) {
        state.cancelled = true;
        emitProgress({
          type: 'execution.cancelled',
        }, gId);
      }
    },
  };
}
