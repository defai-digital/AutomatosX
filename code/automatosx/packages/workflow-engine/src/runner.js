import { randomUUID } from 'node:crypto';
import { DEFAULT_RETRY_POLICY, } from '@defai.digital/contracts';
import { WorkflowErrorCodes } from './types.js';
import { prepareWorkflow, deepFreezeStepResult } from './validation.js';
import { defaultStepExecutor, createStepError, normalizeError } from './executor.js';
import { mergeRetryPolicy, shouldRetry, calculateBackoff, sleep, } from './retry.js';
const LOG_PREFIX = '[workflow-runner]';
const UNKNOWN_AGENT_ID = 'unknown';
const WORKFLOW_GUARD_BLOCKED = 'WORKFLOW_GUARD_BLOCKED';
export class WorkflowRunner {
    config;
    constructor(config = {}) {
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
    async run(workflowData, input) {
        const startTime = Date.now();
        let prepared;
        try {
            prepared = prepareWorkflow(workflowData);
        }
        catch (error) {
            return this.createErrorResult('unknown', startTime, [], normalizeError(error));
        }
        const { workflow } = prepared;
        const stepResults = [];
        for (let i = 0; i < workflow.steps.length; i += 1) {
            const step = workflow.steps[i];
            if (step === undefined) {
                continue;
            }
            const previousOutput = stepResults.length > 0 ? stepResults[stepResults.length - 1].output : undefined;
            const stepInput = i === 0
                ? (input ?? {})
                : (previousOutput ?? input ?? {});
            const context = {
                workflowId: workflow.workflowId,
                stepIndex: i,
                previousResults: [...stepResults],
                input: stepInput,
            };
            if (this.config.stepGuardEngine) {
                const guardContext = this.buildGuardContext(step, i, prepared, stepResults);
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
                const guardContext = this.buildGuardContext(step, i, prepared, stepResults);
                try {
                    await this.config.stepGuardEngine.runAfterGuards(guardContext);
                }
                catch (guardError) {
                    const guardMessage = guardError instanceof Error ? guardError.message : String(guardError);
                    console.warn(`${LOG_PREFIX} After guard threw exception for step ${step.stepId}:`, guardError);
                    return {
                        workflowId: workflow.workflowId,
                        success: false,
                        stepResults,
                        error: {
                            code: WorkflowErrorCodes.AFTER_GUARD_ERROR,
                            message: `After guard failed for step ${step.stepId}: ${guardMessage}`,
                            failedStepId: step.stepId,
                        },
                        totalDurationMs: Date.now() - startTime,
                    };
                }
            }
            if (!frozenResult.success) {
                const workflowError = {
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
    async executeStepWithRetry(step, context) {
        const retryPolicy = mergeRetryPolicy(step.retryPolicy ?? this.config.defaultRetryPolicy);
        let lastResult = null;
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
            }
            catch (error) {
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
            error: createStepError(WorkflowErrorCodes.MAX_RETRIES_EXCEEDED, `Max retries (${String(retryPolicy.maxAttempts)}) exceeded for step ${step.stepId}`, false),
            durationMs: 0,
            retryCount: attempt - 1,
        };
    }
    async executeStepWithTimeout(step, context) {
        const timeout = step.timeout;
        if (timeout === undefined) {
            return this.config.stepExecutor(step, context);
        }
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                const stepError = createStepError(WorkflowErrorCodes.STEP_TIMEOUT, `Step ${step.stepId} timed out after ${String(timeout)}ms`, true);
                reject(stepError);
            }, timeout);
        });
        try {
            const result = await Promise.race([
                this.config.stepExecutor(step, context),
                timeoutPromise,
            ]);
            return result;
        }
        finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }
    createErrorResult(workflowId, startTime, stepResults, error) {
        const workflowError = {
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
    buildGuardContext(step, stepIndex, workflow, stepResults) {
        const previousOutputs = {};
        for (const result of stepResults) {
            if (result.output !== undefined) {
                previousOutputs[result.stepId] = result.output;
            }
        }
        return {
            executionId: this.config.executionId ?? randomUUID(),
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
    createBlockedResult(workflow, stepResults, step, guardResults, startTime) {
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
export function createWorkflowRunner(config) {
    return new WorkflowRunner(config);
}
