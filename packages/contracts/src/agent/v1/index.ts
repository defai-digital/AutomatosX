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
  AgentCategorySchema,
  AgentTaskTypeSchema,
  CapabilityMappingSchema,
  SelectionMetadataSchema,
  FallbackStrategySchema,
  ProviderAffinitySchema,
  OrchestrationConfigSchema,
  AgentRetryPolicySchema,
  AgentStepTypeSchema,
  AgentWorkflowStepSchema,

  // Task Classifier Schemas (INV-TC-001 to INV-TC-005)
  TaskClassifierRuleSchema,
  TaskClassifierConfigSchema,
  TaskClassificationResultSchema,
  validateTaskClassifierConfig,

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

  // Parallel Execution Contracts (schemas only - error codes in parallel-execution/v1)
  ParallelFailureStrategySchema,
  ParallelExecutionConfigSchema,
  ParallelStepResultSchema,
  ParallelGroupResultSchema,

  // Tool Executor Contracts
  ToolExecutionResultSchema,
  ToolExecutionRequestSchema,
  ToolExecutorConfigSchema,
  ToolExecutorErrorCodes,

  // Agent Selection Contracts (MCP Tools)
  AgentRecommendRequestSchema,
  AgentMatchSchema,
  AgentRecommendResultSchema,
  AgentCapabilitiesRequestSchema,
  AgentCapabilitiesResultSchema,
  AgentSelectionContextSchema,

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
  validateAgentRecommendRequest,
  validateAgentRecommendResult,
  validateAgentCapabilitiesRequest,
  validateAgentCapabilitiesResult,

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
  type AgentCategory,
  type AgentTaskType,
  type CapabilityMapping,
  type SelectionMetadata,
  type FallbackStrategy,
  type ProviderAffinity,
  type OrchestrationConfig,
  type AgentRetryPolicy,
  type AgentStepType,
  type AgentWorkflowStep,

  // Task Classifier Types (INV-TC-001 to INV-TC-005)
  type TaskClassifierRule,
  type TaskClassifierConfig,
  type TaskClassificationResult,
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
  type ToolExecutionResult,
  type ToolExecutionRequest,
  type ToolExecutorConfig,
  type ToolExecutorErrorCode,
  type AgentRecommendRequest,
  type AgentMatch,
  type AgentRecommendResult,
  type AgentCapabilitiesRequest,
  type AgentCapabilitiesResult,
  type AgentSelectionContext,
} from './schema.js';

// Storage Port Interfaces (Ports & Adapters pattern)
export type {
  CheckpointStoragePort,
  CheckpointManagerPort,
  DelegationTrackerPort,
  DeadLetterQueuePort,
} from './storage-port.js';
