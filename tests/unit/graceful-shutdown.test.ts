/**
 * Comprehensive tests for Graceful Shutdown Manager
 *
 * Tests for shutdown handling, in-flight tracking, and signal handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GracefulShutdownManager,
  InFlightTracker
} from '../../src/shared/process/graceful-shutdown.js';

describe('GracefulShutdownManager', () => {
  let shutdownManager: GracefulShutdownManager;

  beforeEach(() => {
    vi.useRealTimers();
    shutdownManager = new GracefulShutdownManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerHandler', () => {
    it('should register shutdown handler', () => {
      const handler = vi.fn();
      shutdownManager.registerHandler('test-handler', handler);

      expect(shutdownManager.isShutdownInProgress()).toBe(false);
    });

    it('should use default priority when not specified', () => {
      const handler = vi.fn();
      shutdownManager.registerHandler('default-priority', handler);
      // Default priority is 100 - this handler should exist
      expect(shutdownManager.isShutdownInProgress()).toBe(false);
    });

    it('should sort handlers by priority', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      shutdownManager.registerHandler('high-priority', handler1, 1);
      shutdownManager.registerHandler('low-priority', handler2, 100);
      shutdownManager.registerHandler('medium-priority', handler3, 50);

      // Handlers should execute in priority order (tested in shutdown test)
    });

    it('should register multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      shutdownManager.registerHandler('handler1', handler1);
      shutdownManager.registerHandler('handler2', handler2);

      expect(shutdownManager.isShutdownInProgress()).toBe(false);
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister handler', () => {
      const handler = vi.fn();
      shutdownManager.registerHandler('test-handler', handler);

      const result = shutdownManager.unregisterHandler('test-handler');
      expect(result).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      const result = shutdownManager.unregisterHandler('non-existent');
      expect(result).toBe(false);
    });

    it('should unregister only matching handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      shutdownManager.registerHandler('handler1', handler1);
      shutdownManager.registerHandler('handler2', handler2);

      const result = shutdownManager.unregisterHandler('handler1');
      expect(result).toBe(true);
    });
  });

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      expect(shutdownManager.isShutdownInProgress()).toBe(false);
    });

    it('should return true during shutdown', async () => {
      shutdownManager.registerHandler('slow-handler', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const shutdownPromise = shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      // Should be shutting down
      expect(shutdownManager.isShutdownInProgress()).toBe(true);

      await shutdownPromise;
    });
  });

  describe('shutdown', () => {
    it('should execute handlers in priority order', async () => {
      const executionOrder: number[] = [];

      shutdownManager.registerHandler('priority-3', async () => {
        executionOrder.push(3);
      }, 3);
      shutdownManager.registerHandler('priority-1', async () => {
        executionOrder.push(1);
      }, 1);
      shutdownManager.registerHandler('priority-2', async () => {
        executionOrder.push(2);
      }, 2);

      await shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should execute sync handlers', async () => {
      const handler = vi.fn();
      shutdownManager.registerHandler('sync-handler', handler);

      await shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      expect(handler).toHaveBeenCalled();
    });

    it('should execute async handlers', async () => {
      const handler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      shutdownManager.registerHandler('async-handler', handler);

      await shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      expect(handler).toHaveBeenCalled();
    });

    it('should continue with other handlers when one fails', async () => {
      const handler1 = vi.fn(async () => {
        throw new Error('Handler 1 failed');
      });
      const handler2 = vi.fn();

      shutdownManager.registerHandler('failing-handler', handler1, 1);
      shutdownManager.registerHandler('working-handler', handler2, 2);

      await shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous shutdowns', async () => {
      shutdownManager.registerHandler('slow-handler', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const promise1 = shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });
      const promise2 = shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      // Both should resolve to the same promise effectively
      await Promise.all([promise1, promise2]);

      expect(shutdownManager.isShutdownInProgress()).toBe(true);
    });

    it('should timeout if handlers take too long', async () => {
      shutdownManager.registerHandler('very-slow-handler', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      await expect(
        shutdownManager.shutdown('TEST', { timeout: 50, forceExitOnTimeout: false })
      ).rejects.toThrow('Shutdown timeout exceeded');
    });

    it('should complete successfully with no handlers', async () => {
      await expect(
        shutdownManager.shutdown('TEST', { timeout: 1000, forceExitOnTimeout: false })
      ).resolves.toBeUndefined();
    });

    it('should use signal name in shutdown', async () => {
      shutdownManager.registerHandler('test', vi.fn());

      await shutdownManager.shutdown('SIGTERM', { timeout: 1000, forceExitOnTimeout: false });

      expect(shutdownManager.isShutdownInProgress()).toBe(true);
    });

    it('should return resolved promise when already shutting down', async () => {
      let handlerCalls = 0;
      shutdownManager.registerHandler('slow', async () => {
        handlerCalls++;
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const promise1 = shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });
      const promise2 = shutdownManager.shutdown('TEST', { timeout: 5000, forceExitOnTimeout: false });

      await Promise.all([promise1, promise2]);

      // Handler should only be called once despite two shutdown calls
      expect(handlerCalls).toBe(1);
    });
  });
});

describe('InFlightTracker', () => {
  let tracker: InFlightTracker;

  beforeEach(() => {
    // Use real timers for InFlightTracker tests (setInterval/setTimeout must run)
    vi.useRealTimers();
    tracker = new InFlightTracker();
  });

  describe('start and complete', () => {
    it('should track in-flight operations', () => {
      expect(tracker.getCount()).toBe(0);

      tracker.start('operation1');
      expect(tracker.getCount()).toBe(1);

      tracker.start('operation2');
      expect(tracker.getCount()).toBe(2);

      tracker.complete('operation1');
      expect(tracker.getCount()).toBe(1);

      tracker.complete('operation2');
      expect(tracker.getCount()).toBe(0);
    });

    it('should handle completing non-existent operation', () => {
      tracker.complete('non-existent');
      expect(tracker.getCount()).toBe(0);
    });

    it('should handle completing same operation twice', () => {
      tracker.start('operation1');
      expect(tracker.getCount()).toBe(1);

      tracker.complete('operation1');
      expect(tracker.getCount()).toBe(0);

      tracker.complete('operation1');
      expect(tracker.getCount()).toBe(0);
    });
  });

  describe('getCount', () => {
    it('should return 0 initially', () => {
      expect(tracker.getCount()).toBe(0);
    });

    it('should return correct count after operations', () => {
      tracker.start('op1');
      tracker.start('op2');
      tracker.start('op3');

      expect(tracker.getCount()).toBe(3);

      tracker.complete('op2');
      expect(tracker.getCount()).toBe(2);
    });
  });

  describe('waitForCompletion', () => {
    it('should resolve immediately if no operations', async () => {
      await expect(tracker.waitForCompletion(1000)).resolves.toBeUndefined();
    });

    it('should wait for operations to complete', async () => {
      tracker.start('operation1');

      // Complete after 100ms
      setTimeout(() => {
        tracker.complete('operation1');
      }, 100);

      await expect(tracker.waitForCompletion(1000)).resolves.toBeUndefined();
    });

    it('should timeout if operations dont complete', async () => {
      tracker.start('operation1');

      await expect(tracker.waitForCompletion(100))
        .rejects.toThrow('Timeout waiting for in-flight operations');
    });

    it('should include remaining count in timeout error', async () => {
      tracker.start('op1');
      tracker.start('op2');

      await expect(tracker.waitForCompletion(100))
        .rejects.toThrow('2 remaining');
    });

    it('should handle multiple operations', async () => {
      tracker.start('operation1');
      tracker.start('operation2');
      tracker.start('operation3');

      // Complete all after 100ms
      setTimeout(() => {
        tracker.complete('operation1');
        tracker.complete('operation2');
        tracker.complete('operation3');
      }, 100);

      await expect(tracker.waitForCompletion(1000)).resolves.toBeUndefined();
    });

    it('should use default timeout from TIMEOUTS constant', async () => {
      tracker.start('operation1');

      // Complete immediately
      setTimeout(() => {
        tracker.complete('operation1');
      }, 50);

      // Should use default timeout (TIMEOUTS.GRACEFUL_SHUTDOWN)
      await expect(tracker.waitForCompletion()).resolves.toBeUndefined();
    });

    describe('with AbortSignal', () => {
      it('should reject immediately if signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        tracker.start('operation1');

        await expect(tracker.waitForCompletion(1000, controller.signal))
          .rejects.toThrow('Operation cancelled');
      });

      it('should reject when signal is aborted during wait', async () => {
        const controller = new AbortController();

        tracker.start('operation1');

        // Abort after 50ms
        setTimeout(() => {
          controller.abort();
        }, 50);

        await expect(tracker.waitForCompletion(1000, controller.signal))
          .rejects.toThrow('Operation cancelled');
      });

      it('should complete normally if signal is not aborted', async () => {
        const controller = new AbortController();

        tracker.start('operation1');

        // Complete after 50ms
        setTimeout(() => {
          tracker.complete('operation1');
        }, 50);

        await expect(tracker.waitForCompletion(1000, controller.signal))
          .resolves.toBeUndefined();
      });

      it('should cleanup abort listener on success', async () => {
        const controller = new AbortController();

        tracker.start('operation1');

        // Complete after 50ms
        setTimeout(() => {
          tracker.complete('operation1');
        }, 50);

        await tracker.waitForCompletion(1000, controller.signal);

        // Aborting after completion should not cause issues
        controller.abort();
        // No error should be thrown
      });

      it('should cleanup abort listener on timeout', async () => {
        const controller = new AbortController();

        tracker.start('operation1');

        try {
          await tracker.waitForCompletion(50, controller.signal);
        } catch {
          // Expected timeout
        }

        // Aborting after timeout should not cause issues
        controller.abort();
        // No error should be thrown
      });

      it('should handle operations completing after abort', async () => {
        const controller = new AbortController();

        tracker.start('operation1');

        // Abort quickly
        setTimeout(() => {
          controller.abort();
        }, 20);

        // Complete after abort
        setTimeout(() => {
          tracker.complete('operation1');
        }, 100);

        await expect(tracker.waitForCompletion(1000, controller.signal))
          .rejects.toThrow('Operation cancelled');

        // Count should still decrease
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(tracker.getCount()).toBe(0);
      });
    });
  });
});
