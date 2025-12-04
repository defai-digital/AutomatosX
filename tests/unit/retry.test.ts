/**
 * Retry Logic Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  retry,
  isRetryableError,
  calculateBackoffDelay,
  CircuitBreaker,
  CircuitState
} from '../../src/shared/helpers/retry.js';

describe('Retry Logic', () => {
  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new Error('Network timeout'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Authentication failed'))).toBe(false);
      expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
    });

    it('should use custom retryable patterns', () => {
      const error = new Error('Custom retryable error');
      expect(isRetryableError(error, [/custom retryable/i])).toBe(true);
      expect(isRetryableError(error, ['custom retryable'])).toBe(true);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = calculateBackoffDelay(0, 1000, 30000, 2);
      const delay2 = calculateBackoffDelay(1, 1000, 30000, 2);
      const delay3 = calculateBackoffDelay(2, 1000, 30000, 2);

      expect(delay1).toBeGreaterThan(700); // ~1000ms with jitter
      expect(delay1).toBeLessThan(1300);

      expect(delay2).toBeGreaterThan(1500); // ~2000ms with jitter
      expect(delay2).toBeLessThan(2500);

      expect(delay3).toBeGreaterThan(3000); // ~4000ms with jitter
      expect(delay3).toBeLessThan(5000);
    });

    it('should cap delay at maxDelay', () => {
      const delay = calculateBackoffDelay(10, 1000, 5000, 2);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('retry function', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const result = await retry(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on retryable errors', async () => {
      let attempts = 0;
      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Network timeout');
          }
          return 'success';
        },
        { maxRetries: 3, initialDelayMs: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry on non-retryable errors', async () => {
      let attempts = 0;
      await expect(retry(
        async () => {
          attempts++;
          throw new Error('Invalid input');
        },
        { maxRetries: 3, initialDelayMs: 10 }
      )).rejects.toThrow('Invalid input');

      expect(attempts).toBe(1);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      await expect(retry(
        async () => {
          attempts++;
          throw new Error('Network timeout');
        },
        { maxRetries: 3, initialDelayMs: 10 }
      )).rejects.toThrow('Network timeout');

      expect(attempts).toBe(3);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      let attempts = 0;

      await retry(
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Network timeout');
          }
          return 'success';
        },
        {
          maxRetries: 3,
          initialDelayMs: 10,
          onRetry
        }
      );

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        expect.any(Number)
      );
    });
  });

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      });

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open after failure threshold', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests when OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 60000 // 1 minute timeout
      });

      // Trigger circuit open
      try {
        await breaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch {
        // Expected
      }

      // Should reject immediately
      await expect(breaker.execute(async () => 'success'))
        .rejects.toThrow("Circuit breaker 'test' is OPEN");
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 100 // 100ms timeout
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should transition to HALF_OPEN
      await breaker.execute(async () => 'success');
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close after success threshold in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 100
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch {
        // Expected
      }

      // Wait and transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 150));

      // Succeed twice to close circuit
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should call onStateChange callback', async () => {
      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        onStateChange
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch {
        // Expected
      }

      expect(onStateChange).toHaveBeenCalledWith(CircuitState.OPEN);
    });

    it('should reset circuit state', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 1000
      });

      // Open circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Failure');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });
});
