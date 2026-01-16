/**
 * Rate Limiter Registry
 *
 * Centralized rate limiting with per-provider isolation.
 * Replaces global rate limiting with provider-scoped token buckets.
 *
 * Features:
 * - Per-provider rate limiters with configurable limits
 * - Session-level quota tracking (optional)
 * - Burst support with token bucket algorithm
 * - Queue management with timeout
 *
 * INV-RATE-001: Rate limiters MUST be scoped per provider
 * INV-RATE-002: Session-level quotas MUST not exceed provider limits
 */

import {
  RATE_LIMIT_RPM_DEFAULT,
  RATE_LIMIT_TPM_DEFAULT,
  LIMIT_QUEUE_SIZE,
  CIRCUIT_QUEUE_TIMEOUT,
} from '@defai.digital/contracts';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Backoff strategies for rate limiting
 */
export type BackoffStrategy = 'linear' | 'exponential' | 'fibonacci';

/**
 * Rate limit configuration for a provider
 */
export interface ProviderRateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum tokens per minute (optional) */
  tokensPerMinute?: number;
  /** Burst multiplier (1.0 = no burst) */
  burstMultiplier: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
  /** Backoff strategy */
  backoffStrategy: BackoffStrategy;
  /** Initial backoff delay in ms */
  initialBackoffMs: number;
  /** Maximum backoff delay in ms */
  maxBackoffMs: number;
  /** Queue size */
  queueSize: number;
  /** Queue timeout in ms */
  queueTimeoutMs: number;
}

/**
 * Session quota configuration
 */
export interface SessionQuotaConfig {
  /** Maximum requests per session */
  maxRequestsPerSession?: number;
  /** Maximum tokens per session */
  maxTokensPerSession?: number;
  /** Session timeout in ms */
  sessionTimeoutMs: number;
  /** Warn threshold (0-1) */
  warnThreshold: number;
}

/**
 * Rate limiter registry configuration
 */
export interface RateLimiterRegistryConfig {
  /** Per-provider configurations */
  providers: Record<string, Partial<ProviderRateLimitConfig>>;
  /** Session quota (optional) */
  sessionQuota: SessionQuotaConfig | undefined;
  /** Global fallback configuration */
  globalFallback: Partial<ProviderRateLimitConfig>;
  /** Enable per-provider isolation */
  enableProviderIsolation: boolean;
  /** Enable session-level tracking */
  enableSessionTracking: boolean;
}

/**
 * Acquire result from rate limiter
 */
export interface RateLimitAcquireResult {
  acquired: boolean;
  waitedMs?: number;
  reason?: 'limit-exceeded' | 'queue-full' | 'timeout' | 'session-quota-exceeded';
  retryAfterMs?: number;
  providerId?: string;
  queuePosition?: number;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  providerId: string;
  requestsAllowed: number;
  requestsRejected: number;
  queueSize: number;
  availableCapacity: number;
  nextRefillMs: number;
  windowStart: string;
}

/**
 * Session usage tracking
 */
interface SessionUsage {
  sessionId: string;
  requestCount: number;
  tokenCount: number;
  startedAt: number;
  lastActivityAt: number;
}

/**
 * Queued request
 */
interface QueuedRequest {
  tokens: number;
  resolve: (result: RateLimitAcquireResult) => void;
  enqueuedAt: number;
  sessionId: string | undefined;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PROVIDER_CONFIG: ProviderRateLimitConfig = {
  requestsPerMinute: RATE_LIMIT_RPM_DEFAULT,
  tokensPerMinute: RATE_LIMIT_TPM_DEFAULT,
  burstMultiplier: 1.5,
  maxConcurrent: 5,
  backoffStrategy: 'exponential',
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  queueSize: LIMIT_QUEUE_SIZE,
  queueTimeoutMs: CIRCUIT_QUEUE_TIMEOUT,
};

/**
 * Default provider-specific rate limits
 * Based on typical API limits for each provider
 */
export const DEFAULT_PROVIDER_RATE_LIMITS: Record<string, Partial<ProviderRateLimitConfig>> = {
  claude: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    maxConcurrent: 3,
  },
  gemini: {
    requestsPerMinute: 300,
    tokensPerMinute: 1000000,
    burstMultiplier: 2.0,
    maxConcurrent: 10,
  },
  codex: {
    requestsPerMinute: 60,
    tokensPerMinute: 150000,
    maxConcurrent: 5,
  },
  grok: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    maxConcurrent: 3,
  },
};

