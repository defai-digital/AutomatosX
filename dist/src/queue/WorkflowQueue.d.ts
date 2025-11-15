/**
 * WorkflowQueue.ts
 *
 * Priority-based workflow execution queue
 * Phase 5 Week 2: Distributed Execution
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { WorkflowDefinition, WorkflowExecutionOptions } from '../types/schemas/workflow.schema.js';
/**
 * Queue item
 */
export interface QueueItem {
    id: string;
    workflowDefinition: WorkflowDefinition;
    options: WorkflowExecutionOptions;
    priority: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    attempts: number;
    maxAttempts: number;
    error?: string;
    workerId?: string;
    result?: unknown;
}
/**
 * Queue statistics
 */
export interface QueueStats {
    totalItems: number;
    pendingItems: number;
    processingItems: number;
    completedItems: number;
    failedItems: number;
    averageProcessingTimeMs: number;
    throughput: number;
}
/**
 * WorkflowQueue - Priority-based workflow queue with persistence
 */
export declare class WorkflowQueue extends EventEmitter {
    private db;
    private processingTimeSum;
    private processedCount;
    constructor(db?: Database.Database);
    /**
     * Initialize queue table
     */
    private initializeTable;
    /**
     * Add workflow to queue
     */
    enqueue(workflowDefinition: WorkflowDefinition, options?: WorkflowExecutionOptions, maxAttempts?: number): string;
    /**
     * Dequeue next workflow (highest priority, oldest first)
     */
    dequeue(workerId: string): QueueItem | null;
    /**
     * Mark item as completed
     */
    complete(itemId: string, result?: unknown): void;
    /**
     * Mark item as failed
     */
    fail(itemId: string, error: string): void;
    /**
     * Cancel queued item
     */
    cancel(itemId: string): boolean;
    /**
     * Get queue item by ID
     */
    getItem(itemId: string): QueueItem | null;
    /**
     * Get queue items by status
     */
    getItemsByStatus(status: QueueItem['status'], limit?: number): QueueItem[];
    /**
     * Get items by worker ID
     */
    getItemsByWorker(workerId: string): QueueItem[];
    /**
     * Get queue statistics
     */
    getStats(): QueueStats;
    /**
     * Get queue length by priority
     */
    getLengthByPriority(): Record<number, number>;
    /**
     * Clean up old completed/failed items
     */
    cleanup(retentionDays?: number): number;
    /**
     * Reset stuck items (processing for too long)
     */
    resetStuckItems(timeoutMs?: number): number;
    /**
     * Get queue health status
     */
    getHealth(): {
        healthy: boolean;
        issues: string[];
        stats: QueueStats;
    };
    /**
     * Convert database row to QueueItem
     */
    private rowToQueueItem;
    /**
     * Clear all items (for testing)
     */
    clear(): void;
}
//# sourceMappingURL=WorkflowQueue.d.ts.map