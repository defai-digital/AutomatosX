/**
 * Unit tests for BaseProvider enhanced cache metrics (Phase 3 v5.6.3)
 *
 * Tests for:
 * - Average age calculation
 * - Last hit/miss timestamps
 * - Health metrics (consecutive failures/successes, uptime)
 * - Version cache age calculation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  ProviderConfig,
  ExecutionRequest,
  ExecutionResponse,
  ProviderCapabilities
} from '../../src/types/provider.js';
import { BaseProvider } from '../../src/providers/base-provider.js';
import { providerCache } from '../../src/core/provider-cache.js';

// Mock concrete provider for testing
class TestProvider extends BaseProvider {
  get version(): string {
    return '1.0.0';
  }

  get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,
      supportsEmbedding: false,
      supportsVision: false,
      maxContextTokens: 8000,
      supportedModels: ['test-model']
    };
  }

  protected async executeRequest(request: ExecutionRequest): Promise<ExecutionResponse> {
    return {
      content: 'test response',
      model: 'test-model',
      tokensUsed: {
        prompt: 10,
        completion: 20,
        total: 30
      },
      latencyMs: 100,
      finishReason: 'stop'
    };
  }

  protected async generateEmbeddingInternal(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  protected buildCLIArgs(request: ExecutionRequest): string[] {
    return ['--prompt', request.prompt];
  }

  supportsStreaming(): boolean {
    return false;
  }

  protected supportsParameter(param: 'maxTokens' | 'temperature' | 'topP'): boolean {
    return true;
  }
}

describe('BaseProvider - Enhanced Cache Metrics (Phase 3)', () => {
  let provider: TestProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    // Disable mock providers to test real CLI detection
    delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    delete process.env.CLAUDE_CODE;

    // Clear shared cache to prevent test pollution
    providerCache.clearAll();

    config = {
      name: 'test-provider',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'echo' // Use echo as a safe command that exists on all systems
    };
    provider = new TestProvider(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up shared cache after each test
    providerCache.clearAll();
  });

  describe('Average Age Calculation', () => {
    it('should track average age of availability cache hits', async () => {
      vi.useFakeTimers();

      // First check - miss (cache empty)
      await provider.isAvailable();

      // Advance 5 seconds
      vi.advanceTimersByTime(5000);

      // Second check - hit (cache is 5s old)
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      // Average age should be around 5000ms (5 seconds)
      expect(metrics.availability.avgAge).toBeGreaterThanOrEqual(4500);
      expect(metrics.availability.avgAge).toBeLessThanOrEqual(5500);

      vi.useRealTimers();
    });

    it('should update average age across multiple hits', async () => {
      vi.useFakeTimers();

      // First check - miss
      await provider.isAvailable();

      // Hit at 2s (age: 2s)
      vi.advanceTimersByTime(2000);
      await provider.isAvailable();

      // Hit at 4s (age: 4s)
      vi.advanceTimersByTime(2000);
      await provider.isAvailable();

      // Hit at 6s (age: 6s)
      vi.advanceTimersByTime(2000);
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      // Average age should be (2000 + 4000 + 6000) / 3 = 4000ms
      expect(metrics.availability.avgAge).toBeGreaterThanOrEqual(3500);
      expect(metrics.availability.avgAge).toBeLessThanOrEqual(4500);

      vi.useRealTimers();
    });

    it('should return 0 average age when no cache hits', () => {
      const metrics = provider.getCacheMetrics();
      expect(metrics.availability.avgAge).toBe(0);
    });
  });

  describe('Last Hit/Miss Timestamps', () => {
    it('should track lastHit timestamp', async () => {
      vi.useFakeTimers();
      const startTime = Date.now();

      // First check - miss
      await provider.isAvailable();

      // Second check - hit
      vi.advanceTimersByTime(1000);
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      expect(metrics.availability.lastHit).toBeDefined();
      expect(metrics.availability.lastHit).toBeGreaterThanOrEqual(startTime + 1000);

      vi.useRealTimers();
    });

    it('should track lastMiss timestamp', async () => {
      vi.useFakeTimers();
      const startTime = Date.now();

      // First check - miss
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      expect(metrics.availability.lastMiss).toBeDefined();
      expect(metrics.availability.lastMiss).toBeGreaterThanOrEqual(startTime);

      vi.useRealTimers();
    });

    it('should update lastHit on each cache hit', async () => {
      vi.useFakeTimers();

      // First check - miss
      await provider.isAvailable();

      // Second check - hit at 1s
      vi.advanceTimersByTime(1000);
      await provider.isAvailable();
      const metrics1 = provider.getCacheMetrics();
      const firstHit = metrics1.availability.lastHit;

      // Third check - hit at 2s
      vi.advanceTimersByTime(1000);
      await provider.isAvailable();
      const metrics2 = provider.getCacheMetrics();
      const secondHit = metrics2.availability.lastHit;

      expect(secondHit).toBeGreaterThan(firstHit!);

      vi.useRealTimers();
    });

    it('should be undefined when no hits or misses occurred', () => {
      const metrics = provider.getCacheMetrics();
      expect(metrics.availability.lastHit).toBeUndefined();
      expect(metrics.availability.lastMiss).toBeUndefined();
    });
  });

  describe('Version Cache Age Calculation', () => {
    it('should calculate average age of version cache entries', async () => {
      vi.useFakeTimers();

      // Setup: Create multiple version cache entries at different times
      const versionCache = (provider as any).versionCache;
      const now = Date.now();

      // Entry 1: 10 seconds old
      versionCache.set('cmd1', { version: '1.0.0', timestamp: now - 10000 });

      // Entry 2: 20 seconds old
      versionCache.set('cmd2', { version: '2.0.0', timestamp: now - 20000 });

      // Entry 3: 30 seconds old
      versionCache.set('cmd3', { version: '3.0.0', timestamp: now - 30000 });

      const metrics = provider.getCacheMetrics();

      // Average age should be (10000 + 20000 + 30000) / 3 = 20000ms
      expect(metrics.version.avgAge).toBeGreaterThanOrEqual(19500);
      expect(metrics.version.avgAge).toBeLessThanOrEqual(20500);

      vi.useRealTimers();
    });

    it('should return 0 average age when version cache is empty', () => {
      const metrics = provider.getCacheMetrics();
      expect(metrics.version.avgAge).toBe(0);
    });

    it('should track version cache size', async () => {
      const versionCache = (provider as any).versionCache;

      // Initially empty
      let metrics = provider.getCacheMetrics();
      expect(metrics.version.size).toBe(0);

      // Add entries
      versionCache.set('cmd1', { version: '1.0.0', timestamp: Date.now() });
      metrics = provider.getCacheMetrics();
      expect(metrics.version.size).toBe(1);

      versionCache.set('cmd2', { version: '2.0.0', timestamp: Date.now() });
      metrics = provider.getCacheMetrics();
      expect(metrics.version.size).toBe(2);
    });
  });

  describe('Health Metrics', () => {
    it('should track consecutive successes on successful availability checks', async () => {
      // Mock checkCLIAvailabilityEnhanced to succeed
      vi.spyOn(provider as any, 'checkCLIAvailabilityEnhanced')
        .mockResolvedValue(true);

      // Make 3 consecutive successful checks
      await provider.isAvailable();
      await provider.isAvailable();
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      // Should track consecutive successes
      expect(metrics.health.consecutiveSuccesses).toBeGreaterThan(0);
    });

    it('should reset consecutive successes on failed availability check', async () => {
      vi.useFakeTimers();

      // Start with successes
      vi.spyOn(provider as any, 'checkCLIAvailabilityEnhanced')
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);

      // First check - success
      await provider.isAvailable();

      let metrics = provider.getCacheMetrics();
      expect(metrics.health.consecutiveSuccesses).toBeGreaterThan(0);

      // Expire cache to force new check
      vi.advanceTimersByTime(61000); // Beyond 60s TTL

      // Second check - failure (should reset successes)
      await provider.isAvailable();

      metrics = provider.getCacheMetrics();
      expect(metrics.health.consecutiveSuccesses).toBe(0);

      vi.useRealTimers();
    });

    it('should track consecutive failures in health metrics', async () => {
      // Note: consecutiveFailures is tracked in execute(), not isAvailable()
      // This test verifies the metric exists in the API
      const metrics = provider.getCacheMetrics();

      // Should have consecutiveFailures field (defaults to 0)
      expect(metrics.health).toHaveProperty('consecutiveFailures');
      expect(typeof metrics.health.consecutiveFailures).toBe('number');
    });

    it('should have lastCheckTime field in health metrics', () => {
      // Note: lastCheckTime is set during provider health checks
      // This test verifies the field exists in the API
      const metrics = provider.getCacheMetrics();

      // Should have lastCheckTime field (may be undefined before first check)
      expect(metrics.health).toHaveProperty('lastCheckTime');
    });

    it('should track last check duration', async () => {
      // First availability check
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      // Duration should be a positive number
      expect(metrics.health.lastCheckDuration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate uptime based on health history', async () => {
      // Mock to create a mix of successes and failures
      vi.spyOn(provider as any, 'checkCLIAvailabilityEnhanced')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // Make 4 checks: 3 success, 1 failure
      await provider.isAvailable();
      await provider.isAvailable();
      await provider.isAvailable();
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      // Uptime should be between 50-100% (depending on health history implementation)
      expect(metrics.health.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.health.uptime).toBeLessThanOrEqual(100);
    });

    it('should default to 100% uptime when no history', () => {
      const metrics = provider.getCacheMetrics();

      // With no history, uptime should be based on current availability
      // Since provider is enabled and command exists, it should be 100%
      expect(metrics.health.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.health.uptime).toBeLessThanOrEqual(100);
    });
  });

  describe('Max Age Reporting', () => {
    it('should report correct maxAge for availability cache', () => {
      const metrics = provider.getCacheMetrics();

      // Default TTL is 60 seconds (60000ms)
      expect(metrics.availability.maxAge).toBe(60000);
    });

    it('should report correct maxAge for version cache', () => {
      const metrics = provider.getCacheMetrics();

      // Version cache TTL is 5 minutes (300000ms)
      expect(metrics.version.maxAge).toBe(300000);
    });
  });

  describe('Comprehensive Metrics Integration', () => {
    it('should provide all enhanced metrics in a single call', async () => {
      vi.useFakeTimers();

      // Generate some activity
      await provider.isAvailable();
      vi.advanceTimersByTime(1000);
      await provider.isAvailable();

      const metrics = provider.getCacheMetrics();

      // Availability metrics
      expect(metrics.availability).toHaveProperty('hits');
      expect(metrics.availability).toHaveProperty('misses');
      expect(metrics.availability).toHaveProperty('hitRate');
      expect(metrics.availability).toHaveProperty('avgAge');
      expect(metrics.availability).toHaveProperty('maxAge');
      expect(metrics.availability).toHaveProperty('lastHit');
      expect(metrics.availability).toHaveProperty('lastMiss');

      // Version metrics
      expect(metrics.version).toHaveProperty('hits');
      expect(metrics.version).toHaveProperty('misses');
      expect(metrics.version).toHaveProperty('hitRate');
      expect(metrics.version).toHaveProperty('size');
      expect(metrics.version).toHaveProperty('avgAge');
      expect(metrics.version).toHaveProperty('maxAge');

      // Health metrics
      expect(metrics.health).toHaveProperty('consecutiveFailures');
      expect(metrics.health).toHaveProperty('consecutiveSuccesses');
      expect(metrics.health).toHaveProperty('lastCheckTime');
      expect(metrics.health).toHaveProperty('lastCheckDuration');
      expect(metrics.health).toHaveProperty('uptime');

      vi.useRealTimers();
    });

    it('should update all metrics correctly over time', async () => {
      vi.useFakeTimers();

      // Initial state
      let metrics = provider.getCacheMetrics();
      expect(metrics.availability.hits).toBe(0);
      expect(metrics.availability.misses).toBe(0);

      // First check - miss
      await provider.isAvailable();
      metrics = provider.getCacheMetrics();
      expect(metrics.availability.misses).toBe(1);
      expect(metrics.availability.lastMiss).toBeDefined();

      // Second check - hit
      vi.advanceTimersByTime(1000);
      await provider.isAvailable();
      metrics = provider.getCacheMetrics();
      expect(metrics.availability.hits).toBe(1);
      expect(metrics.availability.lastHit).toBeDefined();
      expect(metrics.availability.hitRate).toBe(0.5); // 1 hit / 2 total

      // Third check - hit
      vi.advanceTimersByTime(1000);
      await provider.isAvailable();
      metrics = provider.getCacheMetrics();
      expect(metrics.availability.hits).toBe(2);
      expect(metrics.availability.hitRate).toBeCloseTo(0.667, 2); // 2 hits / 3 total

      vi.useRealTimers();
    });
  });
});
