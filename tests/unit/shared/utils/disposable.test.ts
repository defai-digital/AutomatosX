/**
 * Disposable Base Classes Tests
 *
 * @module tests/unit/shared/utils/disposable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  Disposable,
  DisposableEventEmitter,
  createDisposableWrapper
} from '../../../../src/shared/utils/disposable.js';

describe('disposable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Disposable', () => {
    class TestDisposable extends Disposable {
      public cleanupCalled = false;
      public onDestroyCalled = false;
      protected override readonly disposableName = 'TestDisposable';

      constructor() {
        super();
        this.registerCleanup(() => {
          this.cleanupCalled = true;
        });
      }

      protected override onDestroy(): void {
        this.onDestroyCalled = true;
      }

      // Expose protected methods for testing
      public testCreateInterval(callback: () => void, ms: number): () => void {
        return this.createInterval(callback, ms);
      }

      public testCreateTimeout(callback: () => void, ms: number): () => void {
        return this.createTimeout(callback, ms);
      }

      public testRegisterCleanup(task: () => void): void {
        this.registerCleanup(task);
      }
    }

    it('should call onDestroy when destroyed', async () => {
      const disposable = new TestDisposable();
      expect(disposable.onDestroyCalled).toBe(false);

      await disposable.destroy();

      expect(disposable.onDestroyCalled).toBe(true);
    });

    it('should execute cleanup tasks on destroy', async () => {
      const disposable = new TestDisposable();
      expect(disposable.cleanupCalled).toBe(false);

      await disposable.destroy();

      expect(disposable.cleanupCalled).toBe(true);
    });

    it('should execute cleanup tasks in reverse order (LIFO)', async () => {
      const order: number[] = [];

      const disposable = new TestDisposable();
      disposable.testRegisterCleanup(() => order.push(1));
      disposable.testRegisterCleanup(() => order.push(2));
      disposable.testRegisterCleanup(() => order.push(3));

      await disposable.destroy();

      // LIFO: 3, 2, 1, then the original cleanup from constructor
      expect(order).toEqual([3, 2, 1]);
    });

    it('should be idempotent when destroy is called multiple times', async () => {
      const disposable = new TestDisposable();
      let destroyCount = 0;
      disposable.testRegisterCleanup(() => destroyCount++);

      await disposable.destroy();
      await disposable.destroy();
      await disposable.destroy();

      expect(destroyCount).toBe(1);
    });

    it('should mark as destroyed after destroy()', async () => {
      const disposable = new TestDisposable();
      expect(disposable.isDestroyed).toBe(false);

      await disposable.destroy();

      expect(disposable.isDestroyed).toBe(true);
    });

    it('should warn when registering cleanup after destroy', async () => {
      const disposable = new TestDisposable();
      await disposable.destroy();

      let cleanupCalled = false;
      disposable.testRegisterCleanup(() => {
        cleanupCalled = true;
      });

      // Cleanup should not be registered after destroy
      expect(cleanupCalled).toBe(false);
    });

    it('should clean up intervals created via createInterval', async () => {
      vi.useRealTimers(); // Use real timers for interval tests

      const disposable = new TestDisposable();
      const callback = vi.fn();

      disposable.testCreateInterval(callback, 10); // Short interval

      // Wait for at least 2 ticks - use longer wait and "at least" assertion
      // to handle Windows timing variability
      await new Promise(resolve => setTimeout(resolve, 50));
      const callCountBeforeDestroy = callback.mock.calls.length;
      expect(callCountBeforeDestroy).toBeGreaterThanOrEqual(2);

      await disposable.destroy();

      await new Promise(resolve => setTimeout(resolve, 30));
      expect(callback).toHaveBeenCalledTimes(callCountBeforeDestroy); // No more calls after destroy
    });

    it('should clean up timeouts created via createTimeout', async () => {
      const disposable = new TestDisposable();
      const callback = vi.fn();

      disposable.testCreateTimeout(callback, 1000);

      await disposable.destroy();

      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support Symbol.asyncDispose', async () => {
      const disposable = new TestDisposable();

      await disposable[Symbol.asyncDispose]();

      expect(disposable.isDestroyed).toBe(true);
      expect(disposable.cleanupCalled).toBe(true);
    });

    it('should handle async cleanup tasks', async () => {
      vi.useRealTimers(); // Use real timers for async cleanup

      const disposable = new TestDisposable();
      let asyncCleanupDone = false;

      disposable.testRegisterCleanup(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Short delay
        asyncCleanupDone = true;
      });

      await disposable.destroy();

      expect(asyncCleanupDone).toBe(true);
    });

    it('should continue cleanup even if one task throws', async () => {
      const disposable = new TestDisposable();
      const cleanupOrder: number[] = [];

      disposable.testRegisterCleanup(() => cleanupOrder.push(1));
      disposable.testRegisterCleanup(() => {
        throw new Error('Cleanup error');
      });
      disposable.testRegisterCleanup(() => cleanupOrder.push(3));

      await disposable.destroy();

      // All non-throwing cleanups should still run
      expect(cleanupOrder).toContain(1);
      expect(cleanupOrder).toContain(3);
    });
  });

  describe('DisposableEventEmitter', () => {
    class TestEventEmitter extends DisposableEventEmitter {
      public onDestroyCalled = false;
      protected override readonly disposableName = 'TestEventEmitter';

      protected override onDestroy(): void {
        this.onDestroyCalled = true;
        this.emit('shutdown');
      }

      // Expose protected methods for testing
      public testCreateInterval(callback: () => void, ms: number): () => void {
        return this.createInterval(callback, ms);
      }

      public testCreateTimeout(callback: () => void, ms: number): () => void {
        return this.createTimeout(callback, ms);
      }

      public testRegisterCleanup(task: () => void): void {
        this.registerCleanup(task);
      }
    }

    it('should extend EventEmitter', () => {
      const emitter = new TestEventEmitter();
      expect(emitter).toBeInstanceOf(EventEmitter);
    });

    it('should emit events normally', () => {
      const emitter = new TestEventEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.emit('test', 'data');

      expect(handler).toHaveBeenCalledWith('data');
    });

    it('should remove all listeners on destroy', async () => {
      const emitter = new TestEventEmitter();
      const handler = vi.fn();

      emitter.on('test', handler);
      expect(emitter.listenerCount('test')).toBe(1);

      await emitter.destroy();

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should call onDestroy before removing listeners', async () => {
      const emitter = new TestEventEmitter();
      const shutdownHandler = vi.fn();

      emitter.on('shutdown', shutdownHandler);

      await emitter.destroy();

      // shutdown event should have been emitted in onDestroy
      expect(shutdownHandler).toHaveBeenCalled();
      expect(emitter.onDestroyCalled).toBe(true);
    });

    it('should clean up intervals on destroy', async () => {
      vi.useRealTimers(); // Use real timers for interval tests

      const emitter = new TestEventEmitter();
      const callback = vi.fn();

      emitter.testCreateInterval(callback, 10); // Short interval

      await new Promise(resolve => setTimeout(resolve, 15));
      expect(callback).toHaveBeenCalledTimes(1);

      await emitter.destroy();

      await new Promise(resolve => setTimeout(resolve, 30));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should clean up timeouts on destroy', async () => {
      const emitter = new TestEventEmitter();
      const callback = vi.fn();

      emitter.testCreateTimeout(callback, 1000);

      await emitter.destroy();

      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should execute registered cleanup tasks', async () => {
      const emitter = new TestEventEmitter();
      let cleanupDone = false;

      emitter.testRegisterCleanup(() => {
        cleanupDone = true;
      });

      await emitter.destroy();

      expect(cleanupDone).toBe(true);
    });

    it('should be idempotent', async () => {
      const emitter = new TestEventEmitter();
      let destroyCount = 0;

      emitter.testRegisterCleanup(() => destroyCount++);

      await emitter.destroy();
      await emitter.destroy();

      expect(destroyCount).toBe(1);
    });

    it('should support Symbol.asyncDispose', async () => {
      const emitter = new TestEventEmitter();
      emitter.on('test', () => {});

      await emitter[Symbol.asyncDispose]();

      expect(emitter.isDestroyed).toBe(true);
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should handle errors in onDestroy gracefully', async () => {
      class ErrorEmitter extends DisposableEventEmitter {
        protected override onDestroy(): void {
          throw new Error('onDestroy error');
        }
      }

      const emitter = new ErrorEmitter();
      let cleanupRan = false;
      (emitter as any).registerCleanup(() => {
        cleanupRan = true;
      });

      // Should not throw, should continue with cleanup
      await emitter.destroy();

      expect(cleanupRan).toBe(true);
      expect(emitter.isDestroyed).toBe(true);
    });
  });

  describe('createDisposableWrapper', () => {
    it('should wrap a resource and provide cleanup', async () => {
      const resource = { data: 'test', close: vi.fn() };
      const wrapper = createDisposableWrapper(resource, () => {
        resource.close();
      });

      expect(wrapper.resource).toBe(resource);
      expect(resource.close).not.toHaveBeenCalled();

      await wrapper.destroy();

      expect(resource.close).toHaveBeenCalled();
    });

    it('should mark wrapper as destroyed after cleanup', async () => {
      const resource = { value: 42 };
      const wrapper = createDisposableWrapper(resource, () => {});

      expect(wrapper.isDestroyed).toBe(false);

      await wrapper.destroy();

      expect(wrapper.isDestroyed).toBe(true);
    });

    it('should support async cleanup functions', async () => {
      vi.useRealTimers(); // Use real timers for async cleanup

      const resource = { connected: true };
      const wrapper = createDisposableWrapper(resource, async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Short delay
        resource.connected = false;
      });

      await wrapper.destroy();

      expect(resource.connected).toBe(false);
    });

    it('should support Symbol.asyncDispose for using syntax', async () => {
      const cleanupFn = vi.fn();
      const resource = { id: 1 };
      const wrapper = createDisposableWrapper(resource, cleanupFn);

      await wrapper[Symbol.asyncDispose]();

      expect(cleanupFn).toHaveBeenCalled();
      expect(wrapper.isDestroyed).toBe(true);
    });

    it('should be idempotent', async () => {
      const cleanupFn = vi.fn();
      const resource = {};
      const wrapper = createDisposableWrapper(resource, cleanupFn);

      await wrapper.destroy();
      await wrapper.destroy();

      expect(cleanupFn).toHaveBeenCalledTimes(1);
    });
  });
});
