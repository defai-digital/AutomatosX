/**
 * IndexQueue.ts
 *
 * Queue-based indexing service
 * Manages indexing tasks with progress tracking
 */
import { EventEmitter } from 'events';
import { FileService, IndexResult } from './FileService.js';
/**
 * Indexing task
 */
export interface IndexTask {
    id: string;
    path: string;
    operation: 'add' | 'update' | 'delete';
    priority: number;
    timestamp: number;
}
/**
 * Task result
 */
export interface TaskResult {
    task: IndexTask;
    success: boolean;
    result?: IndexResult;
    error?: Error;
    duration: number;
}
/**
 * Queue statistics
 */
export interface QueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalTime: number;
    averageTime: number;
}
/**
 * IndexQueue - Manages indexing tasks
 */
export declare class IndexQueue extends EventEmitter {
    private fileService;
    private queue;
    private processing;
    private completed;
    private failed;
    private totalTime;
    private isProcessing;
    private concurrency;
    constructor(fileService: FileService, concurrency?: number);
    /**
     * Add task to queue
     */
    enqueue(path: string, operation: 'add' | 'update' | 'delete', priority?: number): void;
    /**
     * Process queue
     */
    private process;
    /**
     * Process single task
     */
    private processTask;
    /**
     * Index a file
     */
    private indexFile;
    /**
     * Get language from file extension
     */
    private getLanguageFromExtension;
    /**
     * Get queue statistics
     */
    getStats(): QueueStats;
    /**
     * Clear queue and reset statistics
     */
    clear(): void;
    /**
     * Check if queue is empty and idle
     */
    isIdle(): boolean;
    /**
     * Wait for queue to be idle
     */
    waitForIdle(): Promise<void>;
}
//# sourceMappingURL=IndexQueue.d.ts.map