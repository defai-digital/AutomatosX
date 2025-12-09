/**
 * Provider-Specific Error Pattern Registry
 *
 * This module provides comprehensive error pattern matching for detecting quota exhaustion
 * and rate limit errors across different AI providers. Each provider returns errors in
 * different formats, so we need provider-specific pattern matching to ensure reliable detection.
 *
 * Critical for:
 * - Accurate quota exhaustion detection
 * - Proper fallback behavior when providers are limited
 * - Avoiding misclassification of errors
 *
 * @module error-patterns
 */

/**
 * Error pattern configuration for a provider
 */
export interface ProviderErrorPatterns {
  /** Patterns indicating quota exhaustion (daily/monthly limits reached) */
  quota: string[];
  /** Patterns indicating rate limiting (too many requests per second/minute) */
  rateLimit: string[];
  /** HTTP status codes that indicate quota/rate limit errors */
  statusCodes: number[];
  /** Error codes from provider APIs */
  errorCodes: string[];
}

/**
 * Complete registry of error patterns for all supported providers
 *
 * Based on actual provider API documentation and observed error formats:
 * - Gemini: Returns 'RESOURCE_EXHAUSTED' code, 429 status
 * - Claude: Returns 'rate_limit_error', 'overloaded_error', 529 status
 * - OpenAI: Returns 'insufficient_quota', 'rate_limit_exceeded', 429 status
 */
/**
 * Google Gemini Error Patterns
 *
 * Gemini uses gRPC-style error codes and returns structured errors.
 * Common quota errors include RESOURCE_EXHAUSTED and quotaExceeded.
 */
const GEMINI_PATTERNS: ProviderErrorPatterns = {
  quota: [
    'RESOURCE_EXHAUSTED',
    'resource_exhausted',
    'quotaExceeded',
    'quota exceeded',
    'quota limit reached',
    'daily quota exceeded',
    'monthly quota exceeded',
    'insufficient quota',
  ],
  rateLimit: [
    'RATE_LIMIT_EXCEEDED',
    'rate_limit_exceeded',
    'rate limit exceeded',
    'too many requests',
    'requests per minute exceeded',
    'requests per day exceeded',
  ],
  statusCodes: [429], // Too Many Requests
  errorCodes: [
    'RESOURCE_EXHAUSTED',
    'RATE_LIMIT_EXCEEDED',
    'QUOTA_EXCEEDED',
  ],
};

/**
 * Anthropic Claude Error Patterns
 *
 * Claude returns different error types for rate limiting vs overload.
 * Status 529 indicates temporary overload, 429 indicates rate limiting.
 */
const CLAUDE_PATTERNS: ProviderErrorPatterns = {
  quota: [
    'insufficient_quota',
    'quota_exceeded',
    'quota exceeded',
    'credit limit reached',
    'usage limit exceeded',
    'monthly quota exceeded',
  ],
  rateLimit: [
    'rate_limit_error',
    'rate limit exceeded',
    'overloaded_error',
    'overloaded',
    'too many requests',
    'requests per minute exceeded',
  ],
  statusCodes: [429, 529], // Too Many Requests, Overloaded
  errorCodes: [
    'rate_limit_error',
    'overloaded_error',
    'insufficient_quota',
  ],
};

/**
 * OpenAI/Codex Error Patterns
 *
 * OpenAI provides detailed error messages for different types of limits.
 * Distinguishes between quota exhaustion and rate limiting.
 * Codex uses the same patterns as it's built on OpenAI.
 */
const OPENAI_PATTERNS: ProviderErrorPatterns = {
  quota: [
    'insufficient_quota',
    'quota_exceeded',
    'quota exceeded',
    'billing hard limit reached',
    'usage limit exceeded',
    'monthly quota exceeded',
    'credit limit reached',
  ],
  rateLimit: [
    'rate_limit_exceeded',
    'rate limit exceeded',
    'too_many_requests',
    'too many requests',
    'requests per minute exceeded',
    'tokens per minute exceeded',
    'rate limit reached',
  ],
  statusCodes: [429], // Too Many Requests
  errorCodes: [
    'insufficient_quota',
    'rate_limit_exceeded',
    'quota_exceeded',
    'billing_hard_limit_reached',
  ],
};

// v13.0.0: AX_CLI_PATTERNS REMOVED (ax-cli deprecated)
// GLM and Grok now use OpenAI-compatible API patterns

/**
 * Complete registry of error patterns for all supported providers
 *
 * Based on actual provider API documentation and observed error formats.
 * Aliases (claude-code, gemini-cli, codex, openai) reference the same patterns
 * to avoid duplication and ensure consistency.
 */
export const PROVIDER_ERROR_PATTERNS: Record<string, ProviderErrorPatterns> = {
  // Primary providers
  gemini: GEMINI_PATTERNS,
  claude: CLAUDE_PATTERNS,
  codex: OPENAI_PATTERNS,
  // v12.0.0: Removed ax-cli (deprecated)
  glm: OPENAI_PATTERNS,    // v12.0.0: GLM uses OpenAI-compatible API
  grok: OPENAI_PATTERNS,   // v12.0.0: Grok uses OpenAI-compatible API

  // Aliases - reference same patterns to avoid duplication
  'gemini-cli': GEMINI_PATTERNS,  // Alias for gemini
  'claude-code': CLAUDE_PATTERNS, // Alias for claude
  'openai': OPENAI_PATTERNS,      // Alias for codex (same underlying API)
  'ax-glm': OPENAI_PATTERNS,      // v12.0.0: Alias for glm
  'ax-grok': OPENAI_PATTERNS,     // v12.0.0: Alias for grok
};

