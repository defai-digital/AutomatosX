/**
 * Feedback Contract Tests
 *
 * Tests for the feedback learning contracts including schemas,
 * validation functions, and factory functions.
 *
 * Invariants tested:
 * - INV-FBK-001: Feedback records immutable
 * - INV-FBK-002: Adjustments bounded (-0.5 to +0.5)
 * - INV-FBK-003: Minimum sample count before adjustment
 * - INV-FBK-004: Adjustments decay over time
 */

import { describe, it, expect } from 'vitest';
import {
  FeedbackRecordSchema,
  FeedbackTypeSchema,
  TaskOutcomeSchema,
  SubmitFeedbackInputSchema,
  AgentScoreAdjustmentSchema,
  TaskPatternSchema,
  AgentFeedbackStatsSchema,
  FeedbackOverviewSchema,
  FeedbackLearningConfigSchema,
  FeedbackErrorCodes,
  MAX_ADJUSTMENT,
  MIN_SAMPLE_COUNT,
  DECAY_RATE_PER_DAY,
  validateFeedbackRecord,
  validateSubmitFeedbackInput,
  validateAgentScoreAdjustment,
  createDefaultFeedbackLearningConfig,
  createTaskHash,
  calculateDecayedAdjustment,
  shouldApplyAdjustment,
} from '@defai.digital/contracts';

