/**
 * Fallback Decision Logic Tests
 *
 * Tests the SDK-first fallback decision logic for PRD-012.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  decideFallback,
  FallbackDecision,
  isRetryableError,
  shouldFallbackToCLI,
  getRetryDelay
} from '@/providers/fallback-decision.js';

// Mock feature flags
vi.mock('@/core/feature-flags/flags.js', () => ({
  isSDKFallbackEnabled: vi.fn(() => true),
  shouldCollectProviderMetrics: vi.fn(() => false)
}));

describe('Fallback Decision Logic', () => {
  const providerName = 'test-provider';

  describe('decideFallback', () => {
    describe('SDK Unavailable Errors', () => {
      it('should return USE_CLI for module not found errors', () => {
        const error = new Error('Cannot find module @zhipuai/sdk');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.USE_CLI);
        expect(result.severity).toBe('warn');
      });

      it('should return USE_CLI for SDK initialization failures', () => {
        const error = new Error('SDK initialization failed');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.USE_CLI);
        expect(result.reason).toContain('SDK not available');
      });

      it('should return USE_CLI for dynamic import failures', () => {
        const error = new Error('Dynamic import failed for @openai/codex-sdk');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.USE_CLI);
      });
    });

    describe('Authentication Errors', () => {
      it('should return PROPAGATE for invalid API key errors', () => {
        const error = new Error('Invalid API key provided');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
        expect(result.severity).toBe('error');
        expect(result.reason).toContain('Authentication');
      });

      it('should return PROPAGATE for 401 status code', () => {
        const error = { message: 'Request failed', statusCode: 401 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });

      it('should return PROPAGATE for 403 status code', () => {
        const error = { message: 'Forbidden', status: 403 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });

      it('should return PROPAGATE for unauthorized errors', () => {
        const error = new Error('Unauthorized access');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });
    });

    describe('Rate Limit Errors', () => {
      it('should return RETRY_SDK for rate limit errors', () => {
        const error = new Error('Rate limit exceeded');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
        expect(result.retryDelayMs).toBe(5000);  // Longer delay for rate limits
      });

      it('should return RETRY_SDK for 429 status code', () => {
        const error = { message: 'Too many requests', statusCode: 429 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for quota exceeded errors', () => {
        const error = new Error('Quota exceeded for today');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for RESOURCE_EXHAUSTED errors', () => {
        const error = new Error('RESOURCE_EXHAUSTED: Daily limit reached');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });
    });

    describe('Transient/Network Errors', () => {
      it('should return RETRY_SDK for timeout errors', () => {
        const error = new Error('Request timeout');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
        expect(result.retryDelayMs).toBe(1000);
      });

      it('should return RETRY_SDK for ETIMEDOUT errors', () => {
        const error = { message: 'connect ETIMEDOUT', code: 'ETIMEDOUT' };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for connection reset errors', () => {
        const error = new Error('ECONNRESET: Connection reset by peer');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for network errors', () => {
        const error = new Error('Network error occurred');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for socket hang up', () => {
        const error = new Error('socket hang up');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });
    });

    describe('Server Errors (5xx)', () => {
      it('should return RETRY_SDK for 500 errors', () => {
        const error = { message: 'Internal server error', statusCode: 500 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
        expect(result.retryDelayMs).toBe(2000);
      });

      it('should return RETRY_SDK for 502 errors', () => {
        const error = { message: 'Bad gateway', status: 502 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for 503 errors', () => {
        const error = { message: 'Service unavailable', statusCode: 503 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });

      it('should return RETRY_SDK for 504 gateway timeout', () => {
        const error = new Error('504 Gateway Timeout');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });
    });

    describe('Client Errors (4xx)', () => {
      it('should return PROPAGATE for 400 bad request', () => {
        const error = { message: 'Bad request', statusCode: 400 };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
        expect(result.severity).toBe('error');
      });

      it('should return PROPAGATE for validation errors', () => {
        const error = new Error('Validation error: missing required field');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });

      it('should return PROPAGATE for invalid parameter errors', () => {
        const error = new Error('Invalid parameter: model');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });
    });

    describe('Unknown Errors', () => {
      it('should return USE_CLI for unknown errors when fallback enabled', () => {
        const error = new Error('Something unexpected happened');
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.USE_CLI);
        expect(result.reason).toContain('Unknown error');
      });

      it('should handle string errors', () => {
        const result = decideFallback('String error message', providerName);

        expect(result.decision).toBe(FallbackDecision.USE_CLI);
      });

      it('should handle null/undefined errors', () => {
        const result = decideFallback(null, providerName);

        expect(result.decision).toBe(FallbackDecision.USE_CLI);
      });
    });

    describe('Error Format Handling', () => {
      it('should extract message from nested error object', () => {
        const error = {
          error: {
            message: 'Invalid API key'
          }
        };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });

      it('should extract status from response object', () => {
        const error = {
          message: 'Request failed',
          response: {
            status: 401
          }
        };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.PROPAGATE);
      });

      it('should handle error objects with error string property', () => {
        const error = {
          error: 'Rate limit exceeded'
        };
        const result = decideFallback(error, providerName);

        expect(result.decision).toBe(FallbackDecision.RETRY_SDK);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('isRetryableError', () => {
      it('should return true for transient errors', () => {
        const error = new Error('Connection timeout');
        expect(isRetryableError(error, providerName)).toBe(true);
      });

      it('should return false for auth errors', () => {
        const error = new Error('Invalid API key');
        expect(isRetryableError(error, providerName)).toBe(false);
      });

      it('should return false for SDK unavailable errors', () => {
        const error = new Error('Cannot find module @zhipuai/sdk');
        expect(isRetryableError(error, providerName)).toBe(false);
      });
    });

    describe('shouldFallbackToCLI', () => {
      it('should return true for SDK unavailable errors', () => {
        const error = new Error('SDK not available');
        expect(shouldFallbackToCLI(error, providerName)).toBe(true);
      });

      it('should return true for unknown errors', () => {
        const error = new Error('Random error');
        expect(shouldFallbackToCLI(error, providerName)).toBe(true);
      });

      it('should return false for auth errors', () => {
        const error = new Error('Unauthorized');
        expect(shouldFallbackToCLI(error, providerName)).toBe(false);
      });

      it('should return false for transient errors', () => {
        const error = new Error('Timeout');
        expect(shouldFallbackToCLI(error, providerName)).toBe(false);
      });
    });

    describe('getRetryDelay', () => {
      it('should return 5000ms for rate limit errors', () => {
        const error = new Error('Rate limit exceeded');
        expect(getRetryDelay(error, providerName)).toBe(5000);
      });

      it('should return 2000ms for server errors', () => {
        const error = { message: 'Server error', statusCode: 500 };
        expect(getRetryDelay(error, providerName)).toBe(2000);
      });

      it('should return 1000ms for transient errors', () => {
        const error = new Error('Connection timeout');
        expect(getRetryDelay(error, providerName)).toBe(1000);
      });

      it('should return default 1000ms for non-retryable errors', () => {
        const error = new Error('Invalid API key');
        expect(getRetryDelay(error, providerName)).toBe(1000);
      });
    });
  });
});
