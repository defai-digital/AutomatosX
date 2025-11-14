/**
 * Plugin Hot Reload Engine
 * Sprint 5 Day 46: Hot reload with state preservation
 */
import { EventEmitter } from 'events';
/**
 * Plugin state snapshot
 */
export interface PluginStateSnapshot {
    pluginName: string;
    timestamp: number;
    state: any;
    metadata: Record<string, any>;
}
/**
 * Hot reload result
 */
export interface HotReloadResult {
    success: boolean;
    pluginName: string;
    duration: number;
    error?: Error;
    previousVersion?: string;
    newVersion?: string;
}
/**
 * Hot reload options
 */
export interface HotReloadOptions {
    watchPath: string;
    debounceMs?: number;
    preserveState?: boolean;
    rollbackOnError?: boolean;
}
/**
 * Hot Reload Engine
 */
export declare class HotReloadEngine extends EventEmitter {
    private watchers;
    private pluginStates;
    private loadedPlugins;
    private debounceTimers;
    private reloadInProgress;
    /**
     * Enable hot reload for a plugin
     */
    enableHotReload(pluginName: string, options: HotReloadOptions): Promise<void>;
    /**
     * Disable hot reload for a plugin
     */
    disableHotReload(pluginName: string): void;
    /**
     * Handle file change event
     */
    private handleFileChange;
    /**
     * Reload a plugin
     */
    reloadPlugin(pluginName: string, options: HotReloadOptions): Promise<HotReloadResult>;
    /**
     * Save plugin state
     */
    private savePluginState;
    /**
     * Restore plugin state
     */
    private restorePluginState;
    /**
     * Unload plugin
     */
    private unloadPlugin;
    /**
     * Load plugin
     */
    private loadPlugin;
    /**
     * Clear module cache
     */
    private clearModuleCache;
    /**
     * Rollback plugin
     */
    private rollbackPlugin;
    /**
     * Get plugin state snapshot
     */
    getStateSnapshot(pluginName: string): PluginStateSnapshot | undefined;
    /**
     * Check if hot reload is enabled for plugin
     */
    isEnabled(pluginName: string): boolean;
    /**
     * Check if reload is in progress
     */
    isReloading(pluginName: string): boolean;
    /**
     * Get all watched plugins
     */
    getWatchedPlugins(): string[];
    /**
     * Shutdown hot reload engine
     */
    shutdown(): void;
}
/**
 * Create hot reload engine
 */
export declare function createHotReloadEngine(): HotReloadEngine;
/**
 * Get global hot reload engine
 */
export declare function getHotReloadEngine(): HotReloadEngine;
/**
 * Reset global engine
 */
export declare function resetHotReloadEngine(): void;
//# sourceMappingURL=HotReload.d.ts.map