/**
 * WorkflowQueue.ts
 *
 * Priority-based workflow execution queue
 * Phase 5 Week 2: Distributed Execution
 */
import { EventEmitter } from 'events';
import { getDatabase } from '../database/connection.js';
import { randomUUID } from 'crypto';
/**
 * WorkflowQueue - Priority-based workflow queue with persistence
 */
export class WorkflowQueue extends EventEmitter {
    db;
    processingTimeSum = 0;
    processedCount = 0;
    constructor(db) {
        super();
        this.db = db || getDatabase();
        this.initializeTable();
    }
    /**
     * Initialize queue table
     */
    initializeTable() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_queue (
        id TEXT PRIMARY KEY,
        workflow_definition TEXT NOT NULL,
        options TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        error TEXT,
        worker_id TEXT,
        result TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status_priority
        ON workflow_queue(status, priority DESC, created_at);
      CREATE INDEX IF NOT EXISTS idx_queue_worker
        ON workflow_queue(worker_id);
      CREATE INDEX IF NOT EXISTS idx_queue_created
        ON workflow_queue(created_at);
    `);
    }
    /**
     * Add workflow to queue
     */
    enqueue(workflowDefinition, options = {}, maxAttempts = 3) {
        const id = randomUUID();
        const priority = options.priority ?? 0;
        const stmt = this.db.prepare(`
      INSERT INTO workflow_queue
        (id, workflow_definition, options, priority, status, created_at, attempts, max_attempts)
      VALUES (?, ?, ?, ?, 'pending', ?, 0, ?)
    `);
        stmt.run(id, JSON.stringify(workflowDefinition), JSON.stringify(options), priority, Date.now(), maxAttempts);
        this.emit('enqueued', { id, workflowName: workflowDefinition.name, priority });
        return id;
    }
    /**
     * Dequeue next workflow (highest priority, oldest first)
     */
    dequeue(workerId) {
        // Start transaction to ensure atomic dequeue
        const transaction = this.db.transaction(() => {
            // Find highest priority pending item
            const stmt = this.db.prepare(`
        SELECT * FROM workflow_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `);
            const row = stmt.get();
            if (!row) {
                return null;
            }
            // Mark as processing
            const updateStmt = this.db.prepare(`
        UPDATE workflow_queue
        SET status = 'processing',
            started_at = ?,
            worker_id = ?,
            attempts = attempts + 1
        WHERE id = ?
      `);
            updateStmt.run(Date.now(), workerId, row.id);
            return this.rowToQueueItem(row);
        });
        const item = transaction();
        if (item) {
            this.emit('dequeued', { id: item.id, workerId, priority: item.priority });
        }
        return item;
    }
    /**
     * Mark item as completed
     */
    complete(itemId, result) {
        const completedAt = Date.now();
        // Get item to calculate processing time
        const item = this.getItem(itemId);
        if (item && item.startedAt) {
            const processingTime = completedAt - item.startedAt;
            this.processingTimeSum += processingTime;
            this.processedCount++;
        }
        const stmt = this.db.prepare(`
      UPDATE workflow_queue
      SET status = 'completed',
          completed_at = ?,
          result = ?
      WHERE id = ?
    `);
        stmt.run(completedAt, result ? JSON.stringify(result) : null, itemId);
        this.emit('completed', { id: itemId, duration: item?.startedAt ? completedAt - item.startedAt : 0 });
    }
    /**
     * Mark item as failed
     */
    fail(itemId, error) {
        const item = this.getItem(itemId);
        if (!item) {
            return;
        }
        // Check if should retry
        if (item.attempts < item.maxAttempts) {
            // Reset to pending for retry
            const stmt = this.db.prepare(`
        UPDATE workflow_queue
        SET status = 'pending',
            error = ?,
            worker_id = NULL,
            started_at = NULL
        WHERE id = ?
      `);
            stmt.run(error, itemId);
            this.emit('retry_scheduled', { id: itemId, attempt: item.attempts, error });
        }
        else {
            // Max attempts reached, mark as failed
            const stmt = this.db.prepare(`
        UPDATE workflow_queue
        SET status = 'failed',
            error = ?,
            completed_at = ?
        WHERE id = ?
      `);
            stmt.run(error, Date.now(), itemId);
            this.emit('failed', { id: itemId, attempts: item.attempts, error });
        }
    }
    /**
     * Cancel queued item
     */
    cancel(itemId) {
        const item = this.getItem(itemId);
        if (!item || item.status === 'completed' || item.status === 'failed') {
            return false;
        }
        const stmt = this.db.prepare(`
      UPDATE workflow_queue
      SET status = 'cancelled',
          completed_at = ?
      WHERE id = ?
    `);
        stmt.run(Date.now(), itemId);
        this.emit('cancelled', { id: itemId });
        return true;
    }
    /**
     * Get queue item by ID
     */
    getItem(itemId) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_queue WHERE id = ?
    `);
        const row = stmt.get(itemId);
        return row ? this.rowToQueueItem(row) : null;
    }
    /**
     * Get queue items by status
     */
    getItemsByStatus(status, limit = 100) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_queue
      WHERE status = ?
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `);
        const rows = stmt.all(status, limit);
        return rows.map(row => this.rowToQueueItem(row));
    }
    /**
     * Get items by worker ID
     */
    getItemsByWorker(workerId) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_queue
      WHERE worker_id = ?
      ORDER BY started_at DESC
    `);
        const rows = stmt.all(workerId);
        return rows.map(row => this.rowToQueueItem(row));
    }
    /**
     * Get queue statistics
     */
    getStats() {
        const statsStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM workflow_queue
    `);
        const stats = statsStmt.get();
        // Calculate throughput (items per minute)
        const recentStmt = this.db.prepare(`
      SELECT COUNT(*) as recent_completed
      FROM workflow_queue
      WHERE status = 'completed'
        AND completed_at > ?
    `);
        const recentCompleted = recentStmt.get(Date.now() - 60000).recent_completed;
        return {
            totalItems: stats.total || 0,
            pendingItems: stats.pending || 0,
            processingItems: stats.processing || 0,
            completedItems: stats.completed || 0,
            failedItems: stats.failed || 0,
            averageProcessingTimeMs: this.processedCount > 0 ? this.processingTimeSum / this.processedCount : 0,
            throughput: recentCompleted,
        };
    }
    /**
     * Get queue length by priority
     */
    getLengthByPriority() {
        const stmt = this.db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM workflow_queue
      WHERE status = 'pending'
      GROUP BY priority
      ORDER BY priority DESC
    `);
        const rows = stmt.all();
        const result = {};
        for (const row of rows) {
            result[row.priority] = row.count;
        }
        return result;
    }
    /**
     * Clean up old completed/failed items
     */
    cleanup(retentionDays = 7) {
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        const stmt = this.db.prepare(`
      DELETE FROM workflow_queue
      WHERE (status = 'completed' OR status = 'failed')
        AND completed_at < ?
    `);
        const result = stmt.run(cutoffTime);
        if (result.changes > 0) {
            this.emit('cleanup', { removed: result.changes, retentionDays });
        }
        return result.changes;
    }
    /**
     * Reset stuck items (processing for too long)
     */
    resetStuckItems(timeoutMs = 600000) {
        const cutoffTime = Date.now() - timeoutMs;
        const stmt = this.db.prepare(`
      UPDATE workflow_queue
      SET status = 'pending',
          worker_id = NULL,
          started_at = NULL
      WHERE status = 'processing'
        AND started_at < ?
    `);
        const result = stmt.run(cutoffTime);
        if (result.changes > 0) {
            this.emit('stuck_items_reset', { count: result.changes, timeoutMs });
        }
        return result.changes;
    }
    /**
     * Get queue health status
     */
    getHealth() {
        const stats = this.getStats();
        const issues = [];
        // Check for stuck items
        const stuckCount = this.resetStuckItems(600000);
        if (stuckCount > 0) {
            issues.push(`${stuckCount} stuck items reset`);
        }
        // Check for high failure rate
        if (stats.failedItems > stats.completedItems * 0.1) {
            issues.push(`High failure rate: ${stats.failedItems} failed vs ${stats.completedItems} completed`);
        }
        // Check for queue backup
        if (stats.pendingItems > 1000) {
            issues.push(`Queue backup: ${stats.pendingItems} pending items`);
        }
        return {
            healthy: issues.length === 0,
            issues,
            stats,
        };
    }
    /**
     * Convert database row to QueueItem
     */
    rowToQueueItem(row) {
        return {
            id: row.id,
            workflowDefinition: JSON.parse(row.workflow_definition),
            options: JSON.parse(row.options),
            priority: row.priority,
            status: row.status,
            createdAt: row.created_at,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            attempts: row.attempts,
            maxAttempts: row.max_attempts,
            error: row.error,
            workerId: row.worker_id,
            result: row.result ? JSON.parse(row.result) : undefined,
        };
    }
    /**
     * Clear all items (for testing)
     */
    clear() {
        this.db.exec('DELETE FROM workflow_queue');
        this.emit('cleared');
    }
}
//# sourceMappingURL=WorkflowQueue.js.map