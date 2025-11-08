/**
 * TelemetryQueue.ts
 *
 * SQLite-backed queue for telemetry events awaiting remote submission
 * Handles retry logic, FIFO ordering, and offline resilience
 */

import Database from 'better-sqlite3';
import { RetryManager } from './RetryManager.js';

/**
 * Queued event record
 */
export interface QueuedEvent {
  id: number;
  eventId: number;
  queuedAt: number;
  retryCount: number;
  nextRetryAt: number | null;
  lastError: string | null;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number; // Events ready to submit (nextRetryAt is null or in past)
  retrying: number; // Events waiting for retry (nextRetryAt in future)
  total: number; // Total events in queue
  oldestQueuedAt: number | null; // Timestamp of oldest queued event
}

/**
 * Manages queue of telemetry events for remote submission
 *
 * Features:
 * - SQLite-backed persistent queue
 * - FIFO ordering by queued_at
 * - Automatic retry scheduling with exponential backoff
 * - Batch operations for efficiency
 * - Cleanup of old/failed events
 */
export class TelemetryQueue {
  private db: Database.Database;
  private retryManager: RetryManager;

  /**
   * Create a new telemetry queue
   *
   * @param db - SQLite database instance
   */
  constructor(db: Database.Database) {
    this.db = db;
    this.retryManager = new RetryManager();
  }

  /**
   * Add events to the queue for submission
   *
   * @param eventIds - Array of telemetry event IDs to queue
   */
  enqueue(eventIds: number[]): void {
    if (!eventIds || eventIds.length === 0) {
      return;
    }

    const now = Date.now();

    // Use transaction for batch insert
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO telemetry_queue (event_id, queued_at, retry_count, next_retry_at)
        VALUES (?, ?, 0, NULL)
      `);

      for (const eventId of eventIds) {
        stmt.run(eventId, now);
      }
    });

    transaction();
  }

  /**
   * Get next batch of events ready for submission
   *
   * Returns events that:
   * - Have never been tried (next_retry_at is NULL)
   * - OR are ready for retry (next_retry_at <= now)
   *
   * Ordered by queued_at (FIFO)
   *
   * @param batchSize - Maximum number of events to return
   * @returns Array of queued events with full event data
   */
  dequeue(batchSize: number = 10): QueuedEvent[] {
    const now = Date.now();

    const stmt = this.db.prepare(`
      SELECT
        id,
        event_id as eventId,
        queued_at as queuedAt,
        retry_count as retryCount,
        next_retry_at as nextRetryAt,
        last_error as lastError
      FROM telemetry_queue
      WHERE next_retry_at IS NULL OR next_retry_at <= ?
      ORDER BY queued_at ASC
      LIMIT ?
    `);

    return stmt.all(now, batchSize) as QueuedEvent[];
  }

  /**
   * Mark events as successfully submitted and remove from queue
   *
   * @param queueIds - Array of queue entry IDs (NOT event IDs)
   */
  markSubmitted(queueIds: number[]): void {
    if (!queueIds || queueIds.length === 0) {
      return;
    }

    const placeholders = queueIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      DELETE FROM telemetry_queue
      WHERE id IN (${placeholders})
    `);

    stmt.run(...queueIds);
  }

  /**
   * Mark events as failed and schedule retry
   *
   * If retry count exceeds max retries, removes from queue permanently
   *
   * @param queueIds - Array of queue entry IDs (NOT event IDs)
   * @param error - Error message from failed submission attempt
   */
  markFailed(queueIds: number[], error: string): void {
    if (!queueIds || queueIds.length === 0) {
      return;
    }

    const transaction = this.db.transaction(() => {
      for (const queueId of queueIds) {
        // Get current retry count
        const row = this.db
          .prepare('SELECT retry_count FROM telemetry_queue WHERE id = ?')
          .get(queueId) as { retry_count: number } | undefined;

        if (!row) {
          continue; // Queue entry doesn't exist
        }

        const newRetryCount = row.retry_count + 1;

        // Check if should retry
        if (this.retryManager.shouldRetry(newRetryCount)) {
          // Schedule retry
          const nextRetryAt = this.retryManager.getNextRetryTimestamp(newRetryCount);

          this.db
            .prepare(`
              UPDATE telemetry_queue
              SET retry_count = ?,
                  next_retry_at = ?,
                  last_error = ?
              WHERE id = ?
            `)
            .run(newRetryCount, nextRetryAt, error, queueId);
        } else {
          // Max retries exceeded - remove from queue
          this.db.prepare('DELETE FROM telemetry_queue WHERE id = ?').run(queueId);
        }
      }
    });

    transaction();
  }

  /**
   * Get queue statistics
   *
   * @returns Queue stats (pending, retrying, total, oldest)
   */
  getStats(): QueueStats {
    const now = Date.now();

    // Count pending events (ready to submit)
    const pendingRow = this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM telemetry_queue
        WHERE next_retry_at IS NULL OR next_retry_at <= ?
      `)
      .get(now) as { count: number };

    // Count retrying events (waiting for retry)
    const retryingRow = this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM telemetry_queue
        WHERE next_retry_at > ?
      `)
      .get(now) as { count: number };

    // Get oldest queued timestamp
    const oldestRow = this.db
      .prepare(`
        SELECT MIN(queued_at) as oldest
        FROM telemetry_queue
      `)
      .get() as { oldest: number | null };

    return {
      pending: pendingRow.count,
      retrying: retryingRow.count,
      total: pendingRow.count + retryingRow.count,
      oldestQueuedAt: oldestRow.oldest,
    };
  }

  /**
   * Clean up old queue entries
   *
   * Removes events that have been in queue longer than the specified age
   * Useful for preventing unbounded queue growth
   *
   * @param olderThan - Remove events queued before this timestamp
   * @returns Number of events removed
   */
  cleanup(olderThan: number): number {
    const result = this.db
      .prepare(`
        DELETE FROM telemetry_queue
        WHERE queued_at < ?
      `)
      .run(olderThan);

    return result.changes;
  }

  /**
   * Get all queued events (for debugging/testing)
   *
   * @returns Array of all queued events
   */
  getAll(): QueuedEvent[] {
    const stmt = this.db.prepare(`
      SELECT
        id,
        event_id as eventId,
        queued_at as queuedAt,
        retry_count as retryCount,
        next_retry_at as nextRetryAt,
        last_error as lastError
      FROM telemetry_queue
      ORDER BY queued_at ASC
    `);

    return stmt.all() as QueuedEvent[];
  }

  /**
   * Clear all queue entries (for testing)
   *
   * @returns Number of events removed
   */
  clearAll(): number {
    const result = this.db.prepare('DELETE FROM telemetry_queue').run();
    return result.changes;
  }
}
