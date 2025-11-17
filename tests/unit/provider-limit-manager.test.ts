/**
 * Unit Tests: ProviderLimitManager (v5.7.0)
 *
 * Tests for provider limit tracking, persistence, and automatic recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderLimitManager, getProviderLimitManager } from '../../src/core/provider-limit-manager.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { existsSync } from 'fs';

describe('ProviderLimitManager', () => {
  const testStateDir = path.join(process.cwd(), 'tests', 'fixtures', 'test-state-provider-limits');
  let manager: ProviderLimitManager;

  beforeEach(async () => {
    // Clean up test state directory
    if (existsSync(testStateDir)) {
      await fs.rm(testStateDir, { recursive: true, force: true });
    }

    // Reset singleton
    ProviderLimitManager.resetInstance();

    // Create new instance with test directory
    manager = ProviderLimitManager.getInstance(testStateDir);
    await manager.initialize();
  });

  afterEach(async () => {
    // Clean up
    try {
      if (existsSync(testStateDir)) {
        await fs.rm(testStateDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }

    // Reset singleton
    ProviderLimitManager.resetInstance();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(manager).toBeDefined();
    });

    it('should create singleton instance', () => {
      const instance1 = ProviderLimitManager.getInstance(testStateDir);
      const instance2 = ProviderLimitManager.getInstance(testStateDir);
      expect(instance1).toBe(instance2);
    });

    it('should initialize without existing state file', async () => {
      const newManager = ProviderLimitManager.getInstance(testStateDir);
      await expect(newManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Limit Recording', () => {
    it('should record provider limit hit', async () => {
      const resetAtMs = Date.now() + 3600000; // 1 hour from now

      await manager.recordLimitHit('openai', 'daily', resetAtMs, {
        reason: 'rate_limit_exceeded',
        rawMessage: 'Rate limit exceeded'
      });

      const result = manager.isProviderLimited('openai');
      expect(result.isLimited).toBe(true);
      expect(result.resetAtMs).toBe(resetAtMs);
      expect(result.reason).toBe('rate_limit_exceeded');
    });

    it('should record different limit windows', async () => {
      const dailyResetMs = Date.now() + 3600000;
      const weeklyResetMs = Date.now() + (7 * 24 * 3600000);

      await manager.recordLimitHit('openai', 'daily', dailyResetMs);
      await manager.recordLimitHit('claude-code', 'weekly', weeklyResetMs);

      const openaiResult = manager.isProviderLimited('openai');
      const claudeResult = manager.isProviderLimited('claude-code');

      expect(openaiResult.isLimited).toBe(true);
      expect(claudeResult.isLimited).toBe(true);
      expect(openaiResult.resetAtMs).toBe(dailyResetMs);
      expect(claudeResult.resetAtMs).toBe(weeklyResetMs);
    });

    it('should update metrics on limit recording', async () => {
      const resetAtMs = Date.now() + 3600000;

      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      const metrics = manager.getMetrics();
      expect(metrics.limitsRecorded).toBe(1);
    });

    it('should emit limit-hit event', async () => {
      const resetAtMs = Date.now() + 3600000;
      let eventEmitted = false;

      manager.on('limit-hit', (data) => {
        eventEmitted = true;
        expect(data.providerName).toBe('openai');
        expect(data.limitWindow).toBe('daily');
        expect(data.resetAtMs).toBe(resetAtMs);
      });

      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      expect(eventEmitted).toBe(true);
    });
  });

  describe('Limit Checking', () => {
    it('should return false for non-limited provider', () => {
      const result = manager.isProviderLimited('openai');
      expect(result.isLimited).toBe(false);
    });

    it('should return true for limited provider', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      const result = manager.isProviderLimited('openai');
      expect(result.isLimited).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.resetAtMs).toBe(resetAtMs);
    });

    it('should auto-clear expired limit on check', async () => {
      const resetAtMs = Date.now() - 1000; // 1 second ago (expired)
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      const result = manager.isProviderLimited('openai');
      expect(result.isLimited).toBe(false);
    });

    it('should be fast (< 1ms)', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      const startTime = performance.now();
      manager.isProviderLimited('openai');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1); // < 1ms
    });

    it('should update metrics on check', async () => {
      manager.isProviderLimited('openai');

      const metrics = manager.getMetrics();
      expect(metrics.checksPerformed).toBeGreaterThan(0);
    });
  });

  describe('Limit Clearing', () => {
    it('should clear provider limit manually', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      expect(manager.isProviderLimited('openai').isLimited).toBe(true);

      await manager.clearLimit('openai', 'manual');

      expect(manager.isProviderLimited('openai').isLimited).toBe(false);
    });

    it('should emit limit-cleared event', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      let eventEmitted = false;
      manager.on('limit-cleared', (data) => {
        eventEmitted = true;
        expect(data.providerName).toBe('openai');
        expect(data.reason).toBe('manual');
      });

      await manager.clearLimit('openai', 'manual');

      expect(eventEmitted).toBe(true);
    });

    it('should update metrics on clear', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      await manager.clearLimit('openai');

      const metrics = manager.getMetrics();
      expect(metrics.limitsCleared).toBe(1);
    });

    it('should handle clearing non-existent limit', async () => {
      await expect(manager.clearLimit('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Expired Limit Refresh', () => {
    it('should refresh expired limits', async () => {
      const expiredResetMs = Date.now() - 1000; // 1 second ago
      const futureResetMs = Date.now() + 3600000; // 1 hour from now

      await manager.recordLimitHit('openai', 'daily', expiredResetMs);
      await manager.recordLimitHit('gemini-cli', 'daily', futureResetMs);

      const refreshedProviders = await manager.refreshExpired();

      expect(refreshedProviders).toEqual(['openai']);
      expect(manager.isProviderLimited('openai').isLimited).toBe(false);
      expect(manager.isProviderLimited('gemini-cli').isLimited).toBe(true);
    });

    it('should return empty array when no expired limits', async () => {
      const futureResetMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', futureResetMs);

      const refreshedProviders = await manager.refreshExpired();

      expect(refreshedProviders).toEqual([]);
    });

    it('should handle multiple expired limits', async () => {
      const expiredResetMs = Date.now() - 1000;

      await manager.recordLimitHit('openai', 'daily', expiredResetMs);
      await manager.recordLimitHit('gemini-cli', 'daily', expiredResetMs);
      await manager.recordLimitHit('claude-code', 'weekly', expiredResetMs);

      const refreshedProviders = await manager.refreshExpired();

      expect(refreshedProviders).toHaveLength(3);
      expect(refreshedProviders).toContain('openai');
      expect(refreshedProviders).toContain('gemini-cli');
      expect(refreshedProviders).toContain('claude-code');
    });
  });

  describe('Manual Override', () => {
    it('should set manual override', async () => {
      await manager.setManualOverride('openai');

      const override = manager.getManualOverride();
      expect(override).toBeDefined();
      expect(override?.provider).toBe('openai');
      expect(override?.expiresAtMs).toBeUndefined();
    });

    it('should set manual override with expiry', async () => {
      const expiresAtMs = Date.now() + 3600000;
      await manager.setManualOverride('openai', expiresAtMs);

      const override = manager.getManualOverride();
      expect(override?.expiresAtMs).toBe(expiresAtMs);
    });

    it('should bypass limit check with manual override', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      // Provider should be limited
      expect(manager.isProviderLimited('openai').isLimited).toBe(true);

      // Set manual override
      await manager.setManualOverride('openai');

      // Now should not be limited
      expect(manager.isProviderLimited('openai').isLimited).toBe(false);
    });

    it('should clear manual override', async () => {
      await manager.setManualOverride('openai');
      expect(manager.getManualOverride()).toBeDefined();

      await manager.clearManualOverride();
      expect(manager.getManualOverride()).toBeUndefined();
    });

    it('should emit override-set event', async () => {
      let eventEmitted = false;
      const expiresAtMs = Date.now() + 3600000;

      manager.on('override-set', (data) => {
        eventEmitted = true;
        expect(data.provider).toBe('openai');
        expect(data.expiresAtMs).toBe(expiresAtMs);
      });

      await manager.setManualOverride('openai', expiresAtMs);

      expect(eventEmitted).toBe(true);
    });

    it('should auto-clear expired override', async () => {
      const expiresAtMs = Date.now() - 1000; // Expired
      await manager.setManualOverride('openai', expiresAtMs);

      const override = manager.getManualOverride();
      expect(override).toBeUndefined();
    });
  });

  describe('State Persistence', () => {
    it('should persist state to disk', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);

      const stateFile = path.join(testStateDir, 'provider-limits.json');
      const fileExists = existsSync(stateFile);

      expect(fileExists).toBe(true);
    });

    it('should load state from disk on initialization', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs, {
        reason: 'test_reason'
      });

      // Create new instance (simulates restart)
      ProviderLimitManager.resetInstance();
      const newManager = ProviderLimitManager.getInstance(testStateDir);
      await newManager.initialize();

      const result = newManager.isProviderLimited('openai');
      expect(result.isLimited).toBe(true);
      expect(result.resetAtMs).toBe(resetAtMs);
      expect(result.reason).toBe('test_reason');
    });

    it('should persist manual override', async () => {
      await manager.setManualOverride('openai');

      // Create new instance
      ProviderLimitManager.resetInstance();
      const newManager = ProviderLimitManager.getInstance(testStateDir);
      await newManager.initialize();

      const override = newManager.getManualOverride();
      expect(override?.provider).toBe('openai');
    });

    it('should handle corrupted state file gracefully', async () => {
      // Write invalid JSON
      const stateFile = path.join(testStateDir, 'provider-limits.json');
      await fs.mkdir(path.dirname(stateFile), { recursive: true });
      await fs.writeFile(stateFile, 'invalid json{{{', 'utf-8');

      // Should not throw
      ProviderLimitManager.resetInstance();
      const newManager = ProviderLimitManager.getInstance(testStateDir);
      await expect(newManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should get all provider states', async () => {
      const resetAtMs1 = Date.now() + 3600000;
      const resetAtMs2 = Date.now() + 7200000;

      await manager.recordLimitHit('openai', 'daily', resetAtMs1);
      await manager.recordLimitHit('gemini-cli', 'daily', resetAtMs2);

      const states = manager.getAllStates();

      expect(states.size).toBe(2);
      expect(states.has('openai')).toBe(true);
      expect(states.has('gemini-cli')).toBe(true);
    });

    it('should get next reset time', async () => {
      const resetAtMs1 = Date.now() + 3600000; // 1 hour
      const resetAtMs2 = Date.now() + 7200000; // 2 hours

      await manager.recordLimitHit('openai', 'daily', resetAtMs1);
      await manager.recordLimitHit('gemini-cli', 'daily', resetAtMs2);

      const nextReset = manager.getNextReset();

      expect(nextReset).toBeDefined();
      expect(nextReset?.providerName).toBe('openai');
      expect(nextReset?.resetAtMs).toBe(resetAtMs1);
    });

    it('should return null when no limits', () => {
      const nextReset = manager.getNextReset();
      expect(nextReset).toBeNull();
    });

    it('should calculate daily reset time', () => {
      const resetAtMs = manager.calculateResetTime('openai', 'daily');
      const resetDate = new Date(resetAtMs);

      // Should be tomorrow at midnight UTC
      expect(resetDate.getUTCHours()).toBe(0);
      expect(resetDate.getUTCMinutes()).toBe(0);
      expect(resetDate > new Date()).toBe(true);
    });

    it('should calculate weekly reset time', () => {
      const resetAtMs = manager.calculateResetTime('claude-code', 'weekly');
      const resetDate = new Date(resetAtMs);

      // Should be 7 days from now at midnight UTC
      const daysFromNow = (resetAtMs - Date.now()) / (1000 * 60 * 60 * 24);
      expect(daysFromNow).toBeGreaterThan(6);
      expect(daysFromNow).toBeLessThan(8);
      expect(resetDate.getUTCHours()).toBe(0);
    });

    it('should use retry-after when provided', () => {
      const retryAfterSeconds = 3600; // 1 hour
      const resetAtMs = manager.calculateResetTime('openai', 'daily', retryAfterSeconds);

      const expectedResetMs = Date.now() + (retryAfterSeconds * 1000);
      const diff = Math.abs(resetAtMs - expectedResetMs);

      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it('should serialize state correctly', async () => {
      const resetAtMs = Date.now() + 3600000;
      await manager.recordLimitHit('openai', 'daily', resetAtMs);
      await manager.setManualOverride('gemini-cli');

      const serialized = manager.serialize();

      expect(serialized.schemaVersion).toBe(1);
      expect(serialized.providers).toHaveProperty('openai');
      expect(serialized.manualOverride?.provider).toBe('gemini-cli');
    });
  });

  describe('Performance', () => {
    it('should handle many providers efficiently', async () => {
      const providers = Array.from({ length: 100 }, (_, i) => `provider-${i}`);
      const resetAtMs = Date.now() + 3600000;

      // Record limits for all providers
      for (const provider of providers) {
        await manager.recordLimitHit(provider, 'daily', resetAtMs);
      }

      // Check should still be fast
      const startTime = performance.now();
      for (const provider of providers) {
        manager.isProviderLimited(provider);
      }
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // < 10ms for 100 checks
    });

    // NOTE: Flaky performance test - timing-dependent, can fail on slow systems
    // TODO v5.8: Make performance test more robust or move to separate suite
    it.skip('should have O(1) lookup time', async () => {
      const resetAtMs = Date.now() + 3600000;

      // Add 10 providers
      for (let i = 0; i < 10; i++) {
        await manager.recordLimitHit(`provider-${i}`, 'daily', resetAtMs);
      }

      const time1 = performance.now();
      manager.isProviderLimited('provider-5');
      const duration1 = performance.now() - time1;

      // Add 90 more providers (100 total)
      for (let i = 10; i < 100; i++) {
        await manager.recordLimitHit(`provider-${i}`, 'daily', resetAtMs);
      }

      const time2 = performance.now();
      manager.isProviderLimited('provider-5');
      const duration2 = performance.now() - time2;

      // Duration should be similar (O(1))
      const ratio = duration2 / duration1;
      expect(ratio).toBeLessThan(2); // Should not scale linearly
    });
  });

  describe('Error Handling', () => {
    it('should handle missing state directory', async () => {
      const nonExistentDir = path.join(testStateDir, 'nonexistent');
      ProviderLimitManager.resetInstance();

      const newManager = ProviderLimitManager.getInstance(nonExistentDir);
      await expect(newManager.initialize()).resolves.not.toThrow();
    });

    it('should handle file system errors gracefully', async () => {
      // Try to record limit (triggers save)
      const resetAtMs = Date.now() + 3600000;

      // This should not throw even if FS operations fail
      await expect(
        manager.recordLimitHit('openai', 'daily', resetAtMs)
      ).resolves.not.toThrow();
    });
  });
});

describe('getProviderLimitManager', () => {
  afterEach(() => {
    ProviderLimitManager.resetInstance();
  });

  it('should return singleton instance', async () => {
    const instance1 = await getProviderLimitManager();
    const instance2 = await getProviderLimitManager();
    expect(instance1).toBe(instance2);
  });

  it('should use default directory', async () => {
    const instance = await getProviderLimitManager();
    expect(instance).toBeDefined();
  });

  it('should accept custom directory', async () => {
    const customDir = './custom-state';
    const instance = await getProviderLimitManager(customDir);
    expect(instance).toBeDefined();
  });
});
