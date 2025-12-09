/**
 * Disposable Base Classes
 *
 * Provides base classes that automatically manage resource cleanup:
 * - Timers (intervals, timeouts)
 * - Event listeners
 * - Custom cleanup tasks
 *
 * Classes extending these bases get automatic cleanup on destroy().
 *
 * @module shared/utils/disposable
 * @since v12.4.0
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger.js';
import { createSafeInterval, createSafeTimeout } from './safe-timers.js';

/**
 * Cleanup task type
 */
export type CleanupTask = () => void | Promise<void>;

/**
 * Abstract base class for disposable objects.
 *
 * Provides automatic resource cleanup for:
 * - Registered cleanup tasks
 * - Timers created via helper methods
 *
 * @example
 * ```typescript
 * class MyService extends Disposable {
 *   private data: Map<string, any> = new Map();
 *
 *   constructor() {
 *     super();
 *
 *     // Create a safe interval (auto-cleaned on destroy)
 *     this.createInterval(() => this.checkHealth(), 30000);
 *
 *     // Register custom cleanup
 *     this.registerCleanup(() => {
 *       this.data.clear();
 *     });
 *   }
 *
 *   protected onDestroy(): void {
 *     // Called before cleanup tasks run
 *     console.log('Service shutting down');
 *   }
 * }
 *
 * // Usage
 * const service = new MyService();
 * // ... use service ...
 * await service.destroy(); // All resources cleaned up
 * ```
 */
export abstract class Disposable {
  /** Registered cleanup tasks */
  protected readonly cleanupTasks: CleanupTask[] = [];

  /** Whether destroy() has been called */
  protected destroyed = false;

  /** Name for logging (optional, can be set by subclasses) */
  protected readonly disposableName?: string;

  /**
   * Register a cleanup task to be executed on destroy.
   *
   * Tasks are executed in reverse order (LIFO) to handle dependencies.
   *
   * @param task - Cleanup function to register
   */
  protected registerCleanup(task: CleanupTask): void {
    if (this.destroyed) {
      logger.warn('registerCleanup called after destroy', {
        name: this.disposableName
      });
      return;
    }

    this.cleanupTasks.push(task);
  }

  /**
   * Create a safe interval that is automatically cleaned up on destroy.
   *
   * @param callback - Function to call on each tick
   * @param intervalMs - Interval duration in milliseconds
   * @param name - Optional name for debugging
   * @returns Cleanup function to stop the interval early
   */
  protected createInterval(
    callback: () => void | Promise<void>,
    intervalMs: number,
    name?: string
  ): () => void {
    const cleanup = createSafeInterval(callback, intervalMs, {
      name: name || `${this.disposableName || 'Disposable'}-interval`
    });

    this.registerCleanup(cleanup);
    return cleanup;
  }

  /**
   * Create a safe timeout that is automatically cleaned up on destroy.
   *
   * @param callback - Function to call when timeout fires
   * @param delayMs - Delay duration in milliseconds
   * @param name - Optional name for debugging
   * @returns Cleanup function to cancel the timeout early
   */
  protected createTimeout(
    callback: () => void | Promise<void>,
    delayMs: number,
    name?: string
  ): () => void {
    const cleanup = createSafeTimeout(callback, delayMs, {
      name: name || `${this.disposableName || 'Disposable'}-timeout`
    });

    this.registerCleanup(cleanup);
    return cleanup;
  }

  /**
   * Hook called before cleanup tasks are executed.
   *
   * Override this method to perform custom cleanup logic.
   * Called once, before any cleanup tasks run.
   */
  protected onDestroy(): void | Promise<void> {
    // Default: no-op, override in subclasses
  }

