/**
 * Agent Domain Contracts v1
 *
 * @packageDocumentation
 */

export {
  // Supporting Schemas
  AgentPersonalitySchema,
  AbilitySelectionSchema,
  RedirectRuleSchema,
  SelectionMetadataSchema,
  OrchestrationConfigSchema,
  AgentRetryPolicySchema,
  AgentStepTypeSchema,
  AgentWorkflowStepSchema,

  // Agent Profile
  AgentProfileSchema,
  AgentRunOptionsSchema,

  // Events
  AgentEventTypeSchema,
  AgentErrorSchema,
  AgentEventPayloadSchema,
  BaseEventSchema,
  AgentEventSchema,

  // Result
  AgentResultSchema,

  // Error Codes
  AgentErrorCode,

  // Checkpoint Contracts
  CheckpointConfigSchema,
  MemorySnapshotItemSchema,
  CheckpointSchema,
  ResumeContextSchema,
  CheckpointErrorCodes,

  // Delegation Contracts
  DelegationContextSchema,
  DelegationRequestSchema,
  DelegationResultSchema,
  DelegationCheckResultSchema,
  DelegationErrorCodes,

  // Parallel Execution Contracts
  ParallelFailureStrategySchema,
  ParallelExecutionConfigSchema,
  ParallelStepResultSchema,
  ParallelGroupResultSchema,
  ParallelExecutionErrorCodes,

  // Tool Executor Contracts
  ToolExecutionResultSchema,
  ToolExecutionRequestSchema,
  ToolExecutorConfigSchema,
  ToolExecutorErrorCodes,

  // Validation Functions
  validateAgentProfile,
  safeValidateAgentProfile,
  validateAgentRunOptions,
  validateCheckpointConfig,
  validateCheckpoint,
  validateDelegationContext,
  validateDelegationRequest,
  validateParallelExecutionConfig,
  validateToolExecutionResult,
  validateToolExecutionRequest,

  // Factory Functions
  createDefaultCheckpointConfig,
  createDefaultParallelExecutionConfig,
  createRootDelegationContext,
  createToolExecutionSuccess,
  createToolExecutionFailure,

  // Types
  type AgentPersonality,
  type AbilitySelection,
  type RedirectRule,
  type SelectionMetadata,
  type OrchestrationConfig,
  type AgentRetryPolicy,
  type AgentStepType,
  type AgentWorkflowStep,
  type AgentProfile,
  type AgentRunOptions,
  type AgentEventType,
  type AgentError,
  type AgentEventPayload,
  type AgentEvent,
  type AgentResult,
  type CheckpointConfig,
  type MemorySnapshotItem,
  type Checkpoint,
  type ResumeContext,
  type CheckpointErrorCode,
  type DelegationContext,
  type DelegationRequest,
  type DelegationResult,
  type DelegationCheckResult,
  type DelegationErrorCode,
  type ParallelFailureStrategy,
  type ParallelExecutionConfig,
  type ParallelStepResult,
  type ParallelGroupResult,
  type ParallelExecutionErrorCode,
  type ToolExecutionResult,
  type ToolExecutionRequest,
  type ToolExecutorConfig,
  type ToolExecutorErrorCode,
} from './schema.js';

// Storage Port Interfaces (Ports & Adapters pattern)
export type {
  CheckpointStoragePort,
  CheckpointManagerPort,
  DelegationTrackerPort,
  DeadLetterQueuePort,
} from './storage-port.js';
