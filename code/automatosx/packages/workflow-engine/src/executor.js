import { getErrorMessage } from '@defai.digital/contracts';
import { WorkflowErrorCodes } from './types.js';
const DEFAULT_LOOP_MAX_ITERATIONS = 100;
const DEFAULT_PARALLEL_CONCURRENCY = 5;
// INV-WF-SEC-001: Block prototype chain access to prevent prototype pollution
const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);
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
    const evaluated = evaluateConditionSafely(condition, context);
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
// INV-WF-SEC-001: Safe path traversal (blocks prototype chain)
function getValueFromPath(context, path) {
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        if (DANGEROUS_PROPS.has(part)) return undefined;
        if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
        current = current[part];
    }
    return current;
}
function evaluateConditionSafely(condition, context) {
    try {
        const orParts = splitByLogicalOperator(condition, '||');
        if (orParts.length > 1) return orParts.some((part) => evaluateConditionSafely(part.trim(), context));
        const andParts = splitByLogicalOperator(condition, '&&');
        if (andParts.length > 1) return andParts.every((part) => evaluateConditionSafely(part.trim(), context));
        const trimmed = condition.trim();
        if (trimmed.startsWith('!')) return !evaluateConditionSafely(trimmed.slice(1).trim(), context);
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            let depth = 0, firstOpenMatchesLast = true;
            for (let i = 0; i < trimmed.length - 1; i++) {
                if (trimmed[i] === '(') depth++;
                else if (trimmed[i] === ')') depth--;
                if (depth === 0) { firstOpenMatchesLast = false; break; }
            }
            if (firstOpenMatchesLast) return evaluateConditionSafely(trimmed.slice(1, -1), context);
        }
        const comparisonMatch = /^\$\{([^}]+)\}\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(trimmed);
        if (comparisonMatch) {
            const [, varPath, op, rawValue] = comparisonMatch;
            if (varPath && op && rawValue) {
                return compareConditionValues(getValueFromPath(context, varPath), parseConditionValue(rawValue.trim()), op);
            }
        }
        const varMatch = /^\$\{([^}]+)\}$/.exec(trimmed);
        if (varMatch?.[1]) return Boolean(getValueFromPath(context, varMatch[1]));
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        console.warn(`[executor] Unknown condition pattern: ${condition}`);
        return false;
    } catch (error) {
        console.warn(`[executor] Error evaluating condition: ${condition}`, error);
        return false;
    }
}
function splitByLogicalOperator(condition, operator) {
    const parts = [];
    let current = '', depth = 0;
    for (let i = 0; i < condition.length; i++) {
        const char = condition[i];
        if (char === '(') { depth++; current += char; }
        else if (char === ')') { depth--; current += char; }
        else if (depth === 0 && condition.slice(i, i + operator.length) === operator) {
            parts.push(current); current = ''; i += operator.length - 1;
        } else { current += char; }
    }
    if (current) parts.push(current);
    return parts;
}
function parseConditionValue(value) {
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
    return value;
}
function compareConditionValues(actual, expected, op) {
    switch (op) {
        case '===': return actual === expected;
        case '!==': return actual !== expected;
        case '==': return actual == expected;
        case '!=': return actual != expected;
        case '>': return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
        case '<': return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
        case '>=': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
        case '<=': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
        default: return false;
    }
}
