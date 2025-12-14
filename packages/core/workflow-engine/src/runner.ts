import type { WorkflowStep, RetryPolicy } from '@automatosx/contracts';
import type {
  WorkflowResult,
  WorkflowRunnerConfig,
  StepResult,
  StepContext,
  StepExecutor,
  PreparedWorkflow,
} from './types.js';
import { WorkflowErrorCodes } from './types.js';
import { prepareWorkflow } from './validation.js';
import { defaultStepExecutor, createStepError, normalizeError } from './executor.js';
import {
  mergeRetryPolicy,
  shouldRetry,
  calculateBackoff,
  sleep,
} from './retry.js';

/**
 * Internal config with required properties
 */
interface ResolvedConfig {
  stepExecutor: StepExecutor;
  defaultRetryPolicy: RetryPolicy;
  onStepStart?: ((step: WorkflowStep, context: StepContext) => void) | undefined;
  onStepComplete?: ((step: WorkflowStep, result: StepResult) => void) | undefined;
}

/**
 * Workflow runner that executes workflows following contract invariants
 *
 * Invariants enforced:
 * - INV-WF-001: Step execution order matches definition exactly
 * - INV-WF-002: Retries are scoped to the current step only
 * - INV-WF-003: Schema strictness (via validation)
 * - INV-WF-004: Step ID uniqueness (via validation)
 * - INV-WF-005: Immutable definition (via freezing)
 */
export class WorkflowRunner {
  private readonly config: ResolvedConfig;

  constructor(config: WorkflowRunnerConfig = {}) {
    this.config = {
      stepExecutor: config.stepExecutor ?? defaultStepExecutor,
      defaultRetryPolicy: config.defaultRetryPolicy ?? {
        maxAttempts: 1,
        backoffMs: 1000,
        backoffMultiplier: 2,
        retryOn: ['timeout', 'rate_limit', 'server_error', 'network_error'],
      },
    };

    if (config.onStepStart !== undefined) {
      this.config.onStepStart = config.onStepStart;
    }
    if (config.onStepComplete !== undefined) {
      this.config.onStepComplete = config.onStepComplete;
    }
  }

  /**
   * Executes a workflow
   * INV-WF-001: Steps are executed in definition order
   */
  async run(workflowData: unknown, input?: unknown): Promise<WorkflowResult> {
    const startTime = Date.now();

    // Validate and prepare workflow (INV-WF-003, INV-WF-004, INV-WF-005)
    let prepared: PreparedWorkflow;
    try {
      prepared = prepareWorkflow(workflowData);
    } catch (error) {
      return this.createErrorResult(
        'unknown',
        startTime,
        [],
        normalizeError(error)
      );
    }

    const { workflow } = prepared;
    const stepResults: StepResult[] = [];

    // INV-WF-001: Execute steps in exact definition order
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (step === undefined) {
        continue;
      }

      const context: StepContext = {
        workflowId: workflow.workflowId,
        stepIndex: i,
        previousResults: [...stepResults],
        input: i === 0 ? input : stepResults[i - 1]?.output,
      };

      // Notify step start
      this.config.onStepStart?.(step, context);

      // Execute step with retry logic (INV-WF-002)
      const result = await this.executeStepWithRetry(step, context);
      stepResults.push(result);

      // Notify step complete
      this.config.onStepComplete?.(step, result);

      // Stop on failure
      if (!result.success) {
        const workflowError: WorkflowResult['error'] = {
          code: WorkflowErrorCodes.STEP_EXECUTION_FAILED,
          message: `Step ${step.stepId} failed: ${result.error?.message ?? 'Unknown error'}`,
          failedStepId: step.stepId,
        };
        if (result.error?.details !== undefined) {
          workflowError.details = result.error.details;
        }
        return {
          workflowId: workflow.workflowId,
          success: false,
          stepResults,
          error: workflowError,
          totalDurationMs: Date.now() - startTime,
        };
      }
    }

    // All steps succeeded
    const lastResult = stepResults[stepResults.length - 1];
    return {
      workflowId: workflow.workflowId,
      success: true,
      stepResults,
      output: lastResult?.output,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Executes a single step with retry logic
   * INV-WF-002: Retries are scoped to current step only
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    context: StepContext
  ): Promise<StepResult> {
    const retryPolicy = mergeRetryPolicy(
      step.retryPolicy ?? this.config.defaultRetryPolicy
    );

    let lastResult: StepResult | null = null;
    let attempt = 0;

    while (attempt < retryPolicy.maxAttempts) {
      attempt++;

      try {
        const result = await this.executeStepWithTimeout(step, context);
        result.retryCount = attempt - 1;

        if (result.success) {
          return result;
        }

        lastResult = result;

        // Check if we should retry
        if (
          result.error !== undefined &&
          shouldRetry(result.error, retryPolicy, attempt)
        ) {
          const backoffMs = calculateBackoff(retryPolicy, attempt);
          await sleep(backoffMs);
          continue;
        }

        // Not retryable, return the result
        return result;
      } catch (error) {
        const stepError = normalizeError(error);
        lastResult = {
          stepId: step.stepId,
          success: false,
          error: stepError,
          durationMs: 0,
          retryCount: attempt - 1,
        };

        if (shouldRetry(stepError, retryPolicy, attempt)) {
          const backoffMs = calculateBackoff(retryPolicy, attempt);
          await sleep(backoffMs);
          continue;
        }

        return lastResult;
      }
    }

    // Max retries exceeded
    return lastResult ?? {
      stepId: step.stepId,
      success: false,
      error: createStepError(
        WorkflowErrorCodes.MAX_RETRIES_EXCEEDED,
        `Max retries (${String(retryPolicy.maxAttempts)}) exceeded for step ${step.stepId}`,
        false
      ),
      durationMs: 0,
      retryCount: attempt - 1,
    };
  }

  /**
   * Executes a step with optional timeout
   */
  private async executeStepWithTimeout(
    step: WorkflowStep,
    context: StepContext
  ): Promise<StepResult> {
    const timeout = step.timeout;

    if (timeout === undefined) {
      return this.config.stepExecutor(step, context);
    }

    // Execute with timeout
    const timeoutPromise = new Promise<StepResult>((_, reject) => {
      setTimeout(() => {
        const stepError = createStepError(
          WorkflowErrorCodes.STEP_TIMEOUT,
          `Step ${step.stepId} timed out after ${String(timeout)}ms`,
          true
        );
        reject(new Error(stepError.message));
      }, timeout);
    });

    return Promise.race([
      this.config.stepExecutor(step, context),
      timeoutPromise,
    ]);
  }

  /**
   * Creates an error result
   */
  private createErrorResult(
    workflowId: string,
    startTime: number,
    stepResults: StepResult[],
    error: { code: string; message: string; details?: Record<string, unknown> | undefined }
  ): WorkflowResult {
    const workflowError: WorkflowResult['error'] = {
      code: error.code,
      message: error.message,
    };
    if (error.details !== undefined) {
      workflowError.details = error.details;
    }
    return {
      workflowId,
      success: false,
      stepResults,
      error: workflowError,
      totalDurationMs: Date.now() - startTime,
    };
  }
}

/**
 * Creates a workflow runner with the given configuration
 */
export function createWorkflowRunner(
  config?: WorkflowRunnerConfig
): WorkflowRunner {
  return new WorkflowRunner(config);
}