  /**
   * Destroy the object and clean up all resources.
   *
   * 1. Calls onDestroy() hook
   * 2. Executes all cleanup tasks in reverse order
   * 3. Marks object as destroyed
   *
   * Safe to call multiple times (idempotent).
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      logger.debug('destroy() called on already-destroyed object', {
        name: this.disposableName
      });
      return;
    }

    this.destroyed = true;

    logger.debug('Destroying disposable', {
      name: this.disposableName,
      cleanupTaskCount: this.cleanupTasks.length
    });

    // Call onDestroy hook
    try {
      await this.onDestroy();
    } catch (error) {
      logger.error('Error in onDestroy hook', {
        name: this.disposableName,
        error: (error as Error).message
      });
    }

    // Execute cleanup tasks in reverse order (LIFO)
    const errors: Error[] = [];

    while (this.cleanupTasks.length > 0) {
      const task = this.cleanupTasks.pop()!;

      try {
        await task();
      } catch (error) {
        errors.push(error as Error);
        logger.error('Cleanup task error', {
          name: this.disposableName,
          error: (error as Error).message
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Destroy completed with errors', {
        name: this.disposableName,
        errorCount: errors.length
      });
    } else {
      logger.debug('Destroy completed successfully', {
        name: this.disposableName
      });
    }
  }

  /**
   * Check if this object has been destroyed.
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Symbol.asyncDispose implementation for using() syntax.
   *
   * Enables usage with ECMAScript explicit resource management:
   * ```typescript
   * await using service = new MyService();
   * // ... use service ...
   * // Automatically destroyed when scope exits
   * ```
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy();
  }
}

/**
 * Abstract base class for disposable EventEmitters.
 *
 * Extends Disposable with automatic event listener cleanup:
 * - All listeners removed on destroy()
 * - Safe interval/timeout creation
 * - Event listener tracking
 *
 * @example
 * ```typescript
 * class MyEventSource extends DisposableEventEmitter {
 *   constructor() {
 *     super();
 *
 *     // Create interval (auto-cleaned)
 *     this.createInterval(() => {
 *       this.emit('tick', Date.now());
 *     }, 1000);
 *   }
 *
 *   protected onDestroy(): void {
 *     this.emit('shutdown');
 *   }
 * }
 *
 * // Usage
 * const source = new MyEventSource();
 * source.on('tick', (time) => console.log('Tick:', time));
 * source.on('shutdown', () => console.log('Shutting down'));
 *
 * // Later
 * await source.destroy(); // Emits 'shutdown', removes all listeners
 * ```
 */
export abstract class DisposableEventEmitter extends EventEmitter {
  /** Registered cleanup tasks */
  protected readonly cleanupTasks: CleanupTask[] = [];

  /** Whether destroy() has been called */
  protected destroyed = false;

  /** Name for logging (optional, can be set by subclasses) */
  protected readonly disposableName?: string;

  /**
   * Register a cleanup task to be executed on destroy.
   *
   * Tasks are executed in reverse order (LIFO) to handle dependencies.
   *
   * @param task - Cleanup function to register
   */
  protected registerCleanup(task: CleanupTask): void {
    if (this.destroyed) {
      logger.warn('registerCleanup called after destroy', {
        name: this.disposableName
      });
      return;
    }

    this.cleanupTasks.push(task);
  }

  /**
   * Create a safe interval that is automatically cleaned up on destroy.
   *
   * @param callback - Function to call on each tick
   * @param intervalMs - Interval duration in milliseconds
   * @param name - Optional name for debugging
   * @returns Cleanup function to stop the interval early
   */
  protected createInterval(
    callback: () => void | Promise<void>,
    intervalMs: number,
    name?: string
  ): () => void {
    const cleanup = createSafeInterval(callback, intervalMs, {
      name: name || `${this.disposableName || 'DisposableEventEmitter'}-interval`
    });

    this.registerCleanup(cleanup);
    return cleanup;
  }

