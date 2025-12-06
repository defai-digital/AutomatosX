/**
 * Write Batcher for Task Engine
 *
 * Batches multiple database write operations into single transactions
 * for improved performance at scale.
 *
 * Features:
 * - 100ms batch window
 * - Max 50 operations per batch
 * - Single transaction for batch
 * - Promise-based completion tracking
 *
 * Part of Phase 3: Scaling
 *
 * @module core/task-engine/write-batcher
 * @version 1.0.0
 */

import type Database from 'better-sqlite3';
import { logger } from '../../shared/logging/logger.js';

/**
 * Write operation to be batched
 */
export interface WriteOperation<T = unknown> {
  /** Prepared statement to execute */
  stmt: Database.Statement;
  /** Parameters for the statement */
  params: Record<string, unknown>;
  /** Promise resolution callback */
  resolve: (result: T) => void;
  /** Promise rejection callback */
  reject: (error: Error) => void;
}

/**
 * Write batcher configuration
 */
export interface WriteBatcherConfig {
  /** Time window to collect operations (ms) */
  batchWindowMs?: number;
  /** Maximum operations per batch */
  maxBatchSize?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Write batcher statistics
 */
export interface WriteBatcherStats {
  /** Total operations batched */
  totalOperations: number;
  /** Total batches executed */
  totalBatches: number;
  /** Average operations per batch */
  avgBatchSize: number;
  /** Total time saved (estimated ms) */
  timeSavedMs: number;
  /** Batches currently pending */
  pendingOperations: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<WriteBatcherConfig> = {
  batchWindowMs: 100,
  maxBatchSize: 50,
  debug: false
};

/**
 * WriteBatcher - Batches database writes for performance
 *
 * @example
 * ```typescript
 * const batcher = new WriteBatcher(db);
 *
 * // Queue multiple writes
 * await Promise.all([
 *   batcher.enqueue(insertStmt, { id: '1', data: 'a' }),
 *   batcher.enqueue(insertStmt, { id: '2', data: 'b' }),
 *   batcher.enqueue(insertStmt, { id: '3', data: 'c' })
 * ]);
 * // All executed in single transaction
 *
 * // Cleanup
 * batcher.shutdown();
 * ```
 */
export class WriteBatcher {
  private readonly config: Required<WriteBatcherConfig>;
  private readonly db: Database.Database;
  private queue: WriteOperation[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private closed = false;

  // Statistics
  private stats = {
    totalOperations: 0,
    totalBatches: 0,
    timeSavedMs: 0
  };

  constructor(db: Database.Database, config: WriteBatcherConfig = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.debug('[WriteBatcher] Initialized', {
      batchWindowMs: this.config.batchWindowMs,
      maxBatchSize: this.config.maxBatchSize
    });
  }

  /**
   * Enqueue a write operation for batching
   */
  enqueue<T = Database.RunResult>(
    stmt: Database.Statement,
    params: Record<string, unknown>
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error('WriteBatcher is closed'));
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        stmt,
        params,
        resolve: resolve as (result: unknown) => void,
        reject
      });

      // Flush immediately if batch is full
      if (this.queue.length >= this.config.maxBatchSize) {
        this.flush();
      } else if (!this.flushTimer) {
        // Start batch window timer
        this.flushTimer = setTimeout(() => this.flush(), this.config.batchWindowMs);
      }
    });
  }

  /**
   * Force flush all pending operations
   */
  flush(): void {
    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Get batch to process
    const batch = this.queue.splice(0, this.config.maxBatchSize);
    if (batch.length === 0) return;

    const startTime = Date.now();

    try {
      // Execute all operations in single transaction
      const results: Database.RunResult[] = [];

      this.db.transaction(() => {
        for (const op of batch) {
          const result = op.stmt.run(op.params);
          results.push(result);
        }
      })();

      // Resolve all promises
      batch.forEach((op, i) => op.resolve(results[i]));

      // Update statistics
      this.stats.totalOperations += batch.length;
      this.stats.totalBatches++;
      // Estimate: ~5ms per individual write avoided
      this.stats.timeSavedMs += (batch.length - 1) * 5;

      if (this.config.debug) {
        logger.debug('[WriteBatcher] Batch executed', {
          operations: batch.length,
          durationMs: Date.now() - startTime
        });
      }
    } catch (error) {
      // Reject all promises on error
      const err = error instanceof Error ? error : new Error(String(error));
      batch.forEach(op => op.reject(err));

      logger.error('[WriteBatcher] Batch failed', {
        operations: batch.length,
        error: err.message
      });
    }

    // Process remaining queue if any
    if (this.queue.length > 0 && !this.flushTimer && !this.closed) {
      this.flushTimer = setTimeout(() => this.flush(), this.config.batchWindowMs);
    }
  }

  /**
   * Get batcher statistics
   */
  getStats(): WriteBatcherStats {
    return {
      totalOperations: this.stats.totalOperations,
      totalBatches: this.stats.totalBatches,
      avgBatchSize: this.stats.totalBatches > 0
        ? this.stats.totalOperations / this.stats.totalBatches
        : 0,
      timeSavedMs: this.stats.timeSavedMs,
      pendingOperations: this.queue.length
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalOperations: 0,
      totalBatches: 0,
      timeSavedMs: 0
    };
  }

  /**
   * Get number of pending operations
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Check if batcher is closed
   */
  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Shutdown the batcher
   * Flushes ALL pending operations before closing
   */
  async shutdown(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    // Clear any pending timer first
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush ALL remaining operations (loop until queue is empty)
    // Important: flush() only processes maxBatchSize items at a time,
    // so we need to loop to ensure all items are processed
    while (this.queue.length > 0) {
      this.flush();
    }

    logger.debug('[WriteBatcher] Shutdown complete', {
      stats: this.getStats()
    });
  }
}

/**
 * Create a write batcher instance
 */
export function createWriteBatcher(
  db: Database.Database,
  config?: WriteBatcherConfig
): WriteBatcher {
  return new WriteBatcher(db, config);
}
