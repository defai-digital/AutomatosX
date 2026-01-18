/**
 * Feedback Learning Domain Contracts v1
 *
 * Zod schemas for agent feedback collection and learning.
 */

import { z } from 'zod';

// ============================================================================
// Feedback Types
// ============================================================================

/**
 * Feedback type - how feedback was collected
 */
export const FeedbackTypeSchema = z.enum([
  'explicit', // User explicitly rated
  'implicit', // Inferred from behavior
  'outcome', // Based on task outcome
]);

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;

/**
 * Task outcome
 */
export const TaskOutcomeSchema = z.enum([
  'success',
  'failure',
  'partial',
  'cancelled',
]);

export type TaskOutcome = z.infer<typeof TaskOutcomeSchema>;

// ============================================================================
// Feedback Record
// ============================================================================

/**
 * Feedback record schema
 */
export const FeedbackRecordSchema = z.object({
  feedbackId: z.string().uuid(),
  taskDescription: z.string().min(1).max(5000),
  taskHash: z.string(), // Hash for pattern matching
  recommendedAgent: z.string().optional(),
  selectedAgent: z.string(),
  feedbackType: FeedbackTypeSchema,
  rating: z.number().int().min(1).max(5).optional(),
  outcome: TaskOutcomeSchema.optional(),
  durationMs: z.number().int().min(0).optional(),
  retryCount: z.number().int().min(0).default(0),
  userComment: z.string().max(1000).optional(),
  sessionId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;

/**
 * Submit feedback input
 */
export const SubmitFeedbackInputSchema = z.object({
  taskDescription: z.string().min(1).max(5000),
  selectedAgent: z.string(),
  recommendedAgent: z.string().optional(),
  feedbackType: FeedbackTypeSchema.default('explicit'),
  rating: z.number().int().min(1).max(5).optional(),
  outcome: TaskOutcomeSchema.optional(),
  durationMs: z.number().int().min(0).optional(),
  userComment: z.string().max(1000).optional(),
  sessionId: z.string().uuid().optional(),
});

export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

// ============================================================================
// Score Adjustment
// ============================================================================

/**
 * Agent score adjustment schema
 */
export const AgentScoreAdjustmentSchema = z.object({
  agentId: z.string(),
  taskPattern: z.string(), // Pattern that triggered this adjustment
  scoreAdjustment: z.number().min(-0.5).max(0.5),
  sampleCount: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  lastUpdated: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type AgentScoreAdjustment = z.infer<typeof AgentScoreAdjustmentSchema>;

/**
 * Minimum sample count before applying adjustment
 */
export const MIN_SAMPLE_COUNT = 3;

/**
 * Score adjustment decay rate (per day)
 */
export const DECAY_RATE_PER_DAY = 0.05;

/**
 * Maximum adjustment magnitude
 */
export const MAX_ADJUSTMENT = 0.5;

// ============================================================================
// Task Pattern
// ============================================================================

/**
 * Task pattern for matching similar tasks
 */
export const TaskPatternSchema = z.object({
  patternId: z.string(),
  pattern: z.string(), // Regex or keyword pattern
  agentScores: z.record(z.number()), // agentId -> cumulative score
  feedbackCount: z.number().int().min(0),
  ratingCount: z.number().int().min(0).default(0), // Count of feedback with ratings
  outcomeCount: z.number().int().min(0).default(0), // Count of feedback with success/failure outcomes
  successRate: z.number().min(0).max(1),
  avgRating: z.number().min(1).max(5).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TaskPattern = z.infer<typeof TaskPatternSchema>;

// ============================================================================
// Feedback Statistics
// ============================================================================

/**
 * Feedback statistics for an agent
 */
export const AgentFeedbackStatsSchema = z.object({
  agentId: z.string(),
  totalFeedback: z.number().int().min(0),
  avgRating: z.number().min(1).max(5).optional(),
  successRate: z.number().min(0).max(1),
  recommendationAcceptRate: z.number().min(0).max(1),
  avgDurationMs: z.number().min(0).optional(),
  topPatterns: z.array(z.string()).max(10),
  lastFeedback: z.string().datetime().optional(),
});

export type AgentFeedbackStats = z.infer<typeof AgentFeedbackStatsSchema>;

/**
 * Overall feedback statistics
 */
export const FeedbackOverviewSchema = z.object({
  totalFeedback: z.number().int().min(0),
  feedbackByType: z.record(FeedbackTypeSchema, z.number().int().min(0)),
  avgRating: z.number().min(1).max(5).optional(),
  overallSuccessRate: z.number().min(0).max(1),
  topAgents: z.array(
    z.object({
      agentId: z.string(),
      score: z.number(),
    })
  ),
  recentTrend: z.enum(['improving', 'stable', 'declining']),
  lastUpdated: z.string().datetime(),
});

export type FeedbackOverview = z.infer<typeof FeedbackOverviewSchema>;

// ============================================================================
// Tool Input Schemas
// ============================================================================

/**
 * Input for feedback history query
 */
export const FeedbackHistoryInputSchema = z.object({
  /**
   * Filter by agent ID
   */
  agentId: z.string().optional(),

  /**
   * Maximum records to return
   */
  limit: z.number().int().min(1).max(100).default(20),

  /**
   * Filter records after this ISO date
   */
  since: z.string().datetime().optional(),
});

export type FeedbackHistoryInput = z.infer<typeof FeedbackHistoryInputSchema>;

/**
 * Input for feedback stats query
 */
export const FeedbackStatsInputSchema = z.object({
  /**
   * Agent ID to get stats for
   */
  agentId: z.string(),
});

export type FeedbackStatsInput = z.infer<typeof FeedbackStatsInputSchema>;

/**
 * Input for feedback overview query
 */
export const FeedbackOverviewInputSchema = z.object({});

export type FeedbackOverviewInput = z.infer<typeof FeedbackOverviewInputSchema>;

/**
 * Input for feedback adjustments query
 */
export const FeedbackAdjustmentsInputSchema = z.object({
  /**
   * Agent ID to get adjustments for
   */
  agentId: z.string(),
});

export type FeedbackAdjustmentsInput = z.infer<typeof FeedbackAdjustmentsInputSchema>;

// ============================================================================
// Learning Configuration
// ============================================================================

/**
 * Feedback learning configuration
 */
export const FeedbackLearningConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minSampleCount: z.number().int().min(1).default(MIN_SAMPLE_COUNT),
  decayRatePerDay: z.number().min(0).max(0.5).default(DECAY_RATE_PER_DAY),
  maxAdjustment: z.number().min(0.1).max(1.0).default(MAX_ADJUSTMENT),
  patternMatchThreshold: z.number().min(0).max(1).default(0.7),
  retentionDays: z.number().int().min(1).max(365).default(90),
});

export type FeedbackLearningConfig = z.infer<typeof FeedbackLearningConfigSchema>;

/**
 * Create default feedback learning config
 */
export function createDefaultFeedbackLearningConfig(): FeedbackLearningConfig {
  return FeedbackLearningConfigSchema.parse({});
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Feedback error codes
 */
export const FeedbackErrorCodes = {
  FEEDBACK_NOT_FOUND: 'FBK_NOT_FOUND',
  INVALID_RATING: 'FBK_INVALID_RATING',
  DUPLICATE_FEEDBACK: 'FBK_DUPLICATE',
  PATTERN_NOT_FOUND: 'FBK_PATTERN_NOT_FOUND',
  INSUFFICIENT_DATA: 'FBK_INSUFFICIENT_DATA',
} as const;

export type FeedbackErrorCode =
  (typeof FeedbackErrorCodes)[keyof typeof FeedbackErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate feedback record
 */
export function validateFeedbackRecord(data: unknown): FeedbackRecord {
  return FeedbackRecordSchema.parse(data);
}

/**
 * Validate submit feedback input
 */
export function validateSubmitFeedbackInput(data: unknown): SubmitFeedbackInput {
  return SubmitFeedbackInputSchema.parse(data);
}

/**
 * Validate agent score adjustment
 */
export function validateAgentScoreAdjustment(data: unknown): AgentScoreAdjustment {
  return AgentScoreAdjustmentSchema.parse(data);
}

/**
 * Calculate decayed adjustment
 */
export function calculateDecayedAdjustment(
  adjustment: AgentScoreAdjustment,
  config: FeedbackLearningConfig = createDefaultFeedbackLearningConfig()
): number {
  const now = new Date();
  const lastUpdated = new Date(adjustment.lastUpdated);
  const daysSinceUpdate =
    (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

  const decayFactor = Math.pow(1 - config.decayRatePerDay, daysSinceUpdate);
  return adjustment.scoreAdjustment * decayFactor;
}

/**
 * Check if adjustment should be applied
 */
export function shouldApplyAdjustment(
  adjustment: AgentScoreAdjustment,
  config: FeedbackLearningConfig = createDefaultFeedbackLearningConfig()
): boolean {
  // Check sample count
  if (adjustment.sampleCount < config.minSampleCount) {
    return false;
  }

  // Check expiration
  if (adjustment.expiresAt && new Date(adjustment.expiresAt) < new Date()) {
    return false;
  }

  // Check if decayed adjustment is significant
  const decayedValue = calculateDecayedAdjustment(adjustment, config);
  return Math.abs(decayedValue) >= 0.01;
}

/**
 * Create task hash from description
 */
export function createTaskHash(description: string): string {
  // Simple hash based on normalized keywords
  const normalized = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .join('-');

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