const TOKEN_WINDOW_MS = 60000; // 1 minute
const CHECK_INTERVAL_MS = 100; // Queue check interval

// =============================================================================
// RATE LIMITER INSTANCE
// =============================================================================

/**
 * Single provider rate limiter instance
 */
interface ProviderRateLimiter {
  acquire(tokens?: number, sessionId?: string): Promise<RateLimitAcquireResult>;
  tryAcquire(tokens?: number): boolean;
  getStats(): RateLimiterStats;
  reset(): void;
}

/**
 * Creates a rate limiter for a single provider
 */
function createProviderRateLimiter(
  providerId: string,
  config: ProviderRateLimitConfig
): ProviderRateLimiter {
  // Token bucket state
  let tokens = config.requestsPerMinute * config.burstMultiplier;
  const maxTokens = config.requestsPerMinute * config.burstMultiplier;
  const refillRate = config.requestsPerMinute / 60000; // tokens per ms
  let lastRefillTime = Date.now();

  // LLM token tracking
  let llmTokensUsed = 0;
  let llmTokenWindowStart = Date.now();

  // Statistics
  let requestsAllowed = 0;
  let requestsRejected = 0;
  const windowStart = new Date().toISOString();

  // Queue
  const queue: QueuedRequest[] = [];
  let processingQueue = false;

  function refillTokens(): void {
    const now = Date.now();
    const elapsed = now - lastRefillTime;
    const refill = elapsed * refillRate;

    tokens = Math.min(maxTokens, tokens + refill);
    lastRefillTime = now;

    // Reset LLM token window if minute elapsed
    if (config.tokensPerMinute && now - llmTokenWindowStart >= TOKEN_WINDOW_MS) {
      llmTokensUsed = 0;
      llmTokenWindowStart = now;
    }
  }

  function calculateWaitTime(requestTokens: number): number {
    if (tokens >= requestTokens) return 0;
    const deficit = requestTokens - tokens;
    return Math.ceil(deficit / refillRate);
  }

  function processQueue(): void {
    if (processingQueue || queue.length === 0) return;
    processingQueue = true;

    const processNext = (): void => {
      if (queue.length === 0) {
        processingQueue = false;
        return;
      }

      const request = queue[0];
      if (!request) {
        processingQueue = false;
        return;
      }

      const now = Date.now();

      // Check timeout
      if (now - request.enqueuedAt >= config.queueTimeoutMs) {
        queue.shift();
        request.resolve({
          acquired: false,
          reason: 'timeout',
          providerId,
        });
        setTimeout(processNext, 0);
        return;
      }

      refillTokens();

      if (tokens >= request.tokens) {
        queue.shift();
        tokens -= request.tokens;
        requestsAllowed++;
        request.resolve({
          acquired: true,
          waitedMs: now - request.enqueuedAt,
          providerId,
        });
        setTimeout(processNext, 0);
      } else {
        // Wait for tokens
        const waitTime = calculateWaitTime(request.tokens);
        setTimeout(processNext, Math.min(waitTime, CHECK_INTERVAL_MS));
      }
    };

    processNext();
  }

  return {
    async acquire(requestTokens = 1, sessionId?: string): Promise<RateLimitAcquireResult> {
      refillTokens();

      // Check LLM token limit
      if (config.tokensPerMinute && llmTokensUsed >= config.tokensPerMinute) {
        const retryAfterMs = TOKEN_WINDOW_MS - (Date.now() - llmTokenWindowStart);
        requestsRejected++;
        return {
          acquired: false,
          reason: 'limit-exceeded',
          retryAfterMs,
          providerId,
        };
      }

      // Try immediate acquisition
      if (tokens >= requestTokens && queue.length === 0) {
        tokens -= requestTokens;
        requestsAllowed++;
        return { acquired: true, waitedMs: 0, providerId };
      }

      // Check queue capacity
      if (queue.length >= config.queueSize) {
        requestsRejected++;
        return { acquired: false, reason: 'queue-full', providerId };
      }

      // Queue the request
      return new Promise((resolve) => {
        queue.push({
          tokens: requestTokens,
          resolve,
          enqueuedAt: Date.now(),
          sessionId,
        });
        processQueue();
      });
    },

    tryAcquire(requestTokens = 1): boolean {
      refillTokens();

      // Check LLM token limit
      if (config.tokensPerMinute && llmTokensUsed >= config.tokensPerMinute) {
        requestsRejected++;
        return false;
      }

      if (tokens >= requestTokens && queue.length === 0) {
        tokens -= requestTokens;
        requestsAllowed++;
        return true;
      }

      requestsRejected++;
      return false;
    },

    getStats(): RateLimiterStats {
      refillTokens();
      return {
        providerId,
        requestsAllowed,
        requestsRejected,
        queueSize: queue.length,
        availableCapacity: tokens,
        nextRefillMs: tokens >= maxTokens ? 0 : Math.ceil((maxTokens - tokens) / refillRate),
        windowStart,
      };
    },

    reset(): void {
      tokens = maxTokens;
      lastRefillTime = Date.now();
      llmTokensUsed = 0;
      llmTokenWindowStart = Date.now();
      requestsAllowed = 0;
      requestsRejected = 0;

      // Clear queue
      while (queue.length > 0) {
        const request = queue.shift();
        if (request) {
          request.resolve({ acquired: false, reason: 'timeout', providerId });
        }
      }
    },
  };
}

