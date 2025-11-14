/**
 * ProviderRouter.test.ts
 *
 * Tests for ProviderRouter with fallback and circuit breaker logic.
 *
 * Phase 2 Week 2 Day 6: ProviderRouter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRouter } from '../ProviderRouter.js';
import { BaseProvider, type ProviderConfig, type StreamOptions } from '../BaseProvider.js';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderError,
  ProviderType,
} from '../../../src/types/schemas/provider.schema.js';

/**
 * Mock provider implementation for testing
 */
class MockProvider extends BaseProvider {
  private shouldFail: boolean = false;
  private shouldBeHealthy: boolean = true;
  private failureError: ProviderError | null = null;

  constructor(providerType: ProviderType, config: ProviderConfig) {
    super(config, providerType);
  }

  setFailure(shouldFail: boolean, error?: ProviderError): void {
    this.shouldFail = shouldFail;
    this.failureError = error || null;
  }

  setHealthy(isHealthy: boolean): void {
    this.shouldBeHealthy = isHealthy;
  }

  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    if (this.shouldFail) {
      throw this.failureError || new Error(`${this.providerType} provider failed`);
    }

    return {
      content: `Response from ${this.providerType}`,
      tokens: { input: 10, output: 20, total: 30 },
      duration: 100,
      model: request.model,
      provider: this.providerType,
      finishReason: 'stop',
    };
  }

  async sendStreamingRequest(
    request: ProviderRequest,
    options: StreamOptions
  ): Promise<ProviderResponse> {
    if (this.shouldFail) {
      throw this.failureError || new Error(`${this.providerType} provider failed`);
    }

    // Simulate streaming
    if (options.onChunk) {
      options.onChunk({
        chunk: 'chunk1',
        index: 0,
        delta: 'chunk1',
      });
    }

    if (options.onComplete) {
      options.onComplete();
    }

    return {
      content: `Streaming response from ${this.providerType}`,
      tokens: { input: 10, output: 20, total: 30 },
      duration: 150,
      model: request.model,
      provider: this.providerType,
      finishReason: 'stop',
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.shouldBeHealthy;
  }

  protected getProviderDefaultModel(): string {
    return 'default-model';
  }

  protected transformRequest(request: ProviderRequest): unknown {
    return request;
  }

  protected transformResponse(response: unknown): ProviderResponse {
    return response as ProviderResponse;
  }

  protected transformError(error: unknown): ProviderError {
    if (error instanceof Error) {
      return {
        error: error.message,
        provider: this.providerType,
        retryable: false,
      };
    }
    return error as ProviderError;
  }
}

