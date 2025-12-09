/**
 * Graceful Shutdown Manager
 *
 * Handles process termination gracefully by:
 * - Stopping new requests
 * - Waiting for in-flight operations
 * - Closing database connections
 * - Saving state
 * - Cleaning up resources
 */

import { logger } from '../logging/logger.js';
import { TIMEOUTS } from '../../core/validation-limits.js';

export type ShutdownHandler = () => Promise<void> | void;

export interface ShutdownOptions {
  timeout: number;          // Maximum time to wait for graceful shutdown (ms)
  forceExitOnTimeout: boolean; // Force exit if timeout exceeded
}

const DEFAULT_SHUTDOWN_OPTIONS: ShutdownOptions = {
  timeout: TIMEOUTS.GRACEFUL_SHUTDOWN,
  forceExitOnTimeout: true
};

export class GracefulShutdownManager {
  private handlers: Array<{
    name: string;
    handler: ShutdownHandler;
    priority: number;
  }> = [];
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  /**
   * Register a shutdown handler
   * @param name - Handler name for logging
   * @param handler - Async function to execute on shutdown
   * @param priority - Lower numbers execute first (default: 100)
   */
  registerHandler(
    name: string,
    handler: ShutdownHandler,
    priority: number = 100
  ): void {
    this.handlers.push({ name, handler, priority });

    // Sort handlers by priority (ascending)
    this.handlers.sort((a, b) => a.priority - b.priority);

    logger.debug('Shutdown handler registered', {
      name,
      priority,
      totalHandlers: this.handlers.length
    });
  }

  /**
   * Unregister a shutdown handler
   */
  unregisterHandler(name: string): boolean {
    const initialLength = this.handlers.length;
    this.handlers = this.handlers.filter(h => h.name !== name);
    return this.handlers.length < initialLength;
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Execute graceful shutdown
   */
  async shutdown(
    signal: string,
    options: Partial<ShutdownOptions> = {}
  ): Promise<void> {
    // Prevent multiple simultaneous shutdowns
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, waiting...');
      return this.shutdownPromise || Promise.resolve();
    }

    this.isShuttingDown = true;
    const opts = { ...DEFAULT_SHUTDOWN_OPTIONS, ...options };

    this.shutdownPromise = this.executeShutdown(signal, opts);
    return this.shutdownPromise;
  }

