/**
 * Rate Limiter Implementation
 *
 * Implements token bucket rate limiting for provider request management.
 * Prevents API quota exhaustion through intelligent request throttling.
 *
 * Invariants:
 * - INV-RL-001: Token bucket refills at configured rate
 * - INV-RL-002: Requests consume tokens based on type
 * - INV-RL-003: Strategy applied when limit reached
 */

import {
  type RateLimitConfig,
  type RateLimitState,
  type RateLimitEvent,
  type RateLimitEventType,
  type RateLimitStateEnum,
  createDefaultRateLimitConfig,
  createInitialRateLimitState,
  RateLimitErrorCodes,
} from '@automatosx/contracts';

/**
 * Rate limiter instance for a single provider
 */
export interface RateLimiter {
  /** Get current state */
  getState(): RateLimitState;

  /** Check if request is allowed without consuming */
  canRequest(tokens?: number): boolean;

  /** Try to consume tokens, returns true if allowed */
  tryConsume(tokens?: number): boolean;

  /** Wait for tokens to become available */
  waitForTokens(tokens?: number): Promise<void>;

  /** Get time until next token available (ms) */
  getWaitTime(tokens?: number): number;

  /** Record external rate limit (from API response) */
  recordExternalLimit(retryAfterMs?: number): void;

  /** Get event history */
  getEvents(): RateLimitEvent[];

  /** Reset the rate limiter */
  reset(): void;
}

/**
 * Rate limit event listener
 */
export type RateLimitEventListener = (event: RateLimitEvent) => void;

/**
 * Creates a rate limiter for a provider
 */
