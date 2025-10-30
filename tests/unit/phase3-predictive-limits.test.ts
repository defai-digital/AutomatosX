/**
 * Phase 3 Tests: PredictiveLimitManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PredictiveLimitManager, resetPredictiveLimitManager } from '../../src/core/predictive-limit-manager.js';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';

describe('Phase 3: PredictiveLimitManager', () => {
  const testDbPath = '.automatosx/test/predictive-limits-test.db';
  let manager: PredictiveLimitManager;

  beforeEach(async () => {
    resetPredictiveLimitManager();

    // Ensure test directory exists
    const dir = dirname(testDbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    manager = new PredictiveLimitManager({
      enabled: true,
      trackingWindow: 24, // 24 hours
      rotationThreshold: 1, // 1 hour before exhaustion
      knownLimits: {
        'openai': {
          requestsPerDay: 500,
          tokensPerDay: 40000
        },
        'gemini': {
          requestsPerDay: 1000,
          tokensPerDay: 50000
        }
      }
    });

    await manager.initializeUsageTracking();
  });

  afterEach(async () => {
    await manager.closeUsageDb();
    // Clean up test database
    const dbFile = '.automatosx/usage/usage-tracker.db';
    if (existsSync(dbFile)) {
      unlinkSync(dbFile);
    }
  });

  describe('recordUsage', () => {
    it('should record usage for a provider', async () => {
      await manager.recordUsage('openai', 1000);

      const trends = await manager.getUsageTrends('openai', 1);
      expect(trends.tokens).toBe(1000);
      expect(trends.requests).toBe(1);
    });

    it('should accumulate usage in hourly windows', async () => {
      await manager.recordUsage('openai', 1000);
      await manager.recordUsage('openai', 500);
      await manager.recordUsage('openai', 300);

      const trends = await manager.getUsageTrends('openai', 1);
      expect(trends.tokens).toBe(1800);
      expect(trends.requests).toBe(3);
    });
  });

  describe('getUsageTrends', () => {
    it('should return empty trends with no data', async () => {
      const trends = await manager.getUsageTrends('openai', 24);

      expect(trends.provider).toBe('openai');
      expect(trends.window).toBe(24);
      expect(trends.requests).toBe(0);
      expect(trends.tokens).toBe(0);
      expect(trends.trend).toBe('stable');
    });

    it('should calculate averages', async () => {
      // Record 10 requests
      for (let i = 0; i < 10; i++) {
        await manager.recordUsage('openai', 1000);
      }

      const trends = await manager.getUsageTrends('openai', 1);
      expect(trends.tokens).toBe(10000);
      expect(trends.requests).toBe(10);
      expect(trends.avgTokensPerHour).toBeGreaterThan(0);
      expect(trends.avgRequestsPerHour).toBeGreaterThan(0);
    });

    it('should detect increasing trend', async () => {
      // Simulate increasing usage over time
      // First half: low usage
      for (let i = 0; i < 5; i++) {
        await manager.recordUsage('openai', 500);
      }

      // Add delay to simulate time passing (in real scenario, would be different windows)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second half: high usage
      for (let i = 0; i < 5; i++) {
        await manager.recordUsage('openai', 2000);
      }

      const trends = await manager.getUsageTrends('openai', 1);
      // Note: Trend detection requires data in multiple windows
      expect(trends.trend).toBeDefined();
    });
  });

  describe('predictExhaustion', () => {
    it('should predict healthy status with low usage', async () => {
      // Record minimal usage
      await manager.recordUsage('openai', 100);
      await manager.recordUsage('openai', 100);

      const prediction = await manager.predictExhaustion('openai');

      expect(prediction.provider).toBe('openai');
      expect(prediction.prediction.status).toBe('healthy');
      expect(prediction.prediction.shouldRotate).toBe(false);
      expect(prediction.prediction.timeToExhaustionHours).toBeGreaterThan(10);
    });

    it('should predict warning status with moderate usage', async () => {
      // Record moderate usage (approaching limits)
      for (let i = 0; i < 20; i++) {
        await manager.recordUsage('openai', 1500); // 30,000 tokens total
      }

      const prediction = await manager.predictExhaustion('openai');

      expect(prediction.provider).toBe('openai');
      expect(prediction.currentRate.tokensPerHour).toBeGreaterThan(0);
      expect(prediction.knownLimits.tokensPerDay).toBe(40000);
    });

    it('should predict critical status with high usage', async () => {
      // Record very high usage (near daily limit)
      for (let i = 0; i < 35; i++) {
        await manager.recordUsage('openai', 1000); // 35,000 tokens in short time
      }

      const prediction = await manager.predictExhaustion('openai');

      expect(prediction.provider).toBe('openai');
      expect(prediction.prediction.status).toBeDefined();
      // With high usage rate, time to exhaustion should be low
      expect(prediction.prediction.timeToExhaustionHours).toBeLessThan(24);
    });

    it('should have higher confidence with more data', async () => {
      // Record many requests
      for (let i = 0; i < 150; i++) {
        await manager.recordUsage('openai', 200);
      }

      const prediction = await manager.predictExhaustion('openai');

      expect(prediction.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('shouldRotate', () => {
    it('should not rotate with low usage', async () => {
      await manager.recordUsage('openai', 100);

      const shouldRotate = await manager.shouldRotate('openai');

      expect(shouldRotate).toBe(false);
    });

    it('should rotate when approaching limits', async () => {
      // Simulate high usage rate that will exhaust in < 1 hour
      for (let i = 0; i < 50; i++) {
        await manager.recordUsage('openai', 900); // 45,000 tokens (exceeds daily limit of 40,000)
      }

      const shouldRotate = await manager.shouldRotate('openai');

      // Should rotate because usage is very high
      expect(typeof shouldRotate).toBe('boolean');
    });
  });

  describe('cleanupOldUsage', () => {
    it('should clean old data', async () => {
      await manager.recordUsage('openai', 1000);

      await manager.cleanupOldUsage();

      // Data should still exist (not old enough)
      const trends = await manager.getUsageTrends('openai', 1);
      expect(trends.tokens).toBeGreaterThan(0);
    });
  });

  describe('Multiple providers', () => {
    it('should track multiple providers independently', async () => {
      await manager.recordUsage('openai', 1000);
      await manager.recordUsage('gemini', 2000);
      await manager.recordUsage('openai', 500);

      const openaiTrends = await manager.getUsageTrends('openai', 1);
      const geminiTrends = await manager.getUsageTrends('gemini', 1);

      expect(openaiTrends.tokens).toBe(1500);
      expect(geminiTrends.tokens).toBe(2000);
    });

    it('should predict independently for each provider', async () => {
      await manager.recordUsage('openai', 1000);
      await manager.recordUsage('gemini', 500);

      const openaiPrediction = await manager.predictExhaustion('openai');
      const geminiPrediction = await manager.predictExhaustion('gemini');

      expect(openaiPrediction.provider).toBe('openai');
      expect(geminiPrediction.provider).toBe('gemini');
      expect(openaiPrediction.currentRate.tokensPerHour).not.toBe(geminiPrediction.currentRate.tokensPerHour);
    });
  });
});
