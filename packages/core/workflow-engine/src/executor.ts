import { getErrorMessage, type WorkflowStep } from '@defai.digital/contracts';
import type {
  StepResult,
  StepContext,
  StepExecutor,
  StepError,
} from './types.js';
import { WorkflowErrorCodes } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Log prefix for consistent logging */
const LOG_PREFIX = '[workflow-engine]';

/** Default maximum iterations for loop steps */
const DEFAULT_LOOP_MAX_ITERATIONS = 100;

/** Default concurrency for parallel steps */
const DEFAULT_PARALLEL_CONCURRENCY = 5;

/** Step executor error codes */
const StepExecutorErrorCodes = {
  DISCUSSION_EXECUTOR_NOT_CONFIGURED: 'DISCUSSION_EXECUTOR_NOT_CONFIGURED',
  DELEGATE_EXECUTOR_NOT_CONFIGURED: 'DELEGATE_EXECUTOR_NOT_CONFIGURED',
  STEP_EXECUTION_ERROR: 'STEP_EXECUTION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Track if we've warned about using the default executor
let hasWarnedDefaultExecutor = false;

/**
 * Default step executor - returns placeholder results for prompt/tool steps
 *
 * WARNING: This is intended for development/testing only.
 * For production use, inject a custom executor via WorkflowRunnerConfig.stepExecutor
 * that integrates with your LLM providers and tool implementations.
 */
export const defaultStepExecutor: StepExecutor = async (
  step: WorkflowStep,
  context: StepContext
): Promise<StepResult> => {
  // Warn once on first use for prompt/tool steps
  if (!hasWarnedDefaultExecutor && (step.type === 'prompt' || step.type === 'tool')) {
    console.warn(
      `${LOG_PREFIX} Using default step executor which returns placeholder results. ` +
      'For production, configure WorkflowRunnerConfig.stepExecutor with real implementations.'
    );
    hasWarnedDefaultExecutor = true;
  }

  const startTime = Date.now();

  try {
    // Execute step by type - prompt/tool return placeholders, others are functional
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

/**
 * Executes a step based on its type
 */
async function executeStepByType(
  step: WorkflowStep,
  context: StepContext
): Promise<unknown> {
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
    case 'discuss': {
      // INV-WF-010: Discussion steps require discussion-domain executor
      // Throw error to ensure step fails (caught by defaultStepExecutor wrapper)
      const discussError = createStepError(
        StepExecutorErrorCodes.DISCUSSION_EXECUTOR_NOT_CONFIGURED,
        `Discussion step "${step.stepId}" requires a DiscussionExecutor. Configure it in RealStepExecutorConfig.`,
        false
      );
      throw new Error(discussError.message);
    }
    case 'delegate': {
      // INV-WF-010: Delegate steps require agent-domain executor
      // Throw error to ensure step fails (caught by defaultStepExecutor wrapper)
      const delegateError = createStepError(
        StepExecutorErrorCodes.DELEGATE_EXECUTOR_NOT_CONFIGURED,
        `Delegate step "${step.stepId}" requires an AgentExecutor. Configure it in RealStepExecutorConfig.`,
        false
      );
      throw new Error(delegateError.message);
    }
    default: {
      // TypeScript exhaustiveness check - return error instead of throwing
      // INV-WF-010: All step types return consistent structure
      const _exhaustive: never = step.type;
      return Promise.resolve({
        type: 'unknown',
        stepId: step.stepId,
        status: 'error',
        error: {
          code: WorkflowErrorCodes.UNKNOWN_STEP_TYPE,
          message: `Unknown step type: ${String(_exhaustive)}`,
        },
      });
    }
  }
}

// ============================================================================
// Step Type Configurations (expected in step.config)
// ============================================================================

interface PromptStepConfig {
  prompt?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ToolStepConfig {
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

interface ConditionalStepConfig {
  condition?: string; // Expression to evaluate (e.g., "${previousResult} === true")
  thenValue?: unknown; // Value to return if condition is true
  elseValue?: unknown; // Value to return if condition is false
}

interface LoopStepConfig {
  items?: unknown[]; // Items to iterate over
  itemsPath?: string; // Path to get items from context (e.g., "previousResults.step1")
  maxIterations?: number; // Maximum iterations (default: DEFAULT_LOOP_MAX_ITERATIONS)
}

interface ParallelStepConfig {
  tasks?: { id: string; value: unknown }[]; // Parallel tasks
  concurrency?: number; // Max concurrent tasks (default: DEFAULT_PARALLEL_CONCURRENCY)
  failFast?: boolean; // Stop on first failure (default: false)
}

// ============================================================================
// Step Executors
// ============================================================================

/**
 * Prompt step execution
 * NOTE: This is a placeholder. In production, inject a custom executor via WorkflowRunnerConfig.
 * The workflow-engine cannot depend on provider adapters directly (architectural constraint).
 */
function executePromptStep(
  step: WorkflowStep,
  context: StepContext
): Promise<unknown> {
  const config = (step.config ?? {}) as PromptStepConfig;

  // Return structured output indicating this needs a real executor
  return Promise.resolve({
    type: 'prompt',
    stepId: step.stepId,
    status: 'requires_executor',
    message: 'Prompt execution requires a custom executor. Configure WorkflowRunnerConfig.stepExecutor.',
    config: {
      prompt: config.prompt ?? String(context.input ?? ''),
      systemPrompt: config.systemPrompt,
      provider: config.provider,
      model: config.model,
    },
  });
}

/**
 * Tool step execution
 * NOTE: This is a placeholder. In production, inject a custom executor via WorkflowRunnerConfig.
 */
function executeToolStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  const config = (step.config ?? {}) as ToolStepConfig;

  const toolName = config.toolName ?? 'unknown';

  // Return structured output indicating this needs a real executor
  return Promise.resolve({
    type: 'tool',
    stepId: step.stepId,
    status: config.toolName ? 'requires_executor' : 'missing_config',
    message: config.toolName
      ? 'Tool execution requires a custom executor. Configure WorkflowRunnerConfig.stepExecutor.'
      : `Tool step "${step.stepId}" requires toolName in config`,
    config: {
      toolName,
      toolInput: config.toolInput,
    },
  });
}

/**
 * Conditional step execution
 * Evaluates a condition expression and returns appropriate value.
 *
 * Config:
 * - condition: Expression string (supports ${variable} substitution)
 * - thenValue: Value to return if true (default: { branch: 'then', result: true })
 * - elseValue: Value to return if false (default: { branch: 'else', result: false })
 */
function executeConditionalStep(
  step: WorkflowStep,
  context: StepContext
): Promise<unknown> {
  const config = (step.config ?? {}) as ConditionalStepConfig;
  const condition = config.condition ?? 'true';

  try {
    // Safely evaluate the condition without using eval/Function
    const result = evaluateConditionSafely(condition, context);

    const thenValue = config.thenValue ?? { branch: 'then', result: true };
    const elseValue = config.elseValue ?? { branch: 'else', result: false };

    return Promise.resolve({
      type: 'conditional',
      stepId: step.stepId,
      condition,
      evaluated: result,
      output: result ? thenValue : elseValue,
    });
  } catch (error) {
    // On evaluation error, return false branch
    return Promise.resolve({
      type: 'conditional',
      stepId: step.stepId,
      condition,
      evaluated: false,
      error: getErrorMessage(error, 'Evaluation failed'),
      output: config.elseValue ?? { branch: 'else', result: false },
    });
  }
}

/**
 * Loop step execution
 * Iterates over items and collects results.
 *
 * Config:
 * - items: Array of items to iterate
 * - itemsPath: Path to get items from context (e.g., "previousResults.step1.data")
 * - maxIterations: Max iterations limit (default: 100)
 */
function executeLoopStep(
  step: WorkflowStep,
  context: StepContext
): Promise<unknown> {
  const config = (step.config ?? {}) as LoopStepConfig;
  const maxIterations = config.maxIterations ?? DEFAULT_LOOP_MAX_ITERATIONS;

  // Get items from config or context path
  let items: unknown[] = [];

  if (config.items !== undefined && Array.isArray(config.items)) {
    items = config.items;
  } else if (config.itemsPath !== undefined) {
    const resolved = getValueFromPath(context, config.itemsPath);
    if (Array.isArray(resolved)) {
      items = resolved;
    }
  } else if (Array.isArray(context.input)) {
    items = context.input;
  }

  // Limit iterations
  const limitedItems = items.slice(0, maxIterations);

  // Collect iteration results (in real impl, would execute nested steps per item)
  const iterationResults = limitedItems.map((item, index) => ({
    index,
    item,
    // In a full implementation, nested steps would be executed here
    processed: true,
  }));

  return Promise.resolve({
    type: 'loop',
    stepId: step.stepId,
    totalItems: items.length,
    processedItems: limitedItems.length,
    truncated: items.length > maxIterations,
    results: iterationResults,
  });
}

/**
 * Parallel step execution
 * Executes multiple tasks concurrently.
 *
 * Config:
 * - tasks: Array of { id, value } tasks
 * - concurrency: Max concurrent tasks (default: 5)
 * - failFast: Stop on first failure (default: false)
 */
async function executeParallelStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  const config = (step.config ?? {}) as ParallelStepConfig;
  const tasks = config.tasks ?? [];
  const concurrency = config.concurrency ?? DEFAULT_PARALLEL_CONCURRENCY;
  const failFast = config.failFast ?? false;

  if (tasks.length === 0) {
    return {
      type: 'parallel',
      stepId: step.stepId,
      totalTasks: 0,
      completedTasks: 0,
      results: [],
    };
  }

  // Process tasks in batches for concurrency control
  const results: { id: string; success: boolean; output?: unknown; error?: string }[] = [];
  let hasFailure = false;

  for (let i = 0; i < tasks.length; i += concurrency) {
    if (failFast && hasFailure) break;

    const batch = tasks.slice(i, i + concurrency);

    // Execute batch concurrently
    const batchPromises = batch.map(async (task) => {
      try {
        // In a full implementation, this would execute nested steps
        // For now, just return the task value as processed
        return {
          id: task.id,
          success: true,
          output: { processed: true, value: task.value },
        };
      } catch (error) {
        hasFailure = true;
        return {
          id: task.id,
          success: false,
          error: getErrorMessage(error),
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return {
    type: 'parallel',
    stepId: step.stepId,
    totalTasks: tasks.length,
    completedTasks: results.length,
    failedTasks: results.filter((r) => !r.success).length,
    results,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a value from context using dot-notation path
 * e.g., "previousResults.step1.output" or "input.data"
 * INV-WF-SEC-001: Block prototype chain access to prevent prototype pollution
 */
function getValueFromPath(context: StepContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  // INV-WF-SEC-001: Dangerous properties that could lead to prototype pollution
  const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    // INV-WF-SEC-001: Block prototype chain traversal
    if (DANGEROUS_PROPS.has(part)) {
      return undefined;
    }
    // Only access own properties to prevent prototype chain pollution
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ============================================================================
// Safe Condition Evaluation (no eval/Function - prevents code injection)
// ============================================================================

/**
 * Safely evaluate a condition expression without using eval/Function
 *
 * Supports patterns:
 * - ${variable} === value
 * - ${variable} !== value
 * - ${variable} > value (numeric)
 * - ${variable} < value (numeric)
 * - ${variable} >= value (numeric)
 * - ${variable} <= value (numeric)
 * - ${variable} (truthy check)
 * - !${variable} (falsy check)
 * - condition && condition
 * - condition || condition
 * - true / false literals
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

    // Handle parentheses - only strip if the closing paren matches the opening one
    // INV-WF-COND-001: Check that first '(' matches last ')' by tracking depth
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      // Verify the closing paren matches the opening one
      let depth = 0;
      let firstOpenMatchesLastClose = true;
      for (let i = 0; i < trimmed.length - 1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')') depth--;
        // If depth reaches 0 before the last character, the first '(' doesn't match the last ')'
        if (depth === 0) {
          firstOpenMatchesLastClose = false;
          break;
        }
      }
      if (firstOpenMatchesLastClose) {
        return evaluateConditionSafely(trimmed.slice(1, -1), context);
      }
    }

    // Parse comparison: ${variable} op value
    const comparisonMatch = /^\$\{([^}]+)\}\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/.exec(trimmed);
    if (comparisonMatch) {
      const [, varPath, op, rawValue] = comparisonMatch;
      // INV-WF-012: Explicit null checks for regex capture groups
      if (varPath && op && rawValue) {
        const actualValue = getValueFromPath(context, varPath);
        const expectedValue = parseConditionValue(rawValue.trim());
        return compareConditionValues(actualValue, expectedValue, op);
      }
    }

    // Handle simple variable reference (truthy check): ${variable}
    const varMatch = /^\$\{([^}]+)\}$/.exec(trimmed);
    if (varMatch) {
      const varPath = varMatch[1];
      // INV-WF-012: Explicit null check for regex capture group
      if (varPath) {
        const value = getValueFromPath(context, varPath);
        return Boolean(value);
      }
    }

    // Handle literal booleans
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Unknown pattern - warn and fail safely
    console.warn(`${LOG_PREFIX} Unknown condition pattern: ${condition}`);
    return false;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Error evaluating condition: ${condition}`, error);
    return false;
  }
}

/**
 * Split condition by logical operator, respecting parentheses depth
 */
function splitByLogicalOperator(condition: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < condition.length; i++) {
    const char = condition[i];

    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (depth === 0 && condition.slice(i, i + operator.length) === operator) {
      parts.push(current);
      current = '';
      i += operator.length - 1; // -1 because loop will increment
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Parse a value string from condition into its actual type
 */
function parseConditionValue(value: string): unknown {
  // String literal (single or double quotes)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Null/undefined
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;

  // Booleans
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Numbers
  const num = Number(value);
  if (!Number.isNaN(num)) return num;

  // Return as string if nothing else matches
  return value;
}

/**
 * Compare two values with the given operator
 *
 * INV-WF-COND-002: Supports both strict (===, !==) and loose (==, !=) equality
 *
 * Note: Loose equality (== and !=) is intentionally supported for workflow conditions
 * where type coercion may be desired (e.g., comparing "1" == 1, null == undefined).
 * Use strict equality (===, !==) when type-safe comparison is required.
 */
function compareConditionValues(actual: unknown, expected: unknown, op: string): boolean {
  switch (op) {
    case '===':
      return actual === expected;
    case '!==':
      return actual !== expected;
    // eslint-disable-next-line eqeqeq -- Intentional loose equality for workflow flexibility
    case '==':
      return actual == expected;
    // eslint-disable-next-line eqeqeq -- Intentional loose equality for workflow flexibility
    case '!=':
      return actual != expected;
    case '>':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '<':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    default:
      return false;
  }
}

/**
 * Creates a step error
 */
export function createStepError(
  code: string,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
): StepError {
  const error: StepError = {
    code,
    message,
    retryable,
  };
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

/**
 * Normalizes an unknown error into a StepError
 */
export function normalizeError(error: unknown): StepError {
  if (isStepError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: StepExecutorErrorCodes.STEP_EXECUTION_ERROR,
      message: error.message,
      retryable: false,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  return {
    code: StepExecutorErrorCodes.UNKNOWN_ERROR,
    message: String(error),
    retryable: false,
  };
}

/**
 * Type guard for StepError
 */
function isStepError(error: unknown): error is StepError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  );
}
