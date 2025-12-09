/**
 * Comprehensive tests for retry-errors.ts
 *
 * Tests for centralized retry error patterns across all providers.
 */

import { describe, it, expect } from 'vitest';
import {
  COMMON_NETWORK_ERRORS,
  COMMON_RATE_LIMIT_ERRORS,
  COMMON_SERVER_ERRORS,
  CLAUDE_RETRYABLE_ERRORS,
  GEMINI_RETRYABLE_ERRORS,
  OPENAI_RETRYABLE_ERRORS,
  CODEX_RETRYABLE_ERRORS,
  NON_RETRYABLE_ERRORS,
  containsErrorPattern,
  getRetryableErrors,
  shouldRetryError,
  type RetryableProvider
} from '../../../src/providers/retry-errors.js';

describe('retry-errors', () => {
  describe('COMMON_NETWORK_ERRORS', () => {
    it('should contain expected network error patterns', () => {
      expect(COMMON_NETWORK_ERRORS).toContain('ECONNRESET');
      expect(COMMON_NETWORK_ERRORS).toContain('ETIMEDOUT');
      expect(COMMON_NETWORK_ERRORS).toContain('ENOTFOUND');
      expect(COMMON_NETWORK_ERRORS).toContain('ECONNREFUSED');
      expect(COMMON_NETWORK_ERRORS).toContain('connection_error');
      expect(COMMON_NETWORK_ERRORS).toContain('network connection error');
      expect(COMMON_NETWORK_ERRORS).toContain('timeout');
    });
  });

  describe('COMMON_RATE_LIMIT_ERRORS', () => {
    it('should contain expected rate limit patterns', () => {
      expect(COMMON_RATE_LIMIT_ERRORS).toContain('rate_limit');
      expect(COMMON_RATE_LIMIT_ERRORS).toContain('rate_limit_error');
      expect(COMMON_RATE_LIMIT_ERRORS).toContain('too many requests');
    });
  });

  describe('COMMON_SERVER_ERRORS', () => {
    it('should contain expected server error patterns', () => {
      expect(COMMON_SERVER_ERRORS).toContain('internal_server_error');
      expect(COMMON_SERVER_ERRORS).toContain('server_error');
      expect(COMMON_SERVER_ERRORS).toContain('service_unavailable');
      expect(COMMON_SERVER_ERRORS).toContain('unavailable');
    });
  });

  describe('CLAUDE_RETRYABLE_ERRORS', () => {
    it('should contain Claude-specific error patterns', () => {
      expect(CLAUDE_RETRYABLE_ERRORS).toContain('overloaded_error');
      expect(CLAUDE_RETRYABLE_ERRORS).toContain('internal_server_error');
    });
  });

  describe('GEMINI_RETRYABLE_ERRORS', () => {
    it('should contain Gemini-specific error patterns', () => {
      expect(GEMINI_RETRYABLE_ERRORS).toContain('resource_exhausted');
      expect(GEMINI_RETRYABLE_ERRORS).toContain('deadline_exceeded');
      expect(GEMINI_RETRYABLE_ERRORS).toContain('internal');
    });
  });

  describe('OPENAI_RETRYABLE_ERRORS', () => {
    it('should contain OpenAI-specific error patterns', () => {
      expect(OPENAI_RETRYABLE_ERRORS).toContain('internal_error');
    });
  });

  describe('CODEX_RETRYABLE_ERRORS', () => {
    it('should include OpenAI patterns plus sandbox_error', () => {
      expect(CODEX_RETRYABLE_ERRORS).toContain('internal_error');
      expect(CODEX_RETRYABLE_ERRORS).toContain('sandbox_error');
    });
  });

  describe('NON_RETRYABLE_ERRORS', () => {
    it('should contain non-retryable error patterns', () => {
      expect(NON_RETRYABLE_ERRORS).toContain('authentication');
      expect(NON_RETRYABLE_ERRORS).toContain('unauthorized');
      expect(NON_RETRYABLE_ERRORS).toContain('api key');
      expect(NON_RETRYABLE_ERRORS).toContain('not found');
      expect(NON_RETRYABLE_ERRORS).toContain('permission denied');
      expect(NON_RETRYABLE_ERRORS).toContain('invalid_api_key');
      expect(NON_RETRYABLE_ERRORS).toContain('invalid_request');
    });
  });

  describe('containsErrorPattern', () => {
    it('should return true when message contains pattern', () => {
      expect(containsErrorPattern('Connection ECONNRESET error', COMMON_NETWORK_ERRORS)).toBe(true);
      expect(containsErrorPattern('Request timeout occurred', COMMON_NETWORK_ERRORS)).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(containsErrorPattern('RATE_LIMIT exceeded', COMMON_RATE_LIMIT_ERRORS)).toBe(true);
      expect(containsErrorPattern('Too Many Requests', COMMON_RATE_LIMIT_ERRORS)).toBe(true);
    });

    it('should return false when no pattern matches', () => {
      expect(containsErrorPattern('Some random error', COMMON_NETWORK_ERRORS)).toBe(false);
      expect(containsErrorPattern('Invalid input', COMMON_RATE_LIMIT_ERRORS)).toBe(false);
    });

    it('should handle empty message', () => {
      expect(containsErrorPattern('', COMMON_NETWORK_ERRORS)).toBe(false);
    });

    it('should handle empty patterns array', () => {
      expect(containsErrorPattern('test message', [])).toBe(false);
    });

    it('should match partial patterns', () => {
      expect(containsErrorPattern('Error: connection_error occurred', COMMON_NETWORK_ERRORS)).toBe(true);
    });
  });

  describe('getRetryableErrors', () => {
    it('should return base errors plus Claude-specific for claude provider', () => {
      const errors = getRetryableErrors('claude');

      // Should include common errors
      expect(errors).toContain('ECONNRESET');
      expect(errors).toContain('rate_limit');
      expect(errors).toContain('internal_server_error');

      // Should include Claude-specific
      expect(errors).toContain('overloaded_error');
    });

    it('should return base errors plus Gemini-specific for gemini provider', () => {
      const errors = getRetryableErrors('gemini');

      // Should include common errors
      expect(errors).toContain('ETIMEDOUT');
      expect(errors).toContain('too many requests');

      // Should include Gemini-specific
      expect(errors).toContain('resource_exhausted');
      expect(errors).toContain('deadline_exceeded');
    });

    it('should return base errors plus OpenAI-specific for openai provider', () => {
      const errors = getRetryableErrors('openai');

      // Should include common errors
      expect(errors).toContain('ECONNREFUSED');
      expect(errors).toContain('service_unavailable');

      // Should include OpenAI-specific
      expect(errors).toContain('internal_error');
    });

    it('should return base errors plus Codex-specific for codex provider', () => {
      const errors = getRetryableErrors('codex');

      // Should include common errors
      expect(errors).toContain('timeout');

      // Should include Codex-specific
      expect(errors).toContain('sandbox_error');
      expect(errors).toContain('internal_error');
    });

    it('should return OpenAI patterns for glm provider', () => {
      const errors = getRetryableErrors('glm');

      // GLM uses OpenAI-compatible API
      expect(errors).toContain('internal_error');
      expect(errors).toContain('ECONNRESET');
    });

    it('should return OpenAI patterns for grok provider', () => {
      const errors = getRetryableErrors('grok');

      // Grok uses OpenAI-compatible API
      expect(errors).toContain('internal_error');
      expect(errors).toContain('rate_limit');
    });

    it('should return base errors only for base provider', () => {
      const errors = getRetryableErrors('base');

      // Should include common errors
      expect(errors).toContain('ECONNRESET');
      expect(errors).toContain('rate_limit');
      expect(errors).toContain('service_unavailable');

      // Should NOT include provider-specific
      expect(errors).not.toContain('overloaded_error');
      expect(errors).not.toContain('resource_exhausted');
      expect(errors).not.toContain('sandbox_error');
    });

    it('should return base errors for unknown provider', () => {
      const errors = getRetryableErrors('unknown' as RetryableProvider);

      // Should include common errors only
      expect(errors).toContain('ECONNRESET');
      expect(errors).toContain('rate_limit');
      expect(errors).not.toContain('overloaded_error');
    });
  });

  describe('shouldRetryError', () => {
    it('should return false for non-retryable authentication errors', () => {
      const error = new Error('Authentication failed');
      expect(shouldRetryError(error, 'claude')).toBe(false);
    });

    it('should return false for unauthorized errors', () => {
      const error = new Error('Unauthorized access');
      expect(shouldRetryError(error, 'gemini')).toBe(false);
    });

    it('should return false for invalid API key errors', () => {
      const error = new Error('Invalid API key provided');
      expect(shouldRetryError(error, 'openai')).toBe(false);
    });

    it('should return false for not found errors', () => {
      const error = new Error('Resource not found');
      expect(shouldRetryError(error, 'codex')).toBe(false);
    });

    it('should return false for permission denied errors', () => {
      const error = new Error('Permission denied');
      expect(shouldRetryError(error, 'claude')).toBe(false);
    });

    it('should return false for invalid request errors', () => {
      const error = new Error('invalid_request: missing parameter');
      expect(shouldRetryError(error, 'openai')).toBe(false);
    });

    it('should return true for network timeout errors', () => {
      const error = new Error('Request timeout');
      expect(shouldRetryError(error, 'claude')).toBe(true);
    });

    it('should return true for ECONNRESET errors', () => {
      const error = new Error('Connection reset: ECONNRESET');
      expect(shouldRetryError(error, 'gemini')).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      const error = new Error('rate_limit exceeded');
      expect(shouldRetryError(error, 'openai')).toBe(true);
    });

    it('should return true for server errors', () => {
      const error = new Error('internal_server_error occurred');
      expect(shouldRetryError(error, 'codex')).toBe(true);
    });

    it('should return true for Claude overloaded errors', () => {
      const error = new Error('overloaded_error: Claude is overloaded');
      expect(shouldRetryError(error, 'claude')).toBe(true);
    });

    it('should return true for Gemini resource exhausted errors', () => {
      const error = new Error('resource_exhausted: quota exceeded');
      expect(shouldRetryError(error, 'gemini')).toBe(true);
    });

    it('should return true for Codex sandbox errors', () => {
      const error = new Error('sandbox_error: execution failed');
      expect(shouldRetryError(error, 'codex')).toBe(true);
    });

    it('should return true for service unavailable', () => {
      const error = new Error('Service temporarily unavailable');
      expect(shouldRetryError(error, 'base')).toBe(true);
    });

    it('should return true for GLM provider network errors', () => {
      const error = new Error('ETIMEDOUT: connection timed out');
      expect(shouldRetryError(error, 'glm')).toBe(true);
    });

    it('should return true for Grok provider rate limits', () => {
      const error = new Error('too many requests');
      expect(shouldRetryError(error, 'grok')).toBe(true);
    });

    it('should handle case insensitive error messages', () => {
      const error = new Error('RATE_LIMIT_ERROR: Too Many Requests');
      expect(shouldRetryError(error, 'claude')).toBe(true);
    });

    it('should return false for random errors', () => {
      const error = new Error('Something went wrong');
      expect(shouldRetryError(error, 'claude')).toBe(false);
    });
  });
});
