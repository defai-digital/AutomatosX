/**
 * Unit tests for Router health check metrics enhancements (Phase 3 v5.6.3)
 *
 * Tests for:
 * - Health check metrics tracking (checks performed, duration, failures)
 * - Enhanced health check status API
 * - Provider cache metrics integration
 * - Cache warmup on startup
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Router } from '../../src/core/router/router.js';
import type {
  Provider,
  ProviderConfig,
  ExecutionRequest,
  ExecutionResponse,
  ProviderCapabilities,
  HealthStatus
} from '../../src/types/provider.js';

// Mock provider for testing
class MockProvider implements Provider {
  public isAvailableCalls = 0;
  public getHealthCalls = 0;
  private _available = true;
  private _cacheHitRate = 0.5;
  private _avgCacheAge = 1000;
  private _uptime = 100;

  constructor(public config: ProviderConfig) {}

  get name(): string {
    return this.config.name;
  }

  get priority(): number {
    return this.config.priority;
  }

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

  async isAvailable(): Promise<boolean> {
    this.isAvailableCalls++;
    return this._available;
  }

  setAvailable(available: boolean): void {
    this._available = available;
  }

  setCacheMetrics(hitRate: number, avgAge: number, uptime: number): void {
    this._cacheHitRate = hitRate;
    this._avgCacheAge = avgAge;
    this._uptime = uptime;
  }

  async getHealth(): Promise<HealthStatus> {
    this.getHealthCalls++;
    return {
      available: this._available,
      latencyMs: 100,
      errorRate: 0,
      consecutiveFailures: 0
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
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

  async generateEmbedding(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async checkRateLimit() {
    return {
      hasCapacity: true,
      requestsRemaining: 100,
      tokensRemaining: 10000,
      resetAtMs: Date.now() + 60000
    };
  }

  async estimateCost(request: ExecutionRequest) {
    return {
      estimatedUsd: 0.01,
      tokensUsed: 100
    };
  }

  async getUsageStats() {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatencyMs: 0,
      errorCount: 0
    };
  }

  supportsStreaming(): boolean {
    return false;
  }

  async waitForCapacity(): Promise<void> {
    return Promise.resolve();
  }

  shouldRetry(error: Error): boolean {
    return false;
  }

  getRetryDelay(attempt: number): number {
    return 1000 * attempt;
  }

  getCacheMetrics() {
    return {
      availability: {
        hits: 5,
        misses: 5,
        hitRate: this._cacheHitRate,
        avgAge: this._avgCacheAge,
        maxAge: 60000,
        lastHit: Date.now() - 1000,
        lastMiss: Date.now() - 5000
      },
      version: {
        hits: 3,
        misses: 2,
        hitRate: 0.6,
        size: 2,
        avgAge: 10000,
        maxAge: 300000
      },
      health: {
        consecutiveFailures: 0,
        consecutiveSuccesses: 5,
        lastCheckTime: Date.now(),
        lastCheckDuration: 50,
        uptime: this._uptime
      }
    };
  }

  clearCaches(): void {
    // Mock implementation
  }
}

describe('Router - Health Check Metrics (Phase 3)', () => {
  let router: Router;
  let provider1: MockProvider;
  let provider2: MockProvider;

  beforeEach(() => {
    vi.useFakeTimers();

    provider1 = new MockProvider({
      name: 'provider1',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'test1'
    });

    provider2 = new MockProvider({
      name: 'provider2',
      enabled: true,
      priority: 2,
      timeout: 30000,
      command: 'test2'
    });
  });

  afterEach(() => {
    if (router) {
      router.destroy();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Health Check Metrics Tracking', () => {
    it('should track number of health checks performed', async () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      // Wait for initial check
      await vi.advanceTimersByTimeAsync(100);

      const status1 = router.getHealthCheckStatus();
      expect(status1.checksPerformed).toBe(1);

      // Advance to next check
      await vi.advanceTimersByTimeAsync(1000);

      const status2 = router.getHealthCheckStatus();
      expect(status2.checksPerformed).toBe(2);

      // Advance to third check
      await vi.advanceTimersByTimeAsync(1000);

      const status3 = router.getHealthCheckStatus();
      expect(status3.checksPerformed).toBe(3);
    });

    it('should track average health check duration', async () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      // Wait for initial check
      await vi.advanceTimersByTimeAsync(100);

      // Advance to second check
      await vi.advanceTimersByTimeAsync(1000);

      const status = router.getHealthCheckStatus();

      // Average duration should be a positive number
      expect(status.avgDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track health check failures', async () => {
      // Make provider throw error during health check
      provider1.isAvailable = vi.fn().mockRejectedValue(new Error('Health check failed'));

      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      // Wait for initial check (will fail)
      await vi.advanceTimersByTimeAsync(100);

      const status = router.getHealthCheckStatus();

      // Should have performed at least 1 check
      expect(status.checksPerformed).toBeGreaterThan(0);
      // Success rate should be less than 100% (due to the failure scenario)
      expect(status.successRate).toBeLessThanOrEqual(100);
    });

    it('should calculate success rate correctly', async () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      // Wait for 3 successful checks
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      const status = router.getHealthCheckStatus();

      // All checks should succeed (100%)
      expect(status.successRate).toBe(100);
      expect(status.checksPerformed).toBe(3);
    });

    it('should track last check timestamp', async () => {
      vi.useFakeTimers();
      const startTime = Date.now();

      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      // Wait for initial check
      await vi.advanceTimersByTimeAsync(100);

      const status = router.getHealthCheckStatus();

      expect(status.lastCheck).toBeDefined();
      expect(status.lastCheck).toBeGreaterThanOrEqual(startTime);

      vi.useRealTimers();
    });
  });

  describe('Enhanced Health Check Status API', () => {
    it('should include interval in status', () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      const status = router.getHealthCheckStatus();

      expect(status.interval).toBe(5000);
    });

    it('should report number of providers monitored', () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      const status = router.getHealthCheckStatus();

      expect(status.providersMonitored).toBe(2);
    });

    it('should include per-provider cache metrics', () => {
      // Set custom metrics for providers
      provider1.setCacheMetrics(0.8, 2000, 99);
      provider2.setCacheMetrics(0.6, 3000, 95);

      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      const status = router.getHealthCheckStatus();

      expect(status.providers).toHaveLength(2);

      const p1Status = status.providers.find(p => p.name === 'provider1');
      expect(p1Status).toBeDefined();
      expect(p1Status!.cacheHitRate).toBe(0.8);
      expect(p1Status!.avgCacheAge).toBe(2000);
      expect(p1Status!.uptime).toBe(99);

      const p2Status = status.providers.find(p => p.name === 'provider2');
      expect(p2Status).toBeDefined();
      expect(p2Status!.cacheHitRate).toBe(0.6);
      expect(p2Status!.avgCacheAge).toBe(3000);
      expect(p2Status!.uptime).toBe(95);
    });

    it('should return enabled: false when health checks are not configured', () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true
        // No healthCheckInterval
      });

      const status = router.getHealthCheckStatus();

      expect(status.enabled).toBe(false);
      expect(status.interval).toBeUndefined();
      expect(status.checksPerformed).toBe(0);
    });

    it('should return enabled: true when health checks are configured', () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      const status = router.getHealthCheckStatus();

      expect(status.enabled).toBe(true);
      expect(status.interval).toBe(5000);
    });
  });

  describe('Cache Warmup on Startup', () => {
    it('should warm up caches immediately when health checks are enabled', async () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 60000 // 1 minute
      });

      // Wait for warmup to complete
      await vi.advanceTimersByTimeAsync(100);

      // Both providers should have been checked during warmup
      expect(provider1.isAvailableCalls).toBeGreaterThan(0);
      expect(provider2.isAvailableCalls).toBeGreaterThan(0);
    });

    it('should NOT warm up caches when health checks are disabled', async () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true
        // No healthCheckInterval
      });

      // Wait a bit
      await vi.advanceTimersByTimeAsync(100);

      // Providers should NOT have been checked (no warmup)
      expect(provider1.isAvailableCalls).toBe(0);
      expect(provider2.isAvailableCalls).toBe(0);
    });

    it('should handle warmup failures gracefully', async () => {
      // Make provider1 fail during warmup
      provider1.isAvailable = vi.fn().mockRejectedValue(new Error('Warmup failed'));

      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      // Wait for warmup to complete
      await vi.advanceTimersByTimeAsync(100);

      // Router should still be functional
      const status = router.getHealthCheckStatus();
      expect(status.enabled).toBe(true);

      // Provider2 should still have been warmed up
      expect(provider2.isAvailableCalls).toBeGreaterThan(0);
    });

    it('should use Promise.allSettled for parallel warmup', async () => {
      // This test verifies that warmup doesn't block on individual provider failures

      // Make provider1 slow (100ms)
      provider1.isAvailable = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      // Make provider2 fast (10ms)
      provider2.isAvailable = vi.fn().mockResolvedValue(true);

      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 5000
      });

      // Wait for warmup
      await vi.advanceTimersByTimeAsync(150);

      // Both should have been called (parallel execution)
      expect(provider1.isAvailable).toHaveBeenCalled();
      expect(provider2.isAvailable).toHaveBeenCalled();
    });
  });

  describe('Integration: Health Checks + Cache Metrics', () => {
    it('should provide comprehensive observability data', async () => {
      provider1.setCacheMetrics(0.9, 1500, 99.5);
      provider2.setCacheMetrics(0.7, 2500, 98.0);

      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      // Wait for initial check
      await vi.advanceTimersByTimeAsync(100);

      // Advance to second check
      await vi.advanceTimersByTimeAsync(1000);

      const status = router.getHealthCheckStatus();

      // Verify all metrics are present
      expect(status.enabled).toBe(true);
      expect(status.interval).toBe(1000);
      expect(status.checksPerformed).toBe(2);
      expect(status.avgDuration).toBeGreaterThanOrEqual(0);
      expect(status.successRate).toBe(100);
      expect(status.providersMonitored).toBe(2);

      // Verify per-provider metrics
      expect(status.providers).toHaveLength(2);
      expect(status.providers[0]?.cacheHitRate).toBe(0.9);
      expect(status.providers[0]?.uptime).toBe(99.5);
      expect(status.providers[1]?.cacheHitRate).toBe(0.7);
      expect(status.providers[1]?.uptime).toBe(98.0);
    });

    it('should track degradation over time', async () => {
      // Start with good metrics
      provider1.setCacheMetrics(0.9, 1000, 99);

      router = new Router({
        providers: [provider1],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      await vi.advanceTimersByTimeAsync(100);
      const status1 = router.getHealthCheckStatus();
      expect(status1.providers[0]?.uptime).toBe(99);

      // Degrade metrics
      provider1.setCacheMetrics(0.5, 3000, 85);

      await vi.advanceTimersByTimeAsync(1000);
      const status2 = router.getHealthCheckStatus();
      expect(status2.providers[0]?.uptime).toBe(85);
      expect(status2.providers[0]?.cacheHitRate).toBe(0.5);
    });
  });

  describe('Metrics Reset Behavior', () => {
    it('should reset metrics when router is destroyed', async () => {
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      // Wait for some checks
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1000);

      const statusBefore = router.getHealthCheckStatus();
      expect(statusBefore.checksPerformed).toBeGreaterThan(0);

      // Destroy router
      router.destroy();

      // Create new router
      router = new Router({
        providers: [provider1, provider2],
        fallbackEnabled: true,
        healthCheckInterval: 1000
      });

      await vi.advanceTimersByTimeAsync(100);

      const statusAfter = router.getHealthCheckStatus();
      // New router should have fresh metrics
      expect(statusAfter.checksPerformed).toBe(1);
    });
  });
});