// =============================================================================
// RATE LIMITER REGISTRY
// =============================================================================

/**
 * Rate Limiter Registry interface
 */
export interface RateLimiterRegistry {
  /**
   * Acquire rate limit capacity for a provider
   * @param providerId - The provider to acquire capacity for
   * @param tokens - Number of tokens to acquire (default: 1)
   * @param sessionId - Optional session ID for session-level tracking
   */
  acquire(providerId: string, tokens?: number, sessionId?: string): Promise<RateLimitAcquireResult>;

  /**
   * Try to acquire capacity without waiting
   */
  tryAcquire(providerId: string, tokens?: number): boolean;

  /**
   * Get statistics for a specific provider
   */
  getProviderStats(providerId: string): RateLimiterStats;

  /**
   * Get statistics for all providers
   */
  getAllStats(): RateLimiterStats[];

  /**
   * Get session usage
   */
  getSessionUsage(sessionId: string): SessionUsage | undefined;

  /**
   * Reset a specific provider's rate limiter
   */
  resetProvider(providerId: string): void;

  /**
   * Reset all rate limiters
   */
  resetAll(): void;

  /**
   * Check if a provider is configured
   */
  hasProvider(providerId: string): boolean;

  /**
   * Get the configuration for a provider
   */
  getProviderConfig(providerId: string): ProviderRateLimitConfig;

  /**
   * Dispose of the registry and clean up resources
   * Clears the session cleanup interval to prevent memory leaks
   */
  dispose(): void;
}

/**
 * Creates a rate limiter registry with per-provider isolation
 */
