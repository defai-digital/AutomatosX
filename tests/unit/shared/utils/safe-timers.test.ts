/**
 * Safe Timer Utilities Tests
 *
 * @module tests/unit/shared/utils/safe-timers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSafeInterval,
  createSafeTimeout,
  withTimeout,
  createDeferredWithTimeout,
  sleep,
  SafeTimerTimeoutError
} from '../../../../src/shared/utils/safe-timers.js';

describe('safe-timers', () => {
  // Note: Each test manages its own timer mode (fake or real)
  // Interval tests use real timers with short intervals to avoid infinite loop issues
  // IMPORTANT: Always restore to real timers in afterEach to prevent test pollution

  // Global afterEach to ensure timers are always restored to real mode
  // This prevents issues with vitest's global cleanup on Windows
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createSafeInterval', () => {
    // Interval tests need real timers to avoid fake timer infinite loop issues
    it('should call callback at specified interval', async () => {
      vi.useRealTimers();

      const callback = vi.fn();
      const cleanup = createSafeInterval(callback, 10); // Short interval

      expect(callback).not.toHaveBeenCalled();

      // Wait for 2 ticks
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(callback).toHaveBeenCalledTimes(2);

      cleanup();
    });

    it('should stop calling callback after cleanup', async () => {
      vi.useRealTimers();

      const callback = vi.fn();
      const cleanup = createSafeInterval(callback, 10);

      // Wait for 1 tick
      await new Promise(resolve => setTimeout(resolve, 15));
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();

      // Wait to verify no more calls
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should run immediately when immediate option is true', async () => {
      vi.useRealTimers();

      const callback = vi.fn();
      const cleanup = createSafeInterval(callback, 1000, { immediate: true });

      // Wait for setImmediate to run
      await new Promise(resolve => setImmediate(resolve));
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should handle async callbacks', async () => {
      vi.useRealTimers();

      const results: number[] = [];
      const callback = vi.fn(() => {
        results.push(Date.now());
        return Promise.resolve();
      });

      const cleanup = createSafeInterval(callback, 10);

      // Wait for 2 ticks
      await new Promise(resolve => setTimeout(resolve, 25));

      expect(callback).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      cleanup();
    });

    it('should support AbortSignal for cancellation', async () => {
      vi.useRealTimers();

      const controller = new AbortController();
      const callback = vi.fn();

      const cleanup = createSafeInterval(callback, 10, {
        signal: controller.signal
      });

      // Wait for 1 tick
      await new Promise(resolve => setTimeout(resolve, 15));
      expect(callback).toHaveBeenCalledTimes(1);

      controller.abort();

      // Wait to verify no more calls
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should return no-op cleanup if signal is already aborted', async () => {
      vi.useRealTimers();

      const controller = new AbortController();
      controller.abort();

      const callback = vi.fn();
      const cleanup = createSafeInterval(callback, 10, {
        signal: controller.signal
      });

      await new Promise(resolve => setTimeout(resolve, 30));
      expect(callback).not.toHaveBeenCalled();

      cleanup(); // Should not throw
    });

    it('should catch and log errors from callback', async () => {
      vi.useRealTimers();

      const callback = vi.fn(() => {
        throw new Error('Test error');
      });

      const cleanup = createSafeInterval(callback, 10);

      // Wait for multiple ticks - should not throw and continue running
      // Use longer wait (50ms) and check "at least 2" to avoid timing flakiness
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);

      cleanup();
    });

    it('should be idempotent when cleanup is called multiple times', () => {
      vi.useRealTimers();

      const callback = vi.fn();
      const cleanup = createSafeInterval(callback, 1000);

      cleanup();
      cleanup(); // Should not throw
      cleanup(); // Should not throw
    });
  });

  describe('createSafeTimeout', () => {
    // Timeout tests can use fake timers since setTimeout doesn't cause infinite loops
    beforeEach(() => {
      vi.useFakeTimers();
    });

    // Note: afterEach to restore real timers is handled by parent describe block

    it('should call callback after specified delay', async () => {
      const callback = vi.fn();
      createSafeTimeout(callback, 1000);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callback if cancelled', async () => {
      const callback = vi.fn();
      const cancel = createSafeTimeout(callback, 1000);

      vi.advanceTimersByTime(500);
      cancel();

      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle async callbacks', async () => {
      const callback = vi.fn(async () => {
        // Async callback that doesn't return a value
      });

      createSafeTimeout(callback, 100);

      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support AbortSignal for cancellation', async () => {
      const controller = new AbortController();
      const callback = vi.fn();

      createSafeTimeout(callback, 1000, { signal: controller.signal });

      vi.advanceTimersByTime(500);
      controller.abort();

      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should catch and log errors from callback', async () => {
      const callback = vi.fn(() => {
        throw new Error('Test error');
      });

      createSafeTimeout(callback, 1000);

      // Should not throw
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('withTimeout', () => {
    it('should resolve with promise result if within timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should reject with SafeTimerTimeoutError if timeout exceeded', async () => {
      vi.useRealTimers(); // Need real timers for this test

      const slowPromise = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      await expect(withTimeout(slowPromise, 10)).rejects.toThrow(SafeTimerTimeoutError);
    });

    it('should include timeout duration in error', async () => {
      vi.useRealTimers();

      const slowPromise = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      try {
        await withTimeout(slowPromise, 10);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SafeTimerTimeoutError);
        expect((error as SafeTimerTimeoutError).timeoutMs).toBe(10);
      }
    });

    it('should use custom error message', async () => {
      vi.useRealTimers();

      const slowPromise = new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      await expect(
        withTimeout(slowPromise, 10, { message: 'Custom timeout message' })
      ).rejects.toThrow('Custom timeout message');
    });

    it('should propagate original promise rejection', async () => {
      const error = new Error('Original error');
      const failingPromise = Promise.reject(error);

      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Original error');
    });

    it('should clear timeout after promise resolves', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = Promise.resolve('success');
      await withTimeout(promise, 1000);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout after promise rejects', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = Promise.reject(new Error('fail'));

      try {
        await withTimeout(promise, 1000);
      } catch {
        // Expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('createDeferredWithTimeout', () => {
    it('should resolve when resolve is called', async () => {
      vi.useRealTimers();

      const deferred = createDeferredWithTimeout<string>(1000);
      deferred.resolve('success');

      await expect(deferred.promise).resolves.toBe('success');
    });

    it('should reject when reject is called', async () => {
      vi.useRealTimers();

      const deferred = createDeferredWithTimeout<string>(1000);
      const error = new Error('Custom error');
      deferred.reject(error);

      await expect(deferred.promise).rejects.toThrow('Custom error');
    });

    it('should reject with timeout error if not resolved in time', async () => {
      vi.useRealTimers();

      const deferred = createDeferredWithTimeout<string>(10);

      await expect(deferred.promise).rejects.toThrow(SafeTimerTimeoutError);
    });

    it('should allow cancellation', async () => {
      vi.useRealTimers();

      const deferred = createDeferredWithTimeout<string>(1000);
      deferred.cancel();

      await expect(deferred.promise).rejects.toThrow('Deferred cancelled');
    });

    it('should ignore subsequent resolve/reject after first settle', async () => {
      vi.useRealTimers();

      const deferred = createDeferredWithTimeout<string>(1000);

      deferred.resolve('first');
      deferred.resolve('second'); // Should be ignored
      deferred.reject(new Error('error')); // Should be ignored

      await expect(deferred.promise).resolves.toBe('first');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified duration', async () => {
      vi.useRealTimers();

      const start = Date.now();
      await sleep(10); // Use a short real delay
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(100);
    });

    it('should reject if aborted', async () => {
      vi.useRealTimers();

      const controller = new AbortController();

      const sleepPromise = sleep(1000, controller.signal);

      // Abort immediately
      controller.abort();

      await expect(sleepPromise).rejects.toThrow('Sleep aborted');
    });

    it('should reject immediately if signal is already aborted', async () => {
      vi.useRealTimers();

      const controller = new AbortController();
      controller.abort();

      await expect(sleep(1000, controller.signal)).rejects.toThrow('Sleep aborted');
    });
  });

  describe('SafeTimerTimeoutError', () => {
    it('should have correct name', () => {
      const error = new SafeTimerTimeoutError('Test', 1000);
      expect(error.name).toBe('SafeTimerTimeoutError');
    });

    it('should have correct message', () => {
      const error = new SafeTimerTimeoutError('Custom message', 1000);
      expect(error.message).toBe('Custom message');
    });

    it('should have correct timeoutMs', () => {
      const error = new SafeTimerTimeoutError('Test', 5000);
      expect(error.timeoutMs).toBe(5000);
    });

    it('should be instance of Error', () => {
      const error = new SafeTimerTimeoutError('Test', 1000);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
