import { getErrorMessage, type WorkflowStep } from '@defai.digital/contracts';
import type { StepContext, StepError, StepExecutor, StepResult } from './types.js';
import { WorkflowErrorCodes } from './types.js';

const DEFAULT_LOOP_MAX_ITERATIONS = 100;
const DEFAULT_PARALLEL_CONCURRENCY = 5;

export const defaultStepExecutor: StepExecutor = async (
  step: WorkflowStep,
  context: StepContext,
): Promise<StepResult> => {
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
  } catch (error) {
    return {
      stepId: step.stepId,
      success: false,
      error: normalizeError(error),
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }
};

export function createStepError(
  code: string,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>,
): StepError {
  return {
    code,
    message,
    retryable,
    ...(details !== undefined ? { details } : {}),
  };
}

export function normalizeError(error: unknown): StepError {
  if (typeof error === 'object' && error !== null) {
    const entry = error as { code?: unknown; details?: unknown };
    if (typeof entry.code === 'string') {
      return createStepError(
        entry.code,
        getErrorMessage(error),
        false,
        typeof entry.details === 'object' && entry.details !== null
          ? (entry.details as Record<string, unknown>)
          : undefined,
      );
    }
  }

  return createStepError(
    WorkflowErrorCodes.STEP_EXECUTION_FAILED,
    getErrorMessage(error),
    false,
  );
}

async function executeStepByType(step: WorkflowStep, context: StepContext): Promise<unknown> {
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
      throw createStepError(
        WorkflowErrorCodes.STEP_EXECUTION_FAILED,
        `Step "${step.stepId}": discussion steps require a custom executor (type: discuss).`,
        false,
      );
    case 'delegate':
      throw createStepError(
        WorkflowErrorCodes.STEP_EXECUTION_FAILED,
        `Step "${step.stepId}": delegate steps require a custom executor (type: delegate).`,
        false,
      );
    default: {
      const _exhaustive: never = step.type;
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

function executePromptStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
  const config = step.config ?? {};
  return Promise.resolve({
    type: 'prompt',
    stepId: step.stepId,
    status: 'requires_executor',
    message: 'Prompt execution requires a custom executor.',
    config: {
      prompt: (config.prompt as string | undefined) ?? String(context.input ?? ''),
      provider: config.provider,
      model: config.model,
    },
  });
}

function executeToolStep(step: WorkflowStep, _context: StepContext): Promise<unknown> {
  const config = step.config ?? {};
  const toolName = (config.toolName as string | undefined) ?? step.tool ?? 'unknown';

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

function executeConditionalStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
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

async function executeLoopStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
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

async function executeParallelStep(step: WorkflowStep, _context: StepContext): Promise<unknown> {
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

// INV-WF-SEC-001: Block prototype chain access to prevent prototype pollution
const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Get a value from context using dot-notation path.
 * INV-WF-SEC-001: Blocks __proto__, constructor, prototype traversal.
 */
function getValueFromPath(context: StepContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (DANGEROUS_PROPS.has(part)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Safely evaluate a condition expression without using eval/Function.
 *
 * Supports:
 * - ${variable} === value  (also !==, ==, !=, >, <, >=, <=)
 * - ${variable}            (truthy check)
 * - !${variable}           (falsy check)
 * - condition && condition
 * - condition || condition
 * - (grouped expressions)
 * - true / false literals
 *
 * INV-WF-COND-001: Parentheses must be balanced.
 * INV-WF-COND-002: Supports strict (===, !==) and loose (==, !=) equality.
 */
function evaluateConditionSafely(condition: string, context: StepContext): boolean {
  try {
    // Handle logical OR (lower precedence)
    const orParts = splitByLogicalOperator(condition, '||');
    if (orParts.length > 1) {
      return orParts.some((part) => evaluateConditionSafely(part.trim(), context));
    }

    // Handle logical AND (higher precedence)
    const andParts = splitByLogicalOperator(condition, '&&');
    if (andParts.length > 1) {
      return andParts.every((part) => evaluateConditionSafely(part.trim(), context));
    }

    const trimmed = condition.trim();

    // Handle negation
    if (trimmed.startsWith('!')) {
      return !evaluateConditionSafely(trimmed.slice(1).trim(), context);
    }

    // Handle parentheses — only strip if first '(' matches last ')'
    // INV-WF-COND-001: Track depth to verify balanced parens
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      let depth = 0;
      let firstOpenMatchesLast = true;
      for (let i = 0; i < trimmed.length - 1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')') depth--;
        if (depth === 0) { firstOpenMatchesLast = false; break; }
      }
      if (firstOpenMatchesLast) {
        return evaluateConditionSafely(trimmed.slice(1, -1), context);
      }
    }

    // Parse comparison: ${variable} op value
    const comparisonMatch = /^\$\{([^}]+)\}\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(trimmed);
    if (comparisonMatch) {
      const [, varPath, op, rawValue] = comparisonMatch;
      if (varPath && op && rawValue) {
        const actualValue = getValueFromPath(context, varPath);
        const expectedValue = parseConditionValue(rawValue.trim());
        return compareConditionValues(actualValue, expectedValue, op);
      }
    }

    // Handle simple variable reference (truthy check): ${variable}
    const varMatch = /^\$\{([^}]+)\}$/.exec(trimmed);
    if (varMatch?.[1]) {
      return Boolean(getValueFromPath(context, varMatch[1]));
    }

    // Literal booleans
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Unknown pattern — warn and fail safely
    console.warn(`[executor] Unknown condition pattern: ${condition}`);
    return false;
  } catch (error) {
    console.warn(`[executor] Error evaluating condition: ${condition}`, error);
    return false;
  }
}

function splitByLogicalOperator(condition: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < condition.length; i++) {
    const char = condition[i];
    if (char === '(') { depth++; current += char; }
    else if (char === ')') { depth--; current += char; }
    else if (depth === 0 && condition.slice(i, i + operator.length) === operator) {
      parts.push(current);
      current = '';
      i += operator.length - 1;
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function parseConditionValue(value: string): unknown {
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

function compareConditionValues(actual: unknown, expected: unknown, op: string): boolean {
  switch (op) {
    case '===': return actual === expected;
    case '!==': return actual !== expected;
    // eslint-disable-next-line eqeqeq
    case '==': return actual == expected;
    // eslint-disable-next-line eqeqeq
    case '!=': return actual != expected;
    case '>':  return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '<':  return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case '>=': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    default:   return false;
  }
}

// Keep backward-compatible alias used by executeConditionalStep
function evaluateCondition(condition: string, context: StepContext): boolean {
  return evaluateConditionSafely(condition, context);
}
