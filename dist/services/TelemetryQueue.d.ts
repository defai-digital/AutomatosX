/**
 * TelemetryQueue.ts
 *
 * SQLite-backed queue for telemetry events awaiting remote submission
 * Handles retry logic, FIFO ordering, and offline resilience
 */
import Database from 'better-sqlite3';
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
    pending: number;
    retrying: number;
    total: number;
    oldestQueuedAt: number | null;
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
export declare class TelemetryQueue {
    private db;
    private retryManager;
    /**
     * Create a new telemetry queue
     *
     * @param db - SQLite database instance
     */
    constructor(db: Database.Database);
    /**
     * Add events to the queue for submission
     *
     * @param eventIds - Array of telemetry event IDs to queue
     */
    enqueue(eventIds: number[]): void;
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
    dequeue(batchSize?: number): QueuedEvent[];
    /**
     * Mark events as successfully submitted and remove from queue
     *
     * @param queueIds - Array of queue entry IDs (NOT event IDs)
     */
    markSubmitted(queueIds: number[]): void;
    /**
     * Mark events as failed and schedule retry
     *
     * If retry count exceeds max retries, removes from queue permanently
     *
     * @param queueIds - Array of queue entry IDs (NOT event IDs)
     * @param error - Error message from failed submission attempt
     */
    markFailed(queueIds: number[], error: string): void;
    /**
     * Get queue statistics
     *
     * @returns Queue stats (pending, retrying, total, oldest)
     */
    getStats(): QueueStats;
    /**
     * Clean up old queue entries
     *
     * Removes events that have been in queue longer than the specified age
     * Useful for preventing unbounded queue growth
     *
     * @param olderThan - Remove events queued before this timestamp
     * @returns Number of events removed
     */
    cleanup(olderThan: number): number;
    /**
     * Get all queued events (for debugging/testing)
     *
     * @returns Array of all queued events
     */
    getAll(): QueuedEvent[];
    /**
     * Clear all queue entries (for testing)
     *
     * @returns Number of events removed
     */
    clearAll(): number;
}
//# sourceMappingURL=TelemetryQueue.d.ts.map