/**
 * Generic fallback patterns for providers not in the registry
 *
 * These patterns are used when a provider doesn't have specific patterns defined.
 * They're intentionally conservative to avoid false positives.
 */
export const GENERIC_ERROR_PATTERNS: ProviderErrorPatterns = {
  quota: [
    'quota',
    'quota exceeded',
    'insufficient quota',
    'usage limit',
    'credit limit',
  ],
  rateLimit: [
    'rate limit',
    'rate_limit',
    'too many requests',
    'throttle',
    'throttled',
  ],
  statusCodes: [429, 529],
  errorCodes: [],
};

/**
 * Check if an error matches quota exhaustion patterns for a provider
 *
 * @param error - The error object to check
 * @param providerName - The provider name (e.g., 'gemini', 'claude', 'openai')
 * @returns true if the error indicates quota exhaustion
 *
 * @example
 * ```typescript
 * const error = { message: 'RESOURCE_EXHAUSTED', code: 'RESOURCE_EXHAUSTED' };
 * if (isQuotaError(error, 'gemini')) {
 *   console.log('Gemini quota exhausted!');
 * }
 * ```
 */
export function isQuotaError(error: unknown, providerName: string): boolean {
  const patterns = PROVIDER_ERROR_PATTERNS[providerName] || GENERIC_ERROR_PATTERNS;
  const errorObj = error as { message?: string; code?: string; status?: number; statusCode?: number };
  const message = (errorObj?.message || '').toLowerCase();
  const code = errorObj?.code || '';
  const statusCode = errorObj?.status || errorObj?.statusCode;

  // Check error message against quota patterns
  if (patterns.quota.some((pattern) => message.includes(pattern.toLowerCase()))) {
    return true;
  }

  // Check error code
  if (code && patterns.errorCodes.some((errorCode) => code === errorCode)) {
    return true;
  }

  // Check HTTP status code
  if (statusCode && patterns.statusCodes.includes(statusCode)) {
    // Status codes 429/529 could be either quota or rate limit
    // If we have a message, check if it's specifically quota-related
    if (message) {
      return patterns.quota.some((pattern) => message.includes(pattern.toLowerCase()));
    }
    // Without a message, assume it's rate limiting (safer assumption)
    return false;
  }

  return false;
}

/**
 * Check if an error matches rate limit patterns for a provider
 *
 * @param error - The error object to check
 * @param providerName - The provider name (e.g., 'gemini', 'claude', 'openai')
 * @returns true if the error indicates rate limiting
 *
 * @example
 * ```typescript
 * const error = { message: 'rate limit exceeded', status: 429 };
 * if (isRateLimitError(error, 'openai')) {
 *   console.log('OpenAI rate limited!');
 * }
 * ```
 */
export function isRateLimitError(error: unknown, providerName: string): boolean {
  const patterns = PROVIDER_ERROR_PATTERNS[providerName] || GENERIC_ERROR_PATTERNS;
  const errorObj = error as { message?: string; code?: string; status?: number; statusCode?: number };
  const message = (errorObj?.message || '').toLowerCase();
  const code = errorObj?.code || '';
  const statusCode = errorObj?.status || errorObj?.statusCode;

  // Check error message against rate limit patterns
  if (patterns.rateLimit.some((pattern) => message.includes(pattern.toLowerCase()))) {
    return true;
  }

  // Check error code
  if (code && patterns.errorCodes.some((errorCode) => code === errorCode)) {
    // Check if this error code is rate-limit-specific
    const rateLimitCodes = ['RATE_LIMIT_EXCEEDED', 'rate_limit_error', 'too_many_requests'];
    if (rateLimitCodes.some((rlCode) => code === rlCode)) {
      return true;
    }
  }

  // Check HTTP status code
  if (statusCode && patterns.statusCodes.includes(statusCode)) {
    return true;
  }

  return false;
}

/**
 * Check if an error indicates any type of quota or rate limit issue
 *
 * This is a convenience function that checks both quota and rate limit patterns.
 * Use this when you need to detect any limiting error without distinguishing the type.
 *
 * @param error - The error object to check
 * @param providerName - The provider name (e.g., 'gemini', 'claude', 'openai')
 * @returns true if the error indicates quota exhaustion OR rate limiting
 *
 * @example
 * ```typescript
 * const error = { message: 'Too many requests' };
 * if (isLimitError(error, 'claude')) {
 *   console.log('Claude is limited, fallback to another provider');
 * }
 * ```
 */
export function isLimitError(error: any, providerName: string): boolean {
  return isQuotaError(error, providerName) || isRateLimitError(error, providerName);
}

/**
 * Get the error patterns for a specific provider
 *
 * @param providerName - The provider name
 * @returns The error patterns for the provider, or generic patterns if not found
 */
export function getProviderErrorPatterns(providerName: string): ProviderErrorPatterns {
  return PROVIDER_ERROR_PATTERNS[providerName] || GENERIC_ERROR_PATTERNS;
}
