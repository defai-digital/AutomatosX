import { getErrorMessage } from '@defai.digital/contracts';
import { WorkflowErrorCodes } from './types.js';
const DEFAULT_LOOP_MAX_ITERATIONS = 100;
const DEFAULT_PARALLEL_CONCURRENCY = 5;
export const defaultStepExecutor = async (step, context) => {
    const startTime = Date.now();
    try {
        const output = await executeStepByType(step, context);
        return {
            stepId: step.stepId,
            success: true,
            output,
            durationMs: Date.now() - startTime,
            retryCount: 0,
        };
    }
    catch (error) {
        return {
            stepId: step.stepId,
            success: false,
            error: normalizeError(error),
            durationMs: Date.now() - startTime,
            retryCount: 0,
        };
    }
};
export function createStepError(code, message, retryable, details) {
    return {
        code,
        message,
        retryable,
        ...(details !== undefined ? { details } : {}),
    };
}
export function normalizeError(error) {
    if (typeof error === 'object' && error !== null) {
        const entry = error;
        if (typeof entry.code === 'string') {
            return createStepError(entry.code, getErrorMessage(error), false, typeof entry.details === 'object' && entry.details !== null
                ? entry.details
                : undefined);
        }
    }
    return createStepError(WorkflowErrorCodes.STEP_EXECUTION_FAILED, getErrorMessage(error), false);
}
async function executeStepByType(step, context) {
    switch (step.type) {
        case 'prompt':
            return executePromptStep(step, context);
        case 'tool':
            return executeToolStep(step, context);
        case 'conditional':
            return executeConditionalStep(step, context);
        case 'loop':
            return executeLoopStep(step, context);
        case 'parallel':
            return executeParallelStep(step, context);
        case 'discuss':
            throw createStepError(WorkflowErrorCodes.STEP_EXECUTION_FAILED, `Step "${step.stepId}": discussion steps require a custom executor (type: discuss).`, false);
        case 'delegate':
            throw createStepError(WorkflowErrorCodes.STEP_EXECUTION_FAILED, `Step "${step.stepId}": delegate steps require a custom executor (type: delegate).`, false);
        default: {
            const _exhaustive = step.type;
            return {
                type: 'unknown',
                stepId: step.stepId,
                status: 'error',
                error: {
                    code: WorkflowErrorCodes.UNKNOWN_STEP_TYPE,
                    message: `Unknown step type: ${String(_exhaustive)}`,
                },
            };
        }
    }
}
function executePromptStep(step, context) {
    const config = step.config ?? {};
    return Promise.resolve({
        type: 'prompt',
        stepId: step.stepId,
        status: 'requires_executor',
        message: 'Prompt execution requires a custom executor.',
        config: {
            prompt: config.prompt ?? String(context.input ?? ''),
            provider: config.provider,
            model: config.model,
        },
    });
}
function executeToolStep(step, _context) {
    const config = step.config ?? {};
    const toolName = config.toolName ?? step.tool ?? 'unknown';
    return Promise.resolve({
        type: 'tool',
        stepId: step.stepId,
        status: toolName === 'unknown' ? 'missing_config' : 'requires_executor',
        message: toolName === 'unknown'
            ? `Tool step "${step.stepId}" requires toolName in config`
            : 'Tool execution requires a custom executor.',
        config: {
            toolName,
            toolInput: config.toolInput,
        },
    });
}
function executeConditionalStep(step, context) {
    const config = step.config ?? {};
    const condition = typeof config.condition === 'string' ? config.condition : 'true';
    const evaluated = evaluateCondition(condition, context);
    return Promise.resolve({
        type: 'conditional',
        stepId: step.stepId,
        condition,
        evaluated,
        output: evaluated
            ? (config.thenValue ?? { branch: 'then', result: true })
            : (config.elseValue ?? { branch: 'else', result: false }),
    });
}
async function executeLoopStep(step, context) {
    const config = step.config ?? {};
    const items = Array.isArray(config.items) ? config.items : [];
    const maxIterations = typeof config.maxIterations === 'number' ? config.maxIterations : DEFAULT_LOOP_MAX_ITERATIONS;
    const results = [];
    for (const [index, item] of items.slice(0, maxIterations).entries()) {
        results.push({
            index,
            item,
            input: context.input,
        });
    }
    return {
        type: 'loop',
        stepId: step.stepId,
        results,
        truncated: items.length > maxIterations,
    };
}
async function executeParallelStep(step, _context) {
    const config = step.config ?? {};
    const tasks = Array.isArray(config.tasks) ? config.tasks : [];
    const concurrency = typeof config.concurrency === 'number' ? config.concurrency : DEFAULT_PARALLEL_CONCURRENCY;
    return {
        type: 'parallel',
        stepId: step.stepId,
        concurrency,
        results: tasks.map((task, index) => ({ index, task, success: true })),
    };
}
function evaluateCondition(condition, context) {
    if (condition === 'true') {
        return true;
    }
    if (condition === 'false') {
        return false;
    }
    const variableReference = /^\$\{(.+)\}$/.exec(condition);
    if (variableReference?.[1]) {
        return Boolean(getNestedValue(context, variableReference[1]));
    }
    return Boolean(condition);
}
function getNestedValue(context, path) {
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
