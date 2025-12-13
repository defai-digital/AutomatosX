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
 * Shared cleanup logic used by both Disposable and DisposableEventEmitter.
 * Uses composition to avoid code duplication.
 *
 * @internal
 */
class DisposableCore {
  readonly cleanupTasks: CleanupTask[] = [];
  destroyed = false;

  constructor(private readonly name?: string) {}

  registerCleanup(task: CleanupTask): void {
    if (this.destroyed) {
      logger.warn('registerCleanup called after destroy', { name: this.name });
      return;
    }
    this.cleanupTasks.push(task);
  }

  createInterval(
    callback: () => void | Promise<void>,
    intervalMs: number,
    name?: string
  ): () => void {
    const cleanup = createSafeInterval(callback, intervalMs, {
      name: name || `${this.name || 'Disposable'}-interval`
    });
    this.registerCleanup(cleanup);
    return cleanup;
  }

  createTimeout(
    callback: () => void | Promise<void>,
    delayMs: number,
    name?: string
  ): () => void {
    const cleanup = createSafeTimeout(callback, delayMs, {
      name: name || `${this.name || 'Disposable'}-timeout`
    });
    this.registerCleanup(cleanup);
    return cleanup;
  }

  async executeCleanup(
    onDestroy: () => void | Promise<void>,
    additionalCleanup?: () => void
  ): Promise<void> {
    if (this.destroyed) {
      logger.debug('destroy() called on already-destroyed object', { name: this.name });
      return;
    }

    this.destroyed = true;

    logger.debug('Destroying disposable', {
      name: this.name,
      cleanupTaskCount: this.cleanupTasks.length
    });

    // Call onDestroy hook
    try {
      await onDestroy();
    } catch (error) {
      logger.error('Error in onDestroy hook', {
        name: this.name,
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
          name: this.name,
          error: (error as Error).message
        });
      }
    }

    // Additional cleanup (e.g., remove event listeners)
    if (additionalCleanup) {
      additionalCleanup();
    }

    if (errors.length > 0) {
      logger.warn('Destroy completed with errors', {
        name: this.name,
        errorCount: errors.length
      });
    } else {
      logger.debug('Destroy completed successfully', { name: this.name });
    }
  }
}

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
  private readonly _core: DisposableCore;

  /** Name for logging (optional, can be set by subclasses) */
  protected readonly disposableName?: string;

  constructor() {
    this._core = new DisposableCore(this.disposableName);
  }

  /** Registered cleanup tasks (for subclass access) */
  protected get cleanupTasks(): CleanupTask[] {
    return this._core.cleanupTasks;
  }

  /** Whether destroy() has been called */
  protected get destroyed(): boolean {
    return this._core.destroyed;
  }

  /**
   * Register a cleanup task to be executed on destroy.
   * Tasks are executed in reverse order (LIFO) to handle dependencies.
   */
  protected registerCleanup(task: CleanupTask): void {
    this._core.registerCleanup(task);
  }

  /**
   * Create a safe interval that is automatically cleaned up on destroy.
   */
  protected createInterval(
    callback: () => void | Promise<void>,
    intervalMs: number,
    name?: string
  ): () => void {
    return this._core.createInterval(callback, intervalMs, name);
  }

  /**
   * Create a safe timeout that is automatically cleaned up on destroy.
   */
  protected createTimeout(
    callback: () => void | Promise<void>,
    delayMs: number,
    name?: string
  ): () => void {
    return this._core.createTimeout(callback, delayMs, name);
  }

  /**
   * Hook called before cleanup tasks are executed.
   * Override this method to perform custom cleanup logic.
   */
  protected onDestroy(): void | Promise<void> {
    // Default: no-op, override in subclasses
  }

  /**
   * Destroy the object and clean up all resources.
   * Safe to call multiple times (idempotent).
   */
  async destroy(): Promise<void> {
    await this._core.executeCleanup(() => this.onDestroy());
  }

  /** Check if this object has been destroyed. */
  get isDestroyed(): boolean {
    return this._core.destroyed;
  }

  /** Symbol.asyncDispose implementation for using() syntax. */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy();
  }
}

/**
 * Abstract base class for disposable EventEmitters.
 *
 * Extends EventEmitter with automatic resource cleanup:
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
  private readonly _core: DisposableCore;

  /** Name for logging (optional, can be set by subclasses) */
  protected readonly disposableName?: string;

  constructor() {
    super();
    this._core = new DisposableCore(this.disposableName);
  }

  /** Registered cleanup tasks (for subclass access) */
  protected get cleanupTasks(): CleanupTask[] {
    return this._core.cleanupTasks;
  }

  /** Whether destroy() has been called */
  protected get destroyed(): boolean {
    return this._core.destroyed;
  }

  /**
   * Register a cleanup task to be executed on destroy.
   * Tasks are executed in reverse order (LIFO) to handle dependencies.
   */
  protected registerCleanup(task: CleanupTask): void {
    this._core.registerCleanup(task);
  }

  /**
   * Create a safe interval that is automatically cleaned up on destroy.
   */
  protected createInterval(
    callback: () => void | Promise<void>,
    intervalMs: number,
    name?: string
  ): () => void {
    return this._core.createInterval(callback, intervalMs, name);
  }

  /**
   * Create a safe timeout that is automatically cleaned up on destroy.
   */
  protected createTimeout(
    callback: () => void | Promise<void>,
    delayMs: number,
    name?: string
  ): () => void {
    return this._core.createTimeout(callback, delayMs, name);
  }

  /**
   * Hook called before cleanup tasks are executed.
   * Note: Event listeners are still active when this is called,
   * so you can emit final events (e.g., 'shutdown', 'close').
   */
  protected onDestroy(): void | Promise<void> {
    // Default: no-op, override in subclasses
  }

  /**
   * Destroy the object and clean up all resources.
   * Safe to call multiple times (idempotent).
   */
  async destroy(): Promise<void> {
    await this._core.executeCleanup(
      () => this.onDestroy(),
      () => this.removeAllListeners()
    );
  }

  /** Check if this object has been destroyed. */
  get isDestroyed(): boolean {
    return this._core.destroyed;
  }

  /** Symbol.asyncDispose implementation for using() syntax. */
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
