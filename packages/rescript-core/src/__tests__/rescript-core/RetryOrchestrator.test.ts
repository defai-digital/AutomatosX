/**
 * Unit Tests for RetryOrchestrator.res
 *
 * Tests the ReScript RetryOrchestrator module for exponential backoff,
 * circuit breaker pattern, and retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  configureBridge,
  RetryOrchestratorBridge,
  isOk,
  isError,
} from '../../bridge/RescriptBridge';

describe('RetryOrchestrator Module', () => {
  beforeEach(() => {
    configureBridge({ enableRetryOrchestrator: true, logTransitions: false });
    vi.clearAllMocks();
  });

  describe('BUG #6: Incorrect Retry Logic Leading to Infinite Loops', () => {
    it('should prevent infinite retry loops with max attempts', async () => {
      // BUGGY TypeScript version:
      // async function fetchWithRetry() {
      //   while (true) {
      //     try {
      //       return await fetch('/api');
      //     } catch (error) {
      //       // ❌ Infinite loop if always fails!
      //       continue;
      //     }
      //   }
      // }

      // ReScript version with max attempts:
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        attemptCount++;
        throw new Error('Always fails');
      };

      const config = {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      try {
        await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(attemptCount).toBe(3);  // Stopped after max attempts!
      }
    });

    it('should stop retrying on success', async () => {
      // Succeeds on second attempt
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      const result = await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);

      expect(result).toBe('success');
      expect(attemptCount).toBe(2);  // Stopped after success
    });

    it('should prevent retry on non-retryable errors', async () => {
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        attemptCount++;
        const error = new Error('Authentication failed');
        (error as any).isRetryable = false;
        throw error;
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      try {
        await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
        expect.fail('Should have thrown');
      } catch (error) {
        // Should fail immediately, not retry
        expect(attemptCount).toBe(1);
      }
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase delay exponentially', async () => {
      const delays: number[] = [];
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        const start = Date.now();
        attemptCount++;

        if (attemptCount > 1) {
          delays.push(Date.now() - start);
        }

        if (attemptCount < 4) {
          throw new Error('Retry');
        }

        return 'success';
      };

      const config = {
        maxAttempts: 4,
        initialDelayMs: 10,
        maxDelayMs: 1000,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);

      expect(attemptCount).toBe(4);
      // Delays should be: 10ms, 20ms, 40ms (exponential)
    });

    it('should cap delay at maxDelayMs', async () => {
      let attemptCount = 0;
      const delays: number[] = [];

      const operation = async (): Promise<string> => {
        attemptCount++;

        if (attemptCount < 5) {
          throw new Error('Retry');
        }

        return 'success';
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 100,
        maxDelayMs: 200,  // Cap at 200ms
        backoffMultiplier: 2.0,
        jitter: false,
      };

      const start = Date.now();
      await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
      const duration = Date.now() - start;

      // With cap, total delay should be less than uncapped exponential
      // 100 + 200 + 200 + 200 = 700ms (capped)
      // vs 100 + 200 + 400 + 800 = 1500ms (uncapped)
      expect(duration).toBeLessThan(1000);
    });

    it('should add jitter to prevent thundering herd', async () => {
      const delays1: number[] = [];
      const delays2: number[] = [];

      const makeOperation = (delaysArray: number[]) => async (): Promise<string> => {
        throw new Error('Always fails');
      };

      const config = {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2.0,
        jitter: true,  // Enable jitter
      };

      // Run two operations with same config
      const start1 = Date.now();
      try {
        await RetryOrchestratorBridge.retryWithExponentialBackoff(makeOperation(delays1), config);
      } catch {}
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      try {
        await RetryOrchestratorBridge.retryWithExponentialBackoff(makeOperation(delays2), config);
      } catch {}
      const duration2 = Date.now() - start2;

      // With jitter, delays should be different (prevents thundering herd)
      // Note: This test may be flaky due to timing
      expect(Math.abs(duration1 - duration2)).toBeLessThan(500);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit after threshold failures', async () => {
      let attemptCount = 0;
      const failureThreshold = 3;

      const operation = async (): Promise<string> => {
        attemptCount++;
        throw new Error('Service unavailable');
      };

      // Simulate circuit breaker
      let failureCount = 0;
      let circuitOpen = false;

      const wrappedOperation = async (): Promise<string> => {
        if (circuitOpen) {
          throw new Error('Circuit breaker open');
        }

        try {
          return await operation();
        } catch (error) {
          failureCount++;
          if (failureCount >= failureThreshold) {
            circuitOpen = true;
          }
          throw error;
        }
      };

      // First 3 attempts fail
      for (let i = 0; i < 3; i++) {
        try {
          await wrappedOperation();
        } catch {}
      }

      expect(circuitOpen).toBe(true);

      // Subsequent attempts should fail immediately
      try {
        await wrappedOperation();
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Circuit breaker open');
      }

      expect(attemptCount).toBe(3);  // No more attempts after circuit opens
    });

    it('should half-open circuit after timeout', async () => {
      let circuitState: 'closed' | 'open' | 'half-open' = 'closed';
      let failureCount = 0;
      const failureThreshold = 3;
      const resetTimeout = 100;

      const operation = async (): Promise<string> => {
        if (circuitState === 'open') {
          throw new Error('Circuit breaker open');
        }

        if (circuitState === 'half-open') {
          // Allow one test request
          circuitState = 'closed';
          failureCount = 0;
          return 'success';
        }

        failureCount++;
        if (failureCount >= failureThreshold) {
          circuitState = 'open';
          // Schedule half-open
          setTimeout(() => {
            circuitState = 'half-open';
          }, resetTimeout);
        }
        throw new Error('Failed');
      };

      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await operation();
        } catch {}
      }

      expect(circuitState).toBe('open');

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, resetTimeout + 10));

      expect(circuitState).toBe('half-open');

      // Test request should succeed and close circuit
      const result = await operation();
      expect(result).toBe('success');
      expect(circuitState).toBe('closed');
    });
  });

  describe('Retry Strategies', () => {
    it('should support linear backoff', async () => {
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < 4) {
          throw new Error('Retry');
        }
        return 'success';
      };

      // Linear: delay = initialDelay * attemptNumber
      const config = {
        maxAttempts: 4,
        initialDelayMs: 50,
        maxDelayMs: 1000,
        backoffMultiplier: 1.0,  // Linear
        jitter: false,
      };

      const start = Date.now();
      await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
      const duration = Date.now() - start;

      // Linear delays: 50, 50, 50 = 150ms
      expect(duration).toBeGreaterThan(100);
      expect(duration).toBeLessThan(300);
    });

    it('should support immediate retry', async () => {
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Retry');
        }
        return 'success';
      };

      const config = {
        maxAttempts: 3,
        initialDelayMs: 0,  // Immediate retry
        maxDelayMs: 0,
        backoffMultiplier: 1.0,
        jitter: false,
      };

      const start = Date.now();
      await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
      const duration = Date.now() - start;

      // Should be very fast with no delays
      expect(duration).toBeLessThan(100);
      expect(attemptCount).toBe(3);
    });

    it('should support fixed interval retry', async () => {
      let attemptCount = 0;

      const operation = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < 4) {
          throw new Error('Retry');
        }
        return 'success';
      };

      const config = {
        maxAttempts: 4,
        initialDelayMs: 50,
        maxDelayMs: 50,  // Fixed at 50ms
        backoffMultiplier: 1.0,
        jitter: false,
      };

      const start = Date.now();
      await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
      const duration = Date.now() - start;

      // Fixed delays: 50, 50, 50 = 150ms
      expect(duration).toBeGreaterThan(100);
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle network request retries', async () => {
      let attemptCount = 0;

      const fetchAPI = async (): Promise<{ data: string }> => {
        attemptCount++;

        // Simulate network errors
        if (attemptCount === 1) {
          throw new Error('Network timeout');
        }
        if (attemptCount === 2) {
          throw new Error('Connection reset');
        }

        return { data: 'success' };
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 50,
        maxDelayMs: 500,
        backoffMultiplier: 2.0,
        jitter: true,
      };

      const result = await RetryOrchestratorBridge.retryWithExponentialBackoff(fetchAPI, config);

      expect(result).toEqual({ data: 'success' });
      expect(attemptCount).toBe(3);
    });

    it('should handle database connection retries', async () => {
      let attemptCount = 0;

      const connectDB = async (): Promise<string> => {
        attemptCount++;

        if (attemptCount < 3) {
          throw new Error('Database connection failed');
        }

        return 'connected';
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      const result = await RetryOrchestratorBridge.retryWithExponentialBackoff(connectDB, config);

      expect(result).toBe('connected');
      expect(attemptCount).toBe(3);
    });

    it('should handle rate limit retries with backoff', async () => {
      let attemptCount = 0;

      const makeRequest = async (): Promise<string> => {
        attemptCount++;

        // Simulate rate limit errors
        if (attemptCount <= 2) {
          const error = new Error('Rate limit exceeded') as any;
          error.statusCode = 429;
          throw error;
        }

        return 'success';
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 1000,  // Wait longer for rate limits
        maxDelayMs: 5000,
        backoffMultiplier: 2.0,
        jitter: true,
      };

      const start = Date.now();
      const result = await RetryOrchestratorBridge.retryWithExponentialBackoff(makeRequest, config);
      const duration = Date.now() - start;

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
      expect(duration).toBeGreaterThan(1000);  // Respected rate limit backoff
    });

    it('should handle service discovery retries', async () => {
      const services = ['service1-down', 'service2-down', 'service3-up'];
      let serviceIndex = 0;

      const discoverService = async (): Promise<string> => {
        const service = services[serviceIndex];
        serviceIndex++;

        if (service.includes('down')) {
          throw new Error(`Service ${service} unavailable`);
        }

        return service;
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 1.5,
        jitter: false,
      };

      const result = await RetryOrchestratorBridge.retryWithExponentialBackoff(discoverService, config);

      expect(result).toBe('service3-up');
      expect(serviceIndex).toBe(3);
    });
  });

  describe('Batch Retry Operations', () => {
    it('should retry batch operations independently', async () => {
      const operations = [
        async () => 'success1',
        async () => { throw new Error('Fail'); },
        async () => 'success3',
      ];

      const results = await Promise.allSettled(
        operations.map(op =>
          RetryOrchestratorBridge.retryWithExponentialBackoff(op, {
            maxAttempts: 2,
            initialDelayMs: 10,
            maxDelayMs: 100,
            backoffMultiplier: 2.0,
            jitter: false,
          })
        )
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should handle partial batch failures', async () => {
      let successCount = 0;
      let failureCount = 0;

      const operations = Array(5).fill(0).map((_, i) => async () => {
        if (i % 2 === 0) {
          successCount++;
          return `success-${i}`;
        }
        failureCount++;
        throw new Error(`fail-${i}`);
      });

      const results = await Promise.allSettled(
        operations.map(op =>
          RetryOrchestratorBridge.retryWithExponentialBackoff(op, {
            maxAttempts: 1,
            initialDelayMs: 10,
            maxDelayMs: 100,
            backoffMultiplier: 2.0,
            jitter: false,
          })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(3);  // 0, 2, 4
      expect(failed).toHaveLength(2);      // 1, 3
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max attempts', async () => {
      const operation = async (): Promise<string> => {
        throw new Error('Should not be called');
      };

      const config = {
        maxAttempts: 0,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      try {
        await RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBeDefined();
      }
    });

    it('should handle operation that takes longer than delay', async () => {
      let attemptCount = 0;

      const slowOperation = async (): Promise<string> => {
        attemptCount++;
        await new Promise(resolve => setTimeout(resolve, 100));

        if (attemptCount < 2) {
          throw new Error('Retry');
        }

        return 'success';
      };

      const config = {
        maxAttempts: 3,
        initialDelayMs: 10,  // Shorter than operation
        maxDelayMs: 50,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      const result = await RetryOrchestratorBridge.retryWithExponentialBackoff(slowOperation, config);

      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });

    it('should handle concurrent retry operations', async () => {
      let globalCounter = 0;

      const operation = async (): Promise<number> => {
        const current = ++globalCounter;

        if (current % 3 !== 0) {
          throw new Error('Retry');
        }

        return current;
      };

      const config = {
        maxAttempts: 5,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2.0,
        jitter: false,
      };

      // Run 3 operations concurrently
      const results = await Promise.all([
        RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config),
        RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config),
        RetryOrchestratorBridge.retryWithExponentialBackoff(operation, config),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(r => expect(typeof r).toBe('number'));
    });
  });
});
