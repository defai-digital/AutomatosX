/**
 * Phase 3 Tests: CostTracker
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CostTracker, resetCostTracker } from '../../src/core/cost-tracker.js';
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

describe('Phase 3: CostTracker', () => {
  const testDbPath = '.automatosx/test/cost-tracker-test.db';
  let tracker: CostTracker;

  beforeEach(async () => {
    resetCostTracker();

    // Ensure test directory exists
    const dir = dirname(testDbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    tracker = new CostTracker({
      enabled: true,
      persistPath: testDbPath,
      alertOnBudget: false // Disable alerts for tests
    });
    await tracker.initialize();
  });

  afterEach(async () => {
    await tracker.close();
    // Clean up test database (with retry logic for Windows)
    await safeUnlink(testDbPath);
    // Also clean up WAL files if they exist
    await safeUnlink(`${testDbPath}-wal`);
    await safeUnlink(`${testDbPath}-shm`);
  });

  describe('recordCost', () => {
    it('should record cost entry', async () => {
      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.005
      });

      const total = await tracker.getTotalCost();
      expect(total).toBeCloseTo(0.005, 4);
    });

    it('should record cost with session and agent', async () => {
      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.005,
        sessionId: 'session-123',
        agent: 'backend'
      });

      const breakdown = await tracker.getCostBreakdown();
      expect(breakdown.byAgent['backend']).toBeCloseTo(0.005, 4);
    });

    it('should accumulate costs', async () => {
      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.005
      });

      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'gemini',
        model: 'gemini-pro',
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        estimatedCostUsd: 0.003
      });

      const total = await tracker.getTotalCost();
      expect(total).toBeCloseTo(0.008, 4);
    });
  });

  describe('getCostBreakdown', () => {
    beforeEach(async () => {
      // Add test data
      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.005,
        agent: 'backend'
      });

      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'gemini',
        model: 'gemini-pro',
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        estimatedCostUsd: 0.003,
        agent: 'frontend'
      });
    });

    it('should break down by provider', async () => {
      const breakdown = await tracker.getCostBreakdown();

      expect(breakdown.byProvider['openai']).toBeCloseTo(0.005, 4);
      expect(breakdown.byProvider['gemini']).toBeCloseTo(0.003, 4);
    });

    it('should break down by model', async () => {
      const breakdown = await tracker.getCostBreakdown();

      expect(breakdown.byModel['gpt-4']).toBeCloseTo(0.005, 4);
      expect(breakdown.byModel['gemini-pro']).toBeCloseTo(0.003, 4);
    });

    it('should break down by agent', async () => {
      const breakdown = await tracker.getCostBreakdown();

      expect(breakdown.byAgent['backend']).toBeCloseTo(0.005, 4);
      expect(breakdown.byAgent['frontend']).toBeCloseTo(0.003, 4);
    });

    it('should count entries', async () => {
      const breakdown = await tracker.getCostBreakdown();
      expect(breakdown.entries).toBe(2);
    });
  });

  describe('Budget management', () => {
    beforeEach(() => {
      resetCostTracker();
      tracker = new CostTracker({
        enabled: true,
        persistPath: testDbPath,
        budgets: {
          daily: { limit: 1.00, warningThreshold: 0.75 }
        },
        alertOnBudget: false
      });
    });

    it('should track budget status', async () => {
      await tracker.initialize();

      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.50
      });

      const status = await tracker.checkBudget('daily');
      expect(status.limit).toBe(1.00);
      expect(status.used).toBeCloseTo(0.50, 2);
      expect(status.remaining).toBeCloseTo(0.50, 2);
      expect(status.percentUsed).toBeCloseTo(0.50, 2);
      expect(status.status).toBe('ok');
    });

    it('should detect warning status', async () => {
      await tracker.initialize();

      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.80
      });

      const status = await tracker.checkBudget('daily');
      expect(status.status).toBe('warning');
    });

    it('should detect critical status', async () => {
      await tracker.initialize();

      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.95
      });

      const status = await tracker.checkBudget('daily');
      expect(status.status).toBe('critical');
    });

    it('should detect exceeded status', async () => {
      await tracker.initialize();

      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 1.10
      });

      const status = await tracker.checkBudget('daily');
      expect(status.status).toBe('exceeded');
    });
  });

  describe('Query filters', () => {
    beforeEach(async () => {
      const now = Date.now();
      await tracker.recordCost({
        timestamp: now - 86400000 * 2, // 2 days ago
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.005
      });

      await tracker.recordCost({
        timestamp: now,
        provider: 'gemini',
        model: 'gemini-pro',
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        estimatedCostUsd: 0.003
      });
    });

    it('should filter by provider', async () => {
      const total = await tracker.getTotalCost({ provider: 'openai' });
      expect(total).toBeCloseTo(0.005, 4);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const total = await tracker.getTotalCost({
        startTime: now - 86400000, // Last 24 hours
        endTime: now
      });
      expect(total).toBeCloseTo(0.003, 4);
    });
  });

  describe('Export', () => {
    beforeEach(async () => {
      await tracker.recordCost({
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.005
      });
    });

    it('should export to JSON', async () => {
      const json = await tracker.exportCosts('json');
      const data = JSON.parse(json);

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].provider).toBe('openai');
    });

    it('should export to CSV', async () => {
      const csv = await tracker.exportCosts('csv');

      expect(csv).toContain('id,timestamp,provider');
      expect(csv).toContain('openai');
    });
  });
});
