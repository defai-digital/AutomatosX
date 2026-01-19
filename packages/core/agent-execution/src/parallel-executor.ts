/**
 * Parallel Executor Implementation
 *
 * Executes workflow steps in parallel respecting dependencies.
 * Uses DAG-based execution for optimal concurrency.
 *
 * Invariants:
 * - INV-PE-001: Independent steps execute concurrently
 * - INV-PE-002: Dependencies honored (DAG ordering)
 * - INV-PE-003: Concurrency limit respected
 */

import {
  type ParallelExecutionConfig,
  type ParallelStepResult,
  type ParallelGroupResult,
  type ParallelFailureStrategy,
  type AgentWorkflowStep,
  createDefaultParallelExecutionConfig,
  ParallelExecutionErrorCodes,
  getErrorMessage,
} from '@defai.digital/contracts';

/**
 * Step executor function type
 */
export type StepExecutor = (
  step: AgentWorkflowStep,
  previousOutputs: Record<string, unknown>
) => Promise<unknown>;

/**
 * Parallel executor for workflow steps
 */
export interface ParallelExecutor {
  /** Get configuration */
  getConfig(): ParallelExecutionConfig;

  /** Execute a group of steps in parallel */
  executeGroup(
    steps: AgentWorkflowStep[],
    executor: StepExecutor,
    previousOutputs?: Record<string, unknown>
  ): Promise<ParallelGroupResult>;

  /** Build execution layers from steps (DAG analysis) */
  buildExecutionLayers(steps: AgentWorkflowStep[]): AgentWorkflowStep[][];

  /** Cancel ongoing execution */
  cancel(): void;
}

/**
 * Creates a parallel executor
 */
