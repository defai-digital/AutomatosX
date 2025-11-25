import { Config } from '@ax/schemas';

/**
 * Configuration Loader
 *
 * Loads and validates AutomatosX configuration from ax.config.json
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface ConfigLoaderOptions {
    /** Base directory to search for config */
    baseDir?: string;
    /** Config file name (default: ax.config.json) */
    fileName?: string;
    /** Environment variable prefix for overrides */
    envPrefix?: string;
    /** Whether to search parent directories */
    searchParents?: boolean;
}
interface LoadedConfig {
    config: Config;
    configPath: string | null;
    source: 'file' | 'env' | 'default';
}
/**
 * Load configuration from file and environment
 */
declare function loadConfig(options?: ConfigLoaderOptions): Promise<LoadedConfig>;
/**
 * Load config synchronously (uses defaults only)
 */
declare function loadConfigSync(): Config;
/**
 * Get default configuration
 */
declare function getDefaultConfig(): Config;
/**
 * Validate configuration object
 */
declare function isValidConfig(config: unknown): config is Config;

export { type ConfigLoaderOptions, type LoadedConfig, getDefaultConfig, isValidConfig, loadConfig, loadConfigSync };
