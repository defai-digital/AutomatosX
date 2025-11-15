/**
 * FileWatcher.ts
 *
 * File system watcher for detecting code changes
 * Monitors directories and triggers incremental indexing
 */
import { EventEmitter } from 'events';
/**
 * File change event types
 */
export declare enum FileChangeType {
    ADDED = "added",
    MODIFIED = "modified",
    DELETED = "deleted"
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
    paths: string[];
    ignored?: string[];
    extensions?: string[];
    debounceMs?: number;
}
/**
 * FileWatcher - Monitors file system for code changes
 */
export declare class FileWatcher extends EventEmitter {
    private watcher;
    private config;
    private debounceTimers;
    private isReady;
    constructor(config: WatcherConfig);
    /**
     * Start watching for file changes
     */
    start(): Promise<void>;
    /**
     * Stop watching
     */
    stop(): Promise<void>;
    /**
     * Check if watcher is active
     */
    isActive(): boolean;
    /**
     * Get watched paths
     */
    getWatchedPaths(): string[];
    /**
     * Emit file change event with debouncing
     */
    private emitDebounced;
    /**
     * Check if file should be processed
     */
    private shouldProcess;
    /**
     * Get statistics
     */
    getStats(): {
        isActive: boolean;
        watchedPaths: string[];
        pendingChanges: number;
    };
}
//# sourceMappingURL=FileWatcher.d.ts.map