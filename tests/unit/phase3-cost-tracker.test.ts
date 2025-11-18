/**
 * Phase 3 Tests: CostTracker
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { CostTracker, resetCostTracker } from '../../src/core/cost-tracker.js';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Safely delete a database file with retry logic for Windows
 * Windows can have file locking delays after closing SQLite databases
 *
 * v6.0.8: Increased retries and delays for Windows CI reliability
 * - Windows: 10 retries × 250ms = 2.5 seconds maximum
 * - Unix: 10 retries × 250ms = 2.5 seconds maximum (helps under CI load)
 */
async function safeUnlink(filePath: string, maxRetries = 10, delayMs = 250): Promise<void> {
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
        // Exponential backoff: wait longer on each retry
        const backoffDelay = delayMs * (1 + attempt * 0.5);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }
      // If it's the last attempt or a different error, throw
      throw err;
    }
  }
}

describe('Phase 3: CostTracker', () => {
  let tracker: CostTracker;
  let testDbPath: string;
  const testDbPaths: string[] = []; // Track all DB files for cleanup

  beforeEach(async () => {
    resetCostTracker();

    // v6.0.8: Use unique DB file per test for complete isolation
    // Eliminates Windows EBUSY errors and test data bleeding
    testDbPath = `.automatosx/test/cost-tracker-test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`;
    testDbPaths.push(testDbPath);

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
    // No cleanup needed - unique file per test eliminates lock conflicts
    // WAL checkpoint in close() handles cleanup internally
  });

  afterAll(async () => {
    // One-time cleanup of all test databases
    // This is non-blocking and best-effort
    await new Promise(resolve => setTimeout(resolve, 100));
    for (const dbPath of testDbPaths) {
      try {
        await safeUnlink(dbPath);
        await safeUnlink(`${dbPath}-wal`);
        await safeUnlink(`${dbPath}-shm`);
      } catch {
        // Ignore cleanup errors - temp files will be cleaned by CI
      }
    }
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
        sessionId: '550e8400-e29b-41d4-a716-446655440000', // v8.5.6: Use valid UUID v4 for Zod validation
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
