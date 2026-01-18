/**
 * Score Adjuster
 *
 * Calculate and apply score adjustments based on feedback.
 *
 * Invariants:
 * - INV-FBK-002: Adjustments bounded (-0.5 to +0.5)
 * - INV-FBK-003: Minimum sample count before adjustment
 * - INV-FBK-004: Adjustments decay over time
 */

import type {
  FeedbackRecord,
  AgentScoreAdjustment,
} from '@defai.digital/contracts';
import {
  createDefaultFeedbackLearningConfig,
  calculateDecayedAdjustment,
  shouldApplyAdjustment,
  createTaskHash,
  MAX_ADJUSTMENT,
} from '@defai.digital/contracts';
import type {
  ScoreAdjuster,
  ScoreAdjusterOptions,
  ScoreAdjustmentStoragePort,
  PatternMatcherPort,
} from './types.js';

/**
 * Create in-memory score adjustment storage
 */
export function createInMemoryAdjustmentStorage(): ScoreAdjustmentStoragePort {
  const adjustments = new Map<string, AgentScoreAdjustment>();

  function makeKey(agentId: string, taskPattern: string): string {
    return `${agentId}:${taskPattern}`;
  }

  return {
    async get(
      agentId: string,
      taskPattern: string
    ): Promise<AgentScoreAdjustment | null> {
      return adjustments.get(makeKey(agentId, taskPattern)) ?? null;
    },

    async set(adjustment: AgentScoreAdjustment): Promise<void> {
      adjustments.set(makeKey(adjustment.agentId, adjustment.taskPattern), adjustment);
    },

    async listForAgent(agentId: string): Promise<AgentScoreAdjustment[]> {
      const results: AgentScoreAdjustment[] = [];
      for (const adjustment of adjustments.values()) {
        if (adjustment.agentId === agentId) {
          results.push(adjustment);
        }
      }
      return results;
    },

    async deleteExpired(): Promise<number> {
      const now = new Date();
      let deleted = 0;
      for (const [key, adjustment] of adjustments) {
        if (adjustment.expiresAt && new Date(adjustment.expiresAt) < now) {
          adjustments.delete(key);
          deleted++;
        }
      }
      return deleted;
    },
  };
}

/**
 * Create simple pattern matcher
 */
export function createSimplePatternMatcher(): PatternMatcherPort {
  const patterns = new Map<string, import('@defai.digital/contracts').TaskPattern>();

  return {
    async findMatches(
      taskDescription: string,
      _threshold: number
    ): Promise<import('@defai.digital/contracts').TaskPattern[]> {
      const taskHash = createTaskHash(taskDescription);
      const results: import('@defai.digital/contracts').TaskPattern[] = [];

      // Simple exact match on hash
      const exactMatch = patterns.get(taskHash);
      if (exactMatch) {
        results.push(exactMatch);
      }

      // Could add fuzzy matching here in the future
      return results;
    },

    async upsertPattern(
      pattern: import('@defai.digital/contracts').TaskPattern
    ): Promise<void> {
      patterns.set(pattern.patternId, pattern);
    },

    async getPattern(
      patternId: string
    ): Promise<import('@defai.digital/contracts').TaskPattern | null> {
      return patterns.get(patternId) ?? null;
    },
  };
}

/**
 * Create score adjuster
 */
