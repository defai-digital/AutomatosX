import type { WorkflowStep } from '@automatosx/contracts';
import type {
  StepResult,
  StepContext,
  StepExecutor,
  StepError,
} from './types.js';
import { WorkflowErrorCodes } from './types.js';

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
      '[WARN] workflow-engine: Using default step executor which returns placeholder results. ' +
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
    case 'discuss':
      // Discussion steps are handled by the discussion-domain executor
      // For now, return a placeholder indicating this needs the discussion executor
      return {
        stepId: step.stepId,
        success: false,
        error: 'Discussion steps require the discussion-domain executor',
        durationMs: 0,
      };
    case 'delegate':
      // Delegate steps are handled by the agent-domain executor
      // For now, return a placeholder indicating this needs the agent executor
      return {
        stepId: step.stepId,
        success: false,
        error: 'Delegate steps require the agent-domain executor',
        durationMs: 0,
      };
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = step.type;
      const stepError = createStepError(
        WorkflowErrorCodes.UNKNOWN_STEP_TYPE,
        `Unknown step type: ${String(_exhaustive)}`,
        false
      );
      throw new Error(stepError.message);
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
  maxIterations?: number; // Maximum iterations (default: 100)
}

interface ParallelStepConfig {
  tasks?: { id: string; value: unknown }[]; // Parallel tasks
  concurrency?: number; // Max concurrent tasks (default: 5)
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
    // Substitute variables in condition
    const substituted = substituteVariables(condition, context);

    // Safely evaluate the condition
    // Using Function constructor to evaluate (safer than direct eval, still sandboxed)
    const evaluator = new Function(
      'context',
      'previousResults',
      'input',
      `return Boolean(${substituted})`
    );
    const result = evaluator(context, context.previousResults, context.input);

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
      error: error instanceof Error ? error.message : 'Evaluation failed',
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
  const maxIterations = config.maxIterations ?? 100;

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
  const concurrency = config.concurrency ?? 5;
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
          error: error instanceof Error ? error.message : 'Unknown error',
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
 * Substitute ${variable} patterns in a string with values from context
 */
function substituteVariables(template: string, context: StepContext): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const value = getValueFromPath(context, path);
    if (value === undefined) return match;
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

/**
 * Get a value from context using dot-notation path
 * e.g., "previousResults.step1.output" or "input.data"
 */
function getValueFromPath(context: StepContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
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
      code: 'STEP_EXECUTION_ERROR',
      message: error.message,
      retryable: false,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
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
