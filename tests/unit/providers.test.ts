/**
 * Provider System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeProvider } from '../../src/providers/claude-provider.js';
import { GeminiProvider } from '../../src/providers/gemini-provider.js';
import { Router } from '../../src/core/router.js';
import type { ProviderConfig, ExecutionRequest } from '../../src/types/provider.js';

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      name: 'claude',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'claude',
      rateLimits: {
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 10000,
        maxConcurrentRequests: 3
      }
    };
    provider = new ClaudeProvider(config);
  });

  it('should have correct metadata', () => {
    expect(provider.name).toBe('claude');
    expect(provider.version).toBe('1.0.0');
    expect(provider.capabilities.supportsStreaming).toBe(true); // v6.1.0: Streaming support added
    expect(provider.capabilities.supportsEmbedding).toBe(false);
    expect(provider.capabilities.supportsVision).toBe(true);
    expect(provider.capabilities.maxContextTokens).toBe(200000);
  });

  it('should be available when enabled', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('should not be available when disabled', async () => {
    config.enabled = false;
    const disabledProvider = new ClaudeProvider(config);
    expect(await disabledProvider.isAvailable()).toBe(false);
  });

  it('should have healthy initial status', async () => {
    const health = await provider.getHealth();
    expect(health.available).toBe(true);
    expect(health.consecutiveFailures).toBe(0);
    expect(health.errorRate).toBe(0);
  });

  it('should estimate cost correctly', async () => {
    const request: ExecutionRequest = {
      prompt: 'Hello, world!',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000
    };

    const cost = await provider.estimateCost(request);
    expect(cost.estimatedUsd).toBeGreaterThan(0);
    expect(cost.tokensUsed).toBeGreaterThan(0);
  });

  it('should have zero initial usage stats', async () => {
    const stats = await provider.getUsageStats();
    expect(stats.totalRequests).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.totalCost).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it('should identify retryable errors', () => {
    const retryableError = new Error('rate_limit_error');
    expect(provider.shouldRetry(retryableError)).toBe(true);

    const nonRetryableError = new Error('invalid_api_key');
    expect(provider.shouldRetry(nonRetryableError)).toBe(false);
  });

  it('should calculate retry delay with exponential backoff', () => {
    const delay1 = provider.getRetryDelay(1);
    const delay2 = provider.getRetryDelay(2);
    const delay3 = provider.getRetryDelay(3);

    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('should throw error when generating embeddings', async () => {
    await expect(provider.generateEmbedding('test')).rejects.toThrow(
      'Provider claude does not support embeddings'
    );
  });
});

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      name: 'gemini',
      enabled: true,
      priority: 2,
      timeout: 30000,
      command: 'gemini',
      rateLimits: {
        maxRequestsPerMinute: 15,
        maxTokensPerMinute: 15000,
        maxConcurrentRequests: 5
      }
    };
    provider = new GeminiProvider(config);
  });

  it('should have correct metadata', () => {
    expect(provider.name).toBe('gemini');
    expect(provider.version).toBe('1.0.0');
    expect(provider.capabilities.supportsStreaming).toBe(false);
    expect(provider.capabilities.supportsEmbedding).toBe(true);
    expect(provider.capabilities.supportsVision).toBe(true);
    expect(provider.capabilities.maxContextTokens).toBe(1000000);
  });

  it('should support embeddings', async () => {
    const embedding = await provider.generateEmbedding('test');
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should estimate cost correctly', async () => {
    const request: ExecutionRequest = {
      prompt: 'Hello, world!',
      model: 'gemini-1.5-pro',
      maxTokens: 1000
    };

    const cost = await provider.estimateCost(request);
    expect(cost.estimatedUsd).toBeGreaterThan(0);
    expect(cost.tokensUsed).toBeGreaterThan(0);
  });

  it('should have free pricing for flash-exp model', async () => {
    const request: ExecutionRequest = {
      prompt: 'Hello, world!',
      model: 'gemini-2.0-flash-exp',
      maxTokens: 1000
    };

    const cost = await provider.estimateCost(request);
    expect(cost.estimatedUsd).toBe(0);
  });
});

describe('Router', () => {
  let claudeProvider: ClaudeProvider;
  let geminiProvider: GeminiProvider;
  let router: Router;

  beforeEach(() => {
    const claudeConfig: ProviderConfig = {
      name: 'claude',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'claude'
    };

    const geminiConfig: ProviderConfig = {
      name: 'gemini',
      enabled: true,
      priority: 2,
      timeout: 30000,
      command: 'gemini'
    };

    claudeProvider = new ClaudeProvider(claudeConfig);
    geminiProvider = new GeminiProvider(geminiConfig);

    router = new Router({
      providers: [claudeProvider, geminiProvider],
      fallbackEnabled: true
    });
  });

  it('should get available providers', async () => {
    const available = await router.getAvailableProviders();
    expect(available.length).toBe(2);
  });

  it('should select best provider', async () => {
    const selected = await router.selectProvider();
    expect(selected).not.toBeNull();
    expect(selected?.name).toBe('claude'); // Claude has priority 1 (higher)
  });

  it('should get health status for all providers', async () => {
    const healthMap = await router.getHealthStatus();
    expect(healthMap.size).toBe(2);
    expect(healthMap.has('claude')).toBe(true);
    expect(healthMap.has('gemini')).toBe(true);
  });

  it('should handle no available providers', async () => {
    const disabledClaudeConfig: ProviderConfig = {
      name: 'claude',
      enabled: false,
      priority: 1,
      timeout: 30000,
      command: 'claude'
    };

    const disabledGeminiConfig: ProviderConfig = {
      name: 'gemini',
      enabled: false,
      priority: 2,
      timeout: 30000,
      command: 'gemini'
    };

    const disabledRouter = new Router({
      providers: [
        new ClaudeProvider(disabledClaudeConfig),
        new GeminiProvider(disabledGeminiConfig)
      ],
      fallbackEnabled: true
    });

    const selected = await disabledRouter.selectProvider();
    expect(selected).toBeNull();
  });

  it('should cleanup properly', () => {
    expect(() => router.destroy()).not.toThrow();
  });
});

describe('Rate Limiting', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    const config: ProviderConfig = {
      name: 'claude',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'claude',
      rateLimits: {
        maxRequestsPerMinute: 5,
        maxTokensPerMinute: 1000,
        maxConcurrentRequests: 2
      }
    };
    provider = new ClaudeProvider(config);
  });

  it('should have capacity initially', async () => {
    const status = await provider.checkRateLimit();
    expect(status.hasCapacity).toBe(true);
    expect(status.requestsRemaining).toBe(5);
  });

  it('should report rate limit status correctly', async () => {
    const status = await provider.checkRateLimit();
    expect(status.requestsRemaining).toBeGreaterThanOrEqual(0);
    expect(status.tokensRemaining).toBeGreaterThanOrEqual(0);
    expect(status.resetAtMs).toBeGreaterThan(Date.now());
  });
});
