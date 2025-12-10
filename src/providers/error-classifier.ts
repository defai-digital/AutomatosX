/**
 * Unified Error Classifier
 *
 * Consolidates error pattern matching and retry logic for all providers.
 * This module combines quota/rate-limit detection (from error-patterns.ts)
 * and retry logic (from retry-errors.ts) into a single cohesive API.
 *
 * @module error-classifier
 */

// ============================================
// Types
// ============================================

/**
 * Supported provider types
 */
export type ProviderType =
  | 'claude'
  | 'claude-code'
  | 'gemini'
  | 'gemini-cli'
  | 'openai'
  | 'codex'
  | 'glm'
  | 'ax-glm'
  | 'grok'
  | 'ax-grok'
  | 'qwen'
  | 'qwen-code';

/**
 * Classification result for an error
 */
export interface ErrorClassification {
  /** Is this a quota exhaustion error? */
  isQuotaError: boolean;
  /** Is this a rate limit error? */
  isRateLimitError: boolean;
  /** Is this any kind of limit error? */
  isLimitError: boolean;
  /** Should this error be retried? */
  shouldRetry: boolean;
  /** Error category for logging/metrics */
  category: ErrorCategory;
}

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'quota'
  | 'rate_limit'
  | 'network'
  | 'server'
  | 'authentication'
  | 'validation'
  | 'unknown';

/**
 * Error pattern configuration
 */
interface ErrorPatterns {
  quota: readonly string[];
  rateLimit: readonly string[];
  network: readonly string[];
  server: readonly string[];
  nonRetryable: readonly string[];
  statusCodes: {
    quota: readonly number[];
    rateLimit: readonly number[];
    server: readonly number[];
  };
}

// ============================================
// Pattern Constants
// ============================================

/**
 * Common patterns shared across providers
 */
const COMMON_PATTERNS = {
  network: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'connection_error',
    'network connection error',
    'timeout',
  ] as const,

  server: [
    'internal_server_error',
    'server_error',
    'service_unavailable',
    'unavailable',
  ] as const,

  nonRetryable: [
    'authentication',
    'unauthorized',
    'api key',
    'not found',
    'permission denied',
    'invalid_api_key',
    'invalid_request',
  ] as const,
} as const;

/**
 * Gemini-specific patterns
 */
const GEMINI_PATTERNS: ErrorPatterns = {
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
    'deadline_exceeded',
  ],
  network: [...COMMON_PATTERNS.network],
  server: [...COMMON_PATTERNS.server, 'internal'],
  nonRetryable: [...COMMON_PATTERNS.nonRetryable],
  statusCodes: {
    quota: [429],
    rateLimit: [429],
    server: [500, 502, 503, 504],
  },
};

/**
 * Claude-specific patterns
 */
const CLAUDE_PATTERNS: ErrorPatterns = {
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
  network: [...COMMON_PATTERNS.network],
  server: [...COMMON_PATTERNS.server, 'internal_server_error'],
  nonRetryable: [...COMMON_PATTERNS.nonRetryable],
  statusCodes: {
    quota: [429],
    rateLimit: [429, 529],
    server: [500, 502, 503, 504],
  },
};

/**
 * OpenAI-compatible patterns (OpenAI, Codex, GLM, Grok)
 */
const OPENAI_PATTERNS: ErrorPatterns = {
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
  network: [...COMMON_PATTERNS.network],
  server: [...COMMON_PATTERNS.server, 'internal_error', 'sandbox_error'],
  nonRetryable: [...COMMON_PATTERNS.nonRetryable],
  statusCodes: {
    quota: [429],
    rateLimit: [429],
    server: [500, 502, 503, 504],
  },
};

/**
 * Provider pattern mapping
 */
const PROVIDER_PATTERNS: Record<string, ErrorPatterns> = {
  // Primary providers
  gemini: GEMINI_PATTERNS,
  claude: CLAUDE_PATTERNS,
  openai: OPENAI_PATTERNS,
  codex: OPENAI_PATTERNS,
  glm: OPENAI_PATTERNS,
  grok: OPENAI_PATTERNS,
  qwen: OPENAI_PATTERNS,  // v12.7.0: Qwen uses OpenAI-compatible API

  // Aliases
  'gemini-cli': GEMINI_PATTERNS,
  'claude-code': CLAUDE_PATTERNS,
  'ax-glm': OPENAI_PATTERNS,
  'ax-grok': OPENAI_PATTERNS,
  'qwen-code': OPENAI_PATTERNS,  // v12.7.0: Alias for qwen
};

