/**
 * IndexQueue.ts
 *
 * Queue-based indexing service
 * Manages indexing tasks with progress tracking
 */

import { EventEmitter } from 'events';
import { FileService, IndexResult } from './FileService.js';
import { readFile } from 'fs/promises';
import { extname } from 'path';

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
export class IndexQueue extends EventEmitter {
  private fileService: FileService;
  private queue: IndexTask[] = [];
  private processing: Set<string> = new Set();
  private completed: number = 0;
  private failed: number = 0;
  private totalTime: number = 0;
  private isProcessing: boolean = false;
  private concurrency: number;

  constructor(fileService: FileService, concurrency: number = 3) {
    super();
    this.fileService = fileService;
    this.concurrency = concurrency;
  }

  /**
   * Add task to queue
   */
  enqueue(path: string, operation: 'add' | 'update' | 'delete', priority: number = 0): void {
    const id = `${operation}:${path}:${Date.now()}`;

    const task: IndexTask = {
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
  private async process(): Promise<void> {
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
  private async processTask(task: IndexTask): Promise<void> {
    this.processing.add(task.id);
    this.emit('processing', task);

    const startTime = performance.now();

    try {
      let result: IndexResult | undefined;

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

      const taskResult: TaskResult = {
        task,
        success: true,
        result,
        duration,
      };

      this.emit('task-completed', taskResult);
    } catch (error) {
      const duration = performance.now() - startTime;
      this.totalTime += duration;
      this.failed++;

      const taskResult: TaskResult = {
        task,
        success: false,
        error: error as Error,
        duration,
      };

      this.emit('task-failed', taskResult);
    } finally {
      this.processing.delete(task.id);
    }
  }

  /**
   * Index a file
   */
  private async indexFile(path: string): Promise<IndexResult> {
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
    } else {
      // Index new file (language auto-detected from path)
      return this.fileService.indexFile(path, content);
    }
  }

  /**
   * Get language from file extension
   */
  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
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
  getStats(): QueueStats {
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
  clear(): void {
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
  isIdle(): boolean {
    return this.queue.length === 0 && this.processing.size === 0;
  }

  /**
   * Wait for queue to be idle
   */
  async waitForIdle(): Promise<void> {
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
