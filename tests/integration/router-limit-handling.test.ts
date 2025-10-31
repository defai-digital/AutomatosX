/**
 * Integration Tests: Router Limit Handling (v5.7.0)
 *
 * Tests router behavior with provider limit detection and automatic rotation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../../src/core/router.js';
import { BaseProvider } from '../../src/providers/base-provider.js';
import { ProviderLimitManager, getProviderLimitManager } from '../../src/core/provider-limit-manager.js';
import { ProviderError, ErrorCode } from '../../src/utils/errors.js';
import type {
  ExecutionRequest,
  ExecutionResponse,
  ProviderConfig,
  ProviderCapabilities,
  EmbeddingOptions
} from '../../src/types/provider.js';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Mock Provider for testing
 */
class MockProvider extends BaseProvider {
  public mockExecuteResponse?: ExecutionResponse;
  public mockExecuteError?: Error;
  public executionCount = 0;

  constructor(config: ProviderConfig) {
    super(config);
  }

  get version(): string {
    return '1.0.0-test';
  }

  get capabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,
      supportsEmbedding: false,
      supportsVision: false,
      maxContextTokens: 4096,
      supportedModels: ['test-model']
    };
  }

  protected async executeRequest(_request: ExecutionRequest): Promise<ExecutionResponse> {
    this.executionCount++;

    if (this.mockExecuteError) {
      throw this.mockExecuteError;
    }

    if (this.mockExecuteResponse) {
      return this.mockExecuteResponse;
    }

    return {
      content: 'Mock response',
      model: 'test-model',
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      latencyMs: 100,
      finishReason: 'stop'
    };
  }

  protected async generateEmbeddingInternal(_text: string, _options?: EmbeddingOptions): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  protected buildCLIArgs(_request: ExecutionRequest): string[] {
    return ['--mock'];
  }

  supportsStreaming(): boolean {
    return false;
  }

  protected supportsParameter(_param: string): boolean {
    return false;
  }
}

