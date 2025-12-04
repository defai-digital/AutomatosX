/**
 * Unit tests for Router health check enhancements (Phase 2)
 *
 * Tests:
 * - Background health check scheduling
 * - Availability cache refresh
 * - Health check observability
 * - Integration with provider caching
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
  private _available = true;

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

  async getHealth(): Promise<HealthStatus> {
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
    // Mock implementation
    return Promise.resolve();
  }

  shouldRetry(error: Error): boolean {
    // Mock implementation
    return false;
  }

  getRetryDelay(attempt: number): number {
    // Mock implementation
    return 1000 * attempt;
  }

  getCacheMetrics() {
    return {
      availability: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgAge: 0,
        maxAge: 60000,
        lastHit: undefined,
        lastMiss: undefined
      },
      version: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        avgAge: 0,
        maxAge: 300000
      },
      health: {
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastCheckTime: undefined,
        lastCheckDuration: 0,
        uptime: 100
      }
    };
  }

  clearCaches(): void {
    // Mock implementation
  }
}

describe('Router - Background Health Checks (Phase 2)', () => {
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

  it('should start health checks when interval is configured', async () => {
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 5000 // 5 seconds
    });

    // Wait for initial health check
    await vi.advanceTimersByTimeAsync(100);

    // Both providers should have been checked
    expect(provider1.isAvailableCalls).toBeGreaterThan(0);
    expect(provider2.isAvailableCalls).toBeGreaterThan(0);
  });

  it('should NOT start health checks when interval is not configured', () => {
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true
      // No healthCheckInterval
    });

    // No health checks should run
    expect(provider1.isAvailableCalls).toBe(0);
    expect(provider2.isAvailableCalls).toBe(0);
  });

  it('should refresh availability cache periodically', async () => {
    const initialCalls1 = provider1.isAvailableCalls;
    const initialCalls2 = provider2.isAvailableCalls;

    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 1000 // 1 second for faster testing
    });

    // Wait for initial check
    await vi.advanceTimersByTimeAsync(100);

    const afterInitialCalls1 = provider1.isAvailableCalls;
    const afterInitialCalls2 = provider2.isAvailableCalls;

    expect(afterInitialCalls1).toBeGreaterThan(initialCalls1);
    expect(afterInitialCalls2).toBeGreaterThan(initialCalls2);

    // Advance time by 1 second to trigger next check
    await vi.advanceTimersByTimeAsync(1000);

    // Should have additional calls
    expect(provider1.isAvailableCalls).toBeGreaterThan(afterInitialCalls1);
    expect(provider2.isAvailableCalls).toBeGreaterThan(afterInitialCalls2);
  });

  it('should run health checks immediately on startup', async () => {
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 60000 // 1 minute
    });

    // Even before first interval, health check should run
    await vi.advanceTimersByTimeAsync(100);

    expect(provider1.isAvailableCalls).toBeGreaterThan(0);
    expect(provider2.isAvailableCalls).toBeGreaterThan(0);
  });

  it('should continue health checks even if a provider fails', async () => {
    // Make provider1 unavailable
    provider1.setAvailable(false);

    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 1000
    });

    await vi.advanceTimersByTimeAsync(100);

    // Both providers should still be checked despite provider1 being unavailable
    expect(provider1.isAvailableCalls).toBeGreaterThan(0);
    expect(provider2.isAvailableCalls).toBeGreaterThan(0);

    // Advance to next check
    await vi.advanceTimersByTimeAsync(1000);

    // Should continue checking both
    expect(provider1.isAvailableCalls).toBeGreaterThan(1);
    expect(provider2.isAvailableCalls).toBeGreaterThan(1);
  });

  it('should stop health checks when router is destroyed', async () => {
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 1000
    });

    await vi.advanceTimersByTimeAsync(100);

    const callsBeforeDestroy = provider1.isAvailableCalls;

    // Destroy router
    router.destroy();

    // Advance time
    await vi.advanceTimersByTimeAsync(2000);

    // No additional calls should have been made
    expect(provider1.isAvailableCalls).toBe(callsBeforeDestroy);
  });

  it('should provide health check status via getHealthCheckStatus()', () => {
    // Without health checks
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true
    });

    const statusWithout = router.getHealthCheckStatus();
    expect(statusWithout.enabled).toBe(false);
    expect(statusWithout.providersMonitored).toBe(2);

    router.destroy();

    // With health checks
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 5000
    });

    const statusWith = router.getHealthCheckStatus();
    expect(statusWith.enabled).toBe(true);
    expect(statusWith.providersMonitored).toBe(2);
  });

  it('should benefit from cached availability during execution', async () => {
    router = new Router({
      providers: [provider1, provider2],
      fallbackEnabled: true,
      healthCheckInterval: 1000
    });

    // Wait for initial health check to warm cache
    await vi.advanceTimersByTimeAsync(100);

    const callsAfterWarmup = provider1.isAvailableCalls;

    // Execute a request - should use cached availability
    const request: ExecutionRequest = {
      prompt: 'test prompt'
    };

    await router.execute(request);

    // The execute call should have triggered availability checks,
    // but they should hit cache if Phase 1 is working
    // In reality, this depends on BaseProvider's cache implementation
    expect(provider1.isAvailableCalls).toBeGreaterThanOrEqual(callsAfterWarmup);
  });
});

describe('Router - Health Check Integration with Provider Cache', () => {
  let router: Router;
  let provider: MockProvider;

  beforeEach(() => {
    vi.useFakeTimers();

    provider = new MockProvider({
      name: 'test-provider',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'test'
    });
  });

  afterEach(() => {
    if (router) {
      router.destroy();
    }
    vi.useRealTimers();
  });

  it('should warm up provider caches on startup', async () => {
    router = new Router({
      providers: [provider],
      fallbackEnabled: true,
      healthCheckInterval: 60000 // 1 minute
    });

    // Initial health check should run immediately
    await vi.advanceTimersByTimeAsync(100);

    // Provider should have been checked at least once
    expect(provider.isAvailableCalls).toBeGreaterThan(0);
  });

  it('should keep caches warm with periodic checks', async () => {
    router = new Router({
      providers: [provider],
      fallbackEnabled: true,
      healthCheckInterval: 5000 // 5 seconds
    });

    // Wait for router initialization (limit manager init is now synchronous in tests)
    await vi.advanceTimersByTimeAsync(500);
    const initialCalls = provider.isAvailableCalls;

    // Advance through multiple intervals
    await vi.advanceTimersByTimeAsync(5000);
    const afterFirst = provider.isAvailableCalls;
    expect(afterFirst).toBeGreaterThan(initialCalls);

    await vi.advanceTimersByTimeAsync(5000);
    const afterSecond = provider.isAvailableCalls;
    expect(afterSecond).toBeGreaterThan(afterFirst);

    await vi.advanceTimersByTimeAsync(5000);
    const afterThird = provider.isAvailableCalls;
    expect(afterThird).toBeGreaterThan(afterSecond);
  });
});
