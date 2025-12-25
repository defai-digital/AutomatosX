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
  DiscussionMetadataSchema,
  DiscussionResultSchema,
  DiscussionRequestSchema,

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
  type DiscussionMetadata,
  type DiscussionResult,
  type DiscussionRequest,
  type DiscussionErrorCode,

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
} from './schema.js';
