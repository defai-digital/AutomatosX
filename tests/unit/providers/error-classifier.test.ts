/**
 * Tests for the unified error classifier
 */

import { describe, it, expect } from 'vitest';
import {
  classifyError,
  isQuotaError,
  isRateLimitError,
  isLimitError,
  shouldRetryError,
  getErrorCategory,
} from '../../../src/providers/error-classifier.js';

describe('error-classifier', () => {
  describe('classifyError', () => {
    describe('quota errors', () => {
      it('should detect Gemini quota errors', () => {
        const error = new Error('RESOURCE_EXHAUSTED: Quota exceeded');
        const result = classifyError(error, 'gemini');

        expect(result.isQuotaError).toBe(true);
        expect(result.isLimitError).toBe(true);
        expect(result.category).toBe('quota');
      });

      it('should detect Claude quota errors', () => {
        const error = new Error('insufficient_quota: Monthly limit reached');
        const result = classifyError(error, 'claude');

        expect(result.isQuotaError).toBe(true);
        expect(result.isLimitError).toBe(true);
        expect(result.category).toBe('quota');
      });

      it('should detect OpenAI quota errors', () => {
        const error = new Error('billing hard limit reached');
        const result = classifyError(error, 'openai');

        expect(result.isQuotaError).toBe(true);
        expect(result.isLimitError).toBe(true);
        expect(result.category).toBe('quota');
      });
    });

    describe('rate limit errors', () => {
      it('should detect Gemini rate limit errors', () => {
        const error = new Error('RATE_LIMIT_EXCEEDED');
        const result = classifyError(error, 'gemini');

        expect(result.isRateLimitError).toBe(true);
        expect(result.isLimitError).toBe(true);
        expect(result.shouldRetry).toBe(true);
        expect(result.category).toBe('rate_limit');
      });

      it('should detect Claude rate limit errors', () => {
        const error = new Error('rate_limit_error: Too many requests');
        const result = classifyError(error, 'claude');

        expect(result.isRateLimitError).toBe(true);
        expect(result.shouldRetry).toBe(true);
      });

      it('should detect Claude overloaded errors as rate limit', () => {
        const error = new Error('overloaded_error');
        const result = classifyError(error, 'claude');

        expect(result.isRateLimitError).toBe(true);
        expect(result.shouldRetry).toBe(true);
      });

      it('should detect OpenAI rate limit errors', () => {
        const error = new Error('rate_limit_exceeded');
        const result = classifyError(error, 'openai');

        expect(result.isRateLimitError).toBe(true);
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe('network errors', () => {
      it('should detect connection reset errors', () => {
        const error = new Error('ECONNRESET');
        const result = classifyError(error, 'claude');

        expect(result.category).toBe('network');
        expect(result.shouldRetry).toBe(true);
      });

      it('should detect timeout errors', () => {
        const error = new Error('ETIMEDOUT');
        const result = classifyError(error, 'gemini');

        expect(result.category).toBe('network');
        expect(result.shouldRetry).toBe(true);
      });

      it('should detect connection refused errors', () => {
        const error = new Error('ECONNREFUSED');
        const result = classifyError(error, 'openai');

        expect(result.category).toBe('network');
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe('server errors', () => {
      it('should detect internal server errors', () => {
        const error = new Error('internal_server_error');
        const result = classifyError(error, 'claude');

        expect(result.category).toBe('server');
        expect(result.shouldRetry).toBe(true);
      });

      it('should detect service unavailable errors', () => {
        const error = new Error('service_unavailable');
        const result = classifyError(error, 'gemini');

        expect(result.category).toBe('server');
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe('non-retryable errors', () => {
      it('should not retry authentication errors', () => {
        const error = new Error('invalid_api_key');
        const result = classifyError(error, 'claude');

        expect(result.shouldRetry).toBe(false);
        expect(result.category).toBe('authentication');
      });

      it('should not retry unauthorized errors', () => {
        const error = new Error('unauthorized');
        const result = classifyError(error, 'gemini');

        expect(result.shouldRetry).toBe(false);
        expect(result.category).toBe('authentication');
      });

      it('should not retry permission denied errors', () => {
        const error = new Error('permission denied');
        const result = classifyError(error, 'openai');

        expect(result.shouldRetry).toBe(false);
      });
    });

    describe('provider aliases', () => {
      it('should work with claude-code alias', () => {
        const error = new Error('rate_limit_error');
        const result = classifyError(error, 'claude-code');

        expect(result.isRateLimitError).toBe(true);
      });

      it('should work with gemini-cli alias', () => {
        const error = new Error('RESOURCE_EXHAUSTED');
        const result = classifyError(error, 'gemini-cli');

        expect(result.isQuotaError).toBe(true);
      });

      it('should work with glm alias', () => {
        const error = new Error('rate_limit_exceeded');
        const result = classifyError(error, 'glm');

        expect(result.isRateLimitError).toBe(true);
      });

      it('should work with grok alias', () => {
        const error = new Error('insufficient_quota');
        const result = classifyError(error, 'grok');

        expect(result.isQuotaError).toBe(true);
      });
    });

    describe('error object types', () => {
      it('should handle Error objects', () => {
        const error = new Error('rate_limit_exceeded');
        const result = classifyError(error, 'openai');

        expect(result.isRateLimitError).toBe(true);
      });

      it('should handle plain objects with message', () => {
        const error = { message: 'rate_limit_exceeded' };
        const result = classifyError(error, 'openai');

        expect(result.isRateLimitError).toBe(true);
      });

      it('should handle objects with code property', () => {
        const error = { message: 'Error', code: 'RATE_LIMIT_EXCEEDED' };
        const result = classifyError(error, 'gemini');

        expect(result.isRateLimitError).toBe(true);
      });

      it('should handle string errors', () => {
        const error = 'rate_limit_exceeded';
        const result = classifyError(error, 'openai');

        expect(result.isRateLimitError).toBe(true);
      });

      it('should handle null/undefined gracefully', () => {
        const result1 = classifyError(null, 'claude');
        const result2 = classifyError(undefined, 'claude');

        expect(result1.category).toBe('unknown');
        expect(result2.category).toBe('unknown');
      });
    });
  });

  describe('helper functions', () => {
    describe('isQuotaError', () => {
      it('should return true for quota errors', () => {
        expect(isQuotaError(new Error('quota exceeded'), 'gemini')).toBe(true);
      });

      it('should return false for non-quota errors', () => {
        expect(isQuotaError(new Error('network error'), 'gemini')).toBe(false);
      });
    });

    describe('isRateLimitError', () => {
      it('should return true for rate limit errors', () => {
        expect(isRateLimitError(new Error('rate_limit_error'), 'claude')).toBe(true);
      });

      it('should return false for non-rate-limit errors', () => {
        expect(isRateLimitError(new Error('network error'), 'claude')).toBe(false);
      });
    });

    describe('isLimitError', () => {
      it('should return true for quota errors', () => {
        expect(isLimitError(new Error('quota exceeded'), 'gemini')).toBe(true);
      });

      it('should return true for rate limit errors', () => {
        expect(isLimitError(new Error('rate_limit_error'), 'claude')).toBe(true);
      });

      it('should return false for other errors', () => {
        expect(isLimitError(new Error('network error'), 'gemini')).toBe(false);
      });
    });

    describe('shouldRetryError', () => {
      it('should return true for rate limit errors', () => {
        expect(shouldRetryError(new Error('rate_limit_exceeded'), 'openai')).toBe(true);
      });

      it('should return true for network errors', () => {
        expect(shouldRetryError(new Error('ECONNRESET'), 'claude')).toBe(true);
      });

      it('should return true for server errors', () => {
        expect(shouldRetryError(new Error('internal_server_error'), 'gemini')).toBe(true);
      });

      it('should return false for auth errors', () => {
        expect(shouldRetryError(new Error('invalid_api_key'), 'openai')).toBe(false);
      });
    });

    describe('getErrorCategory', () => {
      it('should return quota for quota errors', () => {
        expect(getErrorCategory(new Error('quota exceeded'), 'gemini')).toBe('quota');
      });

      it('should return rate_limit for rate limit errors', () => {
        expect(getErrorCategory(new Error('rate_limit_error'), 'claude')).toBe('rate_limit');
      });

      it('should return network for network errors', () => {
        expect(getErrorCategory(new Error('ECONNRESET'), 'openai')).toBe('network');
      });

      it('should return server for server errors', () => {
        expect(getErrorCategory(new Error('internal_server_error'), 'gemini')).toBe('server');
      });

      it('should return authentication for auth errors', () => {
        expect(getErrorCategory(new Error('invalid_api_key'), 'claude')).toBe('authentication');
      });

      it('should return unknown for unrecognized errors', () => {
        expect(getErrorCategory(new Error('some random error'), 'openai')).toBe('unknown');
      });
    });
  });
});
