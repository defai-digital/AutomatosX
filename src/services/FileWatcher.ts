/**
 * FileWatcher.ts
 *
 * File system watcher for detecting code changes
 * Monitors directories and triggers incremental indexing
 */

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { extname } from 'path';

/**
 * File change event types
 */
export enum FileChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
}

/**
 * File change event
 */
export interface FileChangeEvent {
  type: FileChangeType;
  path: string;
  timestamp: number;
}

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  paths: string[];              // Directories to watch
  ignored?: string[];           // Patterns to ignore
  extensions?: string[];        // File extensions to watch
  debounceMs?: number;          // Debounce time for rapid changes
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<WatcherConfig> = {
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/data.db',
    '**/data.db-*',
  ],
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  debounceMs: 300,
};

/**
 * FileWatcher - Monitors file system for code changes
 */
export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private config: WatcherConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isReady: boolean = false;

  constructor(config: WatcherConfig) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Start watching for file changes
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.watcher) {
        reject(new Error('Watcher already started'));
        return;
      }

      this.watcher = chokidar.watch(this.config.paths, {
        ignored: this.config.ignored,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      // Wait for initial scan to complete
      this.watcher.on('ready', () => {
        this.isReady = true;
        this.emit('ready');
        resolve();
      });

      // File added
      this.watcher.on('add', (path: string) => {
        if (this.isReady && this.shouldProcess(path)) {
          this.emitDebounced(FileChangeType.ADDED, path);
        }
      });

      // File modified
      this.watcher.on('change', (path: string) => {
        if (this.isReady && this.shouldProcess(path)) {
          this.emitDebounced(FileChangeType.MODIFIED, path);
        }
      });

      // File deleted
      this.watcher.on('unlink', (path: string) => {
        if (this.isReady && this.shouldProcess(path)) {
          this.emitDebounced(FileChangeType.DELETED, path);
        }
      });

      // Error handling
      this.watcher.on('error', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        reject(err);
      });
    });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    await this.watcher.close();
    this.watcher = null;
    this.isReady = false;
    this.emit('stopped');
  }

  /**
   * Check if watcher is active
   */
  isActive(): boolean {
    return this.watcher !== null && this.isReady;
  }

  /**
   * Get watched paths
   */
  getWatchedPaths(): string[] {
    return this.config.paths;
  }

  /**
   * Emit file change event with debouncing
   */
  private emitDebounced(type: FileChangeType, path: string): void {
    const key = `${type}:${path}`;

    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);

      const event: FileChangeEvent = {
        type,
        path,
        timestamp: Date.now(),
      };

      this.emit('change', event);
      this.emit(type, event);
    }, this.config.debounceMs || 300);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Check if file should be processed
   */
  private shouldProcess(path: string): boolean {
    // Check extension
    if (this.config.extensions && this.config.extensions.length > 0) {
      const ext = extname(path);
      return this.config.extensions.includes(ext);
    }

    return true;
  }

  /**
   * Get statistics
   */
  getStats(): {
    isActive: boolean;
    watchedPaths: string[];
    pendingChanges: number;
  } {
    return {
      isActive: this.isActive(),
      watchedPaths: this.getWatchedPaths(),
      pendingChanges: this.debounceTimers.size,
    };
  }
}
