/**
 * Discussion Domain Contracts v1
 *
 * Zod schemas and types for multi-model discussions enabling Claude, GLM, Qwen,
 * Gemini, Codex, and Grok to collaborate on complex problems.
 *
 * @module @defai.digital/contracts/discussion/v1
 */

// Re-export all schemas and types from schema.ts
export {
  // Constants
  MAX_PROVIDERS,
  MIN_PROVIDERS,
  MAX_ROUNDS,
  DEFAULT_ROUNDS,
  DEFAULT_PROVIDER_TIMEOUT,
  MAX_PROVIDER_TIMEOUT,
  DEFAULT_PROVIDERS,
  PATTERN_DESCRIPTIONS,
  PROVIDER_STRENGTHS,
  DiscussionErrorCodes,

  // Recursive Discussion Constants
  MAX_DISCUSSION_DEPTH,
  DEFAULT_DISCUSSION_DEPTH,
  MIN_SYNTHESIS_TIME_MS,
  DEFAULT_TOTAL_BUDGET_MS,
  DEFAULT_MAX_TOTAL_CALLS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_AGENT_WEIGHT_MULTIPLIER,

  // Schemas - Patterns & Configuration
  DiscussionPatternSchema,
  ConsensusMethodSchema,
  ConsensusConfigSchema,
  DebateRoleSchema,
  RoleAssignmentSchema,
  ProviderCapabilitySchema,
  DiscussStepConfigSchema,

  // Schemas - Responses & Results
  DiscussionProviderResponseSchema,
  DiscussionRoundSchema,
  VoteRecordSchema,
  VotingResultsSchema,
  DissentRecordSchema,
  ConsensusResultSchema,
  DiscussionErrorSchema,
  CostSummarySchema,
  EarlyExitInfoSchema,
  DiscussionMetadataSchema,
  DiscussionResultSchema,
  DiscussionRequestSchema,

  // Schemas - Recursive Discussion
  TimeoutStrategySchema,
  TimeoutConfigSchema,
  CascadingConfidenceConfigSchema,
  CostControlConfigSchema,
  RecursiveConfigSchema,
  DiscussionContextSchema,
  DiscussionParticipantSchema,
  SubDiscussionResultSchema,

  // Types
  type DiscussionPattern,
  type ConsensusMethod,
  type ConsensusConfig,
  type DebateRole,
  type RoleAssignment,
  type ProviderCapability,
  type DiscussStepConfig,
  type DiscussionProviderResponse,
  type DiscussionRound,
  type VoteRecord,
  type VotingResults,
  type DissentRecord,
  type ConsensusResult,
  type DiscussionError,
  type CostSummary,
  type EarlyExitInfo,
  type DiscussionMetadata,
  type DiscussionResult,
  type DiscussionRequest,
  type DiscussionErrorCode,

  // Types - Recursive Discussion
  type TimeoutStrategy,
  type TimeoutConfig,
  type CascadingConfidenceConfig,
  type CostControlConfig,
  type RecursiveConfig,
  type DiscussionContext,
  type DiscussionParticipant,
  type SubDiscussionResult,

  // Validation Functions
  validateDiscussStepConfig,
  safeValidateDiscussStepConfig,
  validateDiscussionRequest,
  safeValidateDiscussionRequest,
  validateDiscussionResult,
  safeValidateDiscussionResult,

  // Factory Functions
  createDefaultDiscussStepConfig,
  createDebateConfig,
  createVotingConfig,
  createEmptyDiscussionResult,
  createFailedDiscussionResult,

  // Factory Functions - Recursive Discussion
  createRootDiscussionContext,
  createChildDiscussionContext,
  canSpawnSubDiscussion,
  calculateCascadeTimeout,
  calculateBudgetTimeout,
  getTimeoutForLevel,
} from './schema.js';
