/**
 * @defai.digital/agent-domain
 *
 * Agent profiles and orchestration for AutomatosX.
 * Manages specialized AI agents with defined workflows, personalities,
 * abilities, and orchestration rules.
 */

// Types
export type {
  AgentRegistry,
  AgentFilter,
  AgentExecutor,
  ExecutionStatus,
  ExecutionProgress,
  DelegationRequest,
  DelegationManager,
  AgentEventHandler,
  AgentEventEmitter,
  StepExecutorFn,
  StepExecutionContext,
  StepExecutionResult,
  StepAgentProfile,
  AgentDomainConfig,
  // Prompt executor types
  PromptExecutor,
  PromptExecutionRequest,
  PromptExecutionResponse,
  PromptStepConfig,
  // Tool executor types (INV-TOOL-001, INV-TOOL-002, INV-TOOL-003)
  ToolExecutor,
  // Loader types
  AgentLoader,
  AgentLoaderConfig,
  // Selector types
  AgentSelector,
  AgentSelectionResult,
  AgentSelectionContext,
  // Ability integration types
  AbilityManagerLike,
  // Delegation tracker port types (DI pattern)
  DelegationTrackerPort,
  DelegationTrackerFactory,
  // Checkpoint port types (DI pattern)
  CheckpointStoragePort,
  CheckpointManagerPort,
  Checkpoint,
  CheckpointStorageFactory,
  CheckpointManagerFactory,
  // Parallel executor port types (DI pattern)
  ParallelExecutorPort,
  ParallelStepExecutor,
  ParallelStepResult,
  ParallelGroupResult,
  ParallelExecutorFactory,
} from './types.js';

export { DEFAULT_AGENT_DOMAIN_CONFIG } from './types.js';

// Registry
export {
  InMemoryAgentRegistry,
  AgentRegistryError,
  createAgentRegistry,
} from './registry.js';

// Persistent Registry
export {
  PersistentAgentRegistry,
  createPersistentAgentRegistry,
  getDefaultAgentStoragePath,
  type PersistentRegistryConfig,
} from './persistent-registry.js';

// Executor
export { DefaultAgentExecutor, createAgentExecutor } from './executor.js';

// Enhanced Executor (full feature support)
export {
  EnhancedAgentExecutor,
  createEnhancedAgentExecutor,
  type EnhancedAgentDomainConfig,
} from './enhanced-executor.js';

// Prompt Executor
export {
  StubPromptExecutor,
  ProviderPromptExecutor,
  createStubPromptExecutor,
  createProviderPromptExecutor,
  type ProviderPromptExecutorConfig,
  type ProviderRegistryLike,
  type ProviderLike,
} from './prompt-executor.js';

// Loader
export { FileSystemAgentLoader, createAgentLoader } from './loader.js';

// Selector
export { KeywordAgentSelector, createAgentSelector } from './selector.js';

// Selection Service (INV-AGT-SEL-001 to INV-AGT-SEL-007)
export {
  AgentSelectionService,
  createAgentSelectionService,
  type AgentSelectionServicePort,
  type FeedbackScoreAdjusterPort,
  type AgentSelectionServiceOptions,
} from './selection-service.js';

// Workflow Templates
export {
  WORKFLOW_TEMPLATES,
  PROMPT_RESPONSE_TEMPLATE,
  RESEARCH_TEMPLATE,
  CODE_REVIEW_TEMPLATE,
  MULTI_STEP_TEMPLATE,
  DELEGATE_CHAIN_TEMPLATE,
  AGENT_SELECTION_TEMPLATE,
  getWorkflowTemplate,
  getAvailableTemplates,
  createWorkflowFromTemplate,
  isValidTemplateName,
  getTemplateDescription,
  type WorkflowTemplateName,
  type WorkflowTemplate,
} from './workflow-templates.js';

// Stub factories (for DI fallbacks)
export { stubDelegationTrackerFactory, resetStubWarning as resetDelegationStubWarning } from './stub-delegation-tracker.js';
export { stubCheckpointStorageFactory, stubCheckpointManagerFactory, resetCheckpointStubWarning } from './stub-checkpoint.js';
export { stubParallelExecutorFactory, resetParallelStubWarning } from './stub-parallel-executor.js';

// Production factories (real implementations for wiring)
export {
  createCheckpointStorageFactory,
  createCheckpointManagerFactory,
  createDelegationTrackerFactory,
  createParallelExecutorFactory,
  createProductionFactories,
  type ProductionFactoriesConfig,
  type ProductionFactories,
} from './production-factories.js';

// Re-export contract types for convenience
export type {
  AgentProfile,
  AgentRunOptions,
  AgentResult,
  AgentError,
  AgentEvent,
  AgentEventType,
  AgentEventPayload,
  AgentWorkflowStep,
  AgentStepType,
  AgentRetryPolicy,
  AgentPersonality,
  AbilitySelection,
  OrchestrationConfig,
  SelectionMetadata,
  RedirectRule,
} from '@defai.digital/contracts';

export {
  AgentProfileSchema,
  AgentRunOptionsSchema,
  AgentResultSchema,
  AgentErrorSchema,
  AgentEventSchema,
  AgentWorkflowStepSchema,
  AgentErrorCode,
  validateAgentProfile,
  safeValidateAgentProfile,
  validateAgentRunOptions,
} from '@defai.digital/contracts';