  /**
   * Execute shutdown sequence
   */
  private async executeShutdown(
    signal: string,
    options: ShutdownOptions
  ): Promise<void> {
    logger.info('Graceful shutdown initiated', {
      signal,
      timeout: options.timeout,
      handlerCount: this.handlers.length
    });

    const startTime = Date.now();
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      // Create cancellable timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Shutdown timeout exceeded (${options.timeout}ms)`));
        }, options.timeout);
      });

      // Execute handlers with timeout
      await Promise.race([
        this.executeHandlers(),
        timeoutPromise
      ]);

      // Clear timeout if handlers completed successfully
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }

      const duration = Date.now() - startTime;
      logger.info('Graceful shutdown completed', {
        signal,
        duration,
        handlersExecuted: this.handlers.length
      });

      // Note: Caller is responsible for calling process.exit() if needed
      // This allows for final cleanup and logging at the application level
    } catch (error) {
      // Clear timeout on error
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }

      const duration = Date.now() - startTime;
      logger.error('Graceful shutdown failed', {
        signal,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      // Note: Removed process.exit() calls - caller should handle exit
      // This prevents bypassing final cleanup at application level
      throw error;
    } finally {
      // Note: Do not reset isShuttingDown to prevent race conditions
      // Shutdown should be a final, one-time operation
      this.shutdownPromise = null;
    }
  }

  /**
   * Execute all registered handlers in priority order
   */
  private async executeHandlers(): Promise<void> {
    for (const { name, handler } of this.handlers) {
      try {
        logger.info('Executing shutdown handler', { name });
        const startTime = Date.now();

        await handler();

        const duration = Date.now() - startTime;
        logger.info('Shutdown handler completed', { name, duration });
      } catch (error) {
        logger.error('Shutdown handler failed', {
          name,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other handlers even if one fails
      }
    }
  }
}

// Global shutdown manager instance
export const shutdownManager = new GracefulShutdownManager();

/**
 * Setup graceful shutdown for common signals
 * BUG FIX (v9.0.1): Added timeout protection to prevent hanging shutdowns
 */
export function setupGracefulShutdown(
  options: Partial<ShutdownOptions> = {}
): void {
  // BUG FIX: Wrapper to add timeout protection to shutdown calls
  const shutdownWithTimeout = async (signal: string) => {
    const shutdownTimeout = options.timeout ?? DEFAULT_SHUTDOWN_OPTIONS.timeout;
    const forceExit = options.forceExitOnTimeout ?? DEFAULT_SHUTDOWN_OPTIONS.forceExitOnTimeout;

    const shutdownPromise = shutdownManager.shutdown(signal, options);
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${shutdownTimeout}ms`));
      }, shutdownTimeout);
      // Unref to allow process to exit if shutdown completes
      if (timeoutId.unref) {
        timeoutId.unref();
      }
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      logger.info('Graceful shutdown completed successfully', { signal });
    } catch (error) {
      logger.error('Shutdown failed or timed out', {
        signal,
        error: error instanceof Error ? error.message : String(error)
      });

      if (forceExit) {
        logger.warn('Forcing process exit due to shutdown timeout/failure');
        process.exit(1);
      }
    } finally {
      // BUG FIX: Clear timeout to prevent resource leak
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  };

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await shutdownWithTimeout('SIGINT');
  });

  // Handle SIGTERM (e.g., from Docker, Kubernetes)
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await shutdownWithTimeout('SIGTERM');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    await shutdownWithTimeout('uncaughtException');
    // Force exit after uncaught exception
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason)
    });
    await shutdownWithTimeout('unhandledRejection');
    // Force exit after unhandled rejection
    process.exit(1);
  });

  logger.info('Graceful shutdown handlers registered', {
    signals: ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection'],
    timeout: options.timeout ?? DEFAULT_SHUTDOWN_OPTIONS.timeout,
    forceExitOnTimeout: options.forceExitOnTimeout ?? DEFAULT_SHUTDOWN_OPTIONS.forceExitOnTimeout
  });
}

/**
 * Wait for in-flight operations to complete
 */
export class InFlightTracker {
  private inFlightCount = 0;
  private readonly operations = new Set<string>();

  /**
   * Track start of operation
   */
  start(operationId: string): void {
    this.operations.add(operationId);
    this.inFlightCount++;
  }

  /**
   * Track completion of operation
   */
  complete(operationId: string): void {
    if (this.operations.has(operationId)) {
      this.operations.delete(operationId);
      this.inFlightCount--;
    }
  }

  /**
   * Get count of in-flight operations
   */
  getCount(): number {
    return this.inFlightCount;
  }

  /**
   * Wait for all in-flight operations to complete
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @param signal - Optional AbortSignal to cancel the wait
   */
  async waitForCompletion(timeoutMs: number = TIMEOUTS.GRACEFUL_SHUTDOWN, signal?: AbortSignal): Promise<void> {
    if (this.inFlightCount === 0) {
      return;
    }

    logger.info('Waiting for in-flight operations', {
      count: this.inFlightCount,
      operations: Array.from(this.operations)
    });

    const startTime = Date.now();
    let checkInterval: NodeJS.Timeout | null = null;
    let abortHandler: (() => void) | null = null;

    try {
      return await new Promise<void>((resolve, reject) => {
        // Set up abort handler if signal provided
        if (signal) {
          if (signal.aborted) {
            reject(new Error('Operation cancelled'));
            return;
          }
          abortHandler = () => {
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }
            reject(new Error('Operation cancelled'));
          };
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        checkInterval = setInterval(() => {
          if (this.inFlightCount === 0) {
            clearInterval(checkInterval!);
            checkInterval = null;
            const duration = Date.now() - startTime;
            logger.info('All in-flight operations completed', { duration });
            resolve();
          } else if (Date.now() - startTime >= timeoutMs) {
            clearInterval(checkInterval!);
            checkInterval = null;
            reject(new Error(
              `Timeout waiting for in-flight operations (${this.inFlightCount} remaining)`
            ));
          }
        }, 100); // Check every 100ms
        checkInterval.unref(); // Don't block process exit
      });
    } finally {
      // Cleanup: Ensure interval and abort handler are always removed
      if (checkInterval !== null) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }
}

// Global in-flight tracker
export const inFlightTracker = new InFlightTracker();
