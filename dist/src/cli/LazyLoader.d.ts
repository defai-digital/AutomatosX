/**
 * Lazy Loader
 * Sprint 5 Day 44: Lazy loading for CLI dependencies to optimize startup
 */
import { EventEmitter } from 'events';
/**
 * Lazy module configuration
 */
export interface LazyModuleConfig {
    path: string;
    preload?: boolean;
    timeout?: number;
}
/**
 * Load result
 */
export interface LoadResult<T = any> {
    module: T;
    duration: number;
    cached: boolean;
}
/**
 * Lazy loader for optimizing module loading
 */
export declare class LazyLoader extends EventEmitter {
    private modules;
    private loading;
    private configs;
    private loadTimes;
    /**
     * Register a lazy module
     */
    register(name: string, config: LazyModuleConfig): void;
    /**
     * Load a module
     */
    load<T = any>(name: string): Promise<LoadResult<T>>;
    /**
     * Perform module load
     */
    private performLoad;
    /**
     * Get a module (throws if not loaded)
     */
    get<T = any>(name: string): T;
    /**
     * Check if module is loaded
     */
    isLoaded(name: string): boolean;
    /**
     * Check if module is loading
     */
    isLoading(name: string): boolean;
    /**
     * Get load time for a module
     */
    getLoadTime(name: string): number | undefined;
    /**
     * Get all loaded modules
     */
    getLoadedModules(): string[];
    /**
     * Get all registered modules
     */
    getRegisteredModules(): string[];
    /**
     * Preload multiple modules
     */
    preload(names: string[]): Promise<void>;
    /**
     * Clear cached module
     */
    clear(name: string): void;
    /**
     * Clear all cached modules
     */
    clearAll(): void;
    /**
     * Get statistics
     */
    getStatistics(): LoaderStatistics;
    /**
     * Get slowest module
     */
    private getSlowestModule;
    /**
     * Create lazy getter function
     */
    createGetter<T = any>(name: string): () => Promise<T>;
    /**
     * Unregister module
     */
    unregister(name: string): void;
}
/**
 * Loader statistics
 */
export interface LoaderStatistics {
    registered: number;
    loaded: number;
    loading: number;
    totalLoadTime: number;
    averageLoadTime: number;
    slowestModule: {
        name: string;
        duration: number;
    } | null;
}
/**
 * Create lazy loader
 */
export declare function createLazyLoader(): LazyLoader;
/**
 * Get global loader
 */
export declare function getGlobalLoader(): LazyLoader;
/**
 * Reset global loader
 */
export declare function resetGlobalLoader(): void;
//# sourceMappingURL=LazyLoader.d.ts.map