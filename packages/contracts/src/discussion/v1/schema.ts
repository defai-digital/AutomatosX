/**
 * Discussion Domain Contracts v1
 *
 * Zod schemas for multi-model discussions enabling Claude, GLM, Qwen,
 * Gemini, Codex, and Grok to collaborate on complex problems.
 *
 * @module @defai.digital/contracts/discussion/v1
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of providers in a discussion */
export const MAX_PROVIDERS = 6;

/** Minimum number of providers in a discussion */
export const MIN_PROVIDERS = 2;

/** Maximum discussion rounds */
export const MAX_ROUNDS = 10;

/** Default discussion rounds */
export const DEFAULT_ROUNDS = 2;

/** Default provider timeout in ms */
export const DEFAULT_PROVIDER_TIMEOUT = 60000;

/** Maximum provider timeout in ms */
export const MAX_PROVIDER_TIMEOUT = 300000;

/** Default providers for discussions */
export const DEFAULT_PROVIDERS = ['claude', 'glm', 'qwen', 'gemini'] as const;

// ============================================================================
// Discussion Pattern Schema
// ============================================================================

/**
 * Discussion patterns supported by the system
 *
 * Invariants:
 * - INV-DISC-001: Pattern determines execution flow
 * - INV-DISC-002: All patterns produce a final synthesis
 */
export const DiscussionPatternSchema = z.enum([
  'round-robin', // Sequential responses, each builds on previous
  'debate', // Opposing positions with judge
  'critique', // Propose → critique → refine
  'voting', // Each model votes with confidence
  'synthesis', // Parallel perspectives → synthesize
]);

export type DiscussionPattern = z.infer<typeof DiscussionPatternSchema>;

/** Pattern descriptions for documentation/help */
export const PATTERN_DESCRIPTIONS: Record<DiscussionPattern, string> = {
  'round-robin': 'Models respond sequentially, each building on previous responses',
  debate: 'Models argue opposing positions with an impartial judge',
  critique: 'One model proposes, others critique, author refines',
  voting: 'Models vote on options with confidence scores',
  synthesis: 'Models give parallel perspectives, one synthesizes all views',
};

// ============================================================================
// Consensus Configuration
// ============================================================================

/**
 * Consensus method for combining model outputs
 */
export const ConsensusMethodSchema = z.enum([
  'synthesis', // One model synthesizes all perspectives
  'voting', // Weighted voting by confidence
  'moderator', // Designated moderator decides
  'unanimous', // Require all models to agree
  'majority', // Simple majority wins
]);

export type ConsensusMethod = z.infer<typeof ConsensusMethodSchema>;

/**
 * Consensus configuration
 *
 * Invariants:
 * - INV-DISC-003: Moderator/synthesizer required when method needs it
 * - INV-DISC-004: Threshold must be 0-1 for voting methods
 */
export const ConsensusConfigSchema = z
  .object({
    /** How to reach consensus */
    method: ConsensusMethodSchema.default('synthesis'),

    /** Provider to synthesize/moderate (required for synthesis/moderator) */
    synthesizer: z.string().max(50).optional(),

    /** Confidence threshold for voting (0-1) */
    threshold: z.number().min(0).max(1).default(0.5),

    /** Whether to include dissenting opinions in output */
    includeDissent: z.boolean().default(true),

    /** Custom synthesis prompt */
    synthesisPrompt: z.string().max(10000).optional(),
  })
  .refine(
    (data) => {
      if (data.method === 'moderator' && !data.synthesizer) {
        return false;
      }
      return true;
    },
    { message: 'INV-DISC-003: Moderator method requires synthesizer provider' }
  );

export type ConsensusConfig = z.infer<typeof ConsensusConfigSchema>;

// ============================================================================
// Role Assignment (for debate pattern)
// ============================================================================

/**
 * Role assignment for debate pattern
 */
export const DebateRoleSchema = z.enum([
  'proponent', // Argues FOR
  'opponent', // Argues AGAINST
  'judge', // Evaluates debate
  'moderator', // Facilitates discussion
  'neutral', // Provides balanced view
]);

export type DebateRole = z.infer<typeof DebateRoleSchema>;

