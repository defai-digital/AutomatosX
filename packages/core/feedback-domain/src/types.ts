/**
 * Feedback Domain Types
 *
 * Port interfaces for the feedback learning system.
 */

import type {
  FeedbackRecord,
  SubmitFeedbackInput,
  AgentScoreAdjustment,
  TaskPattern,
  AgentFeedbackStats,
  FeedbackOverview,
  FeedbackLearningConfig,
} from '@defai.digital/contracts';

/**
 * Port for storing feedback records
 */
export interface FeedbackStoragePort {
  /**
   * Store a feedback record
   * INV-FBK-001: Records are immutable after storage
   */
  store(record: FeedbackRecord): Promise<void>;

  /**
   * Get feedback by ID
   */
  get(feedbackId: string): Promise<FeedbackRecord | null>;

  /**
   * List feedback records with optional filters
   */
  list(options?: {
    agentId?: string;
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<FeedbackRecord[]>;

  /**
   * Count feedback records
   */
  count(options?: { agentId?: string; since?: string }): Promise<number>;

  /**
   * Delete old feedback records
   * INV-FBK-301: Retention policy enforced
   */
  deleteOlderThan(date: string): Promise<number>;
}

/**
 * Port for storing score adjustments
 */
export interface ScoreAdjustmentStoragePort {
  /**
   * Get adjustment for agent and pattern
   */
  get(agentId: string, taskPattern: string): Promise<AgentScoreAdjustment | null>;

  /**
   * Save or update adjustment
   */
  set(adjustment: AgentScoreAdjustment): Promise<void>;

  /**
   * List all adjustments for an agent
   */
  listForAgent(agentId: string): Promise<AgentScoreAdjustment[]>;

  /**
   * Delete expired adjustments
   */
  deleteExpired(): Promise<number>;
}

/**
 * Port for pattern matching
 */
export interface PatternMatcherPort {
  /**
   * Find matching patterns for a task
   */
  findMatches(taskDescription: string, threshold: number): Promise<TaskPattern[]>;

  /**
   * Create or update a pattern
   */
  upsertPattern(pattern: TaskPattern): Promise<void>;

  /**
   * Get pattern by ID
   */
  getPattern(patternId: string): Promise<TaskPattern | null>;
}

/**
 * Feedback collector options
 */
export interface FeedbackCollectorOptions {
  /**
   * Feedback storage port
   */
  storage: FeedbackStoragePort;

  /**
   * Learning configuration
   */
  config?: FeedbackLearningConfig;
}

/**
 * Score adjuster options
 */
export interface ScoreAdjusterOptions {
  /**
   * Feedback storage port
   */
  feedbackStorage: FeedbackStoragePort;

  /**
   * Score adjustment storage port
   */
  adjustmentStorage: ScoreAdjustmentStoragePort;

  /**
   * Pattern matcher port
   */
  patternMatcher: PatternMatcherPort;

  /**
   * Learning configuration
   */
  config?: FeedbackLearningConfig;
}

/**
 * Feedback collector interface
 */
export interface FeedbackCollector {
  /**
   * Submit feedback
   */
  submit(input: SubmitFeedbackInput): Promise<FeedbackRecord>;

  /**
   * Get feedback history
   */
  getHistory(options?: {
    agentId?: string;
    limit?: number;
    since?: string;
  }): Promise<FeedbackRecord[]>;

  /**
   * Get feedback statistics for an agent
   */
  getAgentStats(agentId: string): Promise<AgentFeedbackStats>;

  /**
   * Get overall feedback overview
   */
  getOverview(): Promise<FeedbackOverview>;
}

/**
 * Score adjuster interface
 */
export interface ScoreAdjuster {
  /**
   * Get score adjustment for an agent and task
   */
  getAdjustment(agentId: string, taskDescription: string): Promise<number>;

  /**
   * Update adjustments based on new feedback
   */
  processNewFeedback(record: FeedbackRecord): Promise<void>;

  /**
   * Get all adjustments for an agent
   */
  getAgentAdjustments(agentId: string): Promise<AgentScoreAdjustment[]>;

  /**
   * Apply decay to all adjustments
   */
  applyDecay(): Promise<void>;
}
