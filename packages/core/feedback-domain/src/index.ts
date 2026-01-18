/**
 * Feedback Learning Domain
 *
 * Agent feedback collection and learning system.
 */

// Types
export type {
  FeedbackStoragePort,
  ScoreAdjustmentStoragePort,
  PatternMatcherPort,
  FeedbackCollectorOptions,
  ScoreAdjusterOptions,
  FeedbackCollector,
  ScoreAdjuster,
} from './types.js';

// Feedback Collector
export {
  createFeedbackCollector,
  createInMemoryFeedbackStorage,
} from './feedback-collector.js';

// Score Adjuster
export {
  createScoreAdjuster,
  createInMemoryAdjustmentStorage,
  createSimplePatternMatcher,
} from './score-adjuster.js';
