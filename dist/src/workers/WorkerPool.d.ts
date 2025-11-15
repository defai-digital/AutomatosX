/**
 * WorkerPool.ts
 *
 * Auto-scaling worker pool for workflow execution
 * Phase 5 Week 2: Distributed Execution
 */
import { EventEmitter } from 'events';
import { WorkflowQueue } from '../queue/WorkflowQueue.js';
import { WorkflowWorker, WorkerStats } from './WorkflowWorker.js';
import { WorkflowEngine } from '../services/WorkflowEngine.js';
import { WorkflowCache } from '../cache/WorkflowCache.js';
/**
 * Pool configuration
 */
export interface PoolConfig {
    minWorkers: number;
    maxWorkers: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    scalingInterval: number;
}
/**
 * Pool statistics
 */
export interface PoolStats {
    totalWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    pausedWorkers: number;
    totalTasksProcessed: number;
    totalTasksFailed: number;
    averageProcessingTime: number;
    queueLength: number;
    utilization: number;
}
/**
 * WorkerPool - Manage auto-scaling worker pool
 */
export declare class WorkerPool extends EventEmitter {
    private config;
    private queue;
    private engine;
    private cache;
    private workers;
    private scalingInterval?;
    private isRunning;
    constructor(queue: WorkflowQueue, engine: WorkflowEngine, cache: WorkflowCache, config?: Partial<PoolConfig>);
    /**
     * Start worker pool
     */
    start(): Promise<void>;
    /**
     * Stop worker pool (graceful shutdown)
     */
    stop(): Promise<void>;
    /**
     * Add new worker to pool
     */
    private addWorker;
    /**
     * Remove worker from pool
     */
    private removeWorker;
    /**
     * Start auto-scaling logic
     */
    private startAutoScaling;
    /**
     * Evaluate whether to scale up or down
     */
    private evaluateScaling;
    /**
     * Get idle workers
     */
    private getIdleWorkers;
    /**
     * Get pool statistics
     */
    getStats(): PoolStats;
    /**
     * Get worker statistics
     */
    getWorkerStats(): WorkerStats[];
    /**
     * Pause all workers
     */
    pauseAll(): void;
    /**
     * Resume all workers
     */
    resumeAll(): void;
    /**
     * Get specific worker
     */
    getWorker(workerId: string): WorkflowWorker | undefined;
    /**
     * Get all worker IDs
     */
    getWorkerIds(): string[];
}
//# sourceMappingURL=WorkerPool.d.ts.map