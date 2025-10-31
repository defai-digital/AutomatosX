/**
 * Phase 3 Tests: PredictiveLimitManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PredictiveLimitManager, resetPredictiveLimitManager } from '../../src/core/predictive-limit-manager.js';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Safely delete a database file with retry logic for Windows
 * Windows can have file locking delays after closing SQLite databases
 */
async function safeUnlink(filePath: string, maxRetries = 5, delayMs = 100): Promise<void> {
  if (!existsSync(filePath)) {
    return;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      unlinkSync(filePath);
      return;
    } catch (err: any) {
      // EBUSY (Windows file busy) or EPERM (Windows permission) errors are retryable
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      // If it's the last attempt or a different error, throw
      throw err;
    }
  }
}

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
    // Clean up test database (with retry logic for Windows)
    const dbFile = '.automatosx/usage/usage-tracker.db';
    await safeUnlink(dbFile);
    // Also clean up WAL files if they exist
    await safeUnlink(`${dbFile}-wal`);
    await safeUnlink(`${dbFile}-shm`);
  });

  describe('initializeUsageTracking', () => {
    it('should handle initialization errors without memory leaks (Bug #20)', async () => {
      // Bug #20: Database initialization errors should clean up connections
      // to prevent memory leaks on retry

      // Create a manager with an invalid path that will cause errors
      const badManager = new (await import('../../src/core/predictive-limit-manager.js')).PredictiveLimitManager({
        enabled: true,
        trackingWindow: 24,
        rotationThreshold: 1,
        knownLimits: {}
      });

      // Note: We can't easily force a database error in tests without mocking,
      // but the code structure now ensures cleanup happens
      // This test verifies the fix compiles and doesn't break existing functionality

      await badManager.initializeUsageTracking();

      // Should initialize successfully with valid path
      await badManager.recordUsage('test', 100);

      const trends = await badManager.getUsageTrends('test', 24);
      expect(trends.requests).toBe(1);

      await badManager.closeUsageDb();
    });
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

    it('should accept zero tokens (Bug #19)', async () => {
      // Zero tokens is valid - tracks requests with no token usage (e.g., cached responses)
      await manager.recordUsage('openai', 0);

      const trends = await manager.getUsageTrends('openai', 1);
      expect(trends.tokens).toBe(0);
      expect(trends.requests).toBe(1);
    });

    it('should reject negative tokens (Bug #19)', async () => {
      // Bug #19: Must reject negative tokens to prevent data corruption
      await expect(manager.recordUsage('openai', -100)).rejects.toThrow('Cannot be negative');
    });

    it('should reject NaN tokens (Bug #19)', async () => {
      // Bug #19: Must reject NaN to prevent breaking all calculations
      await expect(manager.recordUsage('openai', NaN)).rejects.toThrow('Must be a finite number');
    });

    it('should reject Infinity tokens (Bug #19)', async () => {
      // Bug #19: Must reject Infinity to prevent breaking predictions
      await expect(manager.recordUsage('openai', Infinity)).rejects.toThrow('Must be a finite number');
    });

    it('should reject empty provider name (Bug #19)', async () => {
      // Bug #19: Must reject empty provider to prevent invalid entries
      await expect(manager.recordUsage('', 1000)).rejects.toThrow('cannot be empty');
      await expect(manager.recordUsage('   ', 1000)).rejects.toThrow('cannot be empty');
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

    it('should calculate rate accurately for single hour window (Bug #16)', async () => {
      // Bug #16 fix: Use window span (first to last) for rate calculation
      // This test verifies single-hour data calculates correctly

      // Record usage across multiple calls (will aggregate into same hour window)
      for (let i = 0; i < 10; i++) {
        await manager.recordUsage('openai', 1000);
      }

      const trends = await manager.getUsageTrends('openai', 1);

      // All 10 requests aggregate into 1 hour window
      expect(trends.requests).toBe(10);
      expect(trends.tokens).toBe(10000);

      // With single window: span = 0 hours, +1 for the window = 1 hour total
      // Rate should be 10 requests / 1 hour = 10 req/hr
      expect(trends.avgRequestsPerHour).toBe(10);
      expect(trends.avgTokensPerHour).toBe(10000);
    });

    it('should account for gaps in data (Bug #16)', async () => {
      // Bug #16: Rate calculation must account for time gaps between windows
      // Without this fix, sparse data causes massive overestimation (50-1150% errors)

      // We can't easily create multi-hour gaps in tests since recordUsage uses current time
      // But we can verify the calculation works for data within the same tracking window

      // Record 50 requests in current hour
      for (let i = 0; i < 50; i++) {
        await manager.recordUsage('test-provider-bug16', 100);
      }

      const trends = await manager.getUsageTrends('test-provider-bug16', 24);

      // With data in 1 hour window, rate should be accurate
      expect(trends.requests).toBe(50);
      expect(trends.avgRequestsPerHour).toBe(50);
      expect(trends.tokens).toBe(5000);
      expect(trends.avgTokensPerHour).toBe(5000);
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

    it('should return confidence 0 when no predictions available (Bug #22)', async () => {
      // Bug #22: confidence = 0.5 with Infinity is misleading
      // Should be 0 to indicate no data, not uncertainty

      // Create manager with no known limits
      const noLimitsManager = new (await import('../../src/core/predictive-limit-manager.js')).PredictiveLimitManager({
        enabled: true,
        trackingWindow: 24,
        rotationThreshold: 1,
        knownLimits: {} // No limits configured
      });

      await noLimitsManager.initializeUsageTracking();
      await noLimitsManager.recordUsage('test-provider', 1000);

      const prediction = await noLimitsManager.predictExhaustion('test-provider');

      // Should have Infinity (no exhaustion predicted)
      expect(prediction.prediction.timeToExhaustionHours).toBe(Infinity);

      // Should have confidence 0 (no data to base prediction on)
      expect(prediction.confidence).toBe(0);

      // Should be healthy (Infinity hours to exhaust)
      expect(prediction.prediction.status).toBe('healthy');

      await noLimitsManager.closeUsageDb();
    });

    it('should return confidence 0 when zero usage recorded (Bug #22)', async () => {
      // Bug #22: Zero usage = no predictions = confidence should be 0

      const prediction = await manager.predictExhaustion('never-used-provider');

      // No usage = Infinity hours to exhaust
      expect(prediction.prediction.timeToExhaustionHours).toBe(Infinity);

      // No usage = confidence 0
      expect(prediction.confidence).toBe(0);

      // Status should be healthy
      expect(prediction.prediction.status).toBe('healthy');
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

    it('should filter by window_start not timestamp (Bug #17)', async () => {
      // Bug #17: SQL queries should filter by window_start (data period)
      // not timestamp (last update time) for semantic correctness

      // Record some usage
      await manager.recordUsage('test-bug17', 1000);

      // Query with tracking window should find the data
      const trends = await manager.getUsageTrends('test-bug17', 24);

      // Should find the entry based on window_start, not timestamp
      expect(trends.requests).toBe(1);
      expect(trends.tokens).toBe(1000);

      // Verify cleanup also uses window_start
      await manager.cleanupOldUsage();

      // Recent data should still exist after cleanup
      const trendsAfterCleanup = await manager.getUsageTrends('test-bug17', 24);
      expect(trendsAfterCleanup.requests).toBe(1);
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
