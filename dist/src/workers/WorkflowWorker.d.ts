/**
 * WorkflowWorker.ts
 *
 * Background worker process for executing queued workflows
 * Phase 5 Week 2: Distributed Execution
 */
import { EventEmitter } from 'events';
import { WorkflowQueue } from '../queue/WorkflowQueue.js';
import { WorkflowEngine } from '../services/WorkflowEngine.js';
import { WorkflowCache } from '../cache/WorkflowCache.js';
/**
 * Worker status
 */
export type WorkerStatus = 'idle' | 'busy' | 'paused' | 'stopped';
/**
 * Worker statistics
 */
export interface WorkerStats {
    id: string;
    status: WorkerStatus;
    tasksProcessed: number;
    tasksFailed: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    uptime: number;
    lastTaskAt?: number;
}
/**
 * WorkflowWorker - Process workflows from queue
 */
export declare class WorkflowWorker extends EventEmitter {
    private id;
    private queue;
    private engine;
    private cache;
    private status;
    private isRunning;
    private currentItem?;
    private tasksProcessed;
    private tasksFailed;
    private totalProcessingTime;
    private startedAt;
    private lastTaskAt?;
    constructor(queue: WorkflowQueue, engine: WorkflowEngine, cache: WorkflowCache);
    /**
     * Start worker
     */
    start(): Promise<void>;
    /**
     * Stop worker (graceful shutdown)
     */
    stop(): Promise<void>;
    /**
     * Pause worker
     */
    pause(): void;
    /**
     * Resume worker
     */
    resume(): void;
    /**
     * Main processing loop
     */
    private processLoop;
    /**
     * Process single queue item
     */
    private processItem;
    /**
     * Get worker statistics
     */
    getStats(): WorkerStats;
    /**
     * Get worker ID
     */
    getId(): string;
    /**
     * Get worker status
     */
    getStatus(): WorkerStatus;
    /**
     * Sleep utility
     */
    private sleep;
}
//# sourceMappingURL=WorkflowWorker.d.ts.map