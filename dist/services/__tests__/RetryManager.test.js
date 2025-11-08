/**
 * RetryManager.test.ts
 *
 * Tests for exponential backoff retry logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RetryManager } from '../RetryManager.js';
describe('RetryManager', () => {
    let retryManager;
    beforeEach(() => {
        retryManager = new RetryManager();
    });
    describe('constructor', () => {
        it('should create with default configuration', () => {
            const manager = new RetryManager();
            expect(manager.getBaseDelay()).toBe(1000);
            expect(manager.getMaxRetries()).toBe(5);
            expect(manager.getMaxDelay()).toBe(3600000);
        });
        it('should create with custom configuration', () => {
            const manager = new RetryManager({
                baseDelay: 500,
                maxRetries: 3,
                maxDelay: 60000,
                jitterFactor: 0.1,
            });
            expect(manager.getBaseDelay()).toBe(500);
            expect(manager.getMaxRetries()).toBe(3);
            expect(manager.getMaxDelay()).toBe(60000);
        });
        it('should handle partial configuration', () => {
            const manager = new RetryManager({ maxRetries: 10 });
            expect(manager.getBaseDelay()).toBe(1000); // Default
            expect(manager.getMaxRetries()).toBe(10); // Custom
            expect(manager.getMaxDelay()).toBe(3600000); // Default
        });
    });
    describe('getNextRetryDelay', () => {
        it('should calculate exponential backoff for retry 0', () => {
            const delay = retryManager.getNextRetryDelay(0);
            // Retry 0: 2^0 * 1000 = 1000ms
            // With ±25% jitter: 750ms to 1250ms
            expect(delay).toBeGreaterThanOrEqual(750);
            expect(delay).toBeLessThanOrEqual(1250);
        });
        it('should calculate exponential backoff for retry 1', () => {
            const delay = retryManager.getNextRetryDelay(1);
            // Retry 1: 2^1 * 1000 = 2000ms
            // With ±25% jitter: 1500ms to 2500ms
            expect(delay).toBeGreaterThanOrEqual(1500);
            expect(delay).toBeLessThanOrEqual(2500);
        });
        it('should calculate exponential backoff for retry 2', () => {
            const delay = retryManager.getNextRetryDelay(2);
            // Retry 2: 2^2 * 1000 = 4000ms
            // With ±25% jitter: 3000ms to 5000ms
            expect(delay).toBeGreaterThanOrEqual(3000);
            expect(delay).toBeLessThanOrEqual(5000);
        });
        it('should calculate exponential backoff for retry 3', () => {
            const delay = retryManager.getNextRetryDelay(3);
            // Retry 3: 2^3 * 1000 = 8000ms
            // With ±25% jitter: 6000ms to 10000ms
            expect(delay).toBeGreaterThanOrEqual(6000);
            expect(delay).toBeLessThanOrEqual(10000);
        });
        it('should cap delay at maxDelay', () => {
            const manager = new RetryManager({ maxDelay: 5000 });
            const delay = manager.getNextRetryDelay(10);
            // 2^10 * 1000 = 1,024,000ms, but capped at 5000ms
            // With ±25% jitter: 3750ms to 6250ms
            expect(delay).toBeGreaterThanOrEqual(3750);
            expect(delay).toBeLessThanOrEqual(6250);
        });
        it('should never return negative delay', () => {
            const delay = retryManager.getNextRetryDelay(0);
            expect(delay).toBeGreaterThanOrEqual(0);
        });
        it('should return integer delay', () => {
            const delay = retryManager.getNextRetryDelay(1);
            expect(Number.isInteger(delay)).toBe(true);
        });
        it('should add jitter variation', () => {
            // Run multiple times to verify jitter is applied
            const delays = new Set();
            for (let i = 0; i < 10; i++) {
                const delay = retryManager.getNextRetryDelay(2);
                delays.add(delay);
            }
            // With jitter, delays should vary (not all the same)
            // This may fail occasionally due to randomness, but very unlikely with 10 iterations
            expect(delays.size).toBeGreaterThan(1);
        });
    });
    describe('shouldRetry', () => {
        it('should allow retry when count is below max', () => {
            expect(retryManager.shouldRetry(0)).toBe(true);
            expect(retryManager.shouldRetry(1)).toBe(true);
            expect(retryManager.shouldRetry(2)).toBe(true);
            expect(retryManager.shouldRetry(3)).toBe(true);
            expect(retryManager.shouldRetry(4)).toBe(true);
        });
        it('should stop retrying when count equals max', () => {
            // Max retries is 5, so retry count 5 should not retry
            expect(retryManager.shouldRetry(5)).toBe(false);
        });
        it('should stop retrying when count exceeds max', () => {
            expect(retryManager.shouldRetry(6)).toBe(false);
            expect(retryManager.shouldRetry(10)).toBe(false);
            expect(retryManager.shouldRetry(100)).toBe(false);
        });
        it('should respect custom max retries', () => {
            const manager = new RetryManager({ maxRetries: 3 });
            expect(manager.shouldRetry(0)).toBe(true);
            expect(manager.shouldRetry(1)).toBe(true);
            expect(manager.shouldRetry(2)).toBe(true);
            expect(manager.shouldRetry(3)).toBe(false); // Max is 3
            expect(manager.shouldRetry(4)).toBe(false);
        });
    });
    describe('getNextRetryTimestamp', () => {
        it('should return future timestamp', () => {
            const now = Date.now();
            const timestamp = retryManager.getNextRetryTimestamp(0);
            expect(timestamp).toBeGreaterThan(now);
        });
        it('should be approximately baseDelay in the future for retry 0', () => {
            const now = Date.now();
            const timestamp = retryManager.getNextRetryTimestamp(0);
            const delta = timestamp - now;
            // Retry 0: 1000ms ±25% = 750ms to 1250ms
            expect(delta).toBeGreaterThanOrEqual(750);
            expect(delta).toBeLessThanOrEqual(1250);
        });
        it('should be approximately 2*baseDelay in the future for retry 1', () => {
            const now = Date.now();
            const timestamp = retryManager.getNextRetryTimestamp(1);
            const delta = timestamp - now;
            // Retry 1: 2000ms ±25% = 1500ms to 2500ms
            expect(delta).toBeGreaterThanOrEqual(1500);
            expect(delta).toBeLessThanOrEqual(2500);
        });
        it('should return increasing timestamps for increasing retry counts', () => {
            const ts0 = retryManager.getNextRetryTimestamp(0);
            const ts1 = retryManager.getNextRetryTimestamp(1);
            const ts2 = retryManager.getNextRetryTimestamp(2);
            // Each retry should generally be further in the future
            // (may fail occasionally due to jitter, but very unlikely)
            expect(ts1).toBeGreaterThan(ts0);
            expect(ts2).toBeGreaterThan(ts1);
        });
    });
    describe('configuration getters', () => {
        it('should return base delay', () => {
            const manager = new RetryManager({ baseDelay: 2000 });
            expect(manager.getBaseDelay()).toBe(2000);
        });
        it('should return max retries', () => {
            const manager = new RetryManager({ maxRetries: 10 });
            expect(manager.getMaxRetries()).toBe(10);
        });
        it('should return max delay', () => {
            const manager = new RetryManager({ maxDelay: 120000 });
            expect(manager.getMaxDelay()).toBe(120000);
        });
    });
    describe('edge cases', () => {
        it('should handle retry count of 0', () => {
            expect(() => retryManager.getNextRetryDelay(0)).not.toThrow();
            expect(retryManager.shouldRetry(0)).toBe(true);
        });
        it('should handle very high retry counts', () => {
            expect(() => retryManager.getNextRetryDelay(100)).not.toThrow();
            expect(retryManager.shouldRetry(100)).toBe(false);
        });
        it('should handle zero max retries', () => {
            const manager = new RetryManager({ maxRetries: 0 });
            // With maxRetries=0, no retries should be allowed
            // retryCount < maxRetries: 0 < 0 = false (correct, no retry)
            expect(manager.shouldRetry(0)).toBe(false);
            expect(manager.shouldRetry(1)).toBe(false);
        });
        it('should handle very small base delay', () => {
            const manager = new RetryManager({ baseDelay: 1 });
            const delay = manager.getNextRetryDelay(0);
            // 1ms ±25% with jitter, minimum 0
            expect(delay).toBeGreaterThanOrEqual(0);
            expect(delay).toBeLessThanOrEqual(2);
        });
    });
    describe('real-world scenarios', () => {
        it('should provide reasonable backoff schedule for default config', () => {
            const delays = [];
            for (let retry = 0; retry < 6; retry++) {
                const delay = retryManager.getNextRetryDelay(retry);
                delays.push(delay);
            }
            // Verify delays are increasing (generally)
            // Retry 0: ~1s, Retry 1: ~2s, Retry 2: ~4s, etc.
            expect(delays[0]).toBeLessThan(2000);
            expect(delays[1]).toBeLessThan(3000);
            expect(delays[2]).toBeLessThan(6000);
            expect(delays[3]).toBeLessThan(12000);
            expect(delays[4]).toBeLessThan(24000);
        });
        it('should cap delays at maxDelay for large retry counts', () => {
            const manager = new RetryManager({ maxDelay: 10000 });
            // Very high retry count should still be capped
            const delay = manager.getNextRetryDelay(100);
            // 10000ms ±25% = 7500ms to 12500ms
            expect(delay).toBeGreaterThanOrEqual(7500);
            expect(delay).toBeLessThanOrEqual(12500);
        });
        it('should support aggressive retry strategy', () => {
            const manager = new RetryManager({
                baseDelay: 100,
                maxRetries: 10,
                maxDelay: 5000,
            });
            expect(manager.shouldRetry(9)).toBe(true);
            expect(manager.shouldRetry(10)).toBe(false);
            const delay = manager.getNextRetryDelay(0);
            // 100ms ±25% = 75ms to 125ms
            expect(delay).toBeLessThanOrEqual(125);
        });
        it('should support conservative retry strategy', () => {
            const manager = new RetryManager({
                baseDelay: 5000,
                maxRetries: 2,
                maxDelay: 60000,
            });
            expect(manager.shouldRetry(1)).toBe(true);
            expect(manager.shouldRetry(2)).toBe(false);
            const delay = manager.getNextRetryDelay(0);
            // 5000ms ±25% = 3750ms to 6250ms
            expect(delay).toBeGreaterThanOrEqual(3750);
            expect(delay).toBeLessThanOrEqual(6250);
        });
    });
});
//# sourceMappingURL=RetryManager.test.js.map