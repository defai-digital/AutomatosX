// Workflow Engine
// Executes workflows following contract invariants

export { WorkflowRunner, createWorkflowRunner } from './runner.js';
export {
  validateWorkflow,
  prepareWorkflow,
  WorkflowValidationError,
} from './validation.js';
export {
  defaultStepExecutor,
  createStepError,
  normalizeError,
} from './executor.js';
export {
  createRealStepExecutor,
  type PromptExecutorLike,
  type ToolExecutorLike,
  type RealStepExecutorConfig,
} from './step-executor-factory.js';
export {
  DEFAULT_RETRY_POLICY,
  mergeRetryPolicy,
  shouldRetry,
  calculateBackoff,
  sleep,
} from './retry.js';
export {
  WorkflowErrorCodes,
  type WorkflowErrorCode,
  type StepResult,
  type StepError,
  type WorkflowResult,
  type WorkflowError,
  type StepContext,
  type StepExecutor,
  type WorkflowRunnerConfig,
  type PreparedWorkflow,
} from './types.js';

// Re-export contract types for consumer convenience
export type {
  Workflow,
  WorkflowStep,
  RetryPolicy,
  SchemaReference,
  StepType,
} from '@automatosx/contracts';

// Re-export validation schemas
export {
  WorkflowSchema,
  WorkflowStepSchema,
  RetryPolicySchema,
} from '@automatosx/contracts';

// Step Guard exports
export {
  StepGuardEngine,
  createStepGuardEngine,
  createGateRegistry,
  ProgressTracker,
  createProgressTracker,
  DEFAULT_STEP_GUARD_ENGINE_CONFIG,
  type GateCheckFn,
  type GateRegistry,
  type StepGuardEngineConfig,
} from './step-guard.js';

// Re-export step guard contract types
export type {
  WorkflowStepGuard,
  StepGuardResult,
  StepGuardContext,
  StepGuardPolicy,
  StepGateResult,
  GuardPosition,
  GuardCheckStatus,
  StageProgressEvent,
  StageProgressStatus,
} from '@automatosx/contracts';
