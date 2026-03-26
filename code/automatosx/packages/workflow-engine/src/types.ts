import type { RetryPolicy, Workflow, WorkflowStep } from '@defai.digital/contracts';
import type { StepGuardEngine } from './step-guard.js';

export interface StepError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | undefined;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: StepError | undefined;
  durationMs: number;
  retryCount: number;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface WorkflowError {
  code: string;
  message: string;
  failedStepId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  stepResults: StepResult[];
  output?: unknown;
  error?: WorkflowError | undefined;
  totalDurationMs: number;
}

export interface StepContext {
  workflowId: string;
  stepIndex: number;
  previousResults: StepResult[];
  input?: unknown;
}

export type StepExecutor = (
  step: WorkflowStep,
  context: StepContext,
) => Promise<StepResult>;

export interface WorkflowRunnerConfig {
  stepExecutor?: StepExecutor | undefined;
  defaultRetryPolicy?: RetryPolicy | undefined;
  onStepStart?: ((step: WorkflowStep, context: StepContext) => void) | undefined;
  onStepComplete?: ((step: WorkflowStep, result: StepResult) => void) | undefined;
  stepGuardEngine?: StepGuardEngine | undefined;
  executionId?: string | undefined;
  agentId?: string | undefined;
}

export interface PreparedWorkflow {
  readonly workflow: Readonly<Workflow>;
  readonly stepIds: ReadonlySet<string>;
}

export const WorkflowErrorCodes = {
  VALIDATION_ERROR: 'WORKFLOW_VALIDATION_ERROR',
  DUPLICATE_STEP_ID: 'WORKFLOW_DUPLICATE_STEP_ID',
  STEP_EXECUTION_FAILED: 'WORKFLOW_STEP_EXECUTION_FAILED',
  STEP_TIMEOUT: 'WORKFLOW_STEP_TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'WORKFLOW_MAX_RETRIES_EXCEEDED',
  UNKNOWN_STEP_TYPE: 'WORKFLOW_UNKNOWN_STEP_TYPE',
  AFTER_GUARD_ERROR: 'WORKFLOW_AFTER_GUARD_ERROR',
} as const;

export type WorkflowErrorCode =
  (typeof WorkflowErrorCodes)[keyof typeof WorkflowErrorCodes];