describe('Feedback Contracts', () => {
  describe('FeedbackTypeSchema', () => {
    it('should validate all feedback types', () => {
      const types = ['explicit', 'implicit', 'outcome'];
      types.forEach((type) => {
        const result = FeedbackTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid feedback types', () => {
      const result = FeedbackTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('TaskOutcomeSchema', () => {
    it('should validate all outcome types', () => {
      const outcomes = ['success', 'failure', 'partial', 'cancelled'];
      outcomes.forEach((outcome) => {
        const result = TaskOutcomeSchema.safeParse(outcome);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('FeedbackRecordSchema', () => {
    it('should validate minimal feedback record', () => {
      const record = {
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Implement login feature',
        taskHash: 'abc123',
        selectedAgent: 'backend',
        feedbackType: 'outcome' as const,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      const result = FeedbackRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate complete feedback record', () => {
      const record = {
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Build REST API',
        taskHash: 'def456',
        recommendedAgent: 'backend',
        selectedAgent: 'fullstack',
        feedbackType: 'explicit' as const,
        rating: 4,
        outcome: 'success' as const,
        durationMs: 5000,
        timestamp: new Date().toISOString(),
        retryCount: 1,
        userComment: 'Good job!',
        sessionId: crypto.randomUUID(),
        metadata: { extra: 'data' },
      };

      const result = FeedbackRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should enforce rating bounds', () => {
      const baseRecord = {
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Task',
        taskHash: 'hash',
        selectedAgent: 'agent',
        feedbackType: 'explicit' as const,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      expect(
        FeedbackRecordSchema.safeParse({ ...baseRecord, rating: 0 }).success
      ).toBe(false);

      expect(
        FeedbackRecordSchema.safeParse({ ...baseRecord, rating: 6 }).success
      ).toBe(false);

      expect(
        FeedbackRecordSchema.safeParse({ ...baseRecord, rating: 1 }).success
      ).toBe(true);

      expect(
        FeedbackRecordSchema.safeParse({ ...baseRecord, rating: 5 }).success
      ).toBe(true);
    });
  });

  describe('SubmitFeedbackInputSchema', () => {
    it('should validate minimal input', () => {
      const input = {
        taskDescription: 'Implement feature',
        selectedAgent: 'backend',
      };

      const result = SubmitFeedbackInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate complete input', () => {
      const input = {
        taskDescription: 'Create dashboard',
        recommendedAgent: 'frontend',
        selectedAgent: 'frontend',
        feedbackType: 'explicit' as const,
        rating: 5,
        outcome: 'success' as const,
        durationMs: 10000,
        userComment: 'Perfect!',
        sessionId: crypto.randomUUID(),
      };

      const result = SubmitFeedbackInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should provide default feedbackType', () => {
      const input = SubmitFeedbackInputSchema.parse({
        taskDescription: 'Test',
        selectedAgent: 'agent',
      });
      expect(input.feedbackType).toBe('explicit');
    });
  });

  describe('AgentScoreAdjustmentSchema (INV-FBK-002)', () => {
    it('should validate score adjustment', () => {
      const adjustment = {
        agentId: 'backend',
        taskPattern: 'hash123',
        scoreAdjustment: 0.25,
        sampleCount: 10,
        confidence: 0.8,
        lastUpdated: new Date().toISOString(),
      };

      const result = AgentScoreAdjustmentSchema.safeParse(adjustment);
      expect(result.success).toBe(true);
    });

    it('should enforce adjustment bounds (INV-FBK-002)', () => {
      const baseAdjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      };

      // Below minimum
      expect(
        AgentScoreAdjustmentSchema.safeParse({
          ...baseAdjustment,
          scoreAdjustment: -0.6,
        }).success
      ).toBe(false);

      // Above maximum
      expect(
        AgentScoreAdjustmentSchema.safeParse({
          ...baseAdjustment,
          scoreAdjustment: 0.6,
        }).success
      ).toBe(false);

      // At boundaries
      expect(
        AgentScoreAdjustmentSchema.safeParse({
          ...baseAdjustment,
          scoreAdjustment: -0.5,
        }).success
      ).toBe(true);

      expect(
        AgentScoreAdjustmentSchema.safeParse({
          ...baseAdjustment,
          scoreAdjustment: 0.5,
        }).success
      ).toBe(true);
    });

    it('should validate confidence bounds', () => {
      const baseAdjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.1,
        sampleCount: 5,
        lastUpdated: new Date().toISOString(),
      };

      expect(
        AgentScoreAdjustmentSchema.safeParse({
          ...baseAdjustment,
          confidence: -0.1,
        }).success
      ).toBe(false);

      expect(
        AgentScoreAdjustmentSchema.safeParse({
          ...baseAdjustment,
          confidence: 1.1,
        }).success
      ).toBe(false);
    });

    it('should validate optional expiresAt', () => {
      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.2,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = AgentScoreAdjustmentSchema.safeParse(adjustment);
      expect(result.success).toBe(true);
    });
  });

  describe('TaskPatternSchema', () => {
    it('should validate task pattern', () => {
      const pattern = {
        patternId: 'pattern-123',
        pattern: 'implement.*api',
        agentScores: { backend: 0.3, fullstack: 0.1 },
        feedbackCount: 15,
        successRate: 0.85,
        avgRating: 4.2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = TaskPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });

    it('should validate pattern without avgRating', () => {
      const pattern = {
        patternId: 'pattern-456',
        pattern: 'test',
        agentScores: { agent1: 0.5 },
        feedbackCount: 3,
        successRate: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = TaskPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    });
  });

  describe('AgentFeedbackStatsSchema', () => {
    it('should validate agent feedback stats', () => {
      const stats = {
        agentId: 'backend',
        totalFeedback: 50,
        avgRating: 4.5,
        successRate: 0.9,
        recommendationAcceptRate: 0.85,
        avgDurationMs: 3000,
        topPatterns: ['api', 'database'],
        lastFeedback: new Date().toISOString(),
      };

      const result = AgentFeedbackStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });

    it('should validate stats without optional fields', () => {
      const stats = {
        agentId: 'agent',
        totalFeedback: 0,
        successRate: 0,
        recommendationAcceptRate: 0,
        topPatterns: [],
      };

      const result = AgentFeedbackStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });
  });

  describe('FeedbackOverviewSchema', () => {
    it('should validate feedback overview', () => {
      const overview = {
        totalFeedback: 100,
        feedbackByType: { explicit: 30, implicit: 50, outcome: 20 },
        avgRating: 4.2,
        overallSuccessRate: 0.88,
        topAgents: [
          { agentId: 'backend', score: 45 },
          { agentId: 'frontend', score: 32 },
        ],
        recentTrend: 'improving' as const,
        lastUpdated: new Date().toISOString(),
      };

      const result = FeedbackOverviewSchema.safeParse(overview);
      expect(result.success).toBe(true);
    });

    it('should validate all trend types', () => {
      const trends = ['improving', 'stable', 'declining'];
      trends.forEach((trend) => {
        const overview = {
          totalFeedback: 10,
          feedbackByType: { explicit: 5, implicit: 3, outcome: 2 },
          overallSuccessRate: 0.8,
          topAgents: [],
          recentTrend: trend,
          lastUpdated: new Date().toISOString(),
        };
        expect(FeedbackOverviewSchema.safeParse(overview).success).toBe(true);
      });
    });
  });

  describe('FeedbackLearningConfigSchema', () => {
    it('should provide sensible defaults', () => {
      const config = FeedbackLearningConfigSchema.parse({});
      expect(config.enabled).toBe(true);
      expect(config.minSampleCount).toBe(MIN_SAMPLE_COUNT);
      expect(config.decayRatePerDay).toBe(DECAY_RATE_PER_DAY);
      expect(config.maxAdjustment).toBe(MAX_ADJUSTMENT);
    });

    it('should enforce bounds', () => {
      expect(
        FeedbackLearningConfigSchema.safeParse({ minSampleCount: 0 }).success
      ).toBe(false);

      expect(
        FeedbackLearningConfigSchema.safeParse({ decayRatePerDay: -0.1 }).success
      ).toBe(false);

      expect(
        FeedbackLearningConfigSchema.safeParse({ maxAdjustment: 1.5 }).success
      ).toBe(false);
    });

    it('should validate custom config', () => {
      const config = {
        enabled: false,
        minSampleCount: 5,
        decayRatePerDay: 0.2,
        maxAdjustment: 0.3,
        patternMatchThreshold: 0.8,
        retentionDays: 30,
      };

      const result = FeedbackLearningConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should define MAX_ADJUSTMENT (INV-FBK-002)', () => {
      expect(MAX_ADJUSTMENT).toBe(0.5);
    });

    it('should define MIN_SAMPLE_COUNT (INV-FBK-003)', () => {
      expect(MIN_SAMPLE_COUNT).toBe(3);
    });

    it('should define DECAY_RATE_PER_DAY (INV-FBK-004)', () => {
      expect(DECAY_RATE_PER_DAY).toBe(0.05);
    });
  });

  describe('Validation Functions', () => {
    it('validateFeedbackRecord should parse valid record', () => {
      const record = validateFeedbackRecord({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Task',
        taskHash: 'hash',
        selectedAgent: 'agent',
        feedbackType: 'outcome',
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      expect(record.feedbackType).toBe('outcome');
    });

    it('validateSubmitFeedbackInput should parse valid input', () => {
      const input = validateSubmitFeedbackInput({
        taskDescription: 'Task',
        selectedAgent: 'agent',
      });
      expect(input.selectedAgent).toBe('agent');
    });

    it('validateAgentScoreAdjustment should parse valid adjustment', () => {
      const adjustment = validateAgentScoreAdjustment({
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.2,
        sampleCount: 5,
        confidence: 0.6,
        lastUpdated: new Date().toISOString(),
      });
      expect(adjustment.scoreAdjustment).toBe(0.2);
    });

    it('FeedbackRecordSchema.safeParse should return error for invalid', () => {
      const result = FeedbackRecordSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('createDefaultFeedbackLearningConfig should create valid config', () => {
      const config = createDefaultFeedbackLearningConfig();
      expect(config.enabled).toBe(true);
      expect(config.minSampleCount).toBe(MIN_SAMPLE_COUNT);
    });

    it('createTaskHash should create consistent hash', () => {
      const hash1 = createTaskHash('Implement user authentication');
      const hash2 = createTaskHash('Implement user authentication');
      expect(hash1).toBe(hash2);
    });

    it('createTaskHash should create different hashes for different tasks', () => {
      const hash1 = createTaskHash('Implement authentication system');
      const hash2 = createTaskHash('Build database schema');
      expect(hash1).not.toBe(hash2);
    });

    it('createTaskHash should normalize descriptions', () => {
      const hash1 = createTaskHash('Implement API');
      const hash2 = createTaskHash('implement api');
      expect(hash1).toBe(hash2);
    });
  });

  describe('calculateDecayedAdjustment (INV-FBK-004)', () => {
    it('should return full adjustment for recent updates', () => {
      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 5,
        confidence: 0.8,
        lastUpdated: new Date().toISOString(),
      };

      const config = createDefaultFeedbackLearningConfig();
      const decayed = calculateDecayedAdjustment(adjustment, config);
      expect(decayed).toBeCloseTo(0.3, 2);
    });

    it('should decay adjustment over time', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 5,
        confidence: 0.8,
        lastUpdated: oldDate.toISOString(),
      };

      const config = createDefaultFeedbackLearningConfig();
      const decayed = calculateDecayedAdjustment(adjustment, config);

      // Should be less than original due to decay
      expect(decayed).toBeLessThan(0.3);
      expect(decayed).toBeGreaterThan(0);
    });

    it('should use default config if not provided', () => {
      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 5,
        confidence: 0.8,
        lastUpdated: new Date().toISOString(),
      };

      const decayed = calculateDecayedAdjustment(adjustment);
      expect(decayed).toBeCloseTo(0.3, 2);
    });
  });

  describe('shouldApplyAdjustment (INV-FBK-003)', () => {
    it('should return false for insufficient samples', () => {
      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 2, // Below MIN_SAMPLE_COUNT
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      };

      const config = createDefaultFeedbackLearningConfig();
      expect(shouldApplyAdjustment(adjustment, config)).toBe(false);
    });

    it('should return true for sufficient samples', () => {
      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 5, // Above MIN_SAMPLE_COUNT
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      };

      const config = createDefaultFeedbackLearningConfig();
      expect(shouldApplyAdjustment(adjustment, config)).toBe(true);
    });

    it('should return false for expired adjustment', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
        expiresAt: pastDate.toISOString(),
      };

      const config = createDefaultFeedbackLearningConfig();
      expect(shouldApplyAdjustment(adjustment, config)).toBe(false);
    });

    it('should use default config if not provided', () => {
      const adjustment = {
        agentId: 'agent',
        taskPattern: 'pattern',
        scoreAdjustment: 0.3,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      };

      expect(shouldApplyAdjustment(adjustment)).toBe(true);
    });
  });

  describe('FeedbackErrorCodes', () => {
    it('should define all error codes', () => {
      expect(FeedbackErrorCodes.FEEDBACK_NOT_FOUND).toBe('FBK_NOT_FOUND');
      expect(FeedbackErrorCodes.INVALID_RATING).toBe('FBK_INVALID_RATING');
      expect(FeedbackErrorCodes.DUPLICATE_FEEDBACK).toBe('FBK_DUPLICATE');
      expect(FeedbackErrorCodes.PATTERN_NOT_FOUND).toBe('FBK_PATTERN_NOT_FOUND');
      expect(FeedbackErrorCodes.INSUFFICIENT_DATA).toBe('FBK_INSUFFICIENT_DATA');
    });
  });
});
