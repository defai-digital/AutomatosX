import { randomUUID } from 'node:crypto';
import {
  type WorkflowStep,
  type RetryPolicy,
  DEFAULT_RETRY_POLICY,
  type StepGuardContext,
  type StepGuardResult,
} from '@defai.digital/contracts';
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

const UNKNOWN_AGENT_ID = 'unknown';
const WORKFLOW_GUARD_BLOCKED = 'WORKFLOW_GUARD_BLOCKED';

interface ResolvedConfig {
  stepExecutor: StepExecutor;
  defaultRetryPolicy: RetryPolicy;
  onStepStart?: ((step: WorkflowStep, context: StepContext) => void) | undefined;
  onStepComplete?: ((step: WorkflowStep, result: StepResult) => void) | undefined;
  stepGuardEngine?: StepGuardEngine | undefined;
  executionId?: string | undefined;
  agentId?: string | undefined;
}

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

  async run(workflowData: unknown, input?: unknown): Promise<WorkflowResult> {
    const startTime = Date.now();
    const executionId = this.config.executionId ?? randomUUID();

    let prepared: PreparedWorkflow;
    try {
      prepared = prepareWorkflow(workflowData);
    } catch (error) {
      return this.createErrorResult('unknown', startTime, [], normalizeError(error));
    }

    const { workflow } = prepared;
    const stepResults: StepResult[] = [];

    for (let i = 0; i < workflow.steps.length; i += 1) {
      const step = workflow.steps[i];
      if (step === undefined) {
        continue;
      }

      const previousOutput = stepResults.length > 0 ? stepResults[stepResults.length - 1]!.output : undefined;
      const stepInput = i === 0
        ? (input ?? {})
        : (previousOutput ?? input ?? {});

      const context: StepContext = {
        workflowId: workflow.workflowId,
        stepIndex: i,
        previousResults: [...stepResults],
        input: stepInput,
      };

      if (this.config.stepGuardEngine) {
        const guardContext = this.buildGuardContext(executionId, step, i, prepared, stepResults);
        const beforeResults = await this.config.stepGuardEngine.runBeforeGuards(guardContext);
        if (this.config.stepGuardEngine.shouldBlock(beforeResults)) {
          return this.createBlockedResult(prepared, stepResults, step, beforeResults, startTime);
        }
      }

      this.config.onStepStart?.(step, context);
      const result = await this.executeStepWithRetry(step, context);
      const frozenResult = deepFreezeStepResult(result);
      stepResults.push(frozenResult);
      this.config.onStepComplete?.(step, frozenResult);

      if (this.config.stepGuardEngine) {
        const guardContext = this.buildGuardContext(executionId, step, i, prepared, stepResults);
        try {
          await this.config.stepGuardEngine.runAfterGuards(guardContext);
        } catch (guardError) {
          return this.createErrorResult(
            prepared.workflow.workflowId,
            startTime,
            stepResults,
            {
              code: WorkflowErrorCodes.AFTER_GUARD_ERROR,
              message: `After guard check failed for step ${step.stepId}`,
              details: {
                stepId: step.stepId,
                error: guardError instanceof Error ? guardError.message : String(guardError),
              },
            },
          );
        }
      }

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

    const lastResult = stepResults[stepResults.length - 1];
    return {
      workflowId: workflow.workflowId,
      success: true,
      stepResults,
      output: lastResult?.output,
      totalDurationMs: Date.now() - startTime,
    };
  }

  private async executeStepWithRetry(
    step: WorkflowStep,
    context: StepContext,
  ): Promise<StepResult> {
    const retryPolicy = mergeRetryPolicy(
      step.retryPolicy ?? this.config.defaultRetryPolicy,
    );

    let lastResult: StepResult | null = null;
    let attempt = 0;

    while (attempt < retryPolicy.maxAttempts) {
      attempt += 1;

      try {
        const result = await this.executeStepWithTimeout(step, context);
        result.retryCount = attempt - 1;

        if (result.success) {
          return result;
        }

        lastResult = result;

        if (result.error !== undefined && shouldRetry(result.error, retryPolicy, attempt)) {
          const backoffMs = calculateBackoff(retryPolicy, attempt);
          await sleep(backoffMs);
          continue;
        }

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

    return lastResult ?? {
      stepId: step.stepId,
      success: false,
      error: createStepError(
        WorkflowErrorCodes.MAX_RETRIES_EXCEEDED,
        `Max retries (${String(retryPolicy.maxAttempts)}) exceeded for step ${step.stepId}`,
        false,
      ),
      durationMs: 0,
      retryCount: attempt - 1,
    };
  }

  private async executeStepWithTimeout(
    step: WorkflowStep,
    context: StepContext,
  ): Promise<StepResult> {
    const timeout = step.timeout;

    if (timeout === undefined) {
      return this.config.stepExecutor(step, context);
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<StepResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        const stepError = createStepError(
          WorkflowErrorCodes.STEP_TIMEOUT,
          `Step ${step.stepId} timed out after ${String(timeout)}ms`,
          true,
        );
        reject(stepError);
      }, timeout);
    });

    try {
      const result = await Promise.race([
        this.config.stepExecutor(step, context),
        timeoutPromise,
      ]);

      return result;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private createErrorResult(
    workflowId: string,
    startTime: number,
    stepResults: StepResult[],
    error: { code: string; message: string; details?: Record<string, unknown> | undefined },
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

  private buildGuardContext(
    executionId: string,
    step: WorkflowStep,
    stepIndex: number,
    workflow: PreparedWorkflow,
    stepResults: StepResult[],
  ): StepGuardContext {
    const previousOutputs: Record<string, unknown> = {};
    for (const result of stepResults) {
      if (result.output !== undefined) {
        previousOutputs[result.stepId] = result.output;
      }
    }

    return {
      executionId,
      agentId: this.config.agentId ?? UNKNOWN_AGENT_ID,
      workflowId: workflow.workflow.workflowId,
      stepId: step.stepId,
      stepType: step.type,
      stepIndex,
      totalSteps: workflow.workflow.steps.length,
      stepConfig: step.config,
      previousOutputs,
    };
  }

  private createBlockedResult(
    workflow: PreparedWorkflow,
    stepResults: StepResult[],
    step: WorkflowStep,
    guardResults: StepGuardResult[],
    startTime: number,
  ): WorkflowResult {
    const blockingGuard = guardResults.find((result) => result.blocked);
    const failedGates = blockingGuard?.gates.filter((gate) => gate.status === 'FAIL') ?? [];
    const gateMessages = failedGates.map((gate) => `${gate.gateId}: ${gate.message}`).join('; ');

    return {
      workflowId: workflow.workflow.workflowId,
      success: false,
      stepResults,
      error: {
        code: WORKFLOW_GUARD_BLOCKED,
        message: `Step ${step.stepId} blocked by guard: ${gateMessages}`,
        failedStepId: step.stepId,
        details: {
          guardId: blockingGuard?.guardId,
          failedGates: failedGates.map((gate) => gate.gateId),
        },
      },
      totalDurationMs: Date.now() - startTime,
    };
  }
}

export function createWorkflowRunner(config?: WorkflowRunnerConfig): WorkflowRunner {
  return new WorkflowRunner(config);
}
