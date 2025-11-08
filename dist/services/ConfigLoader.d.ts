/**
 * ConfigLoader.ts
 *
 * Service for loading and merging configurations from multiple sources
 * with hierarchy: defaults → global → project → environment variables
 */
import { type AutomatosXConfig, type PartialConfig, type ConfigWithMetadata, type ValidationResult } from '../types/Config.js';
export declare class ConfigLoader {
    private defaultConfig;
    private globalConfigPath;
    constructor();
    /**
     * Load configuration with full hierarchy
     * @param projectRoot - Project root directory (optional)
     * @returns Configuration with metadata about sources
     */
    load(projectRoot?: string): ConfigWithMetadata;
    /**
     * Load global configuration from user's home directory
     */
    private loadGlobalConfig;
    /**
     * Load project configuration from project root
     */
    private loadProjectConfig;
    /**
     * Load configuration from environment variables
     * Supports: AUTOMATOSX_DATABASE_PATH, AUTOMATOSX_SEARCH_DEFAULT_LIMIT, etc.
     */
    private loadEnvConfig;
    /**
     * Convert environment variable key to config path
     * Example: SEARCH_DEFAULT_LIMIT → ['search', 'defaultLimit']
     */
    private envKeyToConfigPath;
    /**
     * Check if a key is a top-level configuration key
     */
    private isTopLevelKey;
    /**
     * Parse environment variable value to appropriate type
     */
    private parseEnvValue;
    /**
     * Set nested value in object using path array
     */
    private setNestedValue;
    /**
     * Deep merge two configurations
     * Later config takes precedence for conflicts
     */
    private mergeConfigs;
    /**
     * Recursively merge objects
     */
    private deepMerge;
    /**
     * Mark all fields in sources map with given source
     */
    private markAllFields;
    /**
     * Mark fields from partial config with given source
     */
    private markConfigFields;
    /**
     * Get all dot-notation paths in a config object
     */
    private getAllConfigPaths;
    /**
     * Validate a configuration object
     * Partial configs are merged with defaults before validation
     */
    validate(config: unknown): ValidationResult;
    /**
     * Save configuration to a file
     * @param config - Configuration to save
     * @param filePath - File path to save to
     */
    save(config: AutomatosXConfig | PartialConfig, filePath: string): void;
    /**
     * Initialize a new project configuration file
     */
    initProjectConfig(projectRoot: string): string;
    /**
     * Get the default configuration
     */
    getDefault(): AutomatosXConfig;
}
//# sourceMappingURL=ConfigLoader.d.ts.map