export function createScoreAdjuster(options: ScoreAdjusterOptions): ScoreAdjuster {
  const { adjustmentStorage, patternMatcher } = options;
  const config = options.config ?? createDefaultFeedbackLearningConfig();

  return {
    async getAdjustment(agentId: string, taskDescription: string): Promise<number> {
      if (!config.enabled) {
        return 0;
      }

      const taskHash = createTaskHash(taskDescription);
      const adjustment = await adjustmentStorage.get(agentId, taskHash);

      if (!adjustment) {
        // INV-FBK-202: Cold start - return neutral
        return 0;
      }

      // INV-FBK-003: Check minimum sample count
      if (!shouldApplyAdjustment(adjustment, config)) {
        return 0;
      }

      // INV-FBK-004: Apply decay
      return calculateDecayedAdjustment(adjustment, config);
    },

    async processNewFeedback(record: FeedbackRecord): Promise<void> {
      if (!config.enabled) {
        return;
      }

      const { selectedAgent, taskHash, rating, outcome } = record;

      // Calculate score delta based on feedback
      let delta = 0;
      if (rating !== undefined) {
        // Map 1-5 rating to -0.5 to +0.5
        delta = (rating - 3) / 4; // -0.5 to +0.5
      } else if (outcome !== undefined) {
        switch (outcome) {
          case 'success':
            delta = 0.3;
            break;
          case 'partial':
            delta = 0.1;
            break;
          case 'failure':
            delta = -0.3;
            break;
          case 'cancelled':
            delta = 0;
            break;
        }
      }

      // Get or create adjustment
      let adjustment = await adjustmentStorage.get(selectedAgent, taskHash);

      if (adjustment) {
        // Update existing adjustment
        // INV-FBK-201: Average conflicting feedback
        const totalWeight = adjustment.sampleCount + 1;
        const newValue =
          (adjustment.scoreAdjustment * adjustment.sampleCount + delta) / totalWeight;

        // INV-FBK-002: Bound adjustment
        const boundedValue = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, newValue));

        adjustment = {
          ...adjustment,
          scoreAdjustment: boundedValue,
          sampleCount: totalWeight,
          confidence: Math.min(1, totalWeight / 10), // Confidence increases with samples
          lastUpdated: new Date().toISOString(),
        };
      } else {
        // Create new adjustment
        // INV-FBK-002: Bound initial adjustment
        const boundedDelta = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, delta));

        adjustment = {
          agentId: selectedAgent,
          taskPattern: taskHash,
          scoreAdjustment: boundedDelta,
          sampleCount: 1,
          confidence: 0.1,
          lastUpdated: new Date().toISOString(),
        };
      }

      await adjustmentStorage.set(adjustment);

      // Update pattern stats
      const pattern = await patternMatcher.getPattern(taskHash);
      if (pattern) {
        const agentScores = { ...pattern.agentScores };
        agentScores[selectedAgent] = (agentScores[selectedAgent] ?? 0) + delta;

        // Calculate new avgRating using ratingCount (not feedbackCount)
        const currentRatingCount = pattern.ratingCount ?? 0;
        const newRatingCount = rating !== undefined ? currentRatingCount + 1 : currentRatingCount;
        const newAvgRating =
          rating !== undefined
            ? ((pattern.avgRating ?? rating) * currentRatingCount + rating) / newRatingCount
            : pattern.avgRating;

        // Calculate successRate using outcomeCount (only success/failure count)
        const currentOutcomeCount = pattern.outcomeCount ?? 0;
        const isSuccessOrFailure = outcome === 'success' || outcome === 'failure';
        const newOutcomeCount = isSuccessOrFailure ? currentOutcomeCount + 1 : currentOutcomeCount;
        const newSuccessRate =
          outcome === 'success'
            ? (pattern.successRate * currentOutcomeCount + 1) / newOutcomeCount
            : outcome === 'failure'
              ? (pattern.successRate * currentOutcomeCount) / newOutcomeCount
              : pattern.successRate; // Keep unchanged for partial/cancelled/undefined

        await patternMatcher.upsertPattern({
          ...pattern,
          agentScores,
          feedbackCount: pattern.feedbackCount + 1,
          ratingCount: newRatingCount,
          outcomeCount: newOutcomeCount,
          successRate: newSuccessRate,
          avgRating: newAvgRating,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new pattern
        // Only count success/failure toward outcomeCount
        const isSuccessOrFailure = outcome === 'success' || outcome === 'failure';
        await patternMatcher.upsertPattern({
          patternId: taskHash,
          pattern: taskHash,
          agentScores: { [selectedAgent]: delta },
          feedbackCount: 1,
          ratingCount: rating !== undefined ? 1 : 0,
          outcomeCount: isSuccessOrFailure ? 1 : 0,
          // successRate only meaningful when outcomeCount > 0
          successRate: outcome === 'success' ? 1 : outcome === 'failure' ? 0 : 0.5,
          avgRating: rating,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    },

    async getAgentAdjustments(agentId: string): Promise<AgentScoreAdjustment[]> {
      return adjustmentStorage.listForAgent(agentId);
    },

    async applyDecay(): Promise<void> {
      // This would be called periodically to decay all adjustments
      // For now, decay is applied on read via calculateDecayedAdjustment
      await adjustmentStorage.deleteExpired();
    },
  };
}
