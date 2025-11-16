/**
 * Claude Code Integration - Configuration Manager
 *
 * Handles reading, merging, and validating Claude Code configurations.
 *
 * @module integrations/claude-code/config-manager
 */

import type { ClaudeConfig, ValidationResult, ConfigScope } from './types.js';
import { ClaudeCodeError, ClaudeCodeErrorType } from './types.js';
import {
  readJsonFile,
  getGlobalConfigPath,
  getProjectConfigPath,
  fileExists,
} from './utils/file-reader.js';
import { validateClaudeConfig } from './utils/validation.js';

/**
 * Cache entry for configuration
 */
interface ConfigCacheEntry {
  data: ClaudeConfig;
  timestamp: number;
}

/**
 * Configuration Manager for Claude Code
 *
 * Handles reading, merging, and caching of Claude Code configurations
 * from global and project-level settings.
 */
export class ConfigManager {
  private cache = new Map<string, ConfigCacheEntry>();
  private readonly ttl: number;
  private pendingReads = new Map<string, Promise<ClaudeConfig>>();
  private pendingMerge: Promise<ClaudeConfig> | null = null;

  /**
   * Create a new ConfigManager
   *
   * @param ttl - Cache time-to-live in milliseconds
   *              Can be overridden via CLAUDE_CODE_CACHE_TTL env var
   *              Default: 60000ms (1 minute)
   */
  constructor(ttl?: number) {
    // Allow TTL override via environment variable
    const envTtl = process.env.CLAUDE_CODE_CACHE_TTL;
    const parsedTtl = envTtl ? parseInt(envTtl, 10) : NaN;
    this.ttl = ttl ?? (Number.isFinite(parsedTtl) ? parsedTtl : 60000);
  }

  /**
   * Read global Claude Code configuration
   *
   * @returns Global configuration or empty object if not found
   */
  async readGlobalConfig(): Promise<ClaudeConfig> {
    const path = getGlobalConfigPath();
    return this.readConfig(path, 'global');
  }

  /**
   * Read project-level Claude Code configuration
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @returns Project configuration or empty object if not found
   */
  async readProjectConfig(projectDir?: string): Promise<ClaudeConfig> {
    const path = getProjectConfigPath(projectDir);
    return this.readConfig(path, 'project');
  }

  /**
   * Read configuration from a specific path with caching
   *
   * @param path - Configuration file path
   * @param scope - Configuration scope for cache key
   * @returns Configuration object
   * @private
   */
  private async readConfig(
    path: string,
    scope: string
  ): Promise<ClaudeConfig> {
    // Check cache
    const cached = this.cache.get(scope);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // Check if there's already a pending read for this scope
    const pendingRead = this.pendingReads.get(scope);
    if (pendingRead) {
      return pendingRead;
    }

    // Create new read operation
    const readOperation = (async () => {
      try {
        // Check if file exists
        const exists = await fileExists(path);
        if (!exists) {
          // Return empty config if file doesn't exist
          const emptyConfig: ClaudeConfig = {};
          this.cache.set(scope, { data: emptyConfig, timestamp: Date.now() });
          return emptyConfig;
        }

        // Read and parse configuration
        const config = await readJsonFile<ClaudeConfig>(path);

        // Cache the result
        this.cache.set(scope, { data: config, timestamp: Date.now() });

        return config;
      } catch (error) {
        if (error instanceof ClaudeCodeError) {
          throw error;
        }

        throw new ClaudeCodeError(
          ClaudeCodeErrorType.INVALID_CONFIG,
          `Failed to read configuration from ${path}`,
          { path, originalError: error }
        );
      } finally {
        // Remove from pending reads after completion
        this.pendingReads.delete(scope);
      }
    })();

    // Track this read operation
    this.pendingReads.set(scope, readOperation);

    return readOperation;
  }

