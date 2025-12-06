/**
 * Task Engine Circuit Breaker
 *
 * Prevents cascade failures by tracking failure rates and temporarily
 * blocking requests when failure threshold is exceeded.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, requests blocked
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * Part of Phase 4: Production Hardening
 *
 * @module core/task-engine/circuit-breaker
 * @version 1.0.0
 */

import { logger } from '../../shared/logging/logger.js';

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure count threshold to open circuit (default: 5) */
  failureThreshold?: number;
  /** Success count threshold to close circuit from half-open (default: 3) */
  successThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeoutMs?: number;
  /** Time window in ms to count failures (default: 60000) */
  failureWindowMs?: number;
  /** Max concurrent requests in half-open state (default: 1) */
  halfOpenMaxRequests?: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitState;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Requests blocked by open circuit */
  blockedRequests: number;
  /** Times circuit opened */
  timesOpened: number;
  /** Times circuit closed (recovered) */
  timesClosed: number;
  /** Current failure count in window */
  currentFailures: number;
  /** Last state change timestamp */
  lastStateChangeAt: number | null;
}

/**
 * Failure record for tracking within window
 */
interface FailureRecord {
  timestamp: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeoutMs: 30000,
  failureWindowMs: 60000,
  halfOpenMaxRequests: 1
};

/**
 * TaskCircuitBreaker - Failure isolation for Task Engine
 *
 * @example
 * ```typescript
 * const breaker = new TaskCircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeoutMs: 30000
 * });
 *
 * // Before executing a task
 * if (!breaker.canExecute()) {
 *   throw new Error('Circuit breaker is open');
 * }
 *
 * try {
 *   const result = await executeTask();
 *   breaker.recordSuccess();
 *   return result;
 * } catch (error) {
 *   breaker.recordFailure();
 *   throw error;
 * }
 * ```
 */
export class TaskCircuitBreaker {
  private readonly config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'CLOSED';
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private halfOpenRequests = 0;
  private openedAt: number | null = null;
  private lastStateChangeAt: number | null = null;

  // Statistics
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    blockedRequests: 0,
    timesOpened: 0,
    timesClosed: 0
  };

  // Event callbacks
  private onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.debug('[TaskCircuitBreaker] Initialized', {
      failureThreshold: this.config.failureThreshold,
      resetTimeoutMs: this.config.resetTimeoutMs
    });
  }

  /**
   * Check if a request can be executed
   */
  canExecute(): boolean {
    this.stats.totalRequests++;
    this.cleanupOldFailures();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if reset timeout has passed
        if (this.openedAt && Date.now() - this.openedAt >= this.config.resetTimeoutMs) {
          this.transitionTo('HALF_OPEN');
          return this.tryHalfOpen();
        }
        this.stats.blockedRequests++;
        return false;

      case 'HALF_OPEN':
        return this.tryHalfOpen();

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.stats.successfulRequests++;

    switch (this.state) {
      case 'HALF_OPEN':
        // Decrement only if we have slots in use (prevent going negative)
        if (this.halfOpenRequests > 0) {
          this.halfOpenRequests--;
        }
        this.successCount++;

        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo('CLOSED');
        }
        break;

      case 'CLOSED':
        // Success in closed state, nothing special to do
        break;

      case 'OPEN':
        // Shouldn't happen, but handle gracefully
        logger.warn('[TaskCircuitBreaker] Success recorded while OPEN');
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.stats.failedRequests++;

    const now = Date.now();
    this.failures.push({ timestamp: now });

    switch (this.state) {
      case 'CLOSED':
        this.cleanupOldFailures();
        if (this.failures.length >= this.config.failureThreshold) {
          this.transitionTo('OPEN');
        }
        break;

      case 'HALF_OPEN':
        // Decrement only if we have slots in use (prevent going negative)
        if (this.halfOpenRequests > 0) {
          this.halfOpenRequests--;
        }
        // Any failure in half-open returns to open
        this.transitionTo('OPEN');
        break;

      case 'OPEN':
        // Already open, extend the open period
        this.openedAt = now;
        break;
    }
  }

  /**
   * Release a half-open slot without recording success or failure.
   * Use this when a request is aborted/cancelled before completion.
   * This prevents slot leaks when callers timeout or throw exceptions.
   */
  releaseHalfOpenSlot(): void {
    if (this.state === 'HALF_OPEN' && this.halfOpenRequests > 0) {
      this.halfOpenRequests--;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open (failing)
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * Check if circuit is closed (healthy)
   */
  isClosed(): boolean {
    return this.state === 'CLOSED';
  }

  /**
   * Force circuit to close (manual recovery)
   */
  forceClose(): void {
    if (this.state !== 'CLOSED') {
      this.transitionTo('CLOSED');
      logger.info('[TaskCircuitBreaker] Forced closed');
    }
  }

  /**
   * Force circuit to open (manual protection)
   */
  forceOpen(): void {
    if (this.state !== 'OPEN') {
      this.transitionTo('OPEN');
      logger.info('[TaskCircuitBreaker] Forced open');
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanupOldFailures();

    return {
      state: this.state,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      blockedRequests: this.stats.blockedRequests,
      timesOpened: this.stats.timesOpened,
      timesClosed: this.stats.timesClosed,
      currentFailures: this.failures.length,
      lastStateChangeAt: this.lastStateChangeAt
    };
  }

  /**
   * Reset statistics (but not state)
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      timesOpened: 0,
      timesClosed: 0
    };
  }

  /**
   * Set state change callback
   */
  onStateChangeCallback(callback: (from: CircuitState, to: CircuitState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Get time until circuit attempts recovery (when OPEN)
   */
  getTimeUntilRetry(): number | null {
    if (this.state !== 'OPEN' || !this.openedAt) {
      return null;
    }

    const elapsed = Date.now() - this.openedAt;
    const remaining = this.config.resetTimeoutMs - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeAt = Date.now();

    switch (newState) {
      case 'OPEN':
        this.openedAt = Date.now();
        this.successCount = 0;
        this.halfOpenRequests = 0;
        this.stats.timesOpened++;
        logger.warn('[TaskCircuitBreaker] Circuit OPENED', {
          failures: this.failures.length,
          resetTimeoutMs: this.config.resetTimeoutMs
        });
        break;

      case 'HALF_OPEN':
        this.successCount = 0;
        this.halfOpenRequests = 0;
        logger.info('[TaskCircuitBreaker] Circuit HALF_OPEN, testing recovery');
        break;

      case 'CLOSED':
        this.openedAt = null;
        this.failures = [];
        this.successCount = 0;
        this.halfOpenRequests = 0;
        if (oldState !== 'CLOSED') {
          this.stats.timesClosed++;
          logger.info('[TaskCircuitBreaker] Circuit CLOSED, recovered');
        }
        break;
    }

    if (this.onStateChange && oldState !== newState) {
      this.onStateChange(oldState, newState);
    }
  }

  /**
   * Try to allow a request in half-open state
   */
  private tryHalfOpen(): boolean {
    if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
      this.stats.blockedRequests++;
      return false;
    }

    this.halfOpenRequests++;
    return true;
  }

  /**
   * Remove failures outside the failure window
   * Bug fix: Use >= to properly exclude failures at exactly the boundary
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.failureWindowMs;
    this.failures = this.failures.filter(f => f.timestamp >= cutoff);
  }
}

/**
 * Create a circuit breaker instance
 */
export function createCircuitBreaker(config?: CircuitBreakerConfig): TaskCircuitBreaker {
  return new TaskCircuitBreaker(config);
}
