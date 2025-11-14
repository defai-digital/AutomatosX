/**
 * Example Plugin Manager
 * Sprint 5 Day 48: Manage example plugins for tutorials and documentation
 */
import { EventEmitter } from 'events';
/**
 * Example plugin metadata
 */
export interface ExamplePlugin {
    id: string;
    name: string;
    description: string;
    category: 'beginner' | 'intermediate' | 'advanced';
    features: string[];
    sourceUrl: string;
    documentationUrl: string;
    demoCommand?: string;
    tags: string[];
}
/**
 * Plugin installation result
 */
export interface InstallResult {
    pluginId: string;
    success: boolean;
    installPath?: string;
    duration: number;
    error?: string;
}
/**
 * Example plugin manager
 */
export declare class ExamplePluginManager extends EventEmitter {
    private plugins;
    private installed;
    /**
     * Register an example plugin
     */
    register(plugin: ExamplePlugin): void;
    /**
     * Unregister a plugin
     */
    unregister(pluginId: string): boolean;
    /**
     * Get plugin by ID
     */
    getPlugin(pluginId: string): ExamplePlugin | undefined;
    /**
     * List all plugins
     */
    listPlugins(category?: 'beginner' | 'intermediate' | 'advanced'): ExamplePlugin[];
    /**
     * Search plugins by tag
     */
    searchByTag(tag: string): ExamplePlugin[];
    /**
     * Search plugins by feature
     */
    searchByFeature(feature: string): ExamplePlugin[];
    /**
     * Install example plugin
     */
    install(pluginId: string): Promise<InstallResult>;
    /**
     * Uninstall example plugin
     */
    uninstall(pluginId: string): Promise<boolean>;
    /**
     * Check if plugin is installed
     */
    isInstalled(pluginId: string): boolean;
    /**
     * Get installed plugins
     */
    getInstalledPlugins(): ExamplePlugin[];
    /**
     * Get plugin statistics
     */
    getStatistics(): {
        totalPlugins: number;
        installedPlugins: number;
        byCategory: Record<string, number>;
        popularTags: Array<{
            tag: string;
            count: number;
        }>;
    };
    /**
     * Clear all plugins
     */
    clear(): void;
}
/**
 * Create example plugin manager
 */
export declare function createExamplePluginManager(): ExamplePluginManager;
/**
 * Get global plugin manager
 */
export declare function getGlobalManager(): ExamplePluginManager;
/**
 * Reset global plugin manager
 */
export declare function resetGlobalManager(): void;
/**
 * Register built-in example plugins
 */
export declare function registerBuiltInExamples(manager: ExamplePluginManager): void;
//# sourceMappingURL=ExamplePluginManager.d.ts.map