export function createParallelExecutor(
  config: Partial<ParallelExecutionConfig> = {}
): ParallelExecutor {
  const cfg = { ...createDefaultParallelExecutionConfig(), ...config };
  let cancelled = false;

  /**
   * Build execution layers using topological sort (Kahn's algorithm)
   * INV-PE-002: Dependencies honored (DAG ordering)
   */
  function buildLayers(steps: AgentWorkflowStep[]): AgentWorkflowStep[][] {
    // Build dependency graph
    const stepMap = new Map<string, AgentWorkflowStep>();
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    // Initialize
    for (const step of steps) {
      stepMap.set(step.stepId, step);
      inDegree.set(step.stepId, step.dependencies?.length ?? 0);
      dependents.set(step.stepId, []);
    }

    // Build reverse dependency map
    for (const step of steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          const depList = dependents.get(dep) ?? [];
          depList.push(step.stepId);
          dependents.set(dep, depList);
        }
      }
    }

    // Build layers using BFS
    const layers: AgentWorkflowStep[][] = [];
    let currentLayer = steps.filter((s) => inDegree.get(s.stepId) === 0);

    while (currentLayer.length > 0) {
      layers.push(currentLayer);

      const nextLayer: AgentWorkflowStep[] = [];

      for (const step of currentLayer) {
        const deps = dependents.get(step.stepId) ?? [];
        for (const depId of deps) {
          const degree = (inDegree.get(depId) ?? 0) - 1;
          inDegree.set(depId, degree);

          if (degree === 0) {
            const depStep = stepMap.get(depId);
            if (depStep) {
              nextLayer.push(depStep);
            }
          }
        }
      }

      currentLayer = nextLayer;
    }

    // Check for circular dependencies
    const processedCount = layers.reduce((sum, l) => sum + l.length, 0);
    if (processedCount !== steps.length) {
      throw new ParallelExecutionError(
        ParallelExecutionErrorCodes.CIRCULAR_DEPENDENCY,
        'Circular dependency detected in workflow steps'
      );
    }

    return layers;
  }

  /**
   * Execute steps with concurrency limit
   * INV-PE-003: Concurrency limit respected
   */
  async function executeWithConcurrency(
    steps: AgentWorkflowStep[],
    executor: StepExecutor,
    outputs: Record<string, unknown>,
    failureStrategy: ParallelFailureStrategy
  ): Promise<ParallelStepResult[]> {
    const results: ParallelStepResult[] = [];
    const pending: Promise<void>[] = [];
    let hasFailure = false;

    async function executeStep(step: AgentWorkflowStep): Promise<void> {
      if (cancelled) {
        results.push({
          stepId: step.stepId,
          success: false,
          cancelled: true,
          durationMs: 0,
        });
        return;
      }

      // Fail fast check
      if (hasFailure && failureStrategy === 'failFast') {
        results.push({
          stepId: step.stepId,
          success: false,
          cancelled: true,
          durationMs: 0,
        });
        return;
      }

      const startTime = Date.now();

      try {
        const output = await executor(step, outputs);
        const durationMs = Date.now() - startTime;

        outputs[step.stepId] = output;
        results.push({
          stepId: step.stepId,
          success: true,
          output,
          durationMs,
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage =
          getErrorMessage(error);

        hasFailure = true;
        results.push({
          stepId: step.stepId,
          success: false,
          error: errorMessage,
          durationMs,
        });

        if (failureStrategy === 'failFast') {
          cancelled = true;
        }
      }
    }

    // Execute with concurrency limit
    // INV-PE-001: Independent steps execute concurrently
    let index = 0;

    while (index < steps.length || pending.length > 0) {
      // Start new tasks up to concurrency limit
      while (pending.length < cfg.maxConcurrency && index < steps.length) {
        const step = steps[index];
        if (step) {
          const promise = executeStep(step).then(() => {
            const idx = pending.indexOf(promise);
            if (idx >= 0) pending.splice(idx, 1);
          });
          pending.push(promise);
        }
        index++;
      }

      // Wait for at least one to complete
      if (pending.length > 0) {
        await Promise.race(pending);
      }
    }

    return results;
  }

  return {
    getConfig(): ParallelExecutionConfig {
      return { ...cfg };
    },

    buildExecutionLayers(steps: AgentWorkflowStep[]): AgentWorkflowStep[][] {
      return buildLayers(steps);
    },

    async executeGroup(
      steps: AgentWorkflowStep[],
      executor: StepExecutor,
      previousOutputs: Record<string, unknown> = {}
    ): Promise<ParallelGroupResult> {
      cancelled = false;
      const groupId = crypto.randomUUID();
      const startTime = Date.now();
      const outputs = { ...previousOutputs };

      // Build execution layers
      const layers = buildLayers(steps);

      // Execute each layer
      const allResults: ParallelStepResult[] = [];

      for (const layer of layers) {
        if (cancelled) break;

        const layerResults = await executeWithConcurrency(
          layer,
          executor,
          outputs,
          cfg.failureStrategy
        );
        allResults.push(...layerResults);

        // Check for failures with failFast
        if (cfg.failureStrategy === 'failFast') {
          const failed = layerResults.some((r) => !r.success && !r.cancelled);
          if (failed) {
            cancelled = true;
            break;
          }
        }
      }

      const totalDurationMs = Date.now() - startTime;
      const failedSteps = allResults
        .filter((r) => !r.success && !r.cancelled)
        .map((r) => r.stepId);
      const cancelledSteps = allResults
        .filter((r) => r.cancelled)
        .map((r) => r.stepId);

      return {
        groupId,
        stepResults: allResults,
        totalDurationMs,
        allSucceeded: failedSteps.length === 0 && cancelledSteps.length === 0,
        failedSteps,
        cancelledSteps:
          cancelledSteps.length > 0 ? cancelledSteps : undefined,
        stepsExecuted: allResults.filter((r) => !r.cancelled).length,
        stepsSkipped: cancelledSteps.length,
      };
    },

    cancel(): void {
      cancelled = true;
    },
  };
}

/**
 * Identifies parallel groups within a workflow
 * Returns array of step groups that can be executed in parallel
 */
export function identifyParallelGroups(
  steps: AgentWorkflowStep[]
): AgentWorkflowStep[][] {
  // Group steps by their dependencies
  // Steps with the same set of dependencies can be grouped
  const groups: AgentWorkflowStep[][] = [];
  const depKeyToGroup = new Map<string, AgentWorkflowStep[]>();

  for (const step of steps) {
    const depKey = (step.dependencies ?? []).sort().join(',');
    const group = depKeyToGroup.get(depKey);
    if (group) {
      group.push(step);
    } else {
      const newGroup = [step];
      depKeyToGroup.set(depKey, newGroup);
      groups.push(newGroup);
    }
  }

  return groups;
}

/**
 * Parallel execution error
 */
export class ParallelExecutionError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `Parallel execution error: ${code}`);
    this.name = 'ParallelExecutionError';
  }

  static groupTimeout(groupId: string, timeoutMs: number): ParallelExecutionError {
    return new ParallelExecutionError(
      ParallelExecutionErrorCodes.GROUP_TIMEOUT,
      `Parallel group ${groupId} timed out after ${timeoutMs}ms`
    );
  }

  static circularDependency(stepIds: string[]): ParallelExecutionError {
    return new ParallelExecutionError(
      ParallelExecutionErrorCodes.CIRCULAR_DEPENDENCY,
      `Circular dependency detected among steps: ${stepIds.join(', ')}`
    );
  }

  static stepFailed(stepId: string, error: string): ParallelExecutionError {
    return new ParallelExecutionError(
      ParallelExecutionErrorCodes.TASK_FAILED,
      `Step ${stepId} failed: ${error}`
    );
  }
}
