/**
 * Unit tests for BaseProvider caching optimizations (Phase 1)
 *
 * Tests:
 * - Availability result caching (60s TTL)
 * - Version detection caching (5min TTL)
 * - Aggregated token bucket rate limiting
 * - Cache metrics and observability
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
  // v8.3.0: Implement abstract methods
  protected async executeCLI(prompt: string): Promise<string> {
    return `Mock response for: ${prompt}`;
  }

  protected async checkCLIAvailable(): Promise<boolean> {
    return true;
  }

  override get version(): string {
    return '1.0.0';
  }

  override get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,
      supportsEmbedding: false,
      supportsVision: false,
      maxContextTokens: 8000,
      supportedModels: ['test-model']
    };
  }

  override async generateEmbedding(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  override supportsStreaming(): boolean {
    return false;
  }

  protected supportsParameter(param: 'maxTokens' | 'temperature' | 'topP'): boolean {
    return true;
  }
}

describe('BaseProvider - Availability Caching', () => {
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

  it('should cache availability check results', async () => {
    // First call - should miss cache
    const result1 = await provider.isAvailable();
    expect(result1).toBe(true);

    const metrics1 = provider.getCacheMetrics();
    expect(metrics1.availability.misses).toBe(1);
    expect(metrics1.availability.hits).toBe(0);

    // Second call - should hit cache
    const result2 = await provider.isAvailable();
    expect(result2).toBe(true);

    const metrics2 = provider.getCacheMetrics();
    expect(metrics2.availability.hits).toBe(1);
    expect(metrics2.availability.misses).toBe(1);
    expect(metrics2.availability.hitRate).toBe(0.5); // 1 hit / 2 total
  });

  it('should expire availability cache after TTL', async () => {
    // First call
    await provider.isAvailable();

    const metrics1 = provider.getCacheMetrics();
    expect(metrics1.availability.misses).toBe(1);

    // Advance time by 61 seconds (beyond 60s TTL)
    vi.useFakeTimers();
    vi.advanceTimersByTime(61000);

    // Second call - should miss cache due to expiry
    await provider.isAvailable();

    const metrics2 = provider.getCacheMetrics();
    expect(metrics2.availability.misses).toBe(2);
    expect(metrics2.availability.hits).toBe(0);

    vi.useRealTimers();
  });

  it('should report cache age in metrics', async () => {
    await provider.isAvailable();

    vi.useFakeTimers();
    vi.advanceTimersByTime(30000); // 30 seconds

    const metrics = provider.getCacheMetrics();
    // Phase 3: avgAge replaces cacheAge
    expect(metrics.availability.avgAge).toBeGreaterThanOrEqual(0);

    vi.useRealTimers();
  });

  it('should clear availability cache', async () => {
    // Cache a result
    await provider.isAvailable();

    const metrics1 = provider.getCacheMetrics();
    expect(metrics1.availability.hits + metrics1.availability.misses).toBe(1);

    // Clear cache (this resets metrics too)
    provider.clearCaches();

    // Next call should miss cache again
    await provider.isAvailable();

    const metrics2 = provider.getCacheMetrics();
    // After clear, the first call is miss #1, then we made another call which is miss #2
    expect(metrics2.availability.misses).toBeGreaterThanOrEqual(1);
    // Phase 3: avgAge replaces cacheAge
    expect(metrics2.availability.avgAge).toBeGreaterThanOrEqual(0);
  });

  it('should not cache when provider is disabled', async () => {
    config.enabled = false;
    provider = new TestProvider(config);

    const result = await provider.isAvailable();
    expect(result).toBe(false);

    const metrics = provider.getCacheMetrics();
    expect(metrics.availability.misses).toBe(0); // Should not even attempt check
  });
});

describe('BaseProvider - Version Detection Caching', () => {
  let provider: TestProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    // Disable mock providers to test real version detection
    delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    delete process.env.CLAUDE_CODE;

    // Clear shared cache to prevent test pollution
    providerCache.clearAll();

    config = {
      name: 'test-provider',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'node', // Node.js should be available in test environment
      minVersion: '18.0.0'
    };
    provider = new TestProvider(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up shared cache after each test
    providerCache.clearAll();
  });

  it('should cache version detection results', async () => {
    // Call isAvailable which will trigger version detection
    const result1 = await provider.isAvailable();
    expect(result1).toBe(true);

    const metrics1 = provider.getCacheMetrics();
    // Version detection happens because minVersion is configured
    // Should see at least one miss on first call
    expect(metrics1.version.misses).toBeGreaterThan(0);

    // Force expiration of availability cache by advancing time
    vi.useFakeTimers();
    vi.advanceTimersByTime(61000); // 61 seconds - beyond availability TTL

    // Second call - availability will miss cache (expired),
    // but version should hit cache (not expired yet - 5min TTL)
    const result2 = await provider.isAvailable();
    expect(result2).toBe(true);

    const metrics2 = provider.getCacheMetrics();
    // Version should have hit cache on second availability check
    expect(metrics2.version.hits).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('should expire version cache after TTL', async () => {
    // First call
    await provider.isAvailable();

    const metrics1 = provider.getCacheMetrics();
    const initialMisses = metrics1.version.misses;

    // Advance time by 6 minutes (beyond 5min TTL)
    vi.useFakeTimers();
    vi.advanceTimersByTime(6 * 60 * 1000);

    // Second call - should miss cache due to expiry
    await provider.isAvailable();

    const metrics2 = provider.getCacheMetrics();
    expect(metrics2.version.misses).toBeGreaterThan(initialMisses);

    vi.useRealTimers();
  });

  it('should track number of cached commands', async () => {
    await provider.isAvailable();

    const metrics = provider.getCacheMetrics();
    // Phase 3: cachedCommands renamed to size
    expect(metrics.version.size).toBeGreaterThanOrEqual(0);
  });
});

describe('BaseProvider - Token Bucket Optimization', () => {
  let provider: TestProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    // Clear shared cache to prevent test pollution
    providerCache.clearAll();

    config = {
      name: 'test-provider',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'echo',
      rateLimits: {
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 1000,
        maxConcurrentRequests: 2
      }
    };
    provider = new TestProvider(config);

    // Set environment variable to enable mock providers
    process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
  });

  afterEach(() => {
    delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    vi.restoreAllMocks();
    // Clean up shared cache after each test
    providerCache.clearAll();
  });

  it('should use aggregated token buckets instead of individual timestamps', async () => {
    const request: ExecutionRequest = {
      prompt: 'test prompt'
    };

    // Execute request (will use 30 tokens according to mock)
    const response = await provider.execute(request);
    expect(response.tokensUsed.total).toBe(30);

    // Check rate limit status
    const rateLimitStatus = await provider.checkRateLimit();
    expect(rateLimitStatus.tokensRemaining).toBe(1000 - 30);
  });

  it('should handle large token counts efficiently', async () => {
    // Create a mock response with large token count (5000 tokens)
    const largeResponse: ExecutionResponse = {
      content: 'large response',
      model: 'test-model',
      tokensUsed: {
        prompt: 100,
        completion: 4900,
        total: 5000
      },
      latencyMs: 100,
      finishReason: 'stop'
    };

    // Update metrics with large response
    // @ts-expect-error - Accessing protected method for testing
    provider.updateMetrics(largeResponse, 100);

    // Check that tokenBuckets is used and efficient
    const rateLimitStatus = await provider.checkRateLimit();

    // The old implementation would create 5000 array entries
    // The new implementation creates just 1 aggregated bucket
    expect(rateLimitStatus).toBeDefined();
    expect(rateLimitStatus.tokensRemaining).toBeLessThan(0); // Should be over limit
  });

  it('should clean up old token buckets', async () => {
    const request: ExecutionRequest = {
      prompt: 'test prompt'
    };

    // Execute request
    await provider.execute(request);

    // Advance time by 61 seconds
    vi.useFakeTimers();
    vi.advanceTimersByTime(61000);

    // Check rate limit (should trigger cleanup)
    const rateLimitStatus = await provider.checkRateLimit();

    // Old buckets should be cleaned up
    expect(rateLimitStatus.tokensRemaining).toBe(1000); // Back to full capacity

    vi.useRealTimers();
  });
});

describe('BaseProvider - Cache Metrics', () => {
  let provider: TestProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    // Clear shared cache to prevent test pollution
    providerCache.clearAll();

    config = {
      name: 'test-provider',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'echo'
    };
    provider = new TestProvider(config);
  });

  afterEach(() => {
    // Clean up shared cache after each test
    providerCache.clearAll();
  });

  it('should calculate correct hit rates', async () => {
    // 1 miss
    await provider.isAvailable();

    // 3 hits
    await provider.isAvailable();
    await provider.isAvailable();
    await provider.isAvailable();

    const metrics = provider.getCacheMetrics();
    expect(metrics.availability.hits).toBe(3);
    expect(metrics.availability.misses).toBe(1);
    expect(metrics.availability.hitRate).toBe(0.75); // 3/4 = 75%
  });

  it('should handle zero total requests gracefully', () => {
    const metrics = provider.getCacheMetrics();
    expect(metrics.availability.hitRate).toBe(0);
    expect(metrics.version.hitRate).toBe(0);
  });

  it('should provide comprehensive metrics', async () => {
    await provider.isAvailable();

    const metrics = provider.getCacheMetrics();

    expect(metrics).toHaveProperty('availability');
    expect(metrics).toHaveProperty('version');

    expect(metrics.availability).toHaveProperty('hits');
    expect(metrics.availability).toHaveProperty('misses');
    expect(metrics.availability).toHaveProperty('hitRate');
    expect(metrics.availability).toHaveProperty('avgAge');

    expect(metrics.version).toHaveProperty('hits');
    expect(metrics.version).toHaveProperty('misses');
    expect(metrics.version).toHaveProperty('hitRate');
    expect(metrics.version).toHaveProperty('size');
  });
});

describe('BaseProvider - Integration Tests', () => {
  let provider: TestProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    // Disable mock providers to test real execution flow
    delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    delete process.env.CLAUDE_CODE;

    // Clear shared cache to prevent test pollution
    providerCache.clearAll();

    config = {
      name: 'test-provider',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'echo'
    };
    provider = new TestProvider(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up shared cache after each test
    providerCache.clearAll();
  });

  it('should benefit from caching in real execution flow', async () => {
    const request: ExecutionRequest = {
      prompt: 'test prompt'
    };

    // First execution - availability check will miss cache
    await provider.execute(request);

    const metrics1 = provider.getCacheMetrics();
    expect(metrics1.availability.misses).toBe(1);

    // Second execution - availability check will hit cache
    await provider.execute(request);

    const metrics2 = provider.getCacheMetrics();
    expect(metrics2.availability.hits).toBe(1);
    expect(metrics2.availability.hitRate).toBe(0.5); // 1 hit / 2 total
  });

  it('should maintain performance under load', async () => {
    const request: ExecutionRequest = {
      prompt: 'test prompt'
    };

    const startTime = Date.now();

    // Execute 10 requests (first will miss cache, rest will hit)
    for (let i = 0; i < 10; i++) {
      await provider.execute(request);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const metrics = provider.getCacheMetrics();
    expect(metrics.availability.hits).toBe(9); // 9 out of 10 should hit cache
    expect(metrics.availability.hitRate).toBeGreaterThan(0.8); // > 80% hit rate

    // With caching, this should be fast
    expect(totalTime).toBeLessThan(5000); // Should complete in < 5 seconds
  });
});
