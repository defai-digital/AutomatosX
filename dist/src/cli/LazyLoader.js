/**
 * Lazy Loader
 * Sprint 5 Day 44: Lazy loading for CLI dependencies to optimize startup
 */
import { EventEmitter } from 'events';
/**
 * Lazy loader for optimizing module loading
 */
export class LazyLoader extends EventEmitter {
    modules = new Map();
    loading = new Map();
    configs = new Map();
    loadTimes = new Map();
    /**
     * Register a lazy module
     */
    register(name, config) {
        this.configs.set(name, config);
        if (config.preload) {
            // Preload in background
            this.load(name).catch((error) => {
                this.emit('preload-error', { name, error });
            });
        }
    }
    /**
     * Load a module
     */
    async load(name) {
        const startTime = Date.now();
        // Return cached module
        if (this.modules.has(name)) {
            return {
                module: this.modules.get(name),
                duration: 0,
                cached: true,
            };
        }
        // Wait for in-progress load
        if (this.loading.has(name)) {
            const module = await this.loading.get(name);
            return {
                module,
                duration: Date.now() - startTime,
                cached: false,
            };
        }
        // Start new load
        const config = this.configs.get(name);
        if (!config) {
            throw new Error(`Module "${name}" not registered`);
        }
        const loadPromise = this.performLoad(name, config);
        this.loading.set(name, loadPromise);
        try {
            const module = await loadPromise;
            const duration = Date.now() - startTime;
            this.modules.set(name, module);
            this.loadTimes.set(name, duration);
            this.loading.delete(name);
            this.emit('module-loaded', { name, duration });
            return {
                module,
                duration,
                cached: false,
            };
        }
        catch (error) {
            this.loading.delete(name);
            this.emit('load-error', { name, error });
            throw error;
        }
    }
    /**
     * Perform module load
     */
    async performLoad(name, config) {
        const timeout = config.timeout || 5000;
        const loadPromise = import(config.path);
        // Add timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Module "${name}" load timeout after ${timeout}ms`));
            }, timeout);
        });
        const module = await Promise.race([loadPromise, timeoutPromise]);
        return module;
    }
    /**
     * Get a module (throws if not loaded)
     */
    get(name) {
        if (!this.modules.has(name)) {
            throw new Error(`Module "${name}" not loaded. Call load() first.`);
        }
        return this.modules.get(name);
    }
    /**
     * Check if module is loaded
     */
    isLoaded(name) {
        return this.modules.has(name);
    }
    /**
     * Check if module is loading
     */
    isLoading(name) {
        return this.loading.has(name);
    }
    /**
     * Get load time for a module
     */
    getLoadTime(name) {
        return this.loadTimes.get(name);
    }
    /**
     * Get all loaded modules
     */
    getLoadedModules() {
        return Array.from(this.modules.keys());
    }
    /**
     * Get all registered modules
     */
    getRegisteredModules() {
        return Array.from(this.configs.keys());
    }
    /**
     * Preload multiple modules
     */
    async preload(names) {
        const promises = names.map((name) => this.load(name).catch((error) => {
            this.emit('preload-error', { name, error });
        }));
        await Promise.all(promises);
    }
    /**
     * Clear cached module
     */
    clear(name) {
        this.modules.delete(name);
        this.loadTimes.delete(name);
    }
    /**
     * Clear all cached modules
     */
    clearAll() {
        this.modules.clear();
        this.loadTimes.clear();
    }
    /**
     * Get statistics
     */
    getStatistics() {
        const loadTimes = Array.from(this.loadTimes.values());
        return {
            registered: this.configs.size,
            loaded: this.modules.size,
            loading: this.loading.size,
            totalLoadTime: loadTimes.reduce((sum, time) => sum + time, 0),
            averageLoadTime: loadTimes.length > 0
                ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length
                : 0,
            slowestModule: this.getSlowestModule(),
        };
    }
    /**
     * Get slowest module
     */
    getSlowestModule() {
        let slowest = null;
        for (const [name, duration] of this.loadTimes.entries()) {
            if (!slowest || duration > slowest.duration) {
                slowest = { name, duration };
            }
        }
        return slowest;
    }
    /**
     * Create lazy getter function
     */
    createGetter(name) {
        return async () => {
            const result = await this.load(name);
            return result.module;
        };
    }
    /**
     * Unregister module
     */
    unregister(name) {
        this.configs.delete(name);
        this.clear(name);
    }
}
/**
 * Create lazy loader
 */
export function createLazyLoader() {
    return new LazyLoader();
}
/**
 * Global loader instance
 */
let globalLoader = null;
/**
 * Get global loader
 */
export function getGlobalLoader() {
    if (!globalLoader) {
        globalLoader = createLazyLoader();
    }
    return globalLoader;
}
/**
 * Reset global loader
 */
export function resetGlobalLoader() {
    globalLoader = null;
}
//# sourceMappingURL=LazyLoader.js.map