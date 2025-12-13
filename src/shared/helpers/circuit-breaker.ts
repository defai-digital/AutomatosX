/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking operations
 * when a service is failing, allowing it time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 *
 * @module shared/helpers/circuit-breaker
 * @since v12.4.0 (extracted from retry.ts)
 */

import { logger } from '../logging/logger.js';

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Too many failures, rejecting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Number of successes needed to close circuit */
  successThreshold: number;
  /** Time to wait before attempting half-open (ms) */
  timeout: number;
  /** Callback when state changes */
  onStateChange?: (state: CircuitState) => void;
}

/**
 * Default circuit breaker options
 */
export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000
};

/**
 * Circuit Breaker - Prevent cascading failures
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker('api-service', {
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * });
 *
 * try {
 *   const result = await breaker.execute(() => apiCall());
 * } catch (error) {
 *   if (error.message.includes('Circuit breaker')) {
 *     // Service is temporarily unavailable
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }

      // Try half-open
      this.state = CircuitState.HALF_OPEN;
      this.notifyStateChange();
      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        name: this.name
      });
    }

    try {
      const result = await fn();

      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.notifyStateChange();
        logger.info('Circuit breaker closed', {
          name: this.name
        });
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.timeout;
      this.notifyStateChange();
      logger.warn('Circuit breaker opened', {
        name: this.name,
        failureCount: this.failureCount,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
      });
    }
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    if (this.options.onStateChange) {
      this.options.onStateChange(this.state);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get success count (in HALF_OPEN state)
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }
}
