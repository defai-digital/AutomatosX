import type {
  Workflow,
  WorkflowStep,
  RetryPolicy,
} from '@defai.digital/contracts';

/**
 * Result of a step execution
 */
export interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: StepError | undefined;
  durationMs: number;
  retryCount: number;
}

/**
 * Error from step execution
 */
export interface StepError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | undefined;
}

/**
 * Result of a workflow execution
 */
export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  stepResults: StepResult[];
  output?: unknown;
  error?: WorkflowError | undefined;
  totalDurationMs: number;
}

/**
 * Error from workflow execution
 */
export interface WorkflowError {
  code: string;
  message: string;
  failedStepId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

/**
 * Context passed to step executors
 */
export interface StepContext {
  workflowId: string;
  stepIndex: number;
  previousResults: StepResult[];
  input?: unknown;
}

/**
 * Function that executes a single step
 */
export type StepExecutor = (
  step: WorkflowStep,
  context: StepContext
) => Promise<StepResult>;

/**
 * Configuration for the workflow runner
 */
export interface WorkflowRunnerConfig {
  /**
   * Custom step executor (for dependency injection)
   */
  stepExecutor?: StepExecutor | undefined;

  /**
   * Default retry policy if step doesn't specify one
   */
  defaultRetryPolicy?: RetryPolicy | undefined;

  /**
   * Called before each step executes
   */
  onStepStart?: ((step: WorkflowStep, context: StepContext) => void) | undefined;

  /**
   * Called after each step completes
   */
  onStepComplete?: ((step: WorkflowStep, result: StepResult) => void) | undefined;
}

/**
 * Validated and frozen workflow ready for execution
 */
export interface PreparedWorkflow {
  readonly workflow: Readonly<Workflow>;
  readonly stepIds: ReadonlySet<string>;
}

/**
 * Error codes for workflow engine
 */
export const WorkflowErrorCodes = {
  VALIDATION_ERROR: 'WORKFLOW_VALIDATION_ERROR',
  DUPLICATE_STEP_ID: 'WORKFLOW_DUPLICATE_STEP_ID',
  STEP_EXECUTION_FAILED: 'WORKFLOW_STEP_EXECUTION_FAILED',
  STEP_TIMEOUT: 'WORKFLOW_STEP_TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'WORKFLOW_MAX_RETRIES_EXCEEDED',
  UNKNOWN_STEP_TYPE: 'WORKFLOW_UNKNOWN_STEP_TYPE',
} as const;

export type WorkflowErrorCode =
  (typeof WorkflowErrorCodes)[keyof typeof WorkflowErrorCodes];
