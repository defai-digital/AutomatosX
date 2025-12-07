/**
 * Fallback Decision Logic
 *
 * Determines whether to retry SDK, fallback to CLI, or propagate errors
 * in the SDK-first provider architecture.
 *
 * v12.0.0: Added as part of PRD-012 provider architecture refactoring.
 *
 * @module providers/fallback-decision
 */

import { logger } from '@/shared/logging/logger.js';
import { isSDKFallbackEnabled } from '@/core/feature-flags/flags.js';

/**
 * Fallback decision result
 */
export enum FallbackDecision {
  /** Retry SDK execution (transient error) */
  RETRY_SDK = 'retry_sdk',

  /** Fallback to CLI execution (SDK unavailable) */
  USE_CLI = 'use_cli',

  /** Propagate error (fatal, non-recoverable) */
  PROPAGATE = 'propagate'
}

/**
 * Error classification for fallback decisions
 */
export interface ErrorClassification {
  /** The decision to take */
  decision: FallbackDecision;

  /** Human-readable reason for the decision */
  reason: string;

  /** Whether this error should be logged as warning vs error */
  severity: 'warn' | 'error';

  /** Suggested retry delay in ms (only for RETRY_SDK) */
  retryDelayMs?: number;
}

/**
 * SDK unavailability error patterns
 *
 * These indicate the SDK is not installed or cannot be initialized.
 */
const SDK_UNAVAILABLE_PATTERNS = [
  'module not found',
  'cannot find module',
  'sdk not available',
  'sdk not installed',
  'failed to initialize sdk',
  'sdk initialization failed',
  'package not found',
  '@zhipuai/sdk',
  '@xai-org/grok-sdk',
  '@openai/codex-sdk',
  'enoent',  // File not found (npm module missing)
  'cannot resolve',
  'dynamic import failed'
];

/**
 * Authentication error patterns
 *
 * These should NOT trigger fallback (CLI would fail with same error).
 */
const AUTH_ERROR_PATTERNS = [
  'authentication failed',
  'invalid api key',
  'invalid_api_key',
  'unauthorized',
  'api key not found',
  'api_key_invalid',
  'invalid credentials',
  'authentication required',
  'access denied',
  '401',
  '403',
  'forbidden',
  'invalid_grant',
  'token expired',
  'invalid token'
];

/**
 * Transient error patterns
 *
 * These should trigger SDK retry with backoff.
 */
const TRANSIENT_ERROR_PATTERNS = [
  'timeout',
  'etimedout',
  'econnreset',
  'econnrefused',
  'enotfound',
  'network error',
  'socket hang up',
  'connection reset',
  'temporary failure',
  'service unavailable',
  '503',
  '504',
  'gateway timeout',
  'bad gateway',
  '502'
];

/**
 * Rate limit error patterns
 *
 * These should trigger SDK retry with longer backoff.
 */
const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'rate_limit',
  'too many requests',
  '429',
  'throttled',
  'quota exceeded',
  'resource_exhausted',
  'overloaded'
];

/**
 * Server error patterns (5xx)
 *
 * These should trigger SDK retry.
 */
const SERVER_ERROR_PATTERNS = [
  '500',
  '502',
  '503',
  '504',
  'internal server error',
  'internal error',
  'server error'
];

/**
 * Client error patterns (4xx except auth)
 *
 * These should NOT trigger fallback (same error would occur with CLI).
 */
const CLIENT_ERROR_PATTERNS = [
  '400',
  'bad request',
  'invalid request',
  'validation error',
  'invalid parameter',
  'missing parameter',
  'malformed request'
];

/**
 * Decide whether to retry SDK, fallback to CLI, or propagate error
 *
 * Decision logic:
 * 1. SDK unavailable → USE_CLI (fallback)
 * 2. Auth errors → PROPAGATE (CLI would fail too)
 * 3. Transient/network errors → RETRY_SDK
 * 4. Rate limit errors → RETRY_SDK (with longer delay)
 * 5. Server errors (5xx) → RETRY_SDK
 * 6. Client errors (4xx) → PROPAGATE (CLI would fail too)
 * 7. Unknown → USE_CLI (safe default)
 *
 * @param error - The error from SDK execution
 * @param providerName - The provider name (for logging)
 * @returns Classification with decision and reason
 */
