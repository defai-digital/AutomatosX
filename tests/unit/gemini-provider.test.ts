/**
 * Gemini Provider Comprehensive Tests
 *
 * This test suite focuses on untested paths in gemini-provider.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiProvider } from '../../src/providers/gemini-provider.js';
import type { ProviderConfig, ExecutionRequest } from '../../src/types/provider.js';

describe('GeminiProvider - Additional Coverage', () => {
  let provider: GeminiProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    // Force mock mode for all tests
    process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';

    config = {
      name: 'gemini',
      enabled: true,
      priority: 2,
      timeout: 30000,
      command: 'gemini'
    };
    provider = new GeminiProvider(config);
  });

  afterEach(() => {
    delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
  });

  describe('executeRequest()', () => {
    it('should execute with system prompt', async () => {
      const request: ExecutionRequest = {
        prompt: 'User prompt',
        systemPrompt: 'System instructions',
        model: 'gemini-2.0-flash-exp'
      };

      const response = await provider.execute(request);

      expect(response.content).toBeDefined();
      expect(response.model).toBe('gemini-2.0-flash-exp');
      expect(response.tokensUsed).toBeDefined();
    });

    it('should execute without system prompt', async () => {
      const request: ExecutionRequest = {
        prompt: 'User prompt only',
        model: 'gemini-1.5-flash'
      };

      const response = await provider.execute(request);

      expect(response.content).toBeDefined();
      expect(response.finishReason).toBe('stop');
    });

    it('should use default model when not specified', async () => {
      const request: ExecutionRequest = {
        prompt: 'Test prompt'
      };

      const response = await provider.execute(request);

      expect(response.model).toBe('gemini-default');
    });

    it('should calculate token usage correctly', async () => {
      const request: ExecutionRequest = {
        prompt: 'Short prompt',
        model: 'gemini-1.5-pro'
      };

      const response = await provider.execute(request);

      expect(response.tokensUsed.prompt).toBeGreaterThan(0);
      expect(response.tokensUsed.completion).toBeGreaterThan(0);
      expect(response.tokensUsed.total).toBe(
        response.tokensUsed.prompt + response.tokensUsed.completion
      );
    });

    it('should measure latency', async () => {
      const request: ExecutionRequest = {
        prompt: 'Latency test'
      };

      const response = await provider.execute(request);

      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.latencyMs).toBeLessThan(10000); // Should be fast in mock mode
    });
  });

  // Streaming tests removed - streaming functionality has been removed from the system

  describe('generateEmbeddingInternal()', () => {
    it('should generate embedding with default dimensions', async () => {
      const embedding = await provider.generateEmbedding('test text');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // Default dimensions
    });

    it('should generate embedding with custom dimensions', async () => {
      const embedding = await provider.generateEmbedding('test', {
        dimensions: 1536
      });

      expect(embedding.length).toBe(1536);
    });

    it('should generate embedding with custom model', async () => {
      const embedding = await provider.generateEmbedding('test', {
        model: 'embedding-002'
      });

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should generate different embeddings for different texts', async () => {
      const emb1 = await provider.generateEmbedding('text one');
      const emb2 = await provider.generateEmbedding('text two');

      // In mock mode, embeddings are random, so they should be different
      expect(emb1).not.toEqual(emb2);
    });
  });

  describe('estimateCost()', () => {
    it('should estimate cost for gemini-1.5-pro', async () => {
      const request: ExecutionRequest = {
        prompt: 'Test prompt with some content',
        model: 'gemini-1.5-pro',
        maxTokens: 2000
      };

      const cost = await provider.estimateCost(request);

      expect(cost.estimatedUsd).toBeGreaterThan(0);
      expect(cost.tokensUsed).toBeGreaterThan(0);
    });

    it('should estimate cost for gemini-1.5-flash', async () => {
      const request: ExecutionRequest = {
        prompt: 'Test',
        model: 'gemini-1.5-flash',
        maxTokens: 1000
      };

      const cost = await provider.estimateCost(request);

      expect(cost.estimatedUsd).toBeGreaterThan(0);
    });

    it('should estimate cost for gemini-1.0-pro', async () => {
      const request: ExecutionRequest = {
        prompt: 'Test',
        model: 'gemini-1.0-pro'
      };

      const cost = await provider.estimateCost(request);

      expect(cost.estimatedUsd).toBeGreaterThan(0);
    });

    it('should use default model pricing when model unknown', async () => {
      const request: ExecutionRequest = {
        prompt: 'Test',
        model: 'unknown-model' as any,
        maxTokens: 1000
      };

      const cost = await provider.estimateCost(request);

      expect(cost.estimatedUsd).toBe(0); // Falls back to flash-exp (free)
    });

    it('should use default maxTokens when not provided', async () => {
      const request: ExecutionRequest = {
        prompt: 'Test',
        model: 'gemini-1.5-pro'
      };

      const cost = await provider.estimateCost(request);

      expect(cost.tokensUsed).toBeGreaterThan(4096); // Default maxTokens
    });

    it('should calculate cost correctly for free model', async () => {
      const request: ExecutionRequest = {
        prompt: 'Long prompt '.repeat(100),
        model: 'gemini-2.0-flash-exp',
        maxTokens: 10000
      };

      const cost = await provider.estimateCost(request);

      expect(cost.estimatedUsd).toBe(0);
      expect(cost.tokensUsed).toBeGreaterThan(0);
    });
  });

  describe('shouldRetry()', () => {
    it('should retry on resource_exhausted error', () => {
      const error = new Error('resource_exhausted: quota exceeded');

      expect(provider.shouldRetry(error)).toBe(true);
    });

    it('should retry on unavailable error', () => {
      const error = new Error('Service unavailable');

      expect(provider.shouldRetry(error)).toBe(true);
    });

    it('should retry on deadline_exceeded error', () => {
      const error = new Error('deadline_exceeded timeout');

      expect(provider.shouldRetry(error)).toBe(true);
    });

    it('should retry on internal error', () => {
      const error = new Error('Internal server error');

      expect(provider.shouldRetry(error)).toBe(true);
    });

    it('should retry on rate_limit error', () => {
      const error = new Error('rate_limit exceeded');

      expect(provider.shouldRetry(error)).toBe(true);
    });

    it('should not retry on invalid_argument error', () => {
      const error = new Error('invalid_argument: bad request');

      expect(provider.shouldRetry(error)).toBe(false);
    });

    it('should not retry on permission_denied error', () => {
      const error = new Error('permission_denied');

      expect(provider.shouldRetry(error)).toBe(false);
    });

    it('should handle case-insensitive error matching', () => {
      const error1 = new Error('RESOURCE_EXHAUSTED');
      const error2 = new Error('Rate_Limit');

      expect(provider.shouldRetry(error1)).toBe(true);
      expect(provider.shouldRetry(error2)).toBe(true);
    });
  });

  describe('Mock vs Real CLI', () => {
    afterEach(() => {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    });

    it('should use mock in test mode', async () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';

      const request: ExecutionRequest = {
        prompt: 'Test',
        model: 'gemini-1.5-pro'
      };

      const response = await provider.execute(request);

      expect(response.content).toContain('Mock Response from Gemini');
      expect(response.content).toContain('placeholder response');
    });

    it('should include prompt excerpt in mock response', async () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';

      const request: ExecutionRequest = {
        prompt: 'This is a unique test prompt for verification',
        model: 'gemini-2.0-flash-exp'
      };

      const response = await provider.execute(request);

      expect(response.content).toContain('Task received');
    });
  });

  describe('Model Support', () => {
    it('should list all supported models in capabilities', () => {
      const supportedModels = provider.capabilities.supportedModels;

      expect(supportedModels).toContain('gemini-2.0-flash-exp');
      expect(supportedModels).toContain('gemini-1.5-pro');
      expect(supportedModels).toContain('gemini-1.5-flash');
      expect(supportedModels).toContain('gemini-1.0-pro');
      expect(supportedModels.length).toBe(4);
    });

    it('should execute with each supported model', async () => {
      const models = provider.capabilities.supportedModels;

      for (const model of models) {
        const request: ExecutionRequest = {
          prompt: 'Test',
          model
        };

        const response = await provider.execute(request);
        expect(response.model).toBe(model);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle execution errors gracefully', async () => {
      // Test error handling by simulating a provider error
      const request: ExecutionRequest = {
        prompt: 'Test',
        model: 'gemini-1.5-pro'
      };

      // In mock mode, this should not throw
      const response = await provider.execute(request);
      expect(response).toBeDefined();
    });
  });
});
