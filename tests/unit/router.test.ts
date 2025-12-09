/**
 * Router Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Router } from '../../src/core/router/router.js';
import type { Provider, ExecutionRequest, ExecutionResponse } from '../../src/types/provider.js';
import { ProviderError } from '../../src/shared/errors/errors.js';

describe('Router', () => {
  let router: Router;
  let mockProvider1: Provider;
  let mockProvider2: Provider;
  let mockRequest: ExecutionRequest;

  beforeEach(() => {
    // Mock provider 1 (higher priority)
    mockProvider1 = {
      name: 'provider1',
      version: '1.0.0',
      priority: 1,
      capabilities: {
        supportsStreaming: true,
        supportsEmbedding: false,
        supportsVision: false,
        maxContextTokens: 4096,
        supportedModels: ['model1']
      },
      execute: vi.fn().mockResolvedValue({
        content: 'Response from provider1',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'model1',
        finishReason: 'stop'
      } as ExecutionResponse),
      supportsStreaming: vi.fn().mockReturnValue(false),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      isAvailable: vi.fn().mockResolvedValue(true),
      getHealth: vi.fn().mockResolvedValue({
        available: true,
        latencyMs: 100,
        errorRate: 0,
        consecutiveFailures: 0
      }),
      checkRateLimit: vi.fn().mockResolvedValue({
        hasCapacity: true,
        requestsRemaining: 100,
        tokensRemaining: 10000,
        resetAtMs: Date.now() + 60000
      }),
      waitForCapacity: vi.fn().mockResolvedValue(undefined),
      estimateCost: vi.fn().mockResolvedValue({
        estimatedUsd: 0.01,
        tokensUsed: 30
      }),
      getUsageStats: vi.fn().mockResolvedValue({
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatencyMs: 0,
        errorCount: 0
      }),
      shouldRetry: vi.fn().mockReturnValue(false),
      getRetryDelay: vi.fn().mockReturnValue(1000),
      getCacheMetrics: vi.fn().mockReturnValue({
        availability: { hits: 0, misses: 0, hitRate: 0, avgAge: 0, maxAge: 60000 },
        version: { hits: 0, misses: 0, hitRate: 0, size: 0, avgAge: 0, maxAge: 300000 },
        health: { consecutiveFailures: 0, consecutiveSuccesses: 0, lastCheckDuration: 0, uptime: 100 }
      }),
      clearCaches: vi.fn()
    } as Provider;

    // Mock provider 2 (lower priority)
    mockProvider2 = {
      name: 'provider2',
      version: '1.0.0',
      priority: 2,
      capabilities: {
        supportsStreaming: true,
        supportsEmbedding: false,
        supportsVision: false,
        maxContextTokens: 4096,
        supportedModels: ['model2']
      },
      execute: vi.fn().mockResolvedValue({
        content: 'Response from provider2',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 150,
        model: 'model2',
        finishReason: 'stop'
      } as ExecutionResponse),
      supportsStreaming: vi.fn().mockReturnValue(false),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      isAvailable: vi.fn().mockResolvedValue(true),
      getHealth: vi.fn().mockResolvedValue({
        available: true,
        latencyMs: 150,
        errorRate: 0,
        consecutiveFailures: 0
      }),
      checkRateLimit: vi.fn().mockResolvedValue({
        hasCapacity: true,
        requestsRemaining: 100,
        tokensRemaining: 10000,
        resetAtMs: Date.now() + 60000
      }),
      waitForCapacity: vi.fn().mockResolvedValue(undefined),
      estimateCost: vi.fn().mockResolvedValue({
        estimatedUsd: 0.01,
        tokensUsed: 30
      }),
      getUsageStats: vi.fn().mockResolvedValue({
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatencyMs: 0,
        errorCount: 0
      }),
      shouldRetry: vi.fn().mockReturnValue(false),
      getRetryDelay: vi.fn().mockReturnValue(1000),
      getCacheMetrics: vi.fn().mockReturnValue({
        availability: { hits: 0, misses: 0, hitRate: 0, avgAge: 0, maxAge: 60000 },
        version: { hits: 0, misses: 0, hitRate: 0, size: 0, avgAge: 0, maxAge: 300000 },
        health: { consecutiveFailures: 0, consecutiveSuccesses: 0, lastCheckDuration: 0, uptime: 100 }
      }),
      clearCaches: vi.fn()
    } as Provider;

    mockRequest = {
      prompt: 'Test prompt',
      systemPrompt: 'Test system prompt',
      model: 'test-model',
      temperature: 0.7
    };

    router = new Router({
      providers: [mockProvider2, mockProvider1], // Intentionally unsorted
      fallbackEnabled: true
    });
  });

  afterEach(() => {
    router.destroy();
  });

  describe('constructor', () => {
    it('should sort providers by priority', async () => {
      const providers = await router.getAvailableProviders();
      expect(providers[0]?.name).toBe('provider1'); // Priority 1
      expect(providers[1]?.name).toBe('provider2'); // Priority 2
    });
  });

  describe('execute', () => {
    it('should execute with first available provider', async () => {
      const response = await router.execute(mockRequest);

      expect(response.model).toBe('model1');
      expect(mockProvider1.execute).toHaveBeenCalledWith(mockRequest);
      expect(mockProvider2.execute).not.toHaveBeenCalled();
    });

    it('should throw error when no providers available', async () => {
      mockProvider1.isAvailable = vi.fn().mockResolvedValue(false);
      mockProvider2.isAvailable = vi.fn().mockResolvedValue(false);

      await expect(router.execute(mockRequest)).rejects.toThrow(ProviderError);
      await expect(router.execute(mockRequest)).rejects.toThrow('No AI providers are available');
    });

    it('should fallback to next provider on failure', async () => {
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider1 failed'));

      const response = await router.execute(mockRequest);

      expect(response.model).toBe('model2');
      expect(mockProvider1.execute).toHaveBeenCalled();
      expect(mockProvider2.execute).toHaveBeenCalled();
    });

    it('should throw error when fallback disabled and provider fails', async () => {
      const routerNoFallback = new Router({
        providers: [mockProvider1],
        fallbackEnabled: false
      });

      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider failed'));

      await expect(routerNoFallback.execute(mockRequest)).rejects.toThrow('Provider failed');

      routerNoFallback.destroy();
    });

    it('should throw ProviderError when all providers fail', async () => {
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider1 failed'));
      mockProvider2.execute = vi.fn().mockRejectedValue(new Error('Provider2 failed'));

      const promise = router.execute(mockRequest);
      await expect(promise).rejects.toThrow(ProviderError);
      await expect(promise).rejects.toThrow('All providers failed');
    });

    it('should include last error in ProviderError when all fail', async () => {
      const lastError = new Error('Provider2 specific error');
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider1 failed'));
      mockProvider2.execute = vi.fn().mockRejectedValue(lastError);

      try {
        await router.execute(mockRequest);
      } catch (error: any) {
        expect(error.message).toContain('Provider2 specific error');
        expect(error.context?.lastError).toBe('Provider2 specific error');
      }
    });
  });

  // Streaming tests removed - streaming functionality has been removed from the system

  describe('getAvailableProviders', () => {
    it('should return all available providers sorted by priority', async () => {
      const providers = await router.getAvailableProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]?.name).toBe('provider1');
      expect(providers[1]?.name).toBe('provider2');
    });

    it('should filter out unavailable providers', async () => {
      mockProvider1.isAvailable = vi.fn().mockResolvedValue(false);

      const providers = await router.getAvailableProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0]?.name).toBe('provider2');
    });

    it('should return empty array when no providers available', async () => {
      mockProvider1.isAvailable = vi.fn().mockResolvedValue(false);
      mockProvider2.isAvailable = vi.fn().mockResolvedValue(false);

      const providers = await router.getAvailableProviders();

      expect(providers).toHaveLength(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status of all providers', async () => {
      const healthMap = await router.getHealthStatus();

      expect(healthMap.size).toBe(2);
      expect(healthMap.get('provider1')).toBeDefined();
      expect(healthMap.get('provider1')?.available).toBe(true);
      expect(healthMap.get('provider2')).toBeDefined();
      expect(healthMap.get('provider2')?.available).toBe(true);
    });

    it('should include unavailable providers in health status', async () => {
      mockProvider1.getHealth = vi.fn().mockResolvedValue({
        available: false,
        latencyMs: 0,
        lastCheck: new Date(),
        consecutiveFailures: 3
      });

      const healthMap = await router.getHealthStatus();

      expect(healthMap.get('provider1')?.available).toBe(false);
      expect(healthMap.get('provider1')?.consecutiveFailures).toBe(3);
    });
  });

  describe('selectProvider', () => {
    it('should select first available provider by priority', async () => {
      const provider = await router.selectProvider();

      expect(provider).toBeDefined();
      expect(provider?.name).toBe('provider1');
    });

    it('should return null when no providers available', async () => {
      mockProvider1.isAvailable = vi.fn().mockResolvedValue(false);
      mockProvider2.isAvailable = vi.fn().mockResolvedValue(false);

      const provider = await router.selectProvider();

      expect(provider).toBeNull();
    });

    it('should skip unavailable providers', async () => {
      mockProvider1.isAvailable = vi.fn().mockResolvedValue(false);

      const provider = await router.selectProvider();

      expect(provider?.name).toBe('provider2');
    });
  });

  describe('health checks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should perform periodic health checks when interval provided', async () => {
      const routerWithHealthCheck = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        healthCheckInterval: 100
      });

      // Wait for warmup + initial health check + periodic health check
      await vi.advanceTimersByTimeAsync(300);

      expect(mockProvider1.getHealth).toHaveBeenCalled();

      routerWithHealthCheck.destroy();

      // Wait a bit after destroy to ensure cleanup completes
      await vi.advanceTimersByTimeAsync(50);
    });

    it('should stop health checks when destroyed', async () => {
      const routerWithHealthCheck = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        healthCheckInterval: 100
      });

      // Wait for warmup and initial health check to complete
      await vi.advanceTimersByTimeAsync(200);

      const callCount = (mockProvider1.getHealth as any).mock.calls.length;

      routerWithHealthCheck.destroy();

      // Wait to ensure no more calls happen after destroy
      await vi.advanceTimersByTimeAsync(200);

      expect((mockProvider1.getHealth as any).mock.calls.length).toBe(callCount);
    });

    it('should handle errors in health checks gracefully', async () => {
      // Mock getHealth to throw error
      mockProvider1.getHealth = vi.fn().mockRejectedValue(new Error('Health check failed'));

      const routerWithHealthCheck = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        healthCheckInterval: 100
      });

      // Wait for warmup + initial health check + periodic health check
      await vi.advanceTimersByTimeAsync(300);

      // Should not throw unhandled rejection
      expect(mockProvider1.getHealth).toHaveBeenCalled();

      routerWithHealthCheck.destroy();

      // Wait for cleanup to complete
      await vi.advanceTimersByTimeAsync(50);
    });

    it('should clear interval handle when destroyed', () => {
      const routerWithHealthCheck = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        healthCheckInterval: 100
      });

      routerWithHealthCheck.destroy();

      // Should be safe to call destroy again
      expect(() => routerWithHealthCheck.destroy()).not.toThrow();
    });
  });

  describe('parallel availability checks', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('should check provider availability in parallel', async () => {
      const startTime = Date.now();

      // Mock slow availability checks (100ms each)
      mockProvider1.isAvailable = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });
      mockProvider2.isAvailable = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      const providers = await router.getAvailableProviders();
      const duration = Date.now() - startTime;

      // Should complete in ~100ms (parallel), not ~200ms (serial)
      expect(duration).toBeLessThan(150);
      expect(providers).toHaveLength(2);
      expect(mockProvider1.isAvailable).toHaveBeenCalled();
      expect(mockProvider2.isAvailable).toHaveBeenCalled();
    });

    it('should handle individual availability check failures', async () => {
      // Provider 1 throws error
      mockProvider1.isAvailable = vi.fn().mockRejectedValue(new Error('Check failed'));
      mockProvider2.isAvailable = vi.fn().mockResolvedValue(true);

      const providers = await router.getAvailableProviders();

      // Should still return provider 2
      expect(providers).toHaveLength(1);
      expect(providers[0]?.name).toBe('provider2');
    });
  });

  describe('dynamic provider penalty (cooldown)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should penalize failed providers temporarily', async () => {
      // v8.3.0: Circuit breaker requires 3 failures to open
      // Provider 1 fails 3 times to trigger circuit breaker
      mockProvider1.execute = vi.fn()
        .mockRejectedValueOnce(new Error('Provider failed'))
        .mockRejectedValueOnce(new Error('Provider failed'))
        .mockRejectedValueOnce(new Error('Provider failed'));
      mockProvider2.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider2',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 150,
        model: 'model2',
        finishReason: 'stop'
      } as ExecutionResponse);

      // First 3 executions: provider1 fails, fallback to provider2
      await router.execute(mockRequest);
      await router.execute(mockRequest);
      const response1 = await router.execute(mockRequest);
      expect(response1.model).toBe('model2');

      // After 3 failures, circuit breaker should be open
      // Reset mocks for fourth execution
      vi.clearAllMocks();
      mockProvider1.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider1',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'model1',
        finishReason: 'stop'
      } as ExecutionResponse);

      // Fourth execution: provider1 should be skipped (circuit breaker open)
      const response2 = await router.execute(mockRequest);
      expect(response2.model).toBe('model2');
      expect(mockProvider1.execute).not.toHaveBeenCalled(); // Skipped due to circuit breaker!
      expect(mockProvider2.execute).toHaveBeenCalledTimes(1);
    });

    it('should remove penalty after cooldown period', async () => {
      const shortCooldownRouter = new Router({
        providers: [mockProvider1, mockProvider2],
        fallbackEnabled: true,
        providerCooldownMs: 100 // 100ms cooldown
      });

      // Provider 1 fails
      mockProvider1.execute = vi.fn().mockRejectedValueOnce(new Error('Provider failed'));
      mockProvider2.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider2',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 150,
        model: 'model2',
        finishReason: 'stop'
      } as ExecutionResponse);

      // First execution: provider1 fails
      await shortCooldownRouter.execute(mockRequest);

      // Wait for cooldown to expire
      await vi.advanceTimersByTimeAsync(150);

      // Reset mocks
      vi.clearAllMocks();
      mockProvider1.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider1',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'model1',
        finishReason: 'stop'
      } as ExecutionResponse);

      // Second execution: provider1 should be available again
      const response = await shortCooldownRouter.execute(mockRequest);
      expect(response.model).toBe('model1');
      expect(mockProvider1.execute).toHaveBeenCalled();

      shortCooldownRouter.destroy();

      // Wait for cleanup to complete
      await vi.advanceTimersByTimeAsync(50);
    });

    it('should remove penalty on successful execution', async () => {
      const shortCooldownRouter = new Router({
        providers: [mockProvider1, mockProvider2],
        fallbackEnabled: true,
        providerCooldownMs: 100 // 100ms cooldown for faster test
      });

      // Provider 1 fails first, then succeeds
      mockProvider1.execute = vi.fn()
        .mockRejectedValueOnce(new Error('Provider failed'))
        .mockResolvedValue({
          content: 'Response from provider1',
          tokensUsed: { prompt: 10, completion: 20, total: 30 },
          latencyMs: 100,
          model: 'model1',
          finishReason: 'stop'
        } as ExecutionResponse);

      mockProvider2.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider2',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 150,
        model: 'model2',
        finishReason: 'stop'
      } as ExecutionResponse);

      // First execution: provider1 fails, falls back to provider2
      await shortCooldownRouter.execute(mockRequest);

      // Wait for cooldown to expire
      await vi.advanceTimersByTimeAsync(150);

      // Provider 1 should be available again and succeed
      const response = await shortCooldownRouter.execute(mockRequest);
      expect(response.model).toBe('model1');

      // Provider 1 succeeds, so penalty should be removed immediately
      vi.clearAllMocks();
      const response2 = await shortCooldownRouter.execute(mockRequest);
      expect(response2.model).toBe('model1');
      expect(mockProvider1.execute).toHaveBeenCalled();

      shortCooldownRouter.destroy();

      // Wait for cleanup to complete
      await vi.advanceTimersByTimeAsync(50);
    });

    it('should clear penalties on destroy', () => {
      // Provider 1 fails
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider failed'));
      mockProvider2.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider2',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 150,
        model: 'model2',
        finishReason: 'stop'
      } as ExecutionResponse);

      // Execute to create penalty
      router.execute(mockRequest).catch(() => {});

      // Destroy should clear penalties
      router.destroy();

      // Should not throw
      expect(() => router.destroy()).not.toThrow();
    });
  });

  describe('providerCount', () => {
    it('should return number of configured providers', () => {
      expect(router.providerCount).toBe(2);
    });

    it('should return 0 for empty router', () => {
      const emptyRouter = new Router({
        providers: [],
        fallbackEnabled: true
      });

      expect(emptyRouter.providerCount).toBe(0);
      emptyRouter.destroy();
    });
  });

  describe('getCircuitBreakerStats', () => {
    it('should return circuit breaker stats for all providers', () => {
      const stats = router.getCircuitBreakerStats();

      expect(stats).toBeInstanceOf(Map);
      // Stats are tracked per-provider when used
    });
  });

  describe('getHealthCheckStatus', () => {
    it('should return health check status when disabled', () => {
      const status = router.getHealthCheckStatus();

      expect(status.enabled).toBe(false);
      expect(status.interval).toBeUndefined();
      expect(status.checksPerformed).toBe(0);
      expect(status.avgDuration).toBe(0);
      expect(status.successRate).toBe(0);
      expect(status.providersMonitored).toBe(2);
      expect(status.providers).toHaveLength(2);
    });

    it('should return health check status when enabled', async () => {
      vi.useFakeTimers();

      const routerWithHealthCheck = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        healthCheckInterval: 100
      });

      // Wait for health check to run
      await vi.advanceTimersByTimeAsync(200);

      const status = routerWithHealthCheck.getHealthCheckStatus();

      expect(status.enabled).toBe(true);
      expect(status.interval).toBe(100);
      expect(status.checksPerformed).toBeGreaterThan(0);
      expect(status.providersMonitored).toBe(1);

      routerWithHealthCheck.destroy();
      await vi.advanceTimersByTimeAsync(50);
      vi.useRealTimers();
    });

    it('should include provider cache metrics', () => {
      const status = router.getHealthCheckStatus();

      expect(status.providers).toHaveLength(2);
      expect(status.providers[0]).toHaveProperty('name');
      expect(status.providers[0]).toHaveProperty('cacheHitRate');
      expect(status.providers[0]).toHaveProperty('avgCacheAge');
      expect(status.providers[0]).toHaveProperty('uptime');
    });
  });

  describe('cache integration', () => {
    let mockCache: any;
    let routerWithCache: Router;

    beforeEach(() => {
      mockCache = {
        isEnabled: true,
        get: vi.fn().mockReturnValue(null),
        set: vi.fn()
      };

      routerWithCache = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        cache: mockCache
      });
    });

    afterEach(() => {
      routerWithCache.destroy();
    });

    it('should check cache before executing provider', async () => {
      await routerWithCache.execute(mockRequest);

      expect(mockCache.get).toHaveBeenCalledWith(
        'provider1',
        mockRequest.prompt,
        expect.objectContaining({
          temperature: mockRequest.temperature,
          maxTokens: mockRequest.maxTokens
        })
      );
    });

    it('should return cached response when available', async () => {
      mockCache.get = vi.fn().mockReturnValue('Cached response content');

      const response = await routerWithCache.execute(mockRequest);

      expect(response.content).toBe('Cached response content');
      expect(response.cached).toBe(true);
      expect(response.latencyMs).toBe(0);
      expect(mockProvider1.execute).not.toHaveBeenCalled();
    });

    it('should cache successful response', async () => {
      await routerWithCache.execute(mockRequest);

      expect(mockCache.set).toHaveBeenCalledWith(
        'provider1',
        mockRequest.prompt,
        'Response from provider1',
        expect.objectContaining({
          temperature: mockRequest.temperature
        })
      );
    });

    it('should not cache failed response', async () => {
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider failed'));

      await expect(routerWithCache.execute(mockRequest)).rejects.toThrow();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('multi-factor routing', () => {
    it('should enable multi-factor routing when strategy provided', () => {
      const routerWithStrategy = new Router({
        providers: [mockProvider1, mockProvider2],
        fallbackEnabled: true,
        strategy: {
          strategy: 'balanced'
        }
      });

      // Router should initialize without errors
      expect(routerWithStrategy.providerCount).toBe(2);

      routerWithStrategy.destroy();
    });
  });

  describe('trace logging', () => {
    it('should initialize trace logging when workspacePath provided', () => {
      const routerWithTracing = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        workspacePath: '/tmp/test-workspace',
        enableTracing: true
      });

      // Router should initialize without errors
      expect(routerWithTracing.providerCount).toBe(1);

      routerWithTracing.destroy();
    });

    it('should not initialize trace logging when enableTracing is false', () => {
      const routerWithoutTracing = new Router({
        providers: [mockProvider1],
        fallbackEnabled: true,
        workspacePath: '/tmp/test-workspace',
        enableTracing: false
      });

      // Router should initialize without errors
      expect(routerWithoutTracing.providerCount).toBe(1);

      routerWithoutTracing.destroy();
    });
  });

  describe('last resort provider logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should try unavailable providers when all available fail', async () => {
      // Provider 1 is available but fails
      mockProvider1.isAvailable = vi.fn().mockResolvedValue(true);
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider1 failed'));

      // Provider 2 is unavailable initially
      mockProvider2.isAvailable = vi.fn().mockResolvedValue(false);
      mockProvider2.execute = vi.fn().mockResolvedValue({
        content: 'Response from provider2 (last resort)',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 150,
        model: 'model2',
        finishReason: 'stop'
      } as ExecutionResponse);

      const response = await router.execute(mockRequest);

      // Should have tried provider2 as last resort
      expect(response.model).toBe('model2');
      expect(mockProvider2.execute).toHaveBeenCalled();
    });
  });
});