export function decideFallback(
  error: Error | unknown,
  providerName: string
): ErrorClassification {
  const errorMessage = getErrorMessage(error).toLowerCase();
  const errorCode = getErrorCode(error);
  const statusCode = getStatusCode(error);

  logger.debug('Classifying error for fallback decision', {
    provider: providerName,
    message: errorMessage.substring(0, 100),
    code: errorCode,
    statusCode
  });

  // 1. Check SDK unavailability (should fallback)
  if (matchesPatterns(errorMessage, SDK_UNAVAILABLE_PATTERNS)) {
    return {
      decision: FallbackDecision.USE_CLI,
      reason: 'SDK not available or not installed',
      severity: 'warn'
    };
  }

  // 2. Check authentication errors (should NOT fallback)
  if (matchesPatterns(errorMessage, AUTH_ERROR_PATTERNS) ||
      statusCode === 401 || statusCode === 403) {
    return {
      decision: FallbackDecision.PROPAGATE,
      reason: 'Authentication error - CLI would fail with same credentials',
      severity: 'error'
    };
  }

  // 3. Check rate limit errors (retry with longer delay)
  if (matchesPatterns(errorMessage, RATE_LIMIT_PATTERNS) || statusCode === 429) {
    return {
      decision: FallbackDecision.RETRY_SDK,
      reason: 'Rate limited - retrying with backoff',
      severity: 'warn',
      retryDelayMs: 5000  // Longer delay for rate limits
    };
  }

  // 4. Check transient/network errors (retry)
  if (matchesPatterns(errorMessage, TRANSIENT_ERROR_PATTERNS)) {
    return {
      decision: FallbackDecision.RETRY_SDK,
      reason: 'Transient network error - retrying',
      severity: 'warn',
      retryDelayMs: 1000
    };
  }

  // 5. Check server errors (retry)
  if (matchesPatterns(errorMessage, SERVER_ERROR_PATTERNS) ||
      (statusCode && statusCode >= 500 && statusCode < 600)) {
    return {
      decision: FallbackDecision.RETRY_SDK,
      reason: 'Server error - retrying',
      severity: 'warn',
      retryDelayMs: 2000
    };
  }

  // 6. Check client errors (should NOT fallback)
  if (matchesPatterns(errorMessage, CLIENT_ERROR_PATTERNS) ||
      (statusCode && statusCode >= 400 && statusCode < 500)) {
    return {
      decision: FallbackDecision.PROPAGATE,
      reason: 'Client error - request is invalid',
      severity: 'error'
    };
  }

  // 7. Unknown error - fallback to CLI as safe default
  // But only if fallback is enabled
  if (isSDKFallbackEnabled()) {
    return {
      decision: FallbackDecision.USE_CLI,
      reason: 'Unknown error - falling back to CLI',
      severity: 'warn'
    };
  }

  // Fallback disabled - propagate unknown errors
  return {
    decision: FallbackDecision.PROPAGATE,
    reason: 'Unknown error and fallback is disabled',
    severity: 'error'
  };
}

/**
 * Check if an error is retryable (convenience function)
 */
export function isRetryableError(error: Error | unknown, providerName: string): boolean {
  const classification = decideFallback(error, providerName);
  return classification.decision === FallbackDecision.RETRY_SDK;
}

/**
 * Check if an error should trigger CLI fallback (convenience function)
 */
export function shouldFallbackToCLI(error: Error | unknown, providerName: string): boolean {
  const classification = decideFallback(error, providerName);
  return classification.decision === FallbackDecision.USE_CLI;
}

/**
 * Get suggested retry delay for an error
 */
export function getRetryDelay(error: Error | unknown, providerName: string): number {
  const classification = decideFallback(error, providerName);
  return classification.retryDelayMs || 1000;
}

/**
 * Helper: Extract error message from various error formats
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    if (typeof obj.error === 'string') {
      return obj.error;
    }
    if (obj.error && typeof obj.error === 'object') {
      const innerError = obj.error as Record<string, unknown>;
      if (typeof innerError.message === 'string') {
        return innerError.message;
      }
    }
  }
  return String(error);
}

/**
 * Helper: Extract error code from various error formats
 */
function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === 'string') {
      return obj.code;
    }
    if (typeof obj.errorCode === 'string') {
      return obj.errorCode;
    }
  }
  return undefined;
}

/**
 * Helper: Extract HTTP status code from various error formats
 */
function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.status === 'number') {
      return obj.status;
    }
    if (typeof obj.statusCode === 'number') {
      return obj.statusCode;
    }
    if (obj.response && typeof obj.response === 'object') {
      const response = obj.response as Record<string, unknown>;
      if (typeof response.status === 'number') {
        return response.status;
      }
    }
  }
  return undefined;
}

/**
 * Helper: Check if message matches any pattern
 */
function matchesPatterns(message: string, patterns: string[]): boolean {
  return patterns.some(pattern => message.includes(pattern.toLowerCase()));
}
