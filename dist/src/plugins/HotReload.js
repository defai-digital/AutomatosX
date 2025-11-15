/**
 * Plugin Hot Reload Engine
 * Sprint 5 Day 46: Hot reload with state preservation
 */
import { EventEmitter } from 'events';
import { watch } from 'fs';
/**
 * Hot Reload Engine
 */
export class HotReloadEngine extends EventEmitter {
    watchers = new Map();
    pluginStates = new Map();
    loadedPlugins = new Map();
    debounceTimers = new Map();
    reloadInProgress = new Set();
    /**
     * Enable hot reload for a plugin
     */
    async enableHotReload(pluginName, options) {
        // Stop existing watcher if any
        this.disableHotReload(pluginName);
        const debounceMs = options.debounceMs ?? 300;
        // Create file watcher
        const watcher = watch(options.watchPath, { recursive: true }, (eventType, filename) => {
            if (!filename)
                return;
            // Debounce rapid file changes
            const existingTimer = this.debounceTimers.get(pluginName);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            const timer = setTimeout(() => {
                this.handleFileChange(pluginName, filename, options);
                this.debounceTimers.delete(pluginName);
            }, debounceMs);
            this.debounceTimers.set(pluginName, timer);
        });
        this.watchers.set(pluginName, watcher);
        this.emit('hot-reload-enabled', { pluginName });
    }
    /**
     * Disable hot reload for a plugin
     */
    disableHotReload(pluginName) {
        const watcher = this.watchers.get(pluginName);
        if (watcher) {
            watcher.close();
            this.watchers.delete(pluginName);
        }
        const timer = this.debounceTimers.get(pluginName);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(pluginName);
        }
        this.emit('hot-reload-disabled', { pluginName });
    }
    /**
     * Handle file change event
     */
    async handleFileChange(pluginName, filename, options) {
        // Skip if reload already in progress
        if (this.reloadInProgress.has(pluginName)) {
            return;
        }
        this.reloadInProgress.add(pluginName);
        try {
            const result = await this.reloadPlugin(pluginName, options);
            this.emit('hot-reload-complete', result);
        }
        catch (error) {
            this.emit('hot-reload-error', {
                pluginName,
                error: error instanceof Error ? error : new Error(String(error)),
            });
        }
        finally {
            this.reloadInProgress.delete(pluginName);
        }
    }
    /**
     * Reload a plugin
     */
    async reloadPlugin(pluginName, options) {
        const startTime = Date.now();
        this.emit('reload-started', { pluginName });
        try {
            // Step 1: Save state if requested
            if (options.preserveState) {
                await this.savePluginState(pluginName);
            }
            // Step 2: Unload current plugin
            const previousVersion = await this.unloadPlugin(pluginName);
            // Step 3: Clear module cache
            this.clearModuleCache(pluginName);
            // Step 4: Load new version
            const newVersion = await this.loadPlugin(pluginName, options.watchPath);
            // Step 5: Restore state if requested
            if (options.preserveState) {
                await this.restorePluginState(pluginName);
            }
            const duration = Date.now() - startTime;
            const result = {
                success: true,
                pluginName,
                duration,
                previousVersion,
                newVersion,
            };
            this.emit('reload-success', result);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Rollback if requested
            if (options.rollbackOnError) {
                await this.rollbackPlugin(pluginName);
            }
            const result = {
                success: false,
                pluginName,
                duration,
                error: error instanceof Error ? error : new Error(String(error)),
            };
            this.emit('reload-failure', result);
            return result;
        }
    }
    /**
     * Save plugin state
     */
    async savePluginState(pluginName) {
        const plugin = this.loadedPlugins.get(pluginName);
        if (!plugin)
            return;
        const state = typeof plugin.getState === 'function' ? plugin.getState() : {};
        const snapshot = {
            pluginName,
            timestamp: Date.now(),
            state,
            metadata: {
                version: plugin.version || 'unknown',
            },
        };
        this.pluginStates.set(pluginName, snapshot);
        this.emit('state-saved', { pluginName, snapshot });
    }
    /**
     * Restore plugin state
     */
    async restorePluginState(pluginName) {
        const snapshot = this.pluginStates.get(pluginName);
        if (!snapshot)
            return;
        const plugin = this.loadedPlugins.get(pluginName);
        if (!plugin)
            return;
        if (typeof plugin.setState === 'function') {
            plugin.setState(snapshot.state);
        }
        this.emit('state-restored', { pluginName, snapshot });
    }
    /**
     * Unload plugin
     */
    async unloadPlugin(pluginName) {
        const plugin = this.loadedPlugins.get(pluginName);
        if (!plugin)
            return undefined;
        const version = plugin.version;
        // Call cleanup if available
        if (typeof plugin.cleanup === 'function') {
            await plugin.cleanup();
        }
        this.loadedPlugins.delete(pluginName);
        this.emit('plugin-unloaded', { pluginName, version });
        return version;
    }
    /**
     * Load plugin
     */
    async loadPlugin(pluginName, watchPath) {
        // Mock plugin loading - in real implementation would use dynamic import
        const plugin = {
            name: pluginName,
            version: '1.0.0',
            initialize: async () => { },
            getState: () => ({}),
            setState: (state) => { },
            cleanup: async () => { },
        };
        await plugin.initialize();
        this.loadedPlugins.set(pluginName, plugin);
        this.emit('plugin-loaded', { pluginName, version: plugin.version });
        return plugin.version;
    }
    /**
     * Clear module cache
     */
    clearModuleCache(pluginName) {
        // Clear require cache for Node.js modules
        const cacheKeys = Object.keys(require.cache).filter((key) => key.includes(pluginName));
        for (const key of cacheKeys) {
            delete require.cache[key];
        }
        this.emit('cache-cleared', { pluginName, clearedModules: cacheKeys.length });
    }
    /**
     * Rollback plugin
     */
    async rollbackPlugin(pluginName) {
        // Attempt to restore previous state
        const snapshot = this.pluginStates.get(pluginName);
        if (snapshot) {
            // Reload from snapshot metadata
            this.emit('rollback-started', { pluginName });
            // In real implementation, would restore from backup
            this.emit('rollback-complete', { pluginName });
        }
    }
    /**
     * Get plugin state snapshot
     */
    getStateSnapshot(pluginName) {
        return this.pluginStates.get(pluginName);
    }
    /**
     * Check if hot reload is enabled for plugin
     */
    isEnabled(pluginName) {
        return this.watchers.has(pluginName);
    }
    /**
     * Check if reload is in progress
     */
    isReloading(pluginName) {
        return this.reloadInProgress.has(pluginName);
    }
    /**
     * Get all watched plugins
     */
    getWatchedPlugins() {
        return Array.from(this.watchers.keys());
    }
    /**
     * Shutdown hot reload engine
     */
    shutdown() {
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        // Close all watchers
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
        // Clear state
        this.pluginStates.clear();
        this.loadedPlugins.clear();
        this.reloadInProgress.clear();
        this.emit('shutdown');
    }
}
/**
 * Create hot reload engine
 */
export function createHotReloadEngine() {
    return new HotReloadEngine();
}
/**
 * Global hot reload engine
 */
let globalEngine = null;
/**
 * Get global hot reload engine
 */
export function getHotReloadEngine() {
    if (!globalEngine) {
        globalEngine = createHotReloadEngine();
    }
    return globalEngine;
}
/**
 * Reset global engine
 */
export function resetHotReloadEngine() {
    if (globalEngine) {
        globalEngine.shutdown();
    }
    globalEngine = null;
}
//# sourceMappingURL=HotReload.js.map