/**
 * WorkerPool.ts
 *
 * Auto-scaling worker pool for workflow execution
 * Phase 5 Week 2: Distributed Execution
 */
import { EventEmitter } from 'events';
import { WorkflowWorker } from './WorkflowWorker.js';
/**
 * WorkerPool - Manage auto-scaling worker pool
 */
export class WorkerPool extends EventEmitter {
    config;
    queue;
    engine;
    cache;
    workers;
    scalingInterval;
    isRunning = false;
    constructor(queue, engine, cache, config) {
        super();
        this.config = {
            minWorkers: 2,
            maxWorkers: 10,
            scaleUpThreshold: 10,
            scaleDownThreshold: 300000, // 5 minutes
            scalingInterval: 10000, // 10 seconds
            ...config,
        };
        this.queue = queue;
        this.engine = engine;
        this.cache = cache;
        this.workers = new Map();
    }
    /**
     * Start worker pool
     */
    async start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        // Start minimum workers
        for (let i = 0; i < this.config.minWorkers; i++) {
            await this.addWorker();
        }
        // Start auto-scaling
        this.startAutoScaling();
        this.emit('pool_started', { minWorkers: this.config.minWorkers });
    }
    /**
     * Stop worker pool (graceful shutdown)
     */
    async stop() {
        this.isRunning = false;
        // Stop auto-scaling
        if (this.scalingInterval) {
            clearInterval(this.scalingInterval);
        }
        // Stop all workers
        const stopPromises = [];
        for (const [_, worker] of this.workers) {
            stopPromises.push(worker.stop());
        }
        await Promise.all(stopPromises);
        this.workers.clear();
        this.emit('pool_stopped');
    }
    /**
     * Add new worker to pool
     */
    async addWorker() {
        const worker = new WorkflowWorker(this.queue, this.engine, this.cache);
        // Forward worker events
        worker.on('task_completed', (data) => this.emit('task_completed', data));
        worker.on('task_failed', (data) => this.emit('task_failed', data));
        worker.on('error', (data) => this.emit('worker_error', data));
        await worker.start();
        this.workers.set(worker.getId(), worker);
        this.emit('worker_added', { id: worker.getId(), totalWorkers: this.workers.size });
        return worker;
    }
    /**
     * Remove worker from pool
     */
    async removeWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker) {
            return;
        }
        await worker.stop();
        this.workers.delete(workerId);
        this.emit('worker_removed', { id: workerId, totalWorkers: this.workers.size });
    }
    /**
     * Start auto-scaling logic
     */
    startAutoScaling() {
        this.scalingInterval = setInterval(() => {
            this.evaluateScaling();
        }, this.config.scalingInterval);
    }
    /**
     * Evaluate whether to scale up or down
     */
    async evaluateScaling() {
        if (!this.isRunning) {
            return;
        }
        const queueStats = this.queue.getStats();
        const poolStats = this.getStats();
        // Scale up if queue is backing up
        if (queueStats.pendingItems >= this.config.scaleUpThreshold &&
            poolStats.totalWorkers < this.config.maxWorkers) {
            const workersToAdd = Math.min(Math.ceil(queueStats.pendingItems / this.config.scaleUpThreshold), this.config.maxWorkers - poolStats.totalWorkers);
            for (let i = 0; i < workersToAdd; i++) {
                await this.addWorker();
            }
            this.emit('scaled_up', { workersAdded: workersToAdd, reason: 'queue_backup' });
        }
        // Scale down if workers are idle
        if (poolStats.idleWorkers > this.config.minWorkers &&
            poolStats.totalWorkers > this.config.minWorkers) {
            // Find workers that have been idle for a while
            const idleWorkers = this.getIdleWorkers(this.config.scaleDownThreshold);
            if (idleWorkers.length > 0) {
                const workersToRemove = Math.min(idleWorkers.length, poolStats.totalWorkers - this.config.minWorkers);
                for (let i = 0; i < workersToRemove; i++) {
                    await this.removeWorker(idleWorkers[i].id);
                }
                this.emit('scaled_down', { workersRemoved: workersToRemove, reason: 'idle_workers' });
            }
        }
    }
    /**
     * Get idle workers
     */
    getIdleWorkers(idleThresholdMs) {
        const now = Date.now();
        const idleWorkers = [];
        for (const [_, worker] of this.workers) {
            const stats = worker.getStats();
            if (stats.status === 'idle' &&
                stats.lastTaskAt &&
                now - stats.lastTaskAt > idleThresholdMs) {
                idleWorkers.push(stats);
            }
        }
        return idleWorkers;
    }
    /**
     * Get pool statistics
     */
    getStats() {
        let idleCount = 0;
        let busyCount = 0;
        let pausedCount = 0;
        let totalTasksProcessed = 0;
        let totalTasksFailed = 0;
        let totalProcessingTime = 0;
        for (const [_, worker] of this.workers) {
            const stats = worker.getStats();
            switch (stats.status) {
                case 'idle':
                    idleCount++;
                    break;
                case 'busy':
                    busyCount++;
                    break;
                case 'paused':
                    pausedCount++;
                    break;
            }
            totalTasksProcessed += stats.tasksProcessed;
            totalTasksFailed += stats.tasksFailed;
            totalProcessingTime += stats.totalProcessingTime;
        }
        const queueStats = this.queue.getStats();
        const totalWorkers = this.workers.size;
        return {
            totalWorkers,
            idleWorkers: idleCount,
            busyWorkers: busyCount,
            pausedWorkers: pausedCount,
            totalTasksProcessed,
            totalTasksFailed,
            averageProcessingTime: totalTasksProcessed > 0 ? totalProcessingTime / totalTasksProcessed : 0,
            queueLength: queueStats.pendingItems,
            utilization: totalWorkers > 0 ? busyCount / totalWorkers : 0,
        };
    }
    /**
     * Get worker statistics
     */
    getWorkerStats() {
        const stats = [];
        for (const [_, worker] of this.workers) {
            stats.push(worker.getStats());
        }
        return stats.sort((a, b) => b.tasksProcessed - a.tasksProcessed);
    }
    /**
     * Pause all workers
     */
    pauseAll() {
        for (const [_, worker] of this.workers) {
            worker.pause();
        }
        this.emit('pool_paused');
    }
    /**
     * Resume all workers
     */
    resumeAll() {
        for (const [_, worker] of this.workers) {
            worker.resume();
        }
        this.emit('pool_resumed');
    }
    /**
     * Get specific worker
     */
    getWorker(workerId) {
        return this.workers.get(workerId);
    }
    /**
     * Get all worker IDs
     */
    getWorkerIds() {
        return Array.from(this.workers.keys());
    }
}
//# sourceMappingURL=WorkerPool.js.map