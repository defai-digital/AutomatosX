/**
 * Comprehensive tests for error-patterns.ts
 *
 * Tests for provider-specific error pattern matching.
 */

import { describe, it, expect } from 'vitest';
import {
  PROVIDER_ERROR_PATTERNS,
  GENERIC_ERROR_PATTERNS,
  isQuotaError,
  isRateLimitError,
  isLimitError,
  getProviderErrorPatterns,
  type ProviderErrorPatterns
} from '../../../src/providers/error-patterns.js';

describe('error-patterns', () => {
  describe('PROVIDER_ERROR_PATTERNS', () => {
    it('should have patterns for gemini provider', () => {
      const geminiPatterns = PROVIDER_ERROR_PATTERNS.gemini;
      expect(geminiPatterns).toBeDefined();
      expect(geminiPatterns!.quota).toContain('RESOURCE_EXHAUSTED');
      expect(geminiPatterns!.rateLimit).toContain('RATE_LIMIT_EXCEEDED');
      expect(geminiPatterns!.statusCodes).toContain(429);
    });

    it('should have patterns for claude provider', () => {
      const claudePatterns = PROVIDER_ERROR_PATTERNS.claude;
      expect(claudePatterns).toBeDefined();
      expect(claudePatterns!.quota).toContain('insufficient_quota');
      expect(claudePatterns!.rateLimit).toContain('rate_limit_error');
      expect(claudePatterns!.statusCodes).toContain(529);
    });

    it('should have patterns for codex provider', () => {
      const codexPatterns = PROVIDER_ERROR_PATTERNS.codex;
      expect(codexPatterns).toBeDefined();
      expect(codexPatterns!.quota).toContain('billing hard limit reached');
      expect(codexPatterns!.rateLimit).toContain('too_many_requests');
    });

    it('should have patterns for glm provider', () => {
      const glmPatterns = PROVIDER_ERROR_PATTERNS.glm;
      expect(glmPatterns).toBeDefined();
      // GLM uses OpenAI-compatible API patterns
      expect(glmPatterns!.quota).toContain('insufficient_quota');
    });

    it('should have patterns for grok provider', () => {
      const grokPatterns = PROVIDER_ERROR_PATTERNS.grok;
      expect(grokPatterns).toBeDefined();
      // Grok uses OpenAI-compatible API patterns
      expect(grokPatterns!.rateLimit).toContain('rate_limit_exceeded');
    });

    it('should have alias patterns for gemini-cli', () => {
      expect(PROVIDER_ERROR_PATTERNS['gemini-cli']).toBe(PROVIDER_ERROR_PATTERNS.gemini);
    });

    it('should have alias patterns for claude-code', () => {
      expect(PROVIDER_ERROR_PATTERNS['claude-code']).toBe(PROVIDER_ERROR_PATTERNS.claude);
    });

    it('should have alias patterns for openai', () => {
      expect(PROVIDER_ERROR_PATTERNS['openai']).toBe(PROVIDER_ERROR_PATTERNS.codex);
    });

    it('should have alias patterns for ax-glm', () => {
      expect(PROVIDER_ERROR_PATTERNS['ax-glm']).toBeDefined();
    });

    it('should have alias patterns for ax-grok', () => {
      expect(PROVIDER_ERROR_PATTERNS['ax-grok']).toBeDefined();
    });
  });

  describe('GENERIC_ERROR_PATTERNS', () => {
    it('should have generic quota patterns', () => {
      expect(GENERIC_ERROR_PATTERNS.quota).toContain('quota');
      expect(GENERIC_ERROR_PATTERNS.quota).toContain('quota exceeded');
      expect(GENERIC_ERROR_PATTERNS.quota).toContain('insufficient quota');
    });

    it('should have generic rate limit patterns', () => {
      expect(GENERIC_ERROR_PATTERNS.rateLimit).toContain('rate limit');
      expect(GENERIC_ERROR_PATTERNS.rateLimit).toContain('rate_limit');
      expect(GENERIC_ERROR_PATTERNS.rateLimit).toContain('too many requests');
      expect(GENERIC_ERROR_PATTERNS.rateLimit).toContain('throttle');
    });

    it('should have status codes 429 and 529', () => {
      expect(GENERIC_ERROR_PATTERNS.statusCodes).toContain(429);
      expect(GENERIC_ERROR_PATTERNS.statusCodes).toContain(529);
    });

    it('should have empty errorCodes array', () => {
      expect(GENERIC_ERROR_PATTERNS.errorCodes).toEqual([]);
    });
  });

  describe('isQuotaError', () => {
    describe('Gemini provider', () => {
      it('should detect RESOURCE_EXHAUSTED error', () => {
        const error = { message: 'RESOURCE_EXHAUSTED: quota exceeded' };
        expect(isQuotaError(error, 'gemini')).toBe(true);
      });

      it('should detect quotaExceeded error', () => {
        const error = { message: 'Error: quotaExceeded' };
        expect(isQuotaError(error, 'gemini')).toBe(true);
      });

      it('should detect error by code', () => {
        const error = { message: '', code: 'RESOURCE_EXHAUSTED' };
        expect(isQuotaError(error, 'gemini')).toBe(true);
      });
    });

    describe('Claude provider', () => {
      it('should detect insufficient_quota error', () => {
        const error = { message: 'insufficient_quota: credits depleted' };
        expect(isQuotaError(error, 'claude')).toBe(true);
      });

      it('should detect credit limit reached error', () => {
        const error = { message: 'Credit limit reached for this month' };
        expect(isQuotaError(error, 'claude')).toBe(true);
      });
    });

    describe('OpenAI/Codex provider', () => {
      it('should detect billing hard limit reached', () => {
        const error = { message: 'billing hard limit reached' };
        expect(isQuotaError(error, 'codex')).toBe(true);
      });

      it('should detect insufficient_quota by code', () => {
        const error = { message: '', code: 'insufficient_quota' };
        expect(isQuotaError(error, 'openai')).toBe(true);
      });
    });

    describe('status code handling', () => {
      it('should not treat 429 as quota error without quota message', () => {
        const error = { message: 'too many requests', status: 429 };
        expect(isQuotaError(error, 'gemini')).toBe(false);
      });

      it('should treat 429 as quota error with quota message', () => {
        const error = { message: 'quota exceeded', status: 429 };
        expect(isQuotaError(error, 'gemini')).toBe(true);
      });

      it('should return false for status code only without message', () => {
        const error = { status: 429 };
        expect(isQuotaError(error, 'claude')).toBe(false);
      });

      it('should handle statusCode property (alias)', () => {
        const error = { message: 'quota exceeded', statusCode: 429 };
        expect(isQuotaError(error, 'openai')).toBe(true);
      });
    });

    describe('unknown provider', () => {
      it('should use generic patterns for unknown provider', () => {
        const error = { message: 'quota exceeded' };
        expect(isQuotaError(error, 'unknown-provider')).toBe(true);
      });

      it('should detect insufficient quota for unknown provider', () => {
        const error = { message: 'insufficient quota' };
        expect(isQuotaError(error, 'some-new-provider')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle null error', () => {
        expect(isQuotaError(null, 'gemini')).toBe(false);
      });

      it('should handle undefined error', () => {
        expect(isQuotaError(undefined, 'claude')).toBe(false);
      });

      it('should handle empty object', () => {
        expect(isQuotaError({}, 'openai')).toBe(false);
      });

      it('should handle string error', () => {
        expect(isQuotaError('quota exceeded', 'gemini')).toBe(false);
      });

      it('should be case insensitive', () => {
        const error = { message: 'QUOTA EXCEEDED' };
        expect(isQuotaError(error, 'gemini')).toBe(true);
      });
    });
  });

  describe('isRateLimitError', () => {
    describe('Gemini provider', () => {
      it('should detect RATE_LIMIT_EXCEEDED error', () => {
        const error = { message: 'RATE_LIMIT_EXCEEDED' };
        expect(isRateLimitError(error, 'gemini')).toBe(true);
      });

      it('should detect too many requests', () => {
        const error = { message: 'too many requests per minute' };
        expect(isRateLimitError(error, 'gemini')).toBe(true);
      });
    });

    describe('Claude provider', () => {
      it('should detect rate_limit_error', () => {
        const error = { message: 'rate_limit_error' };
        expect(isRateLimitError(error, 'claude')).toBe(true);
      });

      it('should detect overloaded_error', () => {
        const error = { message: 'overloaded_error: server busy' };
        expect(isRateLimitError(error, 'claude')).toBe(true);
      });

      it('should detect 529 status code', () => {
        const error = { message: '', status: 529 };
        expect(isRateLimitError(error, 'claude')).toBe(true);
      });
    });

    describe('OpenAI/Codex provider', () => {
      it('should detect too_many_requests', () => {
        const error = { message: 'too_many_requests' };
        expect(isRateLimitError(error, 'codex')).toBe(true);
      });

      it('should detect tokens per minute exceeded', () => {
        const error = { message: 'tokens per minute exceeded' };
        expect(isRateLimitError(error, 'openai')).toBe(true);
      });
    });

    describe('error code handling', () => {
      it('should detect RATE_LIMIT_EXCEEDED code', () => {
        const error = { message: '', code: 'RATE_LIMIT_EXCEEDED' };
        expect(isRateLimitError(error, 'gemini')).toBe(true);
      });

      it('should detect rate_limit_error code', () => {
        const error = { message: '', code: 'rate_limit_error' };
        expect(isRateLimitError(error, 'claude')).toBe(true);
      });

      it('should not detect too_many_requests as error code (not in rateLimitCodes)', () => {
        // too_many_requests is in the message patterns, not error codes
        const error = { message: '', code: 'too_many_requests' };
        expect(isRateLimitError(error, 'openai')).toBe(false);
      });

      it('should detect too_many_requests in message', () => {
        const error = { message: 'too_many_requests' };
        expect(isRateLimitError(error, 'openai')).toBe(true);
      });
    });

    describe('status code handling', () => {
      it('should detect 429 status code', () => {
        const error = { message: '', status: 429 };
        expect(isRateLimitError(error, 'gemini')).toBe(true);
      });

      it('should handle statusCode property', () => {
        const error = { message: '', statusCode: 429 };
        expect(isRateLimitError(error, 'openai')).toBe(true);
      });
    });

    describe('GLM and Grok providers', () => {
      it('should detect rate limit for GLM', () => {
        const error = { message: 'rate_limit_exceeded' };
        expect(isRateLimitError(error, 'glm')).toBe(true);
      });

      it('should detect rate limit for Grok', () => {
        const error = { message: 'too many requests' };
        expect(isRateLimitError(error, 'grok')).toBe(true);
      });

      it('should detect rate limit for ax-glm alias', () => {
        const error = { message: 'rate limit exceeded' };
        expect(isRateLimitError(error, 'ax-glm')).toBe(true);
      });

      it('should detect rate limit for ax-grok alias', () => {
        const error = { status: 429 };
        expect(isRateLimitError(error, 'ax-grok')).toBe(true);
      });
    });

    describe('unknown provider', () => {
      it('should use generic patterns', () => {
        const error = { message: 'rate limit' };
        expect(isRateLimitError(error, 'unknown')).toBe(true);
      });

      it('should detect throttle for unknown provider', () => {
        const error = { message: 'request throttled' };
        expect(isRateLimitError(error, 'new-provider')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle null error', () => {
        expect(isRateLimitError(null, 'gemini')).toBe(false);
      });

      it('should handle undefined error', () => {
        expect(isRateLimitError(undefined, 'claude')).toBe(false);
      });

      it('should be case insensitive', () => {
        const error = { message: 'RATE LIMIT EXCEEDED' };
        expect(isRateLimitError(error, 'gemini')).toBe(true);
      });
    });
  });

  describe('isLimitError', () => {
    it('should return true for quota errors', () => {
      const error = { message: 'quota exceeded' };
      expect(isLimitError(error, 'gemini')).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      const error = { message: 'rate limit exceeded' };
      expect(isLimitError(error, 'claude')).toBe(true);
    });

    it('should return true when either quota or rate limit', () => {
      const quotaError = { message: 'insufficient_quota' };
      const rateLimitError = { message: 'too many requests' };

      expect(isLimitError(quotaError, 'openai')).toBe(true);
      expect(isLimitError(rateLimitError, 'openai')).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = { message: 'Internal server error' };
      expect(isLimitError(error, 'gemini')).toBe(false);
    });

    it('should work for all providers', () => {
      const error = { message: 'quota exceeded' };

      expect(isLimitError(error, 'gemini')).toBe(true);
      expect(isLimitError(error, 'claude')).toBe(true);
      expect(isLimitError(error, 'codex')).toBe(true);
      expect(isLimitError(error, 'glm')).toBe(true);
      expect(isLimitError(error, 'grok')).toBe(true);
    });
  });

  describe('getProviderErrorPatterns', () => {
    it('should return patterns for known provider', () => {
      const patterns = getProviderErrorPatterns('gemini');

      expect(patterns).toBe(PROVIDER_ERROR_PATTERNS.gemini);
    });

    it('should return patterns for alias', () => {
      const patterns = getProviderErrorPatterns('claude-code');

      expect(patterns).toBe(PROVIDER_ERROR_PATTERNS.claude);
    });

    it('should return generic patterns for unknown provider', () => {
      const patterns = getProviderErrorPatterns('unknown-provider');

      expect(patterns).toBe(GENERIC_ERROR_PATTERNS);
    });

    it('should return patterns with expected structure', () => {
      const patterns = getProviderErrorPatterns('openai');

      expect(patterns).toHaveProperty('quota');
      expect(patterns).toHaveProperty('rateLimit');
      expect(patterns).toHaveProperty('statusCodes');
      expect(patterns).toHaveProperty('errorCodes');
      expect(Array.isArray(patterns.quota)).toBe(true);
      expect(Array.isArray(patterns.rateLimit)).toBe(true);
      expect(Array.isArray(patterns.statusCodes)).toBe(true);
      expect(Array.isArray(patterns.errorCodes)).toBe(true);
    });
  });
});