  /**
   * Merge multiple configurations with precedence
   *
   * Later configurations in the array take precedence over earlier ones.
   *
   * @param configs - Configurations to merge (in order of increasing precedence)
   * @returns Merged configuration
   */
  mergeConfigs(...configs: ClaudeConfig[]): ClaudeConfig {
    const merged: ClaudeConfig = {};

    for (const config of configs) {
      // Merge model settings
      if (config.model !== undefined) {
        merged.model = {
          ...(merged.model || {}),
          ...config.model,
        };
      }

      // Merge instructions
      if (config.instructions !== undefined) {
        merged.instructions = {
          ...(merged.instructions || {}),
          ...config.instructions,
        };
      }

      // Merge other properties
      for (const [key, value] of Object.entries(config)) {
        if (key !== 'model' && key !== 'instructions') {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Get merged configuration from global and project levels
   *
   * Project-level configuration takes precedence over global.
   * Gracefully handles errors in either config source.
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @returns Merged configuration
   */
  async getMergedConfig(projectDir?: string): Promise<ClaudeConfig> {
    // Check if there's already a pending merge operation
    if (this.pendingMerge) {
      return this.pendingMerge;
    }

    // Check cache for merged config
    const cacheKey = projectDir ? `merged:${projectDir}` : 'merged';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // Create new merge operation
    this.pendingMerge = (async () => {
      try {
        const results = await Promise.allSettled([
          this.readGlobalConfig(),
          this.readProjectConfig(projectDir),
        ]);

        const globalConfig =
          results[0].status === 'fulfilled' ? results[0].value : {};
        const projectConfig =
          results[1].status === 'fulfilled' ? results[1].value : {};

        // Log any errors but continue with available configs
        if (results[0].status === 'rejected') {
          console.warn('Failed to read global config:', results[0].reason);
        }
        if (results[1].status === 'rejected') {
          console.warn('Failed to read project config:', results[1].reason);
        }

        const merged = this.mergeConfigs(globalConfig, projectConfig);

        // Cache the merged result
        this.cache.set(cacheKey, { data: merged, timestamp: Date.now() });

        return merged;
      } finally {
        // Clear pending merge
        this.pendingMerge = null;
      }
    })();

    return this.pendingMerge;
  }

  /**
   * Validate a configuration
   *
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: ClaudeConfig): ValidationResult {
    return validateClaudeConfig(config);
  }

  /**
   * Read and validate global configuration
   *
   * @param throwOnError - Throw error if validation fails (default: false)
   * @returns Global configuration
   * @throws {ClaudeCodeError} If validation fails and throwOnError is true
   */
  async readAndValidateGlobalConfig(
    throwOnError: boolean = false
  ): Promise<ClaudeConfig> {
    const config = await this.readGlobalConfig();
    const result = this.validateConfig(config);

    if (!result.valid && throwOnError) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.VALIDATION_ERROR,
        'Global configuration validation failed',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return config;
  }

  /**
   * Read and validate project configuration
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @param throwOnError - Throw error if validation fails (default: false)
   * @returns Project configuration
   * @throws {ClaudeCodeError} If validation fails and throwOnError is true
   */
  async readAndValidateProjectConfig(
    projectDir?: string,
    throwOnError: boolean = false
  ): Promise<ClaudeConfig> {
    const config = await this.readProjectConfig(projectDir);
    const result = this.validateConfig(config);

    if (!result.valid && throwOnError) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.VALIDATION_ERROR,
        'Project configuration validation failed',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return config;
  }

  /**
   * Read and validate merged configuration
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @param throwOnError - Throw error if validation fails (default: false)
   * @returns Merged configuration
   * @throws {ClaudeCodeError} If validation fails and throwOnError is true
   */
  async readAndValidateMergedConfig(
    projectDir?: string,
    throwOnError: boolean = false
  ): Promise<ClaudeConfig> {
    const config = await this.getMergedConfig(projectDir);
    const result = this.validateConfig(config);

    if (!result.valid && throwOnError) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.VALIDATION_ERROR,
        'Merged configuration validation failed',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return config;
  }

  /**
   * Invalidate cache for a specific scope
   *
   * @param scope - Scope to invalidate ('global', 'project', or 'all')
   */
  invalidateCache(scope: ConfigScope | 'all' = 'all'): void {
    if (scope === 'all') {
      this.cache.clear();
      this.pendingMerge = null;
    } else {
      this.cache.delete(scope);
      // Clear all merged caches when global or project config changes
      for (const key of this.cache.keys()) {
        if (key.startsWith('merged')) {
          this.cache.delete(key);
        }
      }
      this.pendingMerge = null;
    }
  }

  /**
   * Check if global configuration exists
   *
   * @returns True if global configuration file exists
   */
  async hasGlobalConfig(): Promise<boolean> {
    return fileExists(getGlobalConfigPath());
  }

  /**
   * Check if project configuration exists
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @returns True if project configuration file exists
   */
  async hasProjectConfig(projectDir?: string): Promise<boolean> {
    return fileExists(getProjectConfigPath(projectDir));
  }

  /**
   * Get configuration statistics
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @returns Configuration statistics
   */
  async getConfigStats(projectDir?: string): Promise<{
    hasGlobalConfig: boolean;
    hasProjectConfig: boolean;
  }> {
    const [hasGlobal, hasProject] = await Promise.all([
      this.hasGlobalConfig(),
      this.hasProjectConfig(projectDir),
    ]);

    return {
      hasGlobalConfig: hasGlobal,
      hasProjectConfig: hasProject,
    };
  }
}

/**
 * Default ConfigManager instance with 1-minute cache
 */
export const defaultConfigManager = new ConfigManager(60000);
