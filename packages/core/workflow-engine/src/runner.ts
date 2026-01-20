import { type WorkflowStep, type RetryPolicy, DEFAULT_RETRY_POLICY, type StepGuardContext, type StepGuardResult } from '@defai.digital/contracts';
import type {
  WorkflowResult,
  WorkflowRunnerConfig,
  StepResult,
  StepContext,
  StepExecutor,
  PreparedWorkflow,
} from './types.js';
import { WorkflowErrorCodes } from './types.js';
import { prepareWorkflow, deepFreezeStepResult } from './validation.js';
import { defaultStepExecutor, createStepError, normalizeError } from './executor.js';
import {
  mergeRetryPolicy,
  shouldRetry,
  calculateBackoff,
  sleep,
} from './retry.js';
import type { StepGuardEngine } from './step-guard.js';

/**
 * Internal config with required properties
 */
interface ResolvedConfig {
  stepExecutor: StepExecutor;
  defaultRetryPolicy: RetryPolicy;
  onStepStart?: ((step: WorkflowStep, context: StepContext) => void) | undefined;
  onStepComplete?: ((step: WorkflowStep, result: StepResult) => void) | undefined;
  stepGuardEngine?: StepGuardEngine | undefined;
  executionId?: string | undefined;
  agentId?: string | undefined;
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
      defaultRetryPolicy: config.defaultRetryPolicy ?? DEFAULT_RETRY_POLICY,
    };

    if (config.onStepStart !== undefined) {
      this.config.onStepStart = config.onStepStart;
    }
    if (config.onStepComplete !== undefined) {
      this.config.onStepComplete = config.onStepComplete;
    }
    if (config.stepGuardEngine !== undefined) {
      this.config.stepGuardEngine = config.stepGuardEngine;
    }
    if (config.executionId !== undefined) {
      this.config.executionId = config.executionId;
    }
    if (config.agentId !== undefined) {
      this.config.agentId = config.agentId;
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

      // INV-WF-011: Step input is never undefined (fallback to empty object)
      // Chain output from previous step, or use original input, or empty object
      const previousOutput = i > 0 ? stepResults[i - 1]?.output : undefined;
      const stepInput = i === 0
        ? (input ?? {})
        : (previousOutput ?? input ?? {});

      const context: StepContext = {
        workflowId: workflow.workflowId,
        stepIndex: i,
        previousResults: [...stepResults],
        input: stepInput,
      };

      // INV-WF-GUARD-001: Run before guards
      if (this.config.stepGuardEngine) {
        const guardContext = this.buildGuardContext(step, i, prepared, stepResults);
        const beforeResults = await this.config.stepGuardEngine.runBeforeGuards(guardContext);
        if (this.config.stepGuardEngine.shouldBlock(beforeResults)) {
          return this.createBlockedResult(prepared, stepResults, step, beforeResults, startTime);
        }
      }

      // Notify step start
      this.config.onStepStart?.(step, context);

      // Execute step with retry logic (INV-WF-002)
      const result = await this.executeStepWithRetry(step, context);

      // Freeze step result to ensure immutability
      const frozenResult = deepFreezeStepResult(result);
      stepResults.push(frozenResult);

      // Notify step complete (pass frozen result for consistency)
      this.config.onStepComplete?.(step, frozenResult);

      // INV-WF-GUARD-002: Run after guards
      // INV-WF-GUARD-003: After guards should not fail the workflow on exception
      if (this.config.stepGuardEngine) {
        const guardContext = this.buildGuardContext(step, i, prepared, stepResults);
        try {
          // After guards can warn but typically don't block
          await this.config.stepGuardEngine.runAfterGuards(guardContext);
        } catch (guardError) {
          // Log but don't fail the workflow - after guards are advisory
          console.warn(`[workflow-runner] After guard threw exception for step ${step.stepId}:`, guardError);
        }
      }

      // Stop on failure
      if (!frozenResult.success) {
        const workflowError: WorkflowResult['error'] = {
          code: WorkflowErrorCodes.STEP_EXECUTION_FAILED,
          message: `Step ${step.stepId} failed: ${frozenResult.error?.message ?? 'Unknown error'}`,
          failedStepId: step.stepId,
        };
        if (frozenResult.error?.details !== undefined) {
          workflowError.details = frozenResult.error.details;
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

    // Execute with timeout (using cancellable timeout to prevent timer leaks)
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<StepResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        const stepError = createStepError(
          WorkflowErrorCodes.STEP_TIMEOUT,
          `Step ${step.stepId} timed out after ${String(timeout)}ms`,
          true
        );
        reject(new Error(stepError.message));
      }, timeout);
    });

    try {
      const result = await Promise.race([
        this.config.stepExecutor(step, context),
        timeoutPromise,
      ]);

      return result;
    } finally {
      // Always clean up timeout to prevent timer leaks
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
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

  /**
   * Builds guard context from current execution state
   * INV-WF-GUARD-004: Guard results included in trace events
   */
  private buildGuardContext(
    step: WorkflowStep,
    stepIndex: number,
    workflow: PreparedWorkflow,
    stepResults: StepResult[]
  ): StepGuardContext {
    const previousOutputs: Record<string, unknown> = {};
    for (const result of stepResults) {
      if (result.output !== undefined) {
        previousOutputs[result.stepId] = result.output;
      }
    }

    return {
      executionId: this.config.executionId ?? crypto.randomUUID(),
      agentId: this.config.agentId ?? 'unknown',
      workflowId: workflow.workflow.workflowId,
      stepId: step.stepId,
      stepType: step.type,
      stepIndex,
      totalSteps: workflow.workflow.steps.length,
      stepConfig: step.config,
      previousOutputs,
    };
  }

  /**
   * Creates a blocked result when guards prevent execution
   * INV-WF-GUARD-003: Block failures prevent step execution
   */
  private createBlockedResult(
    workflow: PreparedWorkflow,
    stepResults: StepResult[],
    step: WorkflowStep,
    guardResults: StepGuardResult[],
    startTime: number
  ): WorkflowResult {
    const blockingGuard = guardResults.find((r) => r.blocked);
    const failedGates = blockingGuard?.gates.filter((g) => g.status === 'FAIL') ?? [];
    const gateMessages = failedGates.map((g) => `${g.gateId}: ${g.message}`).join('; ');

    return {
      workflowId: workflow.workflow.workflowId,
      success: false,
      stepResults,
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        message: `Step ${step.stepId} blocked by guard: ${gateMessages}`,
        failedStepId: step.stepId,
        details: {
          guardId: blockingGuard?.guardId,
          failedGates: failedGates.map((g) => g.gateId),
        },
      },
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