  /**
   * Create a safe timeout that is automatically cleaned up on destroy.
   *
   * @param callback - Function to call when timeout fires
   * @param delayMs - Delay duration in milliseconds
   * @param name - Optional name for debugging
   * @returns Cleanup function to cancel the timeout early
   */
  protected createTimeout(
    callback: () => void | Promise<void>,
    delayMs: number,
    name?: string
  ): () => void {
    const cleanup = createSafeTimeout(callback, delayMs, {
      name: name || `${this.disposableName || 'DisposableEventEmitter'}-timeout`
    });

    this.registerCleanup(cleanup);
    return cleanup;
  }

  /**
   * Hook called before cleanup tasks are executed.
   *
   * Override this method to perform custom cleanup logic.
   * Called once, before any cleanup tasks run.
   *
   * Note: Event listeners are still active when this is called,
   * so you can emit final events (e.g., 'shutdown', 'close').
   */
  protected onDestroy(): void | Promise<void> {
    // Default: no-op, override in subclasses
  }

  /**
   * Destroy the object and clean up all resources.
   *
   * 1. Calls onDestroy() hook (listeners still active)
   * 2. Executes all cleanup tasks in reverse order
   * 3. Removes all event listeners
   * 4. Marks object as destroyed
   *
   * Safe to call multiple times (idempotent).
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      logger.debug('destroy() called on already-destroyed object', {
        name: this.disposableName
      });
      return;
    }

    this.destroyed = true;

    const listenerCount = this.listenerCount('error') +
      this.eventNames().reduce((sum, name) => sum + this.listenerCount(name), 0);

    logger.debug('Destroying disposable event emitter', {
      name: this.disposableName,
      cleanupTaskCount: this.cleanupTasks.length,
      listenerCount
    });

    // Call onDestroy hook (listeners still active for final events)
    try {
      await this.onDestroy();
    } catch (error) {
      logger.error('Error in onDestroy hook', {
        name: this.disposableName,
        error: (error as Error).message
      });
    }

    // Execute cleanup tasks in reverse order (LIFO)
    const errors: Error[] = [];

    while (this.cleanupTasks.length > 0) {
      const task = this.cleanupTasks.pop()!;

      try {
        await task();
      } catch (error) {
        errors.push(error as Error);
        logger.error('Cleanup task error', {
          name: this.disposableName,
          error: (error as Error).message
        });
      }
    }

    // Remove all event listeners
    this.removeAllListeners();

    if (errors.length > 0) {
      logger.warn('Destroy completed with errors', {
        name: this.disposableName,
        errorCount: errors.length
      });
    } else {
      logger.debug('Destroy completed successfully', {
        name: this.disposableName
      });
    }
  }

  /**
   * Check if this object has been destroyed.
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Symbol.asyncDispose implementation for using() syntax.
   *
   * Enables usage with ECMAScript explicit resource management:
   * ```typescript
   * await using source = new MyEventSource();
   * // ... use source ...
   * // Automatically destroyed when scope exits
   * ```
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy();
  }
}

/**
 * Utility to create a disposable wrapper around any object.
 *
 * Useful for wrapping third-party objects that need cleanup.
 *
 * @param resource - The resource to wrap
 * @param cleanup - Cleanup function for the resource
 * @returns Disposable wrapper with the resource
 *
 * @example
 * ```typescript
 * const dbConnection = await connect();
 * const disposable = createDisposableWrapper(dbConnection, () => {
 *   dbConnection.close();
 * });
 *
 * // Use the resource
 * disposable.resource.query('SELECT 1');
 *
 * // Clean up
 * await disposable.destroy();
 * ```
 */
export function createDisposableWrapper<T>(
  resource: T,
  cleanup: () => void | Promise<void>
): Disposable & { resource: T } {
  class ResourceWrapper extends Disposable {
    public readonly resource: T = resource;

    constructor() {
      super();
      this.registerCleanup(cleanup);
    }

    protected override onDestroy(): void {
      // No additional cleanup needed
    }
  }

  return new ResourceWrapper();
}
