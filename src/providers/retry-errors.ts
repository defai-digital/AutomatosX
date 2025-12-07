/**
 * Retry Errors - Centralized retry error patterns for all providers
 *
 * This module consolidates retry logic to ensure consistent behavior
 * across all provider implementations.
 */

/**
 * Common network errors that should be retried across all providers
 */
export const COMMON_NETWORK_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'connection_error',
  'network connection error',
  'timeout'
] as const;

/**
 * Common rate limit errors that should be retried
 */
export const COMMON_RATE_LIMIT_ERRORS = [
  'rate_limit',
  'rate_limit_error',
  'too many requests'
] as const;

/**
 * Common server errors that should be retried
 */
export const COMMON_SERVER_ERRORS = [
  'internal_server_error',
  'server_error',
  'service_unavailable',
  'unavailable'
] as const;

/**
 * Claude-specific retryable errors
 */
export const CLAUDE_RETRYABLE_ERRORS = [
  'overloaded_error',
  'internal_server_error'
] as const;

/**
 * Gemini-specific retryable errors
 */
export const GEMINI_RETRYABLE_ERRORS = [
  'resource_exhausted',
  'deadline_exceeded',
  'internal'
] as const;

/**
 * OpenAI-specific retryable errors
 */
export const OPENAI_RETRYABLE_ERRORS = [
  'internal_error'
] as const;

/**
 * ax-cli provider retryable errors (v9.2.0)
 *
 * BUG FIX: Added ax-cli specific patterns. ax-cli is a multi-model provider
 * that proxies to GLM, xAI, OpenAI, Anthropic, Ollama, etc.
 * Combines patterns from all backends since errors bubble up from them.
 */
export const AX_CLI_RETRYABLE_ERRORS = [
  // Inherited from Anthropic (via ax-cli)
  'overloaded_error',
  // Inherited from OpenAI (via ax-cli)
  'internal_error',
  // ax-cli specific
  'agent_error',
  'tool_execution_error',
  // xAI/Grok specific
  'service_overloaded'
] as const;

/**
 * Codex provider retryable errors
 *
 * BUG FIX: Added codex patterns (same as OpenAI since Codex uses OpenAI API)
 */
export const CODEX_RETRYABLE_ERRORS = [
  ...OPENAI_RETRYABLE_ERRORS,
  'sandbox_error'  // Codex-specific sandbox issues are often transient
] as const;

/**
 * Errors that should NEVER be retried (authentication, configuration, etc.)
 */
export const NON_RETRYABLE_ERRORS = [
  'authentication',
  'unauthorized',
  'api key',
  'not found',
  'permission denied',
  'invalid_api_key',
  'invalid_request'
] as const;

/**
 * Check if an error message contains any of the specified patterns
 */
export function containsErrorPattern(message: string, patterns: readonly string[]): boolean {
  const lowerMessage = message.toLowerCase();
  return patterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
}

/**
 * Supported provider types for retry error handling
 *
 * v12.0.0: Removed 'ax-cli' (deprecated)
 */
export type RetryableProvider = 'claude' | 'gemini' | 'openai' | 'codex' | 'glm' | 'grok' | 'base';

/**
 * Get all retryable errors for a specific provider
 */
export function getRetryableErrors(provider: RetryableProvider): readonly string[] {
  const baseErrors = [
    ...COMMON_NETWORK_ERRORS,
    ...COMMON_RATE_LIMIT_ERRORS,
    ...COMMON_SERVER_ERRORS
  ];

  switch (provider) {
    case 'claude':
      return [...baseErrors, ...CLAUDE_RETRYABLE_ERRORS];
    case 'gemini':
      return [...baseErrors, ...GEMINI_RETRYABLE_ERRORS];
    case 'openai':
      return [...baseErrors, ...OPENAI_RETRYABLE_ERRORS];
    case 'codex':
      return [...baseErrors, ...CODEX_RETRYABLE_ERRORS];
    case 'glm':
    case 'grok':
      // v12.0.0: GLM/Grok use OpenAI-compatible API, same error patterns
      return [...baseErrors, ...OPENAI_RETRYABLE_ERRORS];
    case 'base':
    default:
      return baseErrors;
  }
}

/**
 * Check if an error should be retried for a specific provider
 *
 * BUG FIX: Updated signature to use RetryableProvider type which includes
 * 'ax-cli' and 'codex' providers.
 */
export function shouldRetryError(
  error: Error,
  provider: RetryableProvider
): boolean {
  const message = error.message;

  // Never retry non-retryable errors
  if (containsErrorPattern(message, NON_RETRYABLE_ERRORS)) {
    return false;
  }

  // Check if error matches provider-specific retryable patterns
  const retryableErrors = getRetryableErrors(provider);
  return containsErrorPattern(message, retryableErrors);
}
