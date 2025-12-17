/**
 * Stub Parallel Executor Implementation
 *
 * Provides minimal parallel execution for when no real implementation
 * is provided via AgentDomainConfig factories.
 *
 * This stub executes steps sequentially (not actually in parallel).
 * For real parallel execution, provide parallelExecutorFactory in config.
 */

import {
  type ParallelExecutionConfig,
  createDefaultParallelExecutionConfig,
  type AgentWorkflowStep,
} from '@automatosx/contracts';
import type {
  ParallelExecutorPort,
  ParallelStepExecutor,
  ParallelGroupResult,
  ParallelStepResult,
  ParallelExecutorFactory,
} from './types.js';

let _warnedOnce = false;

/**
 * Creates a stub parallel executor that executes steps sequentially
 */
function createStubParallelExecutor(
  config: Partial<ParallelExecutionConfig> = {}
): ParallelExecutorPort {
  if (!_warnedOnce) {
    console.warn(
      '[agent-domain] Using stub parallel executor (sequential execution). ' +
      'For real parallel execution, provide parallelExecutorFactory in config.'
    );
    _warnedOnce = true;
  }

  const cfg = { ...createDefaultParallelExecutionConfig(), ...config };
  let cancelled = false;

  return {
    getConfig(): ParallelExecutionConfig {
      return { ...cfg };
    },

    async executeGroup(
      steps: AgentWorkflowStep[],
      executor: ParallelStepExecutor,
      previousOutputs: Record<string, unknown> = {}
    ): Promise<ParallelGroupResult> {
      const startTime = Date.now();
      const stepResults: ParallelStepResult[] = [];
      const outputs = { ...previousOutputs };
      let failedCount = 0;
      let cancelledCount = 0;

      // Build execution layers (respecting dependencies)
      const layers = this.buildExecutionLayers(steps);

      // Execute layers sequentially (stub doesn't do real parallelism)
      for (const layer of layers) {
        if (cancelled) {
          // Mark remaining steps as cancelled
          for (const step of layer) {
            stepResults.push({
              stepId: step.stepId,
              success: false,
              cancelled: true,
              durationMs: 0,
            });
            cancelledCount++;
          }
          continue;
        }

        // Execute steps in layer sequentially
        for (const step of layer) {
          if (cancelled) {
            stepResults.push({
              stepId: step.stepId,
              success: false,
              cancelled: true,
              durationMs: 0,
            });
            cancelledCount++;
            continue;
          }

          const stepStart = Date.now();
          try {
            // Use group timeout or default 5 minutes for step timeout
            const stepTimeoutMs = cfg.groupTimeoutMs ?? 300000;
            const output = await Promise.race([
              executor(step, outputs),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Step timed out')), stepTimeoutMs)
              ),
            ]);

            outputs[step.stepId] = output;
            stepResults.push({
              stepId: step.stepId,
              success: true,
              output,
              durationMs: Date.now() - stepStart,
            });
          } catch (error) {
            const result: ParallelStepResult = {
              stepId: step.stepId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              durationMs: Date.now() - stepStart,
            };
            stepResults.push(result);
            failedCount++;

            // If step is critical (not parallel) and failFast strategy, stop execution
            if (!step.parallel && cfg.failureStrategy === 'failFast') {
              cancelled = true;
            }
          }
        }
      }

      return {
        stepResults,
        totalDurationMs: Date.now() - startTime,
        allSucceeded: failedCount === 0 && cancelledCount === 0,
        failedCount,
        cancelledCount,
      };
    },

    buildExecutionLayers(steps: AgentWorkflowStep[]): AgentWorkflowStep[][] {
      // Simple topological sort based on dependencies
      const layers: AgentWorkflowStep[][] = [];
      const completed = new Set<string>();
      const remaining = [...steps];

      while (remaining.length > 0) {
        // Find steps with all dependencies satisfied
        const ready: AgentWorkflowStep[] = [];
        const stillWaiting: AgentWorkflowStep[] = [];

        for (const step of remaining) {
          const deps = step.dependencies ?? [];
          if (deps.every((dep) => completed.has(dep))) {
            ready.push(step);
          } else {
            stillWaiting.push(step);
          }
        }

        if (ready.length === 0 && stillWaiting.length > 0) {
          // Circular dependency or missing dependency - execute remaining steps
          layers.push(stillWaiting);
          break;
        }

        if (ready.length > 0) {
          layers.push(ready);
          for (const step of ready) {
            completed.add(step.stepId);
          }
        }

        remaining.length = 0;
        remaining.push(...stillWaiting);
      }

      return layers;
    },

    cancel(): void {
      cancelled = true;
    },
  };
}

/**
 * Stub parallel executor factory
 */
export const stubParallelExecutorFactory: ParallelExecutorFactory = (config) => {
  return createStubParallelExecutor(config);
};

/**
 * Reset the warning flag (for testing)
 */
export function resetParallelStubWarning(): void {
  _warnedOnce = false;
}