// ============================================
// Helper Functions
// ============================================

/**
 * Extract error info from unknown error type
 */
function extractErrorInfo(error: unknown): {
  message: string;
  code?: string;
  statusCode?: number;
} {
  if (error instanceof Error) {
    const errorObj = error as Error & {
      code?: string;
      status?: number;
      statusCode?: number;
    };
    return {
      message: errorObj.message,
      code: errorObj.code,
      statusCode: errorObj.status ?? errorObj.statusCode,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      message: String(obj.message ?? ''),
      code: typeof obj.code === 'string' ? obj.code : undefined,
      statusCode:
        typeof obj.status === 'number'
          ? obj.status
          : typeof obj.statusCode === 'number'
            ? obj.statusCode
            : undefined,
    };
  }

  return { message: String(error) };
}

/**
 * Check if message contains any of the patterns (case-insensitive)
 */
function matchesPatterns(
  message: string,
  patterns: readonly string[]
): boolean {
  const lowerMessage = message.toLowerCase();
  return patterns.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}

/**
 * Get patterns for a provider, with fallback to generic patterns
 */
function getPatterns(provider: string): ErrorPatterns {
  return PROVIDER_PATTERNS[provider] ?? OPENAI_PATTERNS;
}

// ============================================
// Public API
// ============================================

/**
 * Classify an error for a specific provider
 *
 * @param error - The error to classify
 * @param provider - The provider name
 * @returns Classification result with all error attributes
 *
 * @example
 * ```typescript
 * const result = classifyError(error, 'gemini');
 * if (result.shouldRetry) {
 *   // Retry the request
 * }
 * if (result.isLimitError) {
 *   // Switch to fallback provider
 * }
 * ```
 */
export function classifyError(
  error: unknown,
  provider: string
): ErrorClassification {
  const { message, code, statusCode } = extractErrorInfo(error);
  const patterns = getPatterns(provider);

  // Check for non-retryable errors first
  if (matchesPatterns(message, patterns.nonRetryable)) {
    return {
      isQuotaError: false,
      isRateLimitError: false,
      isLimitError: false,
      shouldRetry: false,
      category: 'authentication',
    };
  }

  // Check quota patterns
  const isQuotaError =
    matchesPatterns(message, patterns.quota) ||
    (code !== undefined && patterns.quota.includes(code));

  // Check rate limit patterns
  const isRateLimitError =
    matchesPatterns(message, patterns.rateLimit) ||
    (code !== undefined && patterns.rateLimit.includes(code)) ||
    (statusCode !== undefined &&
      patterns.statusCodes.rateLimit.includes(statusCode));

  // Check network errors
  const isNetworkError = matchesPatterns(message, patterns.network);

  // Check server errors
  const isServerError =
    matchesPatterns(message, patterns.server) ||
    (statusCode !== undefined &&
      patterns.statusCodes.server.includes(statusCode));

  // Determine category
  let category: ErrorCategory = 'unknown';
  if (isQuotaError) category = 'quota';
  else if (isRateLimitError) category = 'rate_limit';
  else if (isNetworkError) category = 'network';
  else if (isServerError) category = 'server';

  // Determine if should retry
  const shouldRetry =
    isRateLimitError || isNetworkError || isServerError;

  return {
    isQuotaError,
    isRateLimitError,
    isLimitError: isQuotaError || isRateLimitError,
    shouldRetry,
    category,
  };
}

/**
 * Check if an error indicates quota exhaustion
 */
export function isQuotaError(error: unknown, provider: string): boolean {
  return classifyError(error, provider).isQuotaError;
}

/**
 * Check if an error indicates rate limiting
 */
export function isRateLimitError(error: unknown, provider: string): boolean {
  return classifyError(error, provider).isRateLimitError;
}

/**
 * Check if an error indicates any type of limit
 */
export function isLimitError(error: unknown, provider: string): boolean {
  return classifyError(error, provider).isLimitError;
}

/**
 * Check if an error should be retried
 */
export function shouldRetryError(error: unknown, provider: string): boolean {
  return classifyError(error, provider).shouldRetry;
}

/**
 * Get error category for logging/metrics
 */
export function getErrorCategory(error: unknown, provider: string): ErrorCategory {
  return classifyError(error, provider).category;
}

// ============================================
// Re-exports for backward compatibility
// ============================================

// Re-export types from error-patterns.ts for backward compatibility
export type { ProviderType as RetryableProvider };

// Re-export pattern access for advanced usage
export { PROVIDER_PATTERNS, COMMON_PATTERNS };