/**
 * Provider role assignment
 */
export const RoleAssignmentSchema = z.record(
  z.string(), // provider ID
  DebateRoleSchema
);

export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

// ============================================================================
// Provider Strengths (for intelligent routing)
// ============================================================================

/**
 * Provider capability areas
 */
export const ProviderCapabilitySchema = z.enum([
  'reasoning', // Complex logical reasoning
  'coding', // Code generation and review
  'agentic', // Multi-step task execution
  'research', // Information gathering
  'writing', // Long-form content
  'math', // Mathematical reasoning
  'ocr', // Document/image text extraction
  'translation', // Language translation
  'multilingual', // Multi-language support
  'realtime', // Real-time information
  'tool-use', // Tool/function calling
  'long-context', // Large context window
]);

export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;

/**
 * Provider strength mapping (for routing decisions)
 */
export const PROVIDER_STRENGTHS: Record<string, ProviderCapability[]> = {
  claude: ['reasoning', 'writing', 'coding', 'agentic', 'tool-use'],
  glm: ['coding', 'agentic', 'tool-use', 'multilingual', 'math'],
  qwen: ['ocr', 'translation', 'multilingual', 'math', 'coding'],
  gemini: ['research', 'long-context', 'multilingual', 'realtime'],
  codex: ['coding', 'reasoning'],
  grok: ['realtime', 'research'],
};

// ============================================================================
// Discussion Step Configuration
// ============================================================================

/**
 * Configuration for a discuss workflow step
 *
 * Invariants:
 * - INV-DISC-005: At least 2 providers required
 * - INV-DISC-006: Max 6 providers per discussion
 * - INV-DISC-007: Rounds between 1-10
 * - INV-DISC-008: Debate pattern requires role assignments
 */
export const DiscussStepConfigSchema = z
  .object({
    /** Discussion pattern to use */
    pattern: DiscussionPatternSchema.default('synthesis'),

    /** Number of discussion rounds */
    rounds: z.number().int().min(1).max(MAX_ROUNDS).default(DEFAULT_ROUNDS),

    /** Providers to participate in discussion */
    providers: z.array(z.string().max(50)).min(MIN_PROVIDERS).max(MAX_PROVIDERS),

    /** Main discussion prompt/topic */
    prompt: z.string().min(1).max(10000),

    /** Provider-specific prompt overrides */
    providerPrompts: z.record(z.string(), z.string().max(10000)).optional(),

    /** Role assignments (required for debate pattern) */
    roles: RoleAssignmentSchema.optional(),

    /** Consensus configuration */
    consensus: ConsensusConfigSchema.default({}),

    /** Timeout per provider response in ms */
    providerTimeout: z
      .number()
      .int()
      .min(5000)
      .max(MAX_PROVIDER_TIMEOUT)
      .default(DEFAULT_PROVIDER_TIMEOUT),

    /** Whether to continue if a provider fails */
    continueOnProviderFailure: z.boolean().default(true),

    /** Minimum providers required to succeed */
    minProviders: z.number().int().min(1).default(MIN_PROVIDERS),

    /** Temperature for responses (0-2) */
    temperature: z.number().min(0).max(2).default(0.7),

    /** Enable verbose output with all perspectives */
    verbose: z.boolean().default(false),

    /** Additional context for all providers */
    context: z.string().max(10000).optional(),
  })
  .refine(
    (data) => {
      // INV-DISC-008: Debate pattern requires roles
      if (data.pattern === 'debate' && !data.roles) {
        return false;
      }
      return true;
    },
    { message: 'INV-DISC-008: Debate pattern requires role assignments' }
  )
  .refine((data) => data.minProviders <= data.providers.length, {
    message: 'minProviders cannot exceed providers array length',
  });

export type DiscussStepConfig = z.infer<typeof DiscussStepConfigSchema>;

// ============================================================================
// Discussion Response
// ============================================================================

/**
 * Single provider's response in a discussion
 * Named DiscussionProviderResponseSchema to avoid conflict with provider/v1 ProviderResponseSchema
 */