export function createRateLimiter(
  providerId: string,
  config: Partial<RateLimitConfig> = {}
): RateLimiter {
  const cfg = { ...createDefaultRateLimitConfig(), ...config };
  let internalState = createInitialRateLimitState(cfg);

  // Backoff tracking
  let currentBackoffMs = cfg.backoffBaseMs;
  let consecutiveLimits = 0;

  const events: RateLimitEvent[] = [];
  const listeners: RateLimitEventListener[] = [];

  function emitEvent(
    type: RateLimitEventType,
    details?: Record<string, unknown>
  ): void {
    const event: RateLimitEvent = {
      eventId: crypto.randomUUID(),
      type,
      providerId,
      timestamp: new Date().toISOString(),
      details,
    };
    events.push(event);
    listeners.forEach((listener) => listener(event));
  }

  // INV-RL-001: Token bucket refills at configured rate
  function refillTokens(): void {
    const now = Date.now();
    const lastRefill = new Date(internalState.lastRefillTime).getTime();
    const elapsed = now - lastRefill;
    const minutesFraction = elapsed / 60000;

    // Calculate tokens to add
    const requestsToAdd = cfg.requestsPerMinute * minutesFraction;
    const tokensToAdd = cfg.tokensPerMinute * minutesFraction;

    // Add tokens up to burst limit
    const maxRequests = cfg.requestsPerMinute * cfg.burstMultiplier;
    const maxTokens = cfg.tokensPerMinute * cfg.burstMultiplier;

    internalState.requestTokens = Math.min(
      internalState.requestTokens + requestsToAdd,
      maxRequests
    );
    internalState.outputTokens = Math.min(
      internalState.outputTokens + tokensToAdd,
      maxTokens
    );
    internalState.lastRefillTime = new Date(now).toISOString();

    if (requestsToAdd > 0 || tokensToAdd > 0) {
      emitEvent('rateLimit.refilled', { requestsToAdd, tokensToAdd });
    }
  }

  function updateState(): void {
    const prevState = internalState.state;
    let newState: RateLimitStateEnum = 'normal';

    if (internalState.nextAllowedTime) {
      const nextAllowed = new Date(internalState.nextAllowedTime).getTime();
      if (Date.now() < nextAllowed) {
        newState = 'blocked';
      } else {
        internalState.nextAllowedTime = undefined;
      }
    }

    if (
      newState === 'normal' &&
      (internalState.requestTokens < 1 || internalState.outputTokens < 1)
    ) {
      newState = 'throttled';
    }

    if (prevState !== newState) {
      internalState.state = newState;
      emitEvent('rateLimit.stateChanged', { previousState: prevState, newState });
    }
  }

  // INV-RL-003: Apply strategy when limit reached
  function applyBackoff(): void {
    consecutiveLimits++;
    currentBackoffMs = Math.min(
      cfg.backoffBaseMs * Math.pow(cfg.backoffMultiplier, consecutiveLimits - 1),
      cfg.maxBackoffMs
    );
    internalState.nextAllowedTime = new Date(
      Date.now() + currentBackoffMs
    ).toISOString();
    internalState.state = 'blocked';

    emitEvent('rateLimit.stateChanged', {
      reason: 'backoff',
      backoffMs: currentBackoffMs,
      consecutiveLimits,
    });
  }

  return {
    getState(): RateLimitState {
      refillTokens();
      updateState();
      return { ...internalState };
    },

    canRequest(tokens = 1): boolean {
      refillTokens();
      updateState();

      if (internalState.state === 'blocked') {
        return false;
      }

      // INV-RL-002: Check both request and token budgets
      return internalState.requestTokens >= 1 && internalState.outputTokens >= tokens;
    },

    tryConsume(tokens = 1): boolean {
      refillTokens();
      updateState();

      if (internalState.state === 'blocked') {
        emitEvent('rateLimit.rejected', { tokens, reason: 'blocked' });
        return false;
      }

      if (internalState.requestTokens >= 1 && internalState.outputTokens >= tokens) {
        internalState.requestTokens -= 1;
        internalState.outputTokens -= tokens;
        internalState.requestCount++;
        internalState.tokenCount += tokens;

        // Success resets backoff
        if (consecutiveLimits > 0) {
          consecutiveLimits = 0;
          currentBackoffMs = cfg.backoffBaseMs;
        }

        emitEvent('rateLimit.acquired', { tokens });
        return true;
      }

      // Rate limited locally
      if (cfg.strategy === 'backoff') {
        applyBackoff();
      }

      emitEvent('rateLimit.rejected', { tokens, reason: 'exhausted' });
      return false;
    },

    async waitForTokens(tokens = 1): Promise<void> {
      const waitTime = this.getWaitTime(tokens);
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    },

    getWaitTime(tokens = 1): number {
      refillTokens();
      updateState();

      // Check if blocked
      if (internalState.nextAllowedTime) {
        const blockWait =
          new Date(internalState.nextAllowedTime).getTime() - Date.now();
        if (blockWait > 0) return blockWait;
      }

      // Calculate time to refill needed tokens
      if (internalState.requestTokens >= 1 && internalState.outputTokens >= tokens) {
        return 0;
      }

      const requestsNeeded = Math.max(0, 1 - internalState.requestTokens);
      const tokensNeeded = Math.max(0, tokens - internalState.outputTokens);

      const requestRefillTime =
        (requestsNeeded / cfg.requestsPerMinute) * 60000;
      const tokenRefillTime = (tokensNeeded / cfg.tokensPerMinute) * 60000;

      return Math.max(requestRefillTime, tokenRefillTime);
    },

    recordExternalLimit(retryAfterMs?: number): void {
      const backoffTime = retryAfterMs ?? cfg.backoffBaseMs;
      internalState.nextAllowedTime = new Date(
        Date.now() + backoffTime
      ).toISOString();
      internalState.state = 'blocked';
      consecutiveLimits++;

      emitEvent('rateLimit.stateChanged', {
        reason: 'external',
        retryAfterMs: backoffTime,
        consecutiveLimits,
      });
    },

    getEvents(): RateLimitEvent[] {
      return [...events];
    },

    reset(): void {
      internalState = createInitialRateLimitState(cfg);
      currentBackoffMs = cfg.backoffBaseMs;
      consecutiveLimits = 0;
      events.length = 0;
    },
  };
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(
    public readonly code: string,
    public readonly providerId: string,
    public readonly retryAfterMs?: number,
    message?: string
  ) {
    super(message ?? `Rate limit exceeded for provider ${providerId}`);
    this.name = 'RateLimitError';
  }

  static exceeded(providerId: string, retryAfterMs?: number): RateLimitError {
    return new RateLimitError(
      RateLimitErrorCodes.RATE_LIMITED,
      providerId,
      retryAfterMs
    );
  }

  static quotaExhausted(providerId: string): RateLimitError {
    return new RateLimitError(
      RateLimitErrorCodes.TOKEN_LIMIT,
      providerId,
      undefined,
      `API quota exhausted for provider ${providerId}`
    );
  }
}
