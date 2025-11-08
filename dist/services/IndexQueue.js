/**
 * IndexQueue.ts
 *
 * Queue-based indexing service
 * Manages indexing tasks with progress tracking
 */
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';
import { extname } from 'path';
/**
 * IndexQueue - Manages indexing tasks
 */
export class IndexQueue extends EventEmitter {
    fileService;
    queue = [];
    processing = new Set();
    completed = 0;
    failed = 0;
    totalTime = 0;
    isProcessing = false;
    concurrency;
    constructor(fileService, concurrency = 3) {
        super();
        this.fileService = fileService;
        this.concurrency = concurrency;
    }
    /**
     * Add task to queue
     */
    enqueue(path, operation, priority = 0) {
        const id = `${operation}:${path}:${Date.now()}`;
        const task = {
            id,
            path,
            operation,
            priority,
            timestamp: Date.now(),
        };
        // Remove existing tasks for same file
        this.queue = this.queue.filter((t) => t.path !== path);
        // Add new task
        this.queue.push(task);
        // Sort by priority (higher first)
        this.queue.sort((a, b) => b.priority - a.priority);
        this.emit('enqueued', task);
        // Start processing if not already running
        if (!this.isProcessing) {
            this.process();
        }
    }
    /**
     * Process queue
     */
    async process() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        this.emit('started');
        while (this.queue.length > 0 || this.processing.size > 0) {
            // Process tasks up to concurrency limit
            while (this.queue.length > 0 && this.processing.size < this.concurrency) {
                const task = this.queue.shift();
                if (task) {
                    this.processTask(task);
                }
            }
            // Wait a bit before checking again
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        this.isProcessing = false;
        this.emit('completed', this.getStats());
    }
    /**
     * Process single task
     */
    async processTask(task) {
        this.processing.add(task.id);
        this.emit('processing', task);
        const startTime = performance.now();
        try {
            let result;
            switch (task.operation) {
                case 'add':
                case 'update':
                    result = await this.indexFile(task.path);
                    break;
                case 'delete':
                    this.fileService.deleteFile(task.path);
                    break;
            }
            const duration = performance.now() - startTime;
            this.totalTime += duration;
            this.completed++;
            const taskResult = {
                task,
                success: true,
                result,
                duration,
            };
            this.emit('task-completed', taskResult);
        }
        catch (error) {
            const duration = performance.now() - startTime;
            this.totalTime += duration;
            this.failed++;
            const taskResult = {
                task,
                success: false,
                error: error,
                duration,
            };
            this.emit('task-failed', taskResult);
        }
        finally {
            this.processing.delete(task.id);
        }
    }
    /**
     * Index a file
     */
    async indexFile(path) {
        // Read file content
        const content = await readFile(path, 'utf-8');
        // Determine language from extension
        const ext = extname(path);
        const language = this.getLanguageFromExtension(ext);
        // Check if file exists in database
        const existingFile = this.fileService['fileDAO'].findByPath(path);
        if (existingFile) {
            // Re-index existing file
            return this.fileService.reindexFile(path, content);
        }
        else {
            // Index new file (language auto-detected from path)
            return this.fileService.indexFile(path, content);
        }
    }
    /**
     * Get language from file extension
     */
    getLanguageFromExtension(ext) {
        const languageMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
        };
        return languageMap[ext] || 'unknown';
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            pending: this.queue.length,
            processing: this.processing.size,
            completed: this.completed,
            failed: this.failed,
            totalTime: this.totalTime,
            averageTime: this.completed > 0 ? this.totalTime / this.completed : 0,
        };
    }
    /**
     * Clear queue and reset statistics
     */
    clear() {
        this.queue = [];
        this.processing.clear();
        this.completed = 0;
        this.failed = 0;
        this.totalTime = 0;
        this.emit('cleared');
    }
    /**
     * Check if queue is empty and idle
     */
    isIdle() {
        return this.queue.length === 0 && this.processing.size === 0;
    }
    /**
     * Wait for queue to be idle
     */
    async waitForIdle() {
        return new Promise((resolve) => {
            if (this.isIdle()) {
                resolve();
                return;
            }
            const checkIdle = () => {
                if (this.isIdle()) {
                    this.off('task-completed', checkIdle);
                    this.off('task-failed', checkIdle);
                    resolve();
                }
            };
            this.on('task-completed', checkIdle);
            this.on('task-failed', checkIdle);
        });
    }
}
//# sourceMappingURL=IndexQueue.js.map