export function createRateLimiterRegistry(
  config?: Partial<RateLimiterRegistryConfig>
): RateLimiterRegistry {
  const cfg: RateLimiterRegistryConfig = {
    providers: { ...DEFAULT_PROVIDER_RATE_LIMITS, ...config?.providers },
    sessionQuota: config?.sessionQuota,
    globalFallback: { ...DEFAULT_PROVIDER_CONFIG, ...config?.globalFallback },
    enableProviderIsolation: config?.enableProviderIsolation ?? true,
    enableSessionTracking: config?.enableSessionTracking ?? false,
  };

  // Provider rate limiters
  const limiters = new Map<string, ProviderRateLimiter>();

  // Session tracking
  const sessions = new Map<string, SessionUsage>();

  // Cleanup interval for expired sessions
  let cleanupIntervalId: ReturnType<typeof setInterval> | undefined;
  if (cfg.enableSessionTracking && cfg.sessionQuota) {
    cleanupIntervalId = setInterval(() => {
      const now = Date.now();
      const timeout = cfg.sessionQuota!.sessionTimeoutMs;

      for (const [sessionId, usage] of sessions) {
        if (now - usage.lastActivityAt > timeout) {
          sessions.delete(sessionId);
        }
      }
    }, 60000); // Cleanup every minute
  }

  function getProviderConfig(providerId: string): ProviderRateLimitConfig {
    const providerCfg = cfg.providers[providerId];
    return { ...DEFAULT_PROVIDER_CONFIG, ...cfg.globalFallback, ...providerCfg };
  }

  function getLimiter(providerId: string): ProviderRateLimiter {
    if (!limiters.has(providerId)) {
      const providerConfig = getProviderConfig(providerId);
      limiters.set(providerId, createProviderRateLimiter(providerId, providerConfig));
    }
    return limiters.get(providerId)!;
  }

  function checkSessionQuota(sessionId: string): RateLimitAcquireResult | null {
    if (!cfg.enableSessionTracking || !cfg.sessionQuota) {
      return null;
    }

    const usage = sessions.get(sessionId);
    if (!usage) {
      return null;
    }

    const quota = cfg.sessionQuota;

    // Check request limit
    if (quota.maxRequestsPerSession && usage.requestCount >= quota.maxRequestsPerSession) {
      return {
        acquired: false,
        reason: 'session-quota-exceeded',
      };
    }

    // Check token limit
    if (quota.maxTokensPerSession && usage.tokenCount >= quota.maxTokensPerSession) {
      return {
        acquired: false,
        reason: 'session-quota-exceeded',
      };
    }

    return null;
  }

  function updateSessionUsage(sessionId: string, tokens: number): void {
    if (!cfg.enableSessionTracking) {
      return;
    }

    const now = Date.now();
    const usage = sessions.get(sessionId);

    if (usage) {
      usage.requestCount++;
      usage.tokenCount += tokens;
      usage.lastActivityAt = now;
    } else {
      sessions.set(sessionId, {
        sessionId,
        requestCount: 1,
        tokenCount: tokens,
        startedAt: now,
        lastActivityAt: now,
      });
    }
  }

  return {
    async acquire(providerId: string, tokens = 1, sessionId?: string): Promise<RateLimitAcquireResult> {
      // Check session quota first
      if (sessionId) {
        const quotaResult = checkSessionQuota(sessionId);
        if (quotaResult) {
          return quotaResult;
        }
      }

      // Acquire from provider limiter
      const limiter = getLimiter(providerId);
      const result = await limiter.acquire(tokens, sessionId);

      // Update session usage on success
      if (result.acquired && sessionId) {
        updateSessionUsage(sessionId, tokens);
      }

      return result;
    },

    tryAcquire(providerId: string, tokens = 1): boolean {
      const limiter = getLimiter(providerId);
      return limiter.tryAcquire(tokens);
    },

    getProviderStats(providerId: string): RateLimiterStats {
      const limiter = getLimiter(providerId);
      return limiter.getStats();
    },

    getAllStats(): RateLimiterStats[] {
      const stats: RateLimiterStats[] = [];
      for (const [, limiter] of limiters) {
        stats.push(limiter.getStats());
      }
      return stats;
    },

    getSessionUsage(sessionId: string): SessionUsage | undefined {
      return sessions.get(sessionId);
    },

    resetProvider(providerId: string): void {
      const limiter = limiters.get(providerId);
      if (limiter) {
        limiter.reset();
      }
    },

    resetAll(): void {
      for (const [, limiter] of limiters) {
        limiter.reset();
      }
      sessions.clear();
    },

    hasProvider(providerId: string): boolean {
      return providerId in cfg.providers || providerId in DEFAULT_PROVIDER_RATE_LIMITS;
    },

    getProviderConfig,

    dispose(): void {
      // Clear cleanup interval to prevent memory leaks
      if (cleanupIntervalId !== undefined) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = undefined;
      }
      // Reset all limiters and clear sessions
      for (const [, limiter] of limiters) {
        limiter.reset();
      }
      limiters.clear();
      sessions.clear();
    },
  };
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class RateLimiterRegistryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly providerId?: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'RateLimiterRegistryError';
  }

  static providerNotConfigured(providerId: string): RateLimiterRegistryError {
    return new RateLimiterRegistryError(
      'PROVIDER_NOT_CONFIGURED',
      `Provider ${providerId} is not configured`,
      providerId
    );
  }

  static rateLimited(providerId: string, retryAfterMs: number): RateLimiterRegistryError {
    return new RateLimiterRegistryError(
      'RATE_LIMITED',
      `Rate limit exceeded for ${providerId}. Retry after ${retryAfterMs}ms`,
      providerId,
      retryAfterMs
    );
  }

  static sessionQuotaExceeded(sessionId: string): RateLimiterRegistryError {
    return new RateLimiterRegistryError(
      'SESSION_QUOTA_EXCEEDED',
      `Session quota exceeded for ${sessionId}`
    );
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const RateLimiterRegistryErrorCodes = {
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUEUE_FULL: 'QUEUE_FULL',
  QUEUE_TIMEOUT: 'QUEUE_TIMEOUT',
  SESSION_QUOTA_EXCEEDED: 'SESSION_QUOTA_EXCEEDED',
} as const;
