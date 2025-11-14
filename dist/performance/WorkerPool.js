/**
 * Worker Pool
 *
 * Generic worker thread pool for CPU-intensive tasks
 * Manages task distribution, worker lifecycle, and error handling
 */
import { Worker } from 'worker_threads';
import * as os from 'os';
/**
 * Worker pool for parallel task execution
 */
export class WorkerPool {
    workerScript;
    options;
    workers = [];
    taskQueue = [];
    activeTasks = new Map();
    availableWorkers = [];
    completedTasks = 0;
    failedTasks = 0;
    constructor(workerScript, options = {}) {
        this.workerScript = workerScript;
        this.options = options;
        const maxWorkers = options.maxWorkers || Math.max(1, os.cpus().length - 1);
        this.initializeWorkers(maxWorkers);
    }
    /**
     * Initialize worker threads
     */
    initializeWorkers(count) {
        for (let i = 0; i < count; i++) {
            const worker = new Worker(this.workerScript);
            worker.on('message', (result) => {
                const task = this.activeTasks.get(result.taskId);
                if (!task)
                    return;
                this.activeTasks.delete(result.taskId);
                this.availableWorkers.push(worker);
                if (result.error) {
                    this.failedTasks++;
                    task.reject(new Error(result.error));
                }
                else if (result.result !== undefined) {
                    this.completedTasks++;
                    task.resolve(result.result);
                }
                // Process next task if any
                this.processNextTask();
            });
            worker.on('error', (error) => {
                console.error('Worker error:', error);
                this.restartWorker(worker);
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                    this.restartWorker(worker);
                }
            });
            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
    }
    /**
     * Execute task on worker thread
     */
    async execute(data) {
        return new Promise((resolve, reject) => {
            const task = {
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                data,
                resolve,
                reject,
            };
            this.taskQueue.push(task);
            this.processNextTask();
        });
    }
    /**
     * Process next task in queue
     */
    processNextTask() {
        if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
            return;
        }
        const task = this.taskQueue.shift();
        const worker = this.availableWorkers.shift();
        this.activeTasks.set(task.id, task);
        // Send task to worker
        worker.postMessage({
            taskId: task.id,
            data: task.data,
        });
        // Set timeout
        const timeout = this.options.taskTimeout || 30000;
        setTimeout(() => {
            if (this.activeTasks.has(task.id)) {
                this.activeTasks.delete(task.id);
                this.failedTasks++;
                task.reject(new Error('Task timeout'));
                // Restart worker (may be hung)
                this.restartWorker(worker);
            }
        }, timeout);
    }
    /**
     * Restart a worker thread
     */
    restartWorker(worker) {
        const index = this.workers.indexOf(worker);
        if (index === -1)
            return;
        // Remove from available workers
        const availIndex = this.availableWorkers.indexOf(worker);
        if (availIndex !== -1) {
            this.availableWorkers.splice(availIndex, 1);
        }
        // Terminate old worker
        worker.terminate().catch(err => {
            console.error('Error terminating worker:', err);
        });
        // Create new worker
        const newWorker = new Worker(this.workerScript);
        newWorker.on('message', (result) => {
            const task = this.activeTasks.get(result.taskId);
            if (!task)
                return;
            this.activeTasks.delete(result.taskId);
            this.availableWorkers.push(newWorker);
            if (result.error) {
                this.failedTasks++;
                task.reject(new Error(result.error));
            }
            else if (result.result !== undefined) {
                this.completedTasks++;
                task.resolve(result.result);
            }
            this.processNextTask();
        });
        newWorker.on('error', (error) => {
            console.error('Worker error:', error);
            this.restartWorker(newWorker);
        });
        this.workers[index] = newWorker;
        this.availableWorkers.push(newWorker);
    }
    /**
     * Shutdown all workers
     */
    async shutdown() {
        const terminatePromises = this.workers.map(worker => worker.terminate().catch(err => {
            console.error('Error terminating worker:', err);
        }));
        await Promise.all(terminatePromises);
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.activeTasks.clear();
    }
    /**
     * Get worker pool statistics
     */
    getStats() {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            queuedTasks: this.taskQueue.length,
            activeTasks: this.activeTasks.size,
            completedTasks: this.completedTasks,
            failedTasks: this.failedTasks,
        };
    }
}
//# sourceMappingURL=WorkerPool.js.map