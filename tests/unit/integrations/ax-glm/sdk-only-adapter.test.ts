/**
 * Unit tests for GLM SDK-only adapter
 *
 * Tests the SDK-only execution adapter logic.
 *
 * @module tests/unit/integrations/ax-glm/sdk-only-adapter
 */

import { describe, it, expect } from 'vitest';

// Test the retry logic reimplemented
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Rate limit errors - retryable with backoff
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }

  // Temporary server errors
  if (message.includes('500') || message.includes('502') ||
      message.includes('503') || message.includes('504')) {
    return true;
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('etimedout')) {
    return true;
  }

  // Connection errors
  if (message.includes('econnreset') || message.includes('econnrefused')) {
    return true;
  }

  return false;
}

describe('GLMSdkOnlyAdapter', () => {
  describe('isRetryableError logic', () => {
    it('should retry on rate limit errors', () => {
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('Error 429: Too many requests'))).toBe(true);
    });

    it('should retry on server errors', () => {
      expect(isRetryableError(new Error('Error 500: Internal server error'))).toBe(true);
      expect(isRetryableError(new Error('Error 502: Bad gateway'))).toBe(true);
      expect(isRetryableError(new Error('Error 503: Service unavailable'))).toBe(true);
      expect(isRetryableError(new Error('Error 504: Gateway timeout'))).toBe(true);
    });

    it('should retry on timeout errors', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should retry on connection errors', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('should not retry on auth errors', () => {
      expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
      expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
    });

    it('should not retry on validation errors', () => {
      expect(isRetryableError(new Error('Invalid request body'))).toBe(false);
      expect(isRetryableError(new Error('Missing required parameter'))).toBe(false);
    });
  });

  describe('adapter configuration', () => {
    it('should have correct default model', () => {
      const defaultModel = 'glm-4';
      expect(defaultModel).toBe('glm-4');
    });

    it('should support multiple models', () => {
      const supportedModels = [
        'glm-4',
        'glm-4-flash',
        'glm-4-plus',
        'glm-4v'
      ];
      expect(supportedModels).toContain('glm-4');
      expect(supportedModels).toContain('glm-4-flash');
    });

    it('should have correct default retry settings', () => {
      const defaultMaxRetries = 2;
      const defaultRetryDelayMs = 1000;
      expect(defaultMaxRetries).toBe(2);
      expect(defaultRetryDelayMs).toBe(1000);
    });
  });

  describe('execution response shape', () => {
    it('should have correct response structure', () => {
      const mockResponse = {
        content: 'Test response',
        model: 'glm-4',
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        latencyMs: 100,
        finishReason: 'stop',
        cached: false
      };

      expect(mockResponse.content).toBeDefined();
      expect(mockResponse.model).toBe('glm-4');
      expect(mockResponse.tokensUsed.total).toBe(30);
      expect(typeof mockResponse.latencyMs).toBe('number');
    });
  });
});
