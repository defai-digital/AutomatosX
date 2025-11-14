import { describe, it, expect } from 'vitest';
import * as RetryFallback from '../../../packages/rescript-core/src/retry/RetryFallback.bs.js';
import * as Bridge from '../../bridge/RescriptBridge.js';
describe('RetryFallback - Retry Strategies', () => {
    it('should create fixed delay strategy', () => {
        const strategy = RetryFallback.fixedDelay(1000);
        expect(strategy).toEqual({
            TAG: 'FixedDelay',
            delayMs: 1000,
        });
    });
    it('should create exponential backoff strategy', () => {
        const strategy = RetryFallback.exponentialBackoff(100, 30000, 2.0, undefined);
        expect(strategy).toEqual({
            TAG: 'ExponentialBackoff',
            initialDelayMs: 100,
            maxDelayMs: 30000,
            multiplier: 2.0,
        });
    });
    it('should create linear backoff strategy', () => {
        const strategy = RetryFallback.linearBackoff(100, 100, undefined);
        expect(strategy).toEqual({
            TAG: 'LinearBackoff',
            initialDelayMs: 100,
            incrementMs: 100,
        });
    });
    it('should create random jitter strategy', () => {
        const strategy = RetryFallback.randomJitter(100, 1000, undefined);
        expect(strategy).toEqual({
            TAG: 'RandomJitter',
            baseDelayMs: 100,
            maxJitterMs: 1000,
        });
    });
    it('should calculate fixed delay correctly', () => {
        const strategy = RetryFallback.fixedDelay(500);
        const delay1 = RetryFallback.calculateDelay(strategy, 1);
        const delay2 = RetryFallback.calculateDelay(strategy, 5);
        expect(delay1).toBe(500);
        expect(delay2).toBe(500);
    });
    it('should calculate exponential backoff correctly', () => {
        const strategy = RetryFallback.exponentialBackoff(100, 10000, 2.0, undefined);
        const delay1 = RetryFallback.calculateDelay(strategy, 1);
        const delay2 = RetryFallback.calculateDelay(strategy, 2);
        const delay3 = RetryFallback.calculateDelay(strategy, 3);
        expect(delay1).toBe(100); // 100 * 2^0
        expect(delay2).toBe(200); // 100 * 2^1
        expect(delay3).toBe(400); // 100 * 2^2
    });
    it('should cap exponential backoff at max delay', () => {
        const strategy = RetryFallback.exponentialBackoff(100, 500, 2.0, undefined);
        const delay5 = RetryFallback.calculateDelay(strategy, 5);
        expect(delay5).toBeLessThanOrEqual(500);
    });
    it('should calculate linear backoff correctly', () => {
        const strategy = RetryFallback.linearBackoff(100, 50, undefined);
        const delay1 = RetryFallback.calculateDelay(strategy, 1);
        const delay2 = RetryFallback.calculateDelay(strategy, 2);
        const delay3 = RetryFallback.calculateDelay(strategy, 3);
        expect(delay1).toBe(100); // 100 + 50 * 0
        expect(delay2).toBe(150); // 100 + 50 * 1
        expect(delay3).toBe(200); // 100 + 50 * 2
    });
    it('should calculate random jitter within range', () => {
        const strategy = RetryFallback.randomJitter(100, 100, undefined);
        const delay = RetryFallback.calculateDelay(strategy, 1);
        expect(delay).toBeGreaterThanOrEqual(100);
        expect(delay).toBeLessThanOrEqual(200);
    });
});
describe('RetryFallback - Circuit Breaker', () => {
    it('should create circuit breaker with default config', () => {
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        expect(cb.state).toBe('Closed');
        expect(cb.failureCount).toBe(0);
        expect(cb.successCount).toBe(0);
    });
    it('should create circuit breaker with custom config', () => {
        const config = RetryFallback.createCircuitBreakerConfig(3, 2, 30000, 1, undefined);
        const cb = RetryFallback.createCircuitBreaker(undefined, config, undefined);
        expect(cb.config.failureThreshold).toBe(3);
        expect(cb.config.successThreshold).toBe(2);
        expect(cb.config.timeout).toBe(30000);
    });
    it('should record success in closed state', () => {
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        const updated = RetryFallback.recordSuccess(cb);
        expect(updated.state).toBe('Closed');
        expect(updated.successCount).toBe(0);
        expect(updated.failureCount).toBe(0);
    });
    it('should record failure in closed state', () => {
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        const updated = RetryFallback.recordFailure(cb);
        expect(updated.state).toBe('Closed');
        expect(updated.failureCount).toBe(1);
    });
    it('should transition from closed to open on threshold failures', () => {
        const config = RetryFallback.createCircuitBreakerConfig(3, 2, 30000, 1, undefined);
        let cb = RetryFallback.createCircuitBreaker(undefined, config, undefined);
        cb = RetryFallback.recordFailure(cb);
        cb = RetryFallback.recordFailure(cb);
        cb = RetryFallback.recordFailure(cb);
        expect(cb.state).toBe('Open');
        expect(cb.failureCount).toBe(3);
    });
    it('should not attempt when circuit is open', () => {
        const config = RetryFallback.createCircuitBreakerConfig(2, 1, 30000, 1, undefined);
        let cb = RetryFallback.createCircuitBreaker(undefined, config, undefined);
        cb = RetryFallback.recordFailure(cb);
        cb = RetryFallback.recordFailure(cb);
        const [shouldTry, _updatedCb] = RetryFallback.shouldAttempt(cb);
        expect(shouldTry).toBe(false);
    });
    it('should transition from open to half-open after timeout', async () => {
        const config = RetryFallback.createCircuitBreakerConfig(2, 1, 100, 1, undefined);
        let cb = RetryFallback.createCircuitBreaker(undefined, config, undefined);
        cb = RetryFallback.recordFailure(cb);
        cb = RetryFallback.recordFailure(cb);
        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 150));
        const [shouldTry, updatedCb] = RetryFallback.shouldAttempt(cb);
        expect(shouldTry).toBe(true);
        expect(updatedCb.state).toBe('HalfOpen');
    });
    it('should transition from half-open to closed on success threshold', () => {
        const config = RetryFallback.createCircuitBreakerConfig(2, 2, 30000, 1, undefined);
        const cb = {
            ...RetryFallback.createCircuitBreaker(undefined, config, undefined),
            state: 'HalfOpen',
        };
        let updated = RetryFallback.recordSuccess(cb);
        expect(updated.state).toBe('HalfOpen');
        expect(updated.successCount).toBe(1);
        updated = RetryFallback.recordSuccess(updated);
        expect(updated.state).toBe('Closed');
        expect(updated.successCount).toBe(0);
        expect(updated.failureCount).toBe(0);
    });
    it('should transition from half-open to open on failure', () => {
        const config = RetryFallback.createCircuitBreakerConfig(2, 1, 30000, 1, undefined);
        const cb = {
            ...RetryFallback.createCircuitBreaker(undefined, config, undefined),
            state: 'HalfOpen',
        };
        const updated = RetryFallback.recordFailure(cb);
        expect(updated.state).toBe('Open');
    });
    it('should reset circuit breaker to closed state', () => {
        const config = RetryFallback.createCircuitBreakerConfig(2, 1, 30000, 1, undefined);
        let cb = RetryFallback.createCircuitBreaker(undefined, config, undefined);
        cb = RetryFallback.recordFailure(cb);
        cb = RetryFallback.recordFailure(cb);
        const reset = RetryFallback.resetCircuitBreaker(cb);
        expect(reset.state).toBe('Closed');
        expect(reset.failureCount).toBe(0);
        expect(reset.successCount).toBe(0);
    });
    it('should get circuit state', () => {
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        const state = RetryFallback.getCircuitState(cb);
        expect(state).toBe('Closed');
    });
});
describe('RetryFallback - Retry Execution', () => {
    it('should succeed on first attempt', async () => {
        const fn = async () => Bridge.ok(42);
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe(42);
        expect(execution.attempts.length).toBe(1);
        expect(execution.usedFallback).toBe(false);
    });
    it('should retry on failure and eventually succeed', async () => {
        let attempts = 0;
        const fn = async () => {
            attempts++;
            return attempts === 3 ? Bridge.ok(42) : Bridge.error('Failed');
        };
        const config = RetryFallback.createRetryConfig(5, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe(42);
        expect(execution.attempts.length).toBe(3);
    });
    it('should fail after max attempts', async () => {
        const fn = async () => Bridge.error('Always fails');
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(Bridge.isError(execution.result)).toBe(true);
        expect(execution.attempts.length).toBe(3);
    });
    it('should track attempt timestamps', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(execution.attempts.length).toBe(2);
        expect(execution.attempts[0].timestamp).toBeGreaterThan(0);
        expect(execution.attempts[1].timestamp).toBeGreaterThanOrEqual(execution.attempts[0].timestamp);
    });
    it('should track total duration', async () => {
        const fn = async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return Bridge.error('Failed');
        };
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(execution.totalDuration).toBeGreaterThan(0);
    });
    it('should use custom shouldRetry predicate', async () => {
        let attempts = 0;
        const fn = async () => {
            attempts++;
            return Bridge.error(attempts === 1 ? 'Retryable' : 'NonRetryable');
        };
        const shouldRetry = (error) => error === 'Retryable';
        const config = RetryFallback.createRetryConfig(5, undefined, undefined, shouldRetry, undefined);
        const execution = await RetryFallback.retry(fn, config);
        // Should stop after second attempt because error is not retryable
        expect(execution.attempts.length).toBe(2);
    });
    it('should record attempt errors', async () => {
        const fn = async () => Bridge.error('Test error');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(execution.attempts[0].error).toBe('Test error');
        expect(execution.attempts[1].error).toBe('Test error');
    });
});
describe('RetryFallback - Retry with Fallback', () => {
    it('should use default value fallback on failure', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const fallback = { TAG: 'DefaultValue', _0: 100 };
        const execution = await RetryFallback.retryWithFallback(fn, config, fallback);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe(100);
        expect(execution.usedFallback).toBe(true);
    });
    it('should use cached value fallback on failure', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const fallback = { TAG: 'Cached', _0: 'cached-value' };
        const execution = await RetryFallback.retryWithFallback(fn, config, fallback);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe('cached-value');
        expect(execution.usedFallback).toBe(true);
    });
    it('should use degraded value fallback on failure', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const fallback = { TAG: 'Degraded', _0: 'degraded-value' };
        const execution = await RetryFallback.retryWithFallback(fn, config, fallback);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe('degraded-value');
        expect(execution.usedFallback).toBe(true);
    });
    it('should use alternative function fallback on failure', async () => {
        const fn = async () => Bridge.error('Failed');
        const altFn = async () => Bridge.ok(200);
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const fallback = { TAG: 'AlternativeFunction', _0: altFn };
        const execution = await RetryFallback.retryWithFallback(fn, config, fallback);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe(200);
        expect(execution.usedFallback).toBe(true);
    });
    it('should not use fallback on success', async () => {
        const fn = async () => Bridge.ok(42);
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const fallback = { TAG: 'DefaultValue', _0: 100 };
        const execution = await RetryFallback.retryWithFallback(fn, config, fallback);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe(42);
        expect(execution.usedFallback).toBe(false);
    });
});
describe('RetryFallback - Retry with Circuit Breaker', () => {
    it('should succeed when circuit is closed', async () => {
        const fn = async () => Bridge.ok(42);
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        const [execution, updatedCb] = await RetryFallback.retryWithCircuitBreaker(fn, config, cb);
        expect(Bridge.isOk(execution.result)).toBe(true);
        expect(Bridge.unwrap(execution.result)).toBe(42);
        expect(updatedCb.state).toBe('Closed');
    });
    it('should fail immediately when circuit is open', async () => {
        const fn = async () => Bridge.ok(42);
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const cbConfig = RetryFallback.createCircuitBreakerConfig(2, 1, 30000, 1, undefined);
        let cb = RetryFallback.createCircuitBreaker(undefined, cbConfig, undefined);
        // Open the circuit
        cb = RetryFallback.recordFailure(cb);
        cb = RetryFallback.recordFailure(cb);
        const [execution, updatedCb] = await RetryFallback.retryWithCircuitBreaker(fn, config, cb);
        expect(Bridge.isError(execution.result)).toBe(true);
        expect(Bridge.getError(execution.result)).toBe('Circuit breaker is open');
        expect(execution.attempts.length).toBe(0);
        expect(updatedCb.state).toBe('Open');
    });
    it('should record success in circuit breaker', async () => {
        const fn = async () => Bridge.ok(42);
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        const [_execution, updatedCb] = await RetryFallback.retryWithCircuitBreaker(fn, config, cb);
        expect(updatedCb.failureCount).toBe(0);
    });
    it('should record failure in circuit breaker', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const cb = RetryFallback.createCircuitBreaker(undefined, undefined, undefined);
        const [_execution, updatedCb] = await RetryFallback.retryWithCircuitBreaker(fn, config, cb);
        expect(updatedCb.failureCount).toBe(1);
    });
});
describe('RetryFallback - Batch Retry', () => {
    it('should retry all functions in batch', async () => {
        const fn1 = async () => Bridge.ok(1);
        const fn2 = async () => Bridge.ok(2);
        const fn3 = async () => Bridge.ok(3);
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const executions = await RetryFallback.retryBatch([fn1, fn2, fn3], config);
        expect(executions.length).toBe(3);
        expect(Bridge.unwrap(executions[0].result)).toBe(1);
        expect(Bridge.unwrap(executions[1].result)).toBe(2);
        expect(Bridge.unwrap(executions[2].result)).toBe(3);
    });
    it('should handle mixed success and failure in batch', async () => {
        const fn1 = async () => Bridge.ok(1);
        const fn2 = async () => Bridge.error('Failed');
        const fn3 = async () => Bridge.ok(3);
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const executions = await RetryFallback.retryBatch([fn1, fn2, fn3], config);
        expect(executions.length).toBe(3);
        expect(Bridge.isOk(executions[0].result)).toBe(true);
        expect(Bridge.isError(executions[1].result)).toBe(true);
        expect(Bridge.isOk(executions[2].result)).toBe(true);
    });
});
describe('RetryFallback - Utility Functions', () => {
    it('should check if execution was successful', async () => {
        const fn1 = async () => Bridge.ok(42);
        const fn2 = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const execution1 = await RetryFallback.retry(fn1, config);
        const execution2 = await RetryFallback.retry(fn2, config);
        expect(RetryFallback.wasSuccessful(execution1)).toBe(true);
        expect(RetryFallback.wasSuccessful(execution2)).toBe(false);
    });
    it('should get attempt count', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(RetryFallback.getAttemptCount(execution)).toBe(3);
    });
    it('should get total retries', async () => {
        const fn = async () => Bridge.error('Failed');
        const config = RetryFallback.createRetryConfig(3, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        expect(RetryFallback.getTotalRetries(execution)).toBe(2); // 3 attempts = 2 retries
    });
    it('should get last error', async () => {
        const fn = async () => Bridge.error('Test error');
        const config = RetryFallback.createRetryConfig(2, undefined, undefined, undefined, undefined);
        const execution = await RetryFallback.retry(fn, config);
        const lastError = RetryFallback.getLastError(execution);
        expect(lastError).toBeDefined();
        expect(lastError).toContain('Test error');
    });
});
describe('RetryFallback - Error Classification', () => {
    it('should classify rate limit errors', () => {
        expect(RetryFallback.classifyError('Rate limit exceeded')).toBe('RateLimited');
        expect(RetryFallback.classifyError('Too many requests')).toBe('RateLimited');
        expect(RetryFallback.classifyError('HTTP 429')).toBe('RateLimited');
    });
    it('should classify timeout errors', () => {
        expect(RetryFallback.classifyError('Request timeout')).toBe('Timeout');
        expect(RetryFallback.classifyError('Connection timed out')).toBe('Timeout');
        expect(RetryFallback.classifyError('Deadline exceeded')).toBe('Timeout');
    });
    it('should classify retryable errors', () => {
        expect(RetryFallback.classifyError('Network error')).toBe('Retryable');
        expect(RetryFallback.classifyError('Connection failed')).toBe('Retryable');
        expect(RetryFallback.classifyError('Service unavailable')).toBe('Retryable');
        expect(RetryFallback.classifyError('HTTP 503')).toBe('Retryable');
    });
    it('should classify non-retryable errors', () => {
        expect(RetryFallback.classifyError('Unauthorized')).toBe('NonRetryable');
        expect(RetryFallback.classifyError('Forbidden')).toBe('NonRetryable');
        expect(RetryFallback.classifyError('Not found')).toBe('NonRetryable');
        expect(RetryFallback.classifyError('Invalid request')).toBe('NonRetryable');
    });
    it('should check if error is retryable', () => {
        expect(RetryFallback.isRetryable('Network error')).toBe(true);
        expect(RetryFallback.isRetryable('Timeout')).toBe(true);
        expect(RetryFallback.isRetryable('Rate limit')).toBe(true);
        expect(RetryFallback.isRetryable('Unauthorized')).toBe(false);
    });
});
//# sourceMappingURL=RetryFallback.test.js.map