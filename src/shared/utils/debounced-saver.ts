/**
 * Debounced Saver Utility
 *
 * Provides a reusable pattern for debounced persistence operations.
 * Used by MemoryManager, SessionManager, and other components that need
 * to batch writes and reduce I/O operations.
 *
 * Features:
 * - Configurable debounce delay
 * - Flush on demand
 * - Error handling with retry
 * - Cleanup for proper resource management
 *
 * @module debounced-saver
 */

import { logger } from '../logging/logger.js';

/**
 * Options for DebouncedSaver
 */
export interface DebouncedSaverOptions {
  /** Debounce delay in milliseconds (default: 1000) */
  delayMs?: number;
  /** Maximum number of pending saves before forcing a flush (default: 100) */
  maxPending?: number;
  /** Name for logging purposes */
  name?: string;
  /** Whether to retry on failure (default: true) */
  retryOnFailure?: boolean;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Statistics for the debounced saver
 */
export interface DebouncedSaverStats {
  /** Total number of save requests */
  totalRequests: number;
  /** Number of actual save operations executed */
  actualSaves: number;
  /** Number of saves that were debounced (merged) */
  debouncedSaves: number;
  /** Number of failed save attempts */
  failures: number;
  /** Whether a save is currently pending */
  isPending: boolean;
}

/**
 * DebouncedSaver - Batches and debounces save operations
 *
 * @example
 * ```typescript
 * const saver = new DebouncedSaver({
 *   name: 'session-manager',
 *   delayMs: 1000,
 * });
 *
 * // Register the save function
 * saver.setSaveFunction(async () => {
 *   await fs.writeFile(path, JSON.stringify(data));
 * });
 *
 * // Mark as needing save (will be debounced)
 * saver.markDirty();
 *
 * // Force immediate save
 * await saver.flush();
 *
 * // Cleanup when done
 * saver.destroy();
 * ```
 */
export class DebouncedSaver {
  private readonly delayMs: number;
  private readonly maxPending: number;
  private readonly name: string;
  private readonly retryOnFailure: boolean;
  private readonly maxRetries: number;

  private saveFunction: (() => Promise<void>) | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private pendingCount: number = 0;
  private isSaving: boolean = false;
  private isDestroyed: boolean = false;

  // Statistics
  private stats: DebouncedSaverStats = {
    totalRequests: 0,
    actualSaves: 0,
    debouncedSaves: 0,
    failures: 0,
    isPending: false,
  };

  constructor(options: DebouncedSaverOptions = {}) {
    this.delayMs = options.delayMs ?? 1000;
    this.maxPending = options.maxPending ?? 100;
    this.name = options.name ?? 'debounced-saver';
    this.retryOnFailure = options.retryOnFailure ?? true;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /**
   * Set the save function to be called
   */
  setSaveFunction(fn: () => Promise<void>): void {
    this.saveFunction = fn;
  }

  /**
   * Mark data as dirty (needing save)
   * The save will be debounced according to delayMs
   */
  markDirty(): void {
    if (this.isDestroyed) {
      logger.warn(`[${this.name}] markDirty called after destroy`);
      return;
    }

    this.stats.totalRequests++;
    this.pendingCount++;
    this.stats.isPending = true;

    // Force flush if too many pending
    if (this.pendingCount >= this.maxPending) {
      logger.debug(`[${this.name}] Max pending reached, forcing flush`, {
        pendingCount: this.pendingCount,
      });
      void this.flush();
      return;
    }

    // Clear existing timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.stats.debouncedSaves++;
    }

    // Schedule new save
    this.timeoutHandle = setTimeout(() => {
      void this.executeSave();
    }, this.delayMs);

    // Unref to allow process to exit
    if (this.timeoutHandle.unref) {
      this.timeoutHandle.unref();
    }
  }

  /**
   * Flush any pending saves immediately
   * Returns a promise that resolves when the save is complete
   */
  async flush(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    // Clear any pending timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    // Execute save if there are pending changes
    if (this.pendingCount > 0) {
      await this.executeSave();
    }
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.pendingCount > 0;
  }

  /**
   * Get statistics
   */
  getStats(): DebouncedSaverStats {
    return { ...this.stats, isPending: this.pendingCount > 0 };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      actualSaves: 0,
      debouncedSaves: 0,
      failures: 0,
      isPending: this.pendingCount > 0,
    };
  }

  /**
   * Destroy the saver and cleanup resources
   */
  destroy(): void {
    this.isDestroyed = true;

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    this.saveFunction = null;
    this.pendingCount = 0;
    this.stats.isPending = false;
  }

  /**
   * Execute the save operation with retry logic
   */
  private async executeSave(): Promise<void> {
    if (!this.saveFunction || this.isSaving || this.isDestroyed) {
      return;
    }

    this.isSaving = true;
    const savedCount = this.pendingCount;
    this.pendingCount = 0;
    this.timeoutHandle = null;

    // BUG FIX: Capture saveFunction reference to prevent null dereference
    // if destroy() is called during the retry loop
    const saveFunction = this.saveFunction;

    let lastError: Error | null = null;
    const maxAttempts = this.retryOnFailure ? this.maxRetries : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // BUG FIX: Check if destroyed during retry loop
      if (this.isDestroyed) {
        logger.debug(`[${this.name}] Save aborted due to destroy`);
        this.isSaving = false;
        return;
      }

      try {
        await saveFunction();
        this.stats.actualSaves++;
        this.stats.isPending = false;

        logger.debug(`[${this.name}] Save completed`, {
          batchedChanges: savedCount,
          attempt,
        });

        this.isSaving = false;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          logger.warn(`[${this.name}] Save failed, retrying`, {
            attempt,
            maxAttempts,
            error: lastError.message,
          });

          // Exponential backoff
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await this.sleep(backoffMs);
        }
      }
    }

    // All retries failed
    this.stats.failures++;
    this.isSaving = false;

    logger.error(`[${this.name}] Save failed after ${maxAttempts} attempts`, {
      error: lastError?.message,
      lostChanges: savedCount,
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a debounced saver with a save function
 *
 * @example
 * ```typescript
 * const saver = createDebouncedSaver(
 *   async () => { await saveData(); },
 *   { name: 'my-saver', delayMs: 500 }
 * );
 *
 * saver.markDirty();
 * ```
 */
export function createDebouncedSaver(
  saveFunction: () => Promise<void>,
  options?: DebouncedSaverOptions
): DebouncedSaver {
  const saver = new DebouncedSaver(options);
  saver.setSaveFunction(saveFunction);
  return saver;
}
