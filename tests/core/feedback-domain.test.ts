/**
 * Feedback Domain Tests
 *
 * Tests for the feedback learning domain including:
 * - Feedback collector
 * - Score adjuster
 * - Pattern matching
 *
 * Invariants tested:
 * - INV-FBK-001: Feedback records immutable
 * - INV-FBK-002: Adjustments bounded (-0.5 to +0.5)
 * - INV-FBK-003: Minimum sample count before adjustment
 * - INV-FBK-004: Adjustments decay over time
 * - INV-FBK-100: No duplicate feedback
 * - INV-FBK-201: Average conflicting feedback
 * - INV-FBK-202: Cold start returns neutral
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFeedbackCollector,
  createInMemoryFeedbackStorage,
  createScoreAdjuster,
  createInMemoryAdjustmentStorage,
  createSimplePatternMatcher,
} from '@defai.digital/feedback-domain';
import type {
  FeedbackCollector,
  ScoreAdjuster,
  FeedbackStoragePort,
  ScoreAdjustmentStoragePort,
  PatternMatcherPort,
} from '@defai.digital/feedback-domain';
import { MAX_ADJUSTMENT, createTaskHash } from '@defai.digital/contracts';

describe('Feedback Collector', () => {
  let collector: FeedbackCollector;
  let storage: FeedbackStoragePort;

  beforeEach(() => {
    storage = createInMemoryFeedbackStorage();
    collector = createFeedbackCollector({ storage });
  });

  describe('submit', () => {
    it('should create feedback record with generated ID', async () => {
      const record = await collector.submit({
        taskDescription: 'Implement user authentication',
        selectedAgent: 'backend',
        feedbackType: 'outcome',
        outcome: 'success',
      });

      expect(record.feedbackId).toBeDefined();
      expect(record.taskDescription).toBe('Implement user authentication');
      expect(record.selectedAgent).toBe('backend');
      expect(record.feedbackType).toBe('outcome');
      expect(record.outcome).toBe('success');
      expect(record.timestamp).toBeDefined();
    });

    it('should generate task hash', async () => {
      const record = await collector.submit({
        taskDescription: 'Build REST API',
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 5,
      });

      expect(record.taskHash).toBeDefined();
      expect(record.taskHash.length).toBeGreaterThan(0);
    });

    it('should include optional fields when provided', async () => {
      const sessionId = crypto.randomUUID();
      const record = await collector.submit({
        taskDescription: 'Create dashboard',
        recommendedAgent: 'frontend',
        selectedAgent: 'fullstack',
        feedbackType: 'explicit',
        rating: 4,
        outcome: 'partial',
        durationMs: 5000,
        userComment: 'Good but could be better',
        sessionId,
      });

      expect(record.recommendedAgent).toBe('frontend');
      expect(record.rating).toBe(4);
      expect(record.outcome).toBe('partial');
      expect(record.durationMs).toBe(5000);
      expect(record.userComment).toBe('Good but could be better');
      expect(record.sessionId).toBe(sessionId);
    });

    it('should reject duplicate feedback (INV-FBK-100)', async () => {
      await collector.submit({
        taskDescription: 'Same task',
        selectedAgent: 'backend',
        feedbackType: 'outcome',
      });

      // Immediate resubmit should fail
      await expect(
        collector.submit({
          taskDescription: 'Same task',
          selectedAgent: 'backend',
          feedbackType: 'outcome',
        })
      ).rejects.toThrow('Duplicate feedback');
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      await collector.submit({
        taskDescription: 'Task 1',
        selectedAgent: 'backend',
        feedbackType: 'outcome',
        outcome: 'success',
      });

      // Wait to avoid duplicate detection
      await new Promise((r) => setTimeout(r, 100));

      await collector.submit({
        taskDescription: 'Task 2',
        selectedAgent: 'frontend',
        feedbackType: 'explicit',
        rating: 4,
      });
    });

    it('should return all feedback records', async () => {
      const records = await collector.getHistory();
      expect(records.length).toBe(2);
    });

    it('should filter by agent', async () => {
      const records = await collector.getHistory({ agentId: 'backend' });
      expect(records.length).toBe(1);
      expect(records[0]?.selectedAgent).toBe('backend');
    });

    it('should respect limit', async () => {
      const records = await collector.getHistory({ limit: 1 });
      expect(records.length).toBe(1);
    });
  });

  describe('getAgentStats', () => {
    beforeEach(async () => {
      // Submit multiple feedback for same agent
      // Use distinct task descriptions that hash differently
      await collector.submit({
        taskDescription: 'Implement user authentication system',
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 5,
        outcome: 'success',
      });

      await collector.submit({
        taskDescription: 'Build database migration scripts',
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 4,
        outcome: 'success',
      });

      await collector.submit({
        taskDescription: 'Create REST API endpoints',
        selectedAgent: 'backend',
        feedbackType: 'outcome',
        outcome: 'failure',
      });
    });

    it('should calculate average rating', async () => {
      const stats = await collector.getAgentStats('backend');
      expect(stats.avgRating).toBeCloseTo(4.5, 1);
    });

    it('should calculate success rate', async () => {
      const stats = await collector.getAgentStats('backend');
      expect(stats.successRate).toBeCloseTo(0.67, 1);
    });

    it('should count total feedback', async () => {
      const stats = await collector.getAgentStats('backend');
      expect(stats.totalFeedback).toBe(3);
    });
  });

  describe('getOverview', () => {
    it('should return feedback overview', async () => {
      await collector.submit({
        taskDescription: 'Task 1',
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 5,
        outcome: 'success',
      });

      const overview = await collector.getOverview();

      expect(overview.totalFeedback).toBe(1);
      expect(overview.feedbackByType.explicit).toBe(1);
      expect(overview.lastUpdated).toBeDefined();
    });
  });
});

describe('Score Adjuster', () => {
  let adjuster: ScoreAdjuster;
  let feedbackStorage: FeedbackStoragePort;
  let adjustmentStorage: ScoreAdjustmentStoragePort;
  let patternMatcher: PatternMatcherPort;

  beforeEach(() => {
    feedbackStorage = createInMemoryFeedbackStorage();
    adjustmentStorage = createInMemoryAdjustmentStorage();
    patternMatcher = createSimplePatternMatcher();

    adjuster = createScoreAdjuster({
      feedbackStorage,
      adjustmentStorage,
      patternMatcher,
    });
  });

  describe('getAdjustment (INV-FBK-202, INV-FBK-003)', () => {
    it('should return 0 for unknown tasks (INV-FBK-202)', async () => {
      const adjustment = await adjuster.getAdjustment('backend', 'Unknown task');
      expect(adjustment).toBe(0);
    });

    it('should return 0 for insufficient samples (INV-FBK-003)', async () => {
      // Create adjustment with only 1 sample
      await adjustmentStorage.set({
        agentId: 'backend',
        taskPattern: createTaskHash('API task'),
        scoreAdjustment: 0.3,
        sampleCount: 1,
        confidence: 0.1,
        lastUpdated: new Date().toISOString(),
      });

      const adjustment = await adjuster.getAdjustment('backend', 'API task');
      expect(adjustment).toBe(0);
    });

    it('should return adjustment for sufficient samples', async () => {
      await adjustmentStorage.set({
        agentId: 'backend',
        taskPattern: createTaskHash('API task'),
        scoreAdjustment: 0.3,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      });

      const adjustment = await adjuster.getAdjustment('backend', 'API task');
      expect(adjustment).toBeCloseTo(0.3, 1);
    });

    it('should apply decay for old adjustments (INV-FBK-004)', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await adjustmentStorage.set({
        agentId: 'backend',
        taskPattern: createTaskHash('Old task'),
        scoreAdjustment: 0.4,
        sampleCount: 10,
        confidence: 0.8,
        lastUpdated: oldDate.toISOString(),
      });

      const adjustment = await adjuster.getAdjustment('backend', 'Old task');
      expect(adjustment).toBeLessThan(0.4);
    });
  });

  describe('processNewFeedback', () => {
    it('should create new adjustment from feedback', async () => {
      const taskHash = createTaskHash('New task');

      await adjuster.processNewFeedback({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'New task',
        taskHash,
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 5,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const adjustment = await adjustmentStorage.get('backend', taskHash);
      expect(adjustment).not.toBeNull();
      expect(adjustment?.sampleCount).toBe(1);
    });

    it('should update existing adjustment (INV-FBK-201)', async () => {
      const taskHash = createTaskHash('Existing task');

      // First feedback
      await adjuster.processNewFeedback({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Existing task',
        taskHash,
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 5,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      // Second feedback (conflicting)
      await adjuster.processNewFeedback({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Existing task',
        taskHash,
        selectedAgent: 'backend',
        feedbackType: 'explicit',
        rating: 1,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const adjustment = await adjustmentStorage.get('backend', taskHash);
      expect(adjustment?.sampleCount).toBe(2);
      // Averaged: (0.5 + (-0.5)) / 2 = 0
      expect(adjustment?.scoreAdjustment).toBeCloseTo(0, 1);
    });

    it('should bound adjustments (INV-FBK-002)', async () => {
      const taskHash = createTaskHash('Bounded task');

      // Many positive feedbacks
      for (let i = 0; i < 10; i++) {
        await adjuster.processNewFeedback({
          feedbackId: crypto.randomUUID(),
          taskDescription: 'Bounded task',
          taskHash,
          selectedAgent: 'backend',
          feedbackType: 'explicit',
          rating: 5,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
      }

      const adjustment = await adjustmentStorage.get('backend', taskHash);
      expect(adjustment?.scoreAdjustment).toBeLessThanOrEqual(MAX_ADJUSTMENT);
      expect(adjustment?.scoreAdjustment).toBeGreaterThanOrEqual(-MAX_ADJUSTMENT);
    });

    it('should handle outcome-based feedback', async () => {
      const taskHash = createTaskHash('Outcome task');

      await adjuster.processNewFeedback({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Outcome task',
        taskHash,
        selectedAgent: 'backend',
        feedbackType: 'outcome',
        outcome: 'success',
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const adjustment = await adjustmentStorage.get('backend', taskHash);
      expect(adjustment?.scoreAdjustment).toBeGreaterThan(0);
    });

    it('should handle failure outcome', async () => {
      const taskHash = createTaskHash('Failed task');

      await adjuster.processNewFeedback({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Failed task',
        taskHash,
        selectedAgent: 'backend',
        feedbackType: 'outcome',
        outcome: 'failure',
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const adjustment = await adjustmentStorage.get('backend', taskHash);
      expect(adjustment?.scoreAdjustment).toBeLessThan(0);
    });
  });

  describe('getAgentAdjustments', () => {
    it('should return all adjustments for agent', async () => {
      await adjustmentStorage.set({
        agentId: 'backend',
        taskPattern: 'pattern-1',
        scoreAdjustment: 0.2,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      });

      await adjustmentStorage.set({
        agentId: 'backend',
        taskPattern: 'pattern-2',
        scoreAdjustment: -0.1,
        sampleCount: 3,
        confidence: 0.3,
        lastUpdated: new Date().toISOString(),
      });

      const adjustments = await adjuster.getAgentAdjustments('backend');
      expect(adjustments.length).toBe(2);
    });
  });

  describe('applyDecay', () => {
    it('should remove expired adjustments', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 100);

      await adjustmentStorage.set({
        agentId: 'backend',
        taskPattern: 'expired-pattern',
        scoreAdjustment: 0.1,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: expiredDate.toISOString(),
        expiresAt: expiredDate.toISOString(),
      });

      await adjuster.applyDecay();

      const adjustment = await adjustmentStorage.get('backend', 'expired-pattern');
      expect(adjustment).toBeNull();
    });
  });
});

describe('In-Memory Storage Implementations', () => {
  describe('createInMemoryFeedbackStorage', () => {
    it('should store and retrieve records', async () => {
      const storage = createInMemoryFeedbackStorage();
      const record = {
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Task',
        taskHash: 'hash',
        selectedAgent: 'agent',
        feedbackType: 'outcome' as const,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      await storage.store(record);
      const retrieved = await storage.get(record.feedbackId);

      expect(retrieved).toEqual(record);
    });

    it('should list records with filters', async () => {
      const storage = createInMemoryFeedbackStorage();

      await storage.store({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Task 1',
        taskHash: 'hash1',
        selectedAgent: 'backend',
        feedbackType: 'outcome',
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      await storage.store({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Task 2',
        taskHash: 'hash2',
        selectedAgent: 'frontend',
        feedbackType: 'explicit',
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const backendRecords = await storage.list({ agentId: 'backend' });
      expect(backendRecords.length).toBe(1);
    });

    it('should count records', async () => {
      const storage = createInMemoryFeedbackStorage();

      await storage.store({
        feedbackId: crypto.randomUUID(),
        taskDescription: 'Task',
        taskHash: 'hash',
        selectedAgent: 'agent',
        feedbackType: 'outcome',
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      const count = await storage.count();
      expect(count).toBe(1);
    });
  });

  describe('createInMemoryAdjustmentStorage', () => {
    it('should store and retrieve adjustments', async () => {
      const storage = createInMemoryAdjustmentStorage();
      const adjustment = {
        agentId: 'backend',
        taskPattern: 'pattern',
        scoreAdjustment: 0.2,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      };

      await storage.set(adjustment);
      const retrieved = await storage.get('backend', 'pattern');

      expect(retrieved).toEqual(adjustment);
    });

    it('should list adjustments for agent', async () => {
      const storage = createInMemoryAdjustmentStorage();

      await storage.set({
        agentId: 'backend',
        taskPattern: 'pattern1',
        scoreAdjustment: 0.1,
        sampleCount: 3,
        confidence: 0.3,
        lastUpdated: new Date().toISOString(),
      });

      await storage.set({
        agentId: 'backend',
        taskPattern: 'pattern2',
        scoreAdjustment: 0.2,
        sampleCount: 5,
        confidence: 0.5,
        lastUpdated: new Date().toISOString(),
      });

      const adjustments = await storage.listForAgent('backend');
      expect(adjustments.length).toBe(2);
    });
  });

  describe('createSimplePatternMatcher', () => {
    it('should find exact matches', async () => {
      const matcher = createSimplePatternMatcher();
      const pattern = {
        patternId: createTaskHash('API development'),
        pattern: 'api',
        agentScores: { backend: 0.3 },
        feedbackCount: 5,
        successRate: 0.9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await matcher.upsertPattern(pattern);

      const matches = await matcher.findMatches('API development', 0);
      expect(matches.length).toBe(1);
    });

    it('should return empty for no matches', async () => {
      const matcher = createSimplePatternMatcher();

      const matches = await matcher.findMatches('Unknown task', 0);
      expect(matches.length).toBe(0);
    });
  });
});