export const DiscussionProviderResponseSchema = z.object({
  /** Provider that generated this response */
  provider: z.string().max(50),

  /** Response content */
  content: z.string(),

  /** Round number (1-indexed) */
  round: z.number().int().min(1),

  /** Role in discussion (if applicable) */
  role: DebateRoleSchema.optional(),

  /** Confidence score (0-1) for voting */
  confidence: z.number().min(0).max(1).optional(),

  /** Vote choice (for voting pattern) */
  vote: z.string().max(200).optional(),

  /** Response timestamp */
  timestamp: z.string().datetime(),

  /** Duration in ms */
  durationMs: z.number().int().min(0),

  /** Token count (if available) */
  tokenCount: z.number().int().min(0).optional(),

  /** Whether response was truncated */
  truncated: z.boolean().optional(),

  /** Error if response failed */
  error: z.string().optional(),
});

export type DiscussionProviderResponse = z.infer<typeof DiscussionProviderResponseSchema>;

/**
 * Discussion round containing all provider responses
 */
export const DiscussionRoundSchema = z.object({
  /** Round number (1-indexed) */
  roundNumber: z.number().int().min(1),

  /** Responses from each provider */
  responses: z.array(DiscussionProviderResponseSchema),

  /** Round summary (if generated) */
  summary: z.string().optional(),

  /** Round duration in ms */
  durationMs: z.number().int().min(0),
});

export type DiscussionRound = z.infer<typeof DiscussionRoundSchema>;

// ============================================================================
// Voting Results (for voting pattern)
// ============================================================================

/**
 * Vote record from a single provider
 */
export const VoteRecordSchema = z.object({
  /** Provider that cast the vote */
  provider: z.string(),

  /** Selected option */
  choice: z.string(),

  /** Confidence in the vote (0-1) */
  confidence: z.number().min(0).max(1),

  /** Reasoning for the vote */
  reasoning: z.string().optional(),
});

export type VoteRecord = z.infer<typeof VoteRecordSchema>;

/**
 * Voting results summary
 */
export const VotingResultsSchema = z.object({
  /** Winning option */
  winner: z.string(),

  /** Raw vote counts per option */
  votes: z.record(z.string(), z.number()),

  /** Confidence-weighted vote counts */
  weightedVotes: z.record(z.string(), z.number()),

  /** Individual vote records */
  voteRecords: z.array(VoteRecordSchema),

  /** Whether result was unanimous */
  unanimous: z.boolean(),

  /** Margin of victory */
  margin: z.number().min(0).max(1),
});

export type VotingResults = z.infer<typeof VotingResultsSchema>;

// ============================================================================
// Consensus Result
// ============================================================================

/**
 * Dissenting opinion record
 */
export const DissentRecordSchema = z.object({
  /** Provider with dissenting view */
  provider: z.string(),

  /** Summary of dissenting position */
  position: z.string(),

  /** Key points of disagreement */
  keyPoints: z.array(z.string()).optional(),
});

export type DissentRecord = z.infer<typeof DissentRecordSchema>;

/**
 * Consensus details
 */
export const ConsensusResultSchema = z.object({
  /** Method used to reach consensus */
  method: ConsensusMethodSchema,

  /** Provider that synthesized/moderated */
  synthesizer: z.string().optional(),

  /** Agreement score (0-1, how much providers agreed) */
  agreementScore: z.number().min(0).max(1).optional(),

  /** Areas of strong agreement */
  agreements: z.array(z.string()).optional(),

  /** Dissenting opinions */
  dissent: z.array(DissentRecordSchema).optional(),
});

export type ConsensusResult = z.infer<typeof ConsensusResultSchema>;

// ============================================================================
// Complete Discussion Result
// ============================================================================

/**
 * Discussion error details
 */
export const DiscussionErrorSchema = z.object({
  /** Error code */
  code: z.string(),

  /** Human-readable message */
  message: z.string(),

  /** Provider that caused error (if applicable) */
  provider: z.string().optional(),

  /** Whether error is retryable */
  retryable: z.boolean().optional(),
});

export type DiscussionError = z.infer<typeof DiscussionErrorSchema>;

/**
 * Discussion metadata
 */
