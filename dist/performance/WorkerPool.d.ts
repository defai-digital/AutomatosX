/**
 * Worker Pool
 *
 * Generic worker thread pool for CPU-intensive tasks
 * Manages task distribution, worker lifecycle, and error handling
 */
export interface WorkerTask<T, R> {
    id: string;
    data: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
}
export interface WorkerPoolOptions {
    maxWorkers?: number;
    taskTimeout?: number;
}
export interface WorkerPoolStats {
    totalWorkers: number;
    availableWorkers: number;
    queuedTasks: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
}
/**
 * Worker pool for parallel task execution
 */
export declare class WorkerPool<T, R> {
    private workerScript;
    private options;
    private workers;
    private taskQueue;
    private activeTasks;
    private availableWorkers;
    private completedTasks;
    private failedTasks;
    constructor(workerScript: string, options?: WorkerPoolOptions);
    /**
     * Initialize worker threads
     */
    private initializeWorkers;
    /**
     * Execute task on worker thread
     */
    execute(data: T): Promise<R>;
    /**
     * Process next task in queue
     */
    private processNextTask;
    /**
     * Restart a worker thread
     */
    private restartWorker;
    /**
     * Shutdown all workers
     */
    shutdown(): Promise<void>;
    /**
     * Get worker pool statistics
     */
    getStats(): WorkerPoolStats;
}
//# sourceMappingURL=WorkerPool.d.ts.map