describe('ProviderRouter', () => {
  let router: ProviderRouter;
  let claudeProvider: MockProvider;
  let geminiProvider: MockProvider;
  let openaiProvider: MockProvider;

  const createMockRequest = (overrides?: Partial<ProviderRequest>): ProviderRequest => ({
    provider: 'claude',
    model: 'test-model',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: false,
    metadata: {
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      tags: [],
    },
    ...overrides,
  });

  beforeEach(() => {
    // Create mock providers
    claudeProvider = new MockProvider('claude', { apiKey: 'test-key' });
    geminiProvider = new MockProvider('gemini', { apiKey: 'test-key' });
    openaiProvider = new MockProvider('openai', { apiKey: 'test-key' });

    // Create router with fallback chain
    router = new ProviderRouter({
      primaryProvider: 'claude',
      fallbackChain: ['gemini', 'openai'],
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 1000,
      enableFallback: true,
    });

    // Register providers
    router.registerProvider(claudeProvider);
    router.registerProvider(geminiProvider);
    router.registerProvider(openaiProvider);
  });

  describe('Basic Routing', () => {
    it('should route to primary provider when available', async () => {
      const request = createMockRequest();
      const response = await router.routeRequest(request);

      expect(response.content).toBe('Response from claude');
      expect(response.provider).toBe('claude');
    });

    it('should handle streaming requests', async () => {
      const request = createMockRequest({ stream: true });
      const response = await router.routeRequest(request);

      expect(response.content).toBe('Streaming response from claude');
      expect(response.provider).toBe('claude');
    });

    it('should validate request before routing', async () => {
      const invalidRequest = {
        ...createMockRequest(),
        messages: [],
      };

      await expect(router.routeRequest(invalidRequest)).rejects.toThrow();
    });
  });

  describe('Fallback Logic', () => {
    it('should fallback to secondary provider when primary fails', async () => {
      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });

      const request = createMockRequest();
      const response = await router.routeRequest(request);

      expect(response.content).toBe('Response from gemini');
      expect(response.provider).toBe('gemini');
    });

    it('should fallback through entire chain', async () => {
      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });
      geminiProvider.setFailure(true, {
        error: 'Gemini failed',
        provider: 'gemini',
        retryable: true,
      });

      const request = createMockRequest();
      const response = await router.routeRequest(request);

      expect(response.content).toBe('Response from openai');
      expect(response.provider).toBe('openai');
    });

    it('should throw error when all providers fail', async () => {
      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });
      geminiProvider.setFailure(true, {
        error: 'Gemini failed',
        provider: 'gemini',
        retryable: true,
      });
      openaiProvider.setFailure(true, {
        error: 'OpenAI failed',
        provider: 'openai',
        retryable: true,
      });

      const request = createMockRequest();

      await expect(router.routeRequest(request)).rejects.toMatchObject({
        error: 'OpenAI failed',
        provider: 'openai',
      });
    });

    it('should not fallback when fallback is disabled', async () => {
      router.updateConfig({ enableFallback: false });

      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: false,
      });

      const request = createMockRequest();

      await expect(router.routeRequest(request)).rejects.toMatchObject({
        error: 'Claude failed',
        provider: 'claude',
      });
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });

      const request = createMockRequest();

      // First 3 failures should trigger circuit breaker
      await router.routeRequest(request); // Fallback to gemini
      await router.routeRequest(request); // Fallback to gemini
      await router.routeRequest(request); // Fallback to gemini

      const states = router.getCircuitBreakerStates();
      const claudeState = states.get('claude');

      expect(claudeState?.state).toBe('open');
      expect(claudeState?.failures).toBeGreaterThanOrEqual(3);
    });

    it('should skip provider when circuit breaker is open', async () => {
      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });

      const request = createMockRequest();

      // Trigger circuit breaker
      await router.routeRequest(request);
      await router.routeRequest(request);
      await router.routeRequest(request);

      // Verify circuit is open
      const states = router.getCircuitBreakerStates();
      expect(states.get('claude')?.state).toBe('open');

      // Next request should skip Claude entirely
      claudeProvider.setFailure(false); // Claude is now working
      const response = await router.routeRequest(request);

      // Should still use gemini because circuit is open
      expect(response.provider).toBe('gemini');
    });

    it('should transition to half-open after timeout', async () => {
      // Create router with short timeout for testing
      router = new ProviderRouter({
        primaryProvider: 'claude',
        fallbackChain: ['gemini', 'openai'],
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 100, // 100ms timeout
      });

      router.registerProvider(claudeProvider);
      router.registerProvider(geminiProvider);
      router.registerProvider(openaiProvider);

      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });

      const request = createMockRequest();

      // Trigger circuit breaker
      await router.routeRequest(request);
      await router.routeRequest(request);
      await router.routeRequest(request);

      // Verify circuit is open
      let states = router.getCircuitBreakerStates();
      expect(states.get('claude')?.state).toBe('open');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Provider is now working
      claudeProvider.setFailure(false);

      // Next request should attempt Claude (half-open)
      const response = await router.routeRequest(request);
      expect(response.provider).toBe('claude');

      // Verify circuit is closed after success
      states = router.getCircuitBreakerStates();
      expect(states.get('claude')?.state).toBe('closed');
      expect(states.get('claude')?.failures).toBe(0);
    });

    it('should manually reset circuit breaker', async () => {
      claudeProvider.setFailure(true, {
        error: 'Claude failed',
        provider: 'claude',
        retryable: true,
      });

      const request = createMockRequest();

      // Trigger circuit breaker
      await router.routeRequest(request);
      await router.routeRequest(request);
      await router.routeRequest(request);

      // Verify circuit is open
      let states = router.getCircuitBreakerStates();
      expect(states.get('claude')?.state).toBe('open');

      // Manually reset
      router.resetCircuitBreaker('claude');

      // Verify circuit is closed
      states = router.getCircuitBreakerStates();
      expect(states.get('claude')?.state).toBe('closed');
      expect(states.get('claude')?.failures).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should return health status for all providers', async () => {
      const healthMap = await router.getProviderHealthStatus();

      expect(healthMap.get('claude')).toBe(true);
      expect(healthMap.get('gemini')).toBe(true);
      expect(healthMap.get('openai')).toBe(true);
    });

    it('should detect unhealthy providers', async () => {
      geminiProvider.setHealthy(false);

      const healthMap = await router.getProviderHealthStatus();

      expect(healthMap.get('claude')).toBe(true);
      expect(healthMap.get('gemini')).toBe(false);
      expect(healthMap.get('openai')).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = router.getConfig();

      expect(config.primaryProvider).toBe('claude');
      expect(config.fallbackChain).toEqual(['gemini', 'openai']);
      expect(config.circuitBreakerThreshold).toBe(3);
      expect(config.enableFallback).toBe(true);
    });

    it('should update configuration', () => {
      router.updateConfig({
        primaryProvider: 'gemini',
        circuitBreakerThreshold: 5,
      });

      const config = router.getConfig();

      expect(config.primaryProvider).toBe('gemini');
      expect(config.circuitBreakerThreshold).toBe(5);
      expect(config.fallbackChain).toEqual(['gemini', 'openai']); // Unchanged
    });
  });

  describe('Error Handling', () => {
    it('should normalize Error objects to ProviderError', async () => {
      claudeProvider.setFailure(true);

      const request = createMockRequest();

      // Should fallback to gemini
      const response = await router.routeRequest(request);
      expect(response.provider).toBe('gemini');
    });

    it('should detect retryable errors', async () => {
      claudeProvider.setFailure(true, {
        error: 'Rate limit exceeded',
        provider: 'claude',
        retryable: true,
      });

      const request = createMockRequest();

      // Should fallback because error is retryable
      const response = await router.routeRequest(request);
      expect(response.provider).toBe('gemini');
    });

    it('should not fallback for non-retryable errors when fallback disabled', async () => {
      router.updateConfig({ enableFallback: false });

      claudeProvider.setFailure(true, {
        error: 'Invalid API key',
        provider: 'claude',
        retryable: false,
      });

      const request = createMockRequest();

      await expect(router.routeRequest(request)).rejects.toMatchObject({
        error: 'Invalid API key',
        provider: 'claude',
      });
    });
  });
});