export const DiscussionMetadataSchema = z.object({
  /** When discussion started */
  startedAt: z.string().datetime(),

  /** When discussion completed */
  completedAt: z.string().datetime(),

  /** Total tokens used (if available) */
  totalTokens: z.number().int().optional(),

  /** Estimated cost in USD (if available) */
  estimatedCost: z.number().optional(),

  /** Session ID if associated */
  sessionId: z.string().uuid().optional(),

  /** Trace ID for debugging */
  traceId: z.string().uuid().optional(),
});

export type DiscussionMetadata = z.infer<typeof DiscussionMetadataSchema>;

/**
 * Complete discussion result
 *
 * Invariants:
 * - INV-DISC-009: Result always contains synthesis
 * - INV-DISC-010: participatingProviders >= minProviders (when successful)
 */
export const DiscussionResultSchema = z.object({
  /** Whether discussion completed successfully */
  success: z.boolean(),

  /** Discussion pattern used */
  pattern: DiscussionPatternSchema,

  /** Original topic/prompt */
  topic: z.string(),

  /** Providers that participated */
  participatingProviders: z.array(z.string()),

  /** Providers that failed */
  failedProviders: z.array(z.string()),

  /** All discussion rounds */
  rounds: z.array(DiscussionRoundSchema),

  /** Final synthesized output */
  synthesis: z.string(),

  /** Consensus details */
  consensus: ConsensusResultSchema,

  /** Voting results (for voting pattern) */
  votingResults: VotingResultsSchema.optional(),

  /** Total duration in ms */
  totalDurationMs: z.number().int().min(0),

  /** Discussion metadata */
  metadata: DiscussionMetadataSchema,

  /** Error if discussion failed */
  error: DiscussionErrorSchema.optional(),
});

export type DiscussionResult = z.infer<typeof DiscussionResultSchema>;

// ============================================================================
// Discussion Request (for CLI/MCP)
// ============================================================================

/**
 * Request to start a discussion
 */
export const DiscussionRequestSchema = z.object({
  /** Topic or question to discuss */
  topic: z.string().min(1).max(5000),

  /** Discussion pattern */
  pattern: DiscussionPatternSchema.optional(),

  /** Providers to use (defaults to claude, glm, qwen, gemini) */
  providers: z.array(z.string()).min(MIN_PROVIDERS).max(MAX_PROVIDERS).optional(),

  /** Number of rounds */
  rounds: z.number().int().min(1).max(MAX_ROUNDS).optional(),

  /** Consensus method */
  consensusMethod: ConsensusMethodSchema.optional(),

  /** Options for voting pattern */
  votingOptions: z.array(z.string().max(200)).max(10).optional(),

  /** Additional context */
  context: z.string().max(10000).optional(),

  /** Session ID to associate with */
  sessionId: z.string().uuid().optional(),

  /** Enable verbose output */
  verbose: z.boolean().optional(),
});

export type DiscussionRequest = z.infer<typeof DiscussionRequestSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const DiscussionErrorCodes = {
  /** Not enough providers available */
  INSUFFICIENT_PROVIDERS: 'DISCUSSION_INSUFFICIENT_PROVIDERS',

  /** Provider timed out */
  PROVIDER_TIMEOUT: 'DISCUSSION_PROVIDER_TIMEOUT',

  /** All providers failed */
  ALL_PROVIDERS_FAILED: 'DISCUSSION_ALL_PROVIDERS_FAILED',

  /** Failed to reach consensus */
  CONSENSUS_FAILED: 'DISCUSSION_CONSENSUS_FAILED',

  /** Invalid pattern specified */
  INVALID_PATTERN: 'DISCUSSION_INVALID_PATTERN',

  /** Invalid role assignments */
  INVALID_ROLES: 'DISCUSSION_INVALID_ROLES',

  /** Synthesis step failed */
  SYNTHESIS_FAILED: 'DISCUSSION_SYNTHESIS_FAILED',

  /** Invalid configuration */
  INVALID_CONFIG: 'DISCUSSION_INVALID_CONFIG',

  /** Provider not found */
  PROVIDER_NOT_FOUND: 'DISCUSSION_PROVIDER_NOT_FOUND',
} as const;

