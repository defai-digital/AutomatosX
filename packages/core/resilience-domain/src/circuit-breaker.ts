/**
 * Circuit Breaker Implementation
 *
 * Prevents cascade failures by stopping calls to unhealthy providers.
 */

import {
  type CircuitBreakerState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitBreakerEvent,
  CircuitBreakerErrorCodes,
  createDefaultCircuitBreakerConfig,
  createCircuitBreakerStats,
} from './_contracts.js';
import { getErrorMessage } from '@defai.digital/contracts';

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }

  static circuitOpen(resetInMs: number): CircuitBreakerError {
    return new CircuitBreakerError(
      CircuitBreakerErrorCodes.CIRCUIT_OPEN,
      `Circuit breaker is open. Retry after ${resetInMs}ms`
    );
  }
}

/**
 * Circuit breaker event listener
 */
export type CircuitBreakerListener = (event: CircuitBreakerEvent) => void;

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  /** Current state */
  readonly state: CircuitBreakerState;

  /** Execute function with circuit breaker protection */
  execute<T>(fn: () => Promise<T>): Promise<T>;

  /** Record a successful call */
  recordSuccess(): void;

  /** Record a failed call */
  recordFailure(error?: Error): void;

  /** Get current statistics */
  getStats(): CircuitBreakerStats;

  /** Add event listener */
  onEvent(listener: CircuitBreakerListener): () => void;

  /** Reset to closed state */
  reset(): void;
}

/**
 * Creates a circuit breaker
 */
export function createCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  const cfg = { ...createDefaultCircuitBreakerConfig(), ...config };

  let state: CircuitBreakerState = 'closed';
  let stats = createCircuitBreakerStats();
  let failureTimestamps: number[] = [];
  let openedAt: number | null = null;
  let halfOpenAttempts = 0;
  const listeners = new Set<CircuitBreakerListener>();

  function emit(event: CircuitBreakerEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  function transitionTo(newState: CircuitBreakerState): void {
    if (state === newState) return;

    const event: CircuitBreakerEvent = {
      type: 'state-change',
      from: state,
      to: newState,
      timestamp: new Date().toISOString(),
    };

    state = newState;
    stats = { ...stats, state };

    if (newState === 'open') {
      openedAt = Date.now();
    } else if (newState === 'half-open') {
      halfOpenAttempts = 0;
    } else if (newState === 'closed') {
      openedAt = null;
      failureTimestamps = [];
      stats = { ...stats, recentFailures: 0, halfOpenSuccesses: 0 };
    }

    emit(event);
  }

  function cleanOldFailures(): void {
    const cutoff = Date.now() - cfg.failureWindowMs;
    failureTimestamps = failureTimestamps.filter((ts) => ts > cutoff);
    stats = { ...stats, recentFailures: failureTimestamps.length };
  }

  function shouldOpen(): boolean {
    cleanOldFailures();
    return failureTimestamps.length >= cfg.failureThreshold;
  }

  function shouldTransitionToHalfOpen(): boolean {
    if (state !== 'open' || openedAt === null) return false;
    return Date.now() - openedAt >= cfg.resetTimeoutMs;
  }

  function checkState(): void {
    if (state === 'open' && shouldTransitionToHalfOpen()) {
      transitionTo('half-open');
    }
  }

  return {
    get state() {
      checkState();
      return state;
    },

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      checkState();

      // Check if circuit is open
      if (state === 'open') {
        const resetInMs = openedAt
          ? Math.max(0, cfg.resetTimeoutMs - (Date.now() - openedAt))
          : cfg.resetTimeoutMs;

        emit({
          type: 'call-rejected',
          reason: 'Circuit breaker is open',
          timestamp: new Date().toISOString(),
        });

        throw CircuitBreakerError.circuitOpen(resetInMs);
      }

      // Check half-open attempt limit
      if (state === 'half-open' && halfOpenAttempts >= cfg.halfOpenMaxAttempts) {
        emit({
          type: 'call-rejected',
          reason: 'Half-open attempt limit reached',
          timestamp: new Date().toISOString(),
        });

        throw CircuitBreakerError.circuitOpen(cfg.resetTimeoutMs);
      }

      if (state === 'half-open') {
        halfOpenAttempts++;
      }

      const startTime = Date.now();

      try {
        const result = await fn();
        this.recordSuccess();

        emit({
          type: 'call-success',
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });

        return result;
      } catch (error) {
        this.recordFailure(error instanceof Error ? error : undefined);

        emit({
          type: 'call-failure',
          error: getErrorMessage(error),
          timestamp: new Date().toISOString(),
        });

        throw error;
      }
    },

    recordSuccess(): void {
      stats = {
        ...stats,
        successCount: stats.successCount + 1,
        lastSuccessAt: new Date().toISOString(),
      };

      if (state === 'half-open') {
        stats = { ...stats, halfOpenSuccesses: stats.halfOpenSuccesses + 1 };

        // Single success in half-open closes the circuit
        transitionTo('closed');
      }
    },

    recordFailure(_error?: Error): void {
      const now = Date.now();
      failureTimestamps.push(now);

      stats = {
        ...stats,
        failureCount: stats.failureCount + 1,
        recentFailures: failureTimestamps.length,
        lastFailureAt: new Date().toISOString(),
      };

      if (state === 'half-open') {
        // Failure in half-open reopens the circuit
        transitionTo('open');
      } else if (state === 'closed' && shouldOpen()) {
        transitionTo('open');
      }
    },

    getStats(): CircuitBreakerStats {
      checkState();
      cleanOldFailures();

      return {
        ...stats,
        state,
        openedAt: openedAt ? new Date(openedAt).toISOString() : undefined,
      };
    },

    onEvent(listener: CircuitBreakerListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    reset(): void {
      transitionTo('closed');
      stats = createCircuitBreakerStats();
      failureTimestamps = [];
      openedAt = null;
      halfOpenAttempts = 0;
    },
  };
}