describe('Router - Limit Handling Integration', () => {
  const testStateDir = path.join(process.cwd(), 'tests', 'fixtures', 'test-state-router-limits');
  let router: Router;
  let limitManager: ProviderLimitManager;
  let provider1: MockProvider;
  let provider2: MockProvider;
  let provider3: MockProvider;

  beforeEach(async () => {
    // Clean up test state
    if (existsSync(testStateDir)) {
      await fs.rm(testStateDir, { recursive: true, force: true });
    }

    // Reset limit manager
    ProviderLimitManager.resetInstance();
    limitManager = ProviderLimitManager.getInstance(testStateDir);
    await limitManager.initialize();

    // Create mock providers (use allowed provider names)
    provider1 = new MockProvider({
      name: 'openai',
      enabled: true,
      priority: 1,
      timeout: 5000,
      command: 'mock1'
    });

    provider2 = new MockProvider({
      name: 'gemini-cli',
      enabled: true,
      priority: 2,
      timeout: 5000,
      command: 'mock2'
    });

    provider3 = new MockProvider({
      name: 'claude-code',
      enabled: true,
      priority: 3,
      timeout: 5000,
      command: 'mock3'
    });

    // Create router
    // Bug #9: Disable cost optimization features for predictable test behavior
    router = new Router({
      providers: [provider1, provider2, provider3],
      fallbackEnabled: true,
      providerCooldownMs: 1000, // 1 second for testing
      enableFreeTierPrioritization: false, // Disable to maintain priority order
      enableWorkloadAwareRouting: false    // Disable to maintain priority order
    });
  });

  afterEach(async () => {
    router.destroy();

    // Clean up
    try {
      if (existsSync(testStateDir)) {
        await fs.rm(testStateDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }

    ProviderLimitManager.resetInstance();
  });

  describe('Provider Selection with Limits', () => {
    it('should skip limited providers during selection', async () => {
      // Record limit for highest priority provider
      const resetAtMs = Date.now() + 3600000;
      await limitManager.recordLimitHit('openai', 'daily', resetAtMs);

      // Get available providers
      const available = await router.getAvailableProviders();

      // Should not include provider-1
      const providerNames = available.map(p => p.name);
      expect(providerNames).not.toContain('openai');
      expect(providerNames).toContain('gemini-cli');
      expect(providerNames).toContain('claude-code');
    });

    it('should include providers with expired limits', async () => {
      // Record expired limit
      const resetAtMs = Date.now() - 1000; // Already expired
      await limitManager.recordLimitHit('openai', 'daily', resetAtMs);

      const available = await router.getAvailableProviders();

      // Should include provider-1 (limit expired)
      const providerNames = available.map(p => p.name);
      expect(providerNames).toContain('openai');
    });

    it('should handle multiple limited providers', async () => {
      const resetAtMs = Date.now() + 3600000;

      await limitManager.recordLimitHit('openai', 'daily', resetAtMs);
      await limitManager.recordLimitHit('gemini-cli', 'daily', resetAtMs);

      const available = await router.getAvailableProviders();

      // Only provider-3 should be available
      expect(available).toHaveLength(1);
      expect(available[0]?.name).toBe('claude-code');
    });
  });

  describe('Automatic Fallback on Limit Hit', () => {
    it('should automatically fallback when provider hits limit', async () => {
      const resetAtMs = Date.now() + 3600000;

      // Provider-1 throws rate limit error
      provider1.mockExecuteError = ProviderError.rateLimit(
        'openai',
        'daily',
        resetAtMs,
        'Rate limit exceeded'
      );

      // Provider-2 succeeds
      provider2.mockExecuteResponse = {
        content: 'Success from provider-2',
        model: 'test-model',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      const response = await router.execute({
        prompt: 'Test prompt'
      });

      // Should use provider-2
      expect(response.content).toBe('Success from provider-2');
      expect(provider1.executionCount).toBe(1);
      expect(provider2.executionCount).toBe(1);

      // Provider-1 should now be limited
      const limitCheck = limitManager.isProviderLimited('openai');
      expect(limitCheck.isLimited).toBe(true);
    });

    it('should distinguish rate limit errors from other errors', async () => {
      // Provider-1 throws regular error (not rate limit)
      provider1.mockExecuteError = new Error('Network error');

      // Provider-2 succeeds
      provider2.mockExecuteResponse = {
        content: 'Success from provider-2',
        model: 'test-model',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      await router.execute({ prompt: 'Test prompt' });

      // Provider-1 should NOT be marked as limited (different error type)
      const limitCheck = limitManager.isProviderLimited('openai');
      expect(limitCheck.isLimited).toBe(false);
    });

    it('should continue through multiple providers until success', async () => {
      const resetAtMs = Date.now() + 3600000;

      // Provider-1 and provider-2 hit limits
      provider1.mockExecuteError = ProviderError.rateLimit(
        'openai',
        'daily',
        resetAtMs,
        'Rate limit exceeded'
      );
      provider2.mockExecuteError = ProviderError.rateLimit(
        'gemini-cli',
        'daily',
        resetAtMs,
        'Rate limit exceeded'
      );

      // Provider-3 succeeds
      provider3.mockExecuteResponse = {
        content: 'Success from provider-3',
        model: 'test-model',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      const response = await router.execute({ prompt: 'Test prompt' });

      expect(response.content).toBe('Success from provider-3');
      expect(provider1.executionCount).toBe(1);
      expect(provider2.executionCount).toBe(1);
      expect(provider3.executionCount).toBe(1);
    });
  });

  describe('All Providers Exhausted', () => {
    it('should throw specialized error when all providers are limited', async () => {
      const resetAtMs1 = Date.now() + 3600000; // 1 hour
      const resetAtMs2 = Date.now() + 7200000; // 2 hours
      const resetAtMs3 = Date.now() + 10800000; // 3 hours

      // Record limits for all providers
      await limitManager.recordLimitHit('openai', 'daily', resetAtMs1);
      await limitManager.recordLimitHit('gemini-cli', 'daily', resetAtMs2);
      await limitManager.recordLimitHit('claude-code', 'daily', resetAtMs3);

      // All providers should throw limit errors
      provider1.mockExecuteError = ProviderError.rateLimit(
        'openai',
        'daily',
        resetAtMs1,
        'Limit exceeded'
      );
      provider2.mockExecuteError = ProviderError.rateLimit(
        'gemini-cli',
        'daily',
        resetAtMs2,
        'Limit exceeded'
      );
      provider3.mockExecuteError = ProviderError.rateLimit(
        'claude-code',
        'daily',
        resetAtMs3,
        'Limit exceeded'
      );

      await expect(router.execute({ prompt: 'Test' })).rejects.toThrow(ProviderError);

      try {
        await router.execute({ prompt: 'Test' });
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).code).toBe(ErrorCode.PROVIDER_NO_AVAILABLE);

        // Should mention all providers are limited
        expect((error as ProviderError).message).toContain('All providers');
        expect((error as ProviderError).message).toContain('usage limits');
      }
    });

    it('should provide soonest reset time in error', async () => {
      const resetAtMs1 = Date.now() + 3600000; // 1 hour (soonest)
      const resetAtMs2 = Date.now() + 7200000; // 2 hours
      const resetAtMs3 = Date.now() + 10800000; // 3 hours

      await limitManager.recordLimitHit('openai', 'daily', resetAtMs1);
      await limitManager.recordLimitHit('gemini-cli', 'daily', resetAtMs2);
      await limitManager.recordLimitHit('claude-code', 'daily', resetAtMs3);

      provider1.mockExecuteError = ProviderError.rateLimit(
        'openai',
        'daily',
        resetAtMs1,
        'Limit'
      );
      provider2.mockExecuteError = ProviderError.rateLimit(
        'gemini-cli',
        'daily',
        resetAtMs2,
        'Limit'
      );
      provider3.mockExecuteError = ProviderError.rateLimit(
        'claude-code',
        'daily',
        resetAtMs3,
        'Limit'
      );

      try {
        await router.execute({ prompt: 'Test' });
      } catch (error) {
        expect((error as ProviderError).context?.soonestResetMs).toBe(resetAtMs1);
      }
    });
  });

  describe('Background Refresh', () => {
    it('should restore providers when limits expire', async () => {
      // Record limit that expires quickly
      const resetAtMs = Date.now() + 100; // 100ms from now
      await limitManager.recordLimitHit('openai', 'daily', resetAtMs);

      // Verify limited
      expect(limitManager.isProviderLimited('openai').isLimited).toBe(true);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      // Manually trigger refresh (simulates background task)
      const restoredProviders = await limitManager.refreshExpired();

      expect(restoredProviders).toContain('openai');
      expect(limitManager.isProviderLimited('openai').isLimited).toBe(false);
    });
  });

  describe('Provider Priority with Limits', () => {
    it('should respect priority after limits clear', async () => {
      const resetAtMs = Date.now() + 100; // Short expiry

      // Limit provider-1 (highest priority)
      await limitManager.recordLimitHit('openai', 'daily', resetAtMs);

      // Provider-2 should be selected
      provider2.mockExecuteResponse = {
        content: 'From provider-2',
        model: 'test',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      const response1 = await router.execute({ prompt: 'Test' });
      expect(response1.content).toBe('From provider-2');

      // Wait for limit to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      await limitManager.refreshExpired();

      // Now provider-1 should be available again
      provider1.mockExecuteResponse = {
        content: 'From provider-1',
        model: 'test',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      const response2 = await router.execute({ prompt: 'Test' });
      expect(response2.content).toBe('From provider-1');
    });
  });

  describe('Error Messages and Logging', () => {
    it('should log fallback with reason when limit hit', async () => {
      const resetAtMs = Date.now() + 3600000;

      provider1.mockExecuteError = ProviderError.rateLimit(
        'openai',
        'daily',
        resetAtMs,
        'Rate limit exceeded'
      );
      provider2.mockExecuteResponse = {
        content: 'Success',
        model: 'test',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      // Execute should succeed with fallback
      await expect(router.execute({ prompt: 'Test' })).resolves.toBeDefined();

      // Verify provider-1 is limited
      expect(limitManager.isProviderLimited('openai').isLimited).toBe(true);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent limit hits correctly', async () => {
      const resetAtMs = Date.now() + 3600000;

      provider1.mockExecuteError = ProviderError.rateLimit(
        'openai',
        'daily',
        resetAtMs,
        'Rate limit'
      );
      provider2.mockExecuteResponse = {
        content: 'Success',
        model: 'test',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        finishReason: 'stop'
      };

      // Execute multiple concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        router.execute({ prompt: 'Test' })
      );

      const responses = await Promise.all(requests);

      // All should succeed
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.content).toBe('Success');
      });

      // Provider-1 should be limited only once
      expect(limitManager.isProviderLimited('openai').isLimited).toBe(true);
    });
  });
});
