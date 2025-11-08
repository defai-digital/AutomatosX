/**
 * TelemetryQueue.test.ts
 *
 * Tests for telemetry submission queue
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { unlinkSync } from 'fs';
import { TelemetryQueue } from '../TelemetryQueue.js';
import { runMigrations } from '../../database/migrations.js';
describe('TelemetryQueue', () => {
    let db;
    let queue;
    let testDbPath;
    let testEventIds;
    beforeEach(() => {
        // Create unique test database
        testDbPath = `./test-telemetry-queue-${Date.now()}-${Math.random()}.db`;
        db = new Database(testDbPath);
        // Run migrations to create tables
        runMigrations(db);
        // Create queue instance
        queue = new TelemetryQueue(db);
        // Insert sample telemetry events for testing
        testEventIds = [];
        const now = Date.now();
        for (let i = 0; i < 5; i++) {
            const result = db
                .prepare(`INSERT INTO telemetry_events (session_id, event_type, event_data, timestamp)
           VALUES (?, ?, ?, ?)`)
                .run(`session-${i}`, 'command_executed', '{"command":"test"}', now + i);
            testEventIds.push(result.lastInsertRowid);
        }
    });
    afterEach(() => {
        db.close();
        try {
            unlinkSync(testDbPath);
        }
        catch (e) {
            // Ignore cleanup errors
        }
    });
    describe('enqueue', () => {
        it('should add events to queue', () => {
            queue.enqueue([testEventIds[0], testEventIds[1]]);
            const all = queue.getAll();
            expect(all).toHaveLength(2);
            expect(all[0].eventId).toBe(testEventIds[0]);
            expect(all[1].eventId).toBe(testEventIds[1]);
        });
        it('should set retry_count to 0 for new events', () => {
            queue.enqueue([testEventIds[0]]);
            const all = queue.getAll();
            expect(all[0].retryCount).toBe(0);
        });
        it('should set next_retry_at to NULL for new events', () => {
            queue.enqueue([testEventIds[0]]);
            const all = queue.getAll();
            expect(all[0].nextRetryAt).toBeNull();
        });
        it('should set queued_at timestamp', () => {
            const before = Date.now();
            queue.enqueue([testEventIds[0]]);
            const after = Date.now();
            const all = queue.getAll();
            expect(all[0].queuedAt).toBeGreaterThanOrEqual(before);
            expect(all[0].queuedAt).toBeLessThanOrEqual(after);
        });
        it('should handle empty array', () => {
            queue.enqueue([]);
            expect(queue.getAll()).toHaveLength(0);
        });
        it('should handle multiple events in batch', () => {
            queue.enqueue(testEventIds);
            const all = queue.getAll();
            expect(all).toHaveLength(5);
        });
        it('should preserve FIFO order by queued_at', () => {
            // Enqueue in specific order
            queue.enqueue([testEventIds[2]]);
            queue.enqueue([testEventIds[0]]);
            queue.enqueue([testEventIds[1]]);
            const all = queue.getAll();
            // Should be ordered by queued_at (insertion order)
            expect(all[0].eventId).toBe(testEventIds[2]); // First
            expect(all[1].eventId).toBe(testEventIds[0]); // Second
            expect(all[2].eventId).toBe(testEventIds[1]); // Third
        });
    });
    describe('dequeue', () => {
        beforeEach(() => {
            // Queue all test events
            queue.enqueue(testEventIds);
        });
        it('should return events ready for submission', () => {
            const batch = queue.dequeue(10);
            expect(batch).toHaveLength(5); // All 5 events ready
            expect(batch[0].nextRetryAt).toBeNull();
        });
        it('should respect batch size limit', () => {
            const batch = queue.dequeue(2);
            expect(batch).toHaveLength(2);
        });
        it('should return events in FIFO order', () => {
            const batch = queue.dequeue(10);
            // Should match insertion order
            expect(batch[0].eventId).toBe(testEventIds[0]);
            expect(batch[1].eventId).toBe(testEventIds[1]);
            expect(batch[2].eventId).toBe(testEventIds[2]);
        });
        it('should not return events scheduled for future retry', () => {
            // Mark first event as failed (schedules future retry)
            const batch1 = queue.dequeue(1);
            const futureTime = Date.now() + 10000; // 10 seconds in future
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ? WHERE id = ?').run(futureTime, batch1[0].id);
            // Dequeue again - should skip the event with future retry
            const batch2 = queue.dequeue(10);
            expect(batch2).toHaveLength(4); // One event excluded
            expect(batch2.find((e) => e.id === batch1[0].id)).toBeUndefined();
        });
        it('should return events with past retry time', () => {
            const batch1 = queue.dequeue(1);
            const pastTime = Date.now() - 1000; // 1 second in past
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ? WHERE id = ?').run(pastTime, batch1[0].id);
            const batch2 = queue.dequeue(10);
            // Should include the event with past retry time
            expect(batch2.find((e) => e.id === batch1[0].id)).toBeDefined();
        });
        it('should return empty array when queue is empty', () => {
            queue.clearAll();
            const batch = queue.dequeue(10);
            expect(batch).toHaveLength(0);
        });
        it('should return empty array when all events scheduled for future', () => {
            const futureTime = Date.now() + 10000;
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ?').run(futureTime);
            const batch = queue.dequeue(10);
            expect(batch).toHaveLength(0);
        });
        it('should include retry count and last error in response', () => {
            const batch1 = queue.dequeue(1);
            queue.markFailed([batch1[0].id], 'Network error');
            // Wait a bit to ensure retry time has passed (or set it to past)
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ?').run(Date.now() - 1000);
            const batch2 = queue.dequeue(10);
            const retriedEvent = batch2.find((e) => e.eventId === batch1[0].eventId);
            expect(retriedEvent).toBeDefined();
            expect(retriedEvent.retryCount).toBe(1);
            expect(retriedEvent.lastError).toBe('Network error');
        });
    });
    describe('markSubmitted', () => {
        beforeEach(() => {
            queue.enqueue(testEventIds);
        });
        it('should remove events from queue', () => {
            const batch = queue.dequeue(2);
            const queueIds = batch.map((e) => e.id);
            queue.markSubmitted(queueIds);
            const remaining = queue.getAll();
            expect(remaining).toHaveLength(3); // 5 - 2 = 3
        });
        it('should remove correct events', () => {
            const batch = queue.dequeue(2);
            const removedEventIds = batch.map((e) => e.eventId);
            queue.markSubmitted(batch.map((e) => e.id));
            const remaining = queue.getAll();
            remaining.forEach((event) => {
                expect(removedEventIds).not.toContain(event.eventId);
            });
        });
        it('should handle empty array', () => {
            queue.markSubmitted([]);
            expect(queue.getAll()).toHaveLength(5); // No change
        });
        it('should handle non-existent queue IDs gracefully', () => {
            expect(() => queue.markSubmitted([99999])).not.toThrow();
        });
    });
    describe('markFailed', () => {
        beforeEach(() => {
            queue.enqueue(testEventIds);
        });
        it('should increment retry count', () => {
            const batch = queue.dequeue(1);
            queue.markFailed([batch[0].id], 'Test error');
            const all = queue.getAll();
            const failedEvent = all.find((e) => e.id === batch[0].id);
            expect(failedEvent.retryCount).toBe(1);
        });
        it('should set last error message', () => {
            const batch = queue.dequeue(1);
            queue.markFailed([batch[0].id], 'Network timeout');
            const all = queue.getAll();
            const failedEvent = all.find((e) => e.id === batch[0].id);
            expect(failedEvent.lastError).toBe('Network timeout');
        });
        it('should schedule retry in future', () => {
            const now = Date.now();
            const batch = queue.dequeue(1);
            queue.markFailed([batch[0].id], 'Test error');
            const all = queue.getAll();
            const failedEvent = all.find((e) => e.id === batch[0].id);
            expect(failedEvent.nextRetryAt).not.toBeNull();
            expect(failedEvent.nextRetryAt).toBeGreaterThan(now);
        });
        it('should remove event after max retries exceeded', () => {
            const batch = queue.dequeue(1);
            // Fail 5 times (max retries is 5)
            for (let i = 0; i < 6; i++) {
                const current = queue.getAll().find((e) => e.id === batch[0].id);
                if (!current)
                    break; // Already removed
                queue.markFailed([batch[0].id], `Error ${i}`);
            }
            const remaining = queue.getAll();
            expect(remaining.find((e) => e.id === batch[0].id)).toBeUndefined();
        });
        it('should handle multiple failures in batch', () => {
            const batch = queue.dequeue(3);
            const queueIds = batch.map((e) => e.id);
            queue.markFailed(queueIds, 'Batch error');
            const all = queue.getAll();
            const failedEvents = all.filter((e) => queueIds.includes(e.id));
            expect(failedEvents).toHaveLength(3);
            failedEvents.forEach((event) => {
                expect(event.retryCount).toBe(1);
                expect(event.lastError).toBe('Batch error');
            });
        });
        it('should handle empty array', () => {
            queue.markFailed([], 'Test error');
            expect(queue.getAll()).toHaveLength(5); // No change
        });
        it('should handle non-existent queue IDs gracefully', () => {
            expect(() => queue.markFailed([99999], 'Test error')).not.toThrow();
        });
    });
    describe('getStats', () => {
        it('should return zero stats for empty queue', () => {
            const stats = queue.getStats();
            expect(stats.pending).toBe(0);
            expect(stats.retrying).toBe(0);
            expect(stats.total).toBe(0);
            expect(stats.oldestQueuedAt).toBeNull();
        });
        it('should count pending events correctly', () => {
            queue.enqueue(testEventIds);
            const stats = queue.getStats();
            expect(stats.pending).toBe(5);
            expect(stats.retrying).toBe(0);
            expect(stats.total).toBe(5);
        });
        it('should count retrying events correctly', () => {
            queue.enqueue(testEventIds);
            // Mark 2 events for future retry
            const futureTime = Date.now() + 10000;
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ? LIMIT 2').run(futureTime);
            const stats = queue.getStats();
            expect(stats.pending).toBe(3); // 5 - 2
            expect(stats.retrying).toBe(2);
            expect(stats.total).toBe(5);
        });
        it('should return oldest queued timestamp', () => {
            const time1 = Date.now();
            queue.enqueue([testEventIds[0]]);
            // Wait a bit
            const time2 = Date.now() + 100;
            db.prepare('INSERT INTO telemetry_queue (event_id, queued_at, retry_count) VALUES (?, ?, 0)').run(testEventIds[1], time2);
            const stats = queue.getStats();
            expect(stats.oldestQueuedAt).toBe(time1);
        });
        it('should treat past retry times as pending', () => {
            queue.enqueue(testEventIds);
            const pastTime = Date.now() - 1000;
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ? LIMIT 2').run(pastTime);
            const stats = queue.getStats();
            expect(stats.pending).toBe(5); // All ready (past + null)
            expect(stats.retrying).toBe(0);
        });
    });
    describe('cleanup', () => {
        it('should remove old events', () => {
            const oldTime = Date.now() - 86400000; // 24 hours ago
            const recentTime = Date.now();
            // Insert old events
            db.prepare('INSERT INTO telemetry_queue (event_id, queued_at, retry_count) VALUES (?, ?, 0)').run(testEventIds[0], oldTime);
            // Insert recent events
            db.prepare('INSERT INTO telemetry_queue (event_id, queued_at, retry_count) VALUES (?, ?, 0)').run(testEventIds[1], recentTime);
            const cutoff = Date.now() - 3600000; // 1 hour ago
            const removed = queue.cleanup(cutoff);
            expect(removed).toBe(1); // Only old event removed
            expect(queue.getAll()).toHaveLength(1);
        });
        it('should return count of removed events', () => {
            const oldTime = Date.now() - 86400000;
            queue.enqueue([testEventIds[0], testEventIds[1]]);
            db.prepare('UPDATE telemetry_queue SET queued_at = ?').run(oldTime);
            const cutoff = Date.now() - 3600000;
            const removed = queue.cleanup(cutoff);
            expect(removed).toBe(2);
        });
        it('should not remove recent events', () => {
            queue.enqueue(testEventIds);
            const cutoff = Date.now() - 3600000; // 1 hour ago
            const removed = queue.cleanup(cutoff);
            expect(removed).toBe(0);
            expect(queue.getAll()).toHaveLength(5);
        });
        it('should handle empty queue', () => {
            const removed = queue.cleanup(Date.now());
            expect(removed).toBe(0);
        });
    });
    describe('getAll', () => {
        it('should return all queued events', () => {
            queue.enqueue(testEventIds);
            const all = queue.getAll();
            expect(all).toHaveLength(5);
        });
        it('should return empty array when queue is empty', () => {
            const all = queue.getAll();
            expect(all).toHaveLength(0);
        });
        it('should return events in FIFO order', () => {
            queue.enqueue([testEventIds[2], testEventIds[0], testEventIds[4]]);
            const all = queue.getAll();
            // Should be in order of insertion
            expect(all[0].eventId).toBe(testEventIds[2]);
            expect(all[1].eventId).toBe(testEventIds[0]);
            expect(all[2].eventId).toBe(testEventIds[4]);
        });
    });
    describe('clearAll', () => {
        it('should remove all events from queue', () => {
            queue.enqueue(testEventIds);
            expect(queue.getAll()).toHaveLength(5);
            const removed = queue.clearAll();
            expect(removed).toBe(5);
            expect(queue.getAll()).toHaveLength(0);
        });
        it('should return count of removed events', () => {
            queue.enqueue([testEventIds[0], testEventIds[1]]);
            const removed = queue.clearAll();
            expect(removed).toBe(2);
        });
        it('should handle empty queue', () => {
            const removed = queue.clearAll();
            expect(removed).toBe(0);
        });
    });
    describe('integration scenarios', () => {
        it('should handle complete submission workflow', () => {
            // Enqueue events
            queue.enqueue(testEventIds);
            expect(queue.getStats().pending).toBe(5);
            // Dequeue batch for submission
            const batch = queue.dequeue(3);
            expect(batch).toHaveLength(3);
            // Mark as submitted
            queue.markSubmitted(batch.map((e) => e.id));
            // Verify remaining
            expect(queue.getStats().pending).toBe(2);
            expect(queue.getStats().total).toBe(2);
        });
        it('should handle retry workflow', () => {
            queue.enqueue([testEventIds[0]]);
            // First attempt fails
            const batch1 = queue.dequeue(1);
            queue.markFailed([batch1[0].id], 'Network error');
            // Event should be retrying (future)
            let stats = queue.getStats();
            expect(stats.retrying).toBe(1);
            expect(stats.pending).toBe(0);
            // Make retry time in the past
            db.prepare('UPDATE telemetry_queue SET next_retry_at = ?').run(Date.now() - 1000);
            // Should now be pending
            stats = queue.getStats();
            expect(stats.pending).toBe(1);
            expect(stats.retrying).toBe(0);
            // Second attempt succeeds
            const batch2 = queue.dequeue(1);
            expect(batch2).toHaveLength(1);
            expect(batch2[0].retryCount).toBe(1);
            queue.markSubmitted([batch2[0].id]);
            // Queue should be empty
            expect(queue.getStats().total).toBe(0);
        });
        it('should handle max retries exceeded', () => {
            queue.enqueue([testEventIds[0]]);
            // Fail 6 times (max is 5)
            for (let i = 0; i < 6; i++) {
                const all = queue.getAll();
                if (all.length === 0)
                    break;
                queue.markFailed([all[0].id], `Error ${i}`);
            }
            // Event should be removed
            expect(queue.getStats().total).toBe(0);
        });
        it('should handle offline queue buildup and batch submission', () => {
            // Simulate offline queue buildup
            queue.enqueue(testEventIds);
            // Later, come online and process in batches
            let batch = queue.dequeue(2);
            expect(batch).toHaveLength(2);
            queue.markSubmitted(batch.map((e) => e.id));
            batch = queue.dequeue(2);
            expect(batch).toHaveLength(2);
            queue.markSubmitted(batch.map((e) => e.id));
            batch = queue.dequeue(2);
            expect(batch).toHaveLength(1); // Last one
            queue.markSubmitted(batch.map((e) => e.id));
            // All submitted
            expect(queue.getStats().total).toBe(0);
        });
    });
});
//# sourceMappingURL=TelemetryQueue.test.js.map