export type DiscussionErrorCode =
  (typeof DiscussionErrorCodes)[keyof typeof DiscussionErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates discussion step configuration
 * @throws ZodError if validation fails
 */
export function validateDiscussStepConfig(data: unknown): DiscussStepConfig {
  return DiscussStepConfigSchema.parse(data);
}

/**
 * Safely validates discussion step configuration
 */
export function safeValidateDiscussStepConfig(
  data: unknown
): { success: true; data: DiscussStepConfig } | { success: false; error: z.ZodError } {
  const result = DiscussStepConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates discussion request
 * @throws ZodError if validation fails
 */
export function validateDiscussionRequest(data: unknown): DiscussionRequest {
  return DiscussionRequestSchema.parse(data);
}

/**
 * Safely validates discussion request
 */
export function safeValidateDiscussionRequest(
  data: unknown
): { success: true; data: DiscussionRequest } | { success: false; error: z.ZodError } {
  const result = DiscussionRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates discussion result
 * @throws ZodError if validation fails
 */
export function validateDiscussionResult(data: unknown): DiscussionResult {
  return DiscussionResultSchema.parse(data);
}

/**
 * Safely validates discussion result
 */
export function safeValidateDiscussionResult(
  data: unknown
): { success: true; data: DiscussionResult } | { success: false; error: z.ZodError } {
  const result = DiscussionResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates default discussion step config
 */
export function createDefaultDiscussStepConfig(
  prompt: string,
  providers?: string[]
): DiscussStepConfig {
  return DiscussStepConfigSchema.parse({
    pattern: 'synthesis',
    providers: providers || [...DEFAULT_PROVIDERS],
    prompt,
    rounds: DEFAULT_ROUNDS,
    consensus: { method: 'synthesis', synthesizer: 'claude' },
  });
}

/**
 * Creates a debate configuration
 */
export function createDebateConfig(
  prompt: string,
  proponent = 'claude',
  opponent = 'glm',
  judge = 'gemini'
): DiscussStepConfig {
  return DiscussStepConfigSchema.parse({
    pattern: 'debate',
    providers: [proponent, opponent, judge],
    prompt,
    rounds: 2,
    roles: {
      [proponent]: 'proponent',
      [opponent]: 'opponent',
      [judge]: 'judge',
    },
    consensus: { method: 'moderator', synthesizer: judge },
  });
}

/**
 * Creates a voting configuration
 */
export function createVotingConfig(
  prompt: string,
  options: string[],
  providers?: string[]
): DiscussStepConfig {
  return DiscussStepConfigSchema.parse({
    pattern: 'voting',
    providers: providers || [...DEFAULT_PROVIDERS],
    prompt: `${prompt}\n\nOptions: ${options.join(', ')}`,
    rounds: 1,
    consensus: { method: 'voting', threshold: 0.5 },
  });
}

/**
 * Creates an empty successful discussion result
 */
export function createEmptyDiscussionResult(
  pattern: DiscussionPattern,
  topic: string
): DiscussionResult {
  const now = new Date().toISOString();
  return {
    success: true,
    pattern,
    topic,
    participatingProviders: [],
    failedProviders: [],
    rounds: [],
    synthesis: '',
    consensus: { method: 'synthesis' },
    totalDurationMs: 0,
    metadata: {
      startedAt: now,
      completedAt: now,
    },
  };
}

/**
 * Creates a failed discussion result
 */
export function createFailedDiscussionResult(
  pattern: DiscussionPattern,
  topic: string,
  errorCode: DiscussionErrorCode,
  errorMessage: string,
  startedAt: string
): DiscussionResult {
  return {
    success: false,
    pattern,
    topic,
    participatingProviders: [],
    failedProviders: [],
    rounds: [],
    synthesis: '',
    consensus: { method: 'synthesis' },
    totalDurationMs: Date.now() - new Date(startedAt).getTime(),
    metadata: {
      startedAt,
      completedAt: new Date().toISOString(),
    },
    error: {
      code: errorCode,
      message: errorMessage,
    },
  };
}
