import type { WorkflowStep } from '@automatosx/contracts';
import type {
  StepResult,
  StepContext,
  StepExecutor,
  StepError,
} from './types.js';
import { WorkflowErrorCodes } from './types.js';

/**
 * Default step executor - creates a placeholder result
 * In production, this would be replaced with actual step implementations
 */
export const defaultStepExecutor: StepExecutor = async (
  step: WorkflowStep,
  context: StepContext
): Promise<StepResult> => {
  const startTime = Date.now();

  try {
    // This is a placeholder implementation
    // Real implementations would handle each step type differently
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

/**
 * Placeholder for prompt step execution
 */
function executePromptStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  // In real implementation, this would call the LLM provider
  return Promise.resolve({
    type: 'prompt',
    stepId: step.stepId,
    result: 'placeholder_prompt_result',
  });
}

/**
 * Placeholder for tool step execution
 */
function executeToolStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  // In real implementation, this would invoke the MCP tool
  return Promise.resolve({
    type: 'tool',
    stepId: step.stepId,
    result: 'placeholder_tool_result',
  });
}

/**
 * Placeholder for conditional step execution
 */
function executeConditionalStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  return Promise.resolve({
    type: 'conditional',
    stepId: step.stepId,
    branch: 'default',
  });
}

/**
 * Placeholder for loop step execution
 */
function executeLoopStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  return Promise.resolve({
    type: 'loop',
    stepId: step.stepId,
    iterations: 0,
  });
}

/**
 * Placeholder for parallel step execution
 */
function executeParallelStep(
  step: WorkflowStep,
  _context: StepContext
): Promise<unknown> {
  return Promise.resolve({
    type: 'parallel',
    stepId: step.stepId,
    results: [],
  });
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
