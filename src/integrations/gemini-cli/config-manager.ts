/**
 * Gemini CLI Integration - Configuration Manager
 *
 * Handles reading, merging, and validating Gemini CLI configurations.
 *
 * @module integrations/gemini-cli/config-manager
 */

import type { GeminiConfig, ValidationResult } from './types.js';
import { GeminiCLIError, GeminiCLIErrorType } from './types.js';
import {
  readJsonFile,
  getUserConfigPath,
  getProjectConfigPath,
  fileExists,
} from './utils/file-reader.js';
import { validateGeminiConfig } from './utils/validation.js';

/**
 * Cache entry for configuration
 */
interface ConfigCacheEntry {
  data: GeminiConfig;
  timestamp: number;
}

/**
 * Configuration Manager for Gemini CLI
 *
 * Handles reading, merging, and caching of Gemini CLI configurations
 * from user-level and project-level settings.
 */
export class ConfigManager {
  private cache = new Map<string, ConfigCacheEntry>();
  private readonly ttl: number;
  private pendingReads = new Map<string, Promise<GeminiConfig>>();
  private pendingMerge: Promise<GeminiConfig> | null = null;

  /**
   * Create a new ConfigManager
   *
   * @param ttl - Cache time-to-live in milliseconds
   *              Can be overridden via GEMINI_CLI_CACHE_TTL env var
   *              Default: 60000ms (1 minute)
   */
  constructor(ttl?: number) {
    // Allow TTL override via environment variable
    const envTtl = process.env.GEMINI_CLI_CACHE_TTL;
    const parsedTtl = envTtl ? parseInt(envTtl, 10) : NaN;
    this.ttl = ttl ?? (Number.isFinite(parsedTtl) ? parsedTtl : 60000);
  }

  /**
   * Read user-level Gemini CLI configuration
   *
   * @returns User configuration or empty object if not found
   */
  async readUserConfig(): Promise<GeminiConfig> {
    const path = getUserConfigPath();
    return this.readConfig(path, 'user');
  }

  /**
   * Read project-level Gemini CLI configuration
   *
   * @returns Project configuration or empty object if not found
   */
  async readProjectConfig(): Promise<GeminiConfig> {
    const path = getProjectConfigPath();
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
  ): Promise<GeminiConfig> {
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
          const emptyConfig: GeminiConfig = {};
          this.cache.set(scope, { data: emptyConfig, timestamp: Date.now() });
          return emptyConfig;
        }

        // Read and parse configuration
        const config = await readJsonFile<GeminiConfig>(path);

        // Cache the result
        this.cache.set(scope, { data: config, timestamp: Date.now() });

        return config;
      } catch (error) {
        if (error instanceof GeminiCLIError) {
          throw error;
        }

        throw new GeminiCLIError(
          GeminiCLIErrorType.INVALID_CONFIG,
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
   * For mcpServers, all servers are merged (no overwriting unless same name).
   *
   * @param configs - Configurations to merge (in order of increasing precedence)
   * @returns Merged configuration
   */
  mergeConfigs(...configs: GeminiConfig[]): GeminiConfig {
    const merged: GeminiConfig = {};

    for (const config of configs) {
      // Merge top-level scalar properties
      if (config.model !== undefined) {
        merged.model = config.model;
      }

      // Special handling for mcpServers - merge all servers
      if (config.mcpServers) {
        merged.mcpServers = {
          ...(merged.mcpServers || {}),
          ...config.mcpServers,
        };
      }

      // Deep merge for mcp configuration
      if (config.mcp) {
        merged.mcp = merged.mcp || {};

        // Merge discovery settings
        if (config.mcp.discovery !== undefined) {
          merged.mcp.discovery = {
            ...(merged.mcp.discovery || {}),
            ...config.mcp.discovery,
          };
        }

        // Handle explicit undefined to clear settings
        if ('discovery' in config.mcp && config.mcp.discovery === undefined) {
          delete merged.mcp.discovery;
        }
      }
    }

    return merged;
  }

  /**
   * Get merged configuration from user and project levels
   *
   * Project-level configuration takes precedence over user-level.
   * Gracefully handles errors in either config source.
   *
   * @returns Merged configuration
   */
  async getMergedConfig(): Promise<GeminiConfig> {
    // Check if there's already a pending merge operation
    if (this.pendingMerge) {
      return this.pendingMerge;
    }

    // Check cache for merged config
    const cached = this.cache.get('merged');
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // Create new merge operation
    this.pendingMerge = (async () => {
      try {
        const results = await Promise.allSettled([
          this.readUserConfig(),
          this.readProjectConfig(),
        ]);

        const userConfig =
          results[0].status === 'fulfilled' ? results[0].value : {};
        const projectConfig =
          results[1].status === 'fulfilled' ? results[1].value : {};

        // Log any errors but continue with available configs
        if (results[0].status === 'rejected') {
          console.warn('Failed to read user config:', results[0].reason);
        }
        if (results[1].status === 'rejected') {
          console.warn('Failed to read project config:', results[1].reason);
        }

        const merged = this.mergeConfigs(userConfig, projectConfig);

        // Cache the merged result
        this.cache.set('merged', { data: merged, timestamp: Date.now() });

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
  validateConfig(config: GeminiConfig): ValidationResult {
    return validateGeminiConfig(config);
  }

  /**
   * Read and validate user configuration
   *
   * @param throwOnError - Throw error if validation fails (default: false)
   * @returns User configuration
   * @throws {GeminiCLIError} If validation fails and throwOnError is true
   */
  async readAndValidateUserConfig(
    throwOnError: boolean = false
  ): Promise<GeminiConfig> {
    const config = await this.readUserConfig();
    const result = this.validateConfig(config);

    if (!result.valid && throwOnError) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.VALIDATION_ERROR,
        'User configuration validation failed',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return config;
  }

  /**
   * Read and validate project configuration
   *
   * @param throwOnError - Throw error if validation fails (default: false)
   * @returns Project configuration
   * @throws {GeminiCLIError} If validation fails and throwOnError is true
   */
  async readAndValidateProjectConfig(
    throwOnError: boolean = false
  ): Promise<GeminiConfig> {
    const config = await this.readProjectConfig();
    const result = this.validateConfig(config);

    if (!result.valid && throwOnError) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.VALIDATION_ERROR,
        'Project configuration validation failed',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return config;
  }

  /**
   * Read and validate merged configuration
   *
   * @param throwOnError - Throw error if validation fails (default: false)
   * @returns Merged configuration
   * @throws {GeminiCLIError} If validation fails and throwOnError is true
   */
  async readAndValidateMergedConfig(
    throwOnError: boolean = false
  ): Promise<GeminiConfig> {
    const config = await this.getMergedConfig();
    const result = this.validateConfig(config);

    if (!result.valid && throwOnError) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.VALIDATION_ERROR,
        'Merged configuration validation failed',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return config;
  }

  /**
   * Invalidate cache for a specific scope
   *
   * @param scope - Scope to invalidate ('user', 'project', or 'all')
   */
  invalidateCache(scope: 'user' | 'project' | 'all' = 'all'): void {
    if (scope === 'all') {
      this.cache.clear();
      this.pendingMerge = null;
    } else {
      this.cache.delete(scope);
      // Clear merged cache when user or project config changes
      this.cache.delete('merged');
      this.pendingMerge = null;
    }
  }

  /**
   * Check if user configuration exists
   *
   * @returns True if user configuration file exists
   */
  async hasUserConfig(): Promise<boolean> {
    return fileExists(getUserConfigPath());
  }

  /**
   * Check if project configuration exists
   *
   * @returns True if project configuration file exists
   */
  async hasProjectConfig(): Promise<boolean> {
    return fileExists(getProjectConfigPath());
  }

  /**
   * Get configuration statistics
   *
   * Reads config once to ensure consistent snapshot.
   *
   * @returns Configuration statistics
   */
  async getConfigStats(): Promise<{
    hasUserConfig: boolean;
    hasProjectConfig: boolean;
    userMCPServers: number;
    projectMCPServers: number;
    totalMCPServers: number;
  }> {
    // Read config once using Promise.allSettled to get consistent snapshot
    // This prevents race conditions from multiple separate reads
    const results = await Promise.allSettled([
      this.readUserConfig(),
      this.readProjectConfig(),
    ]);

    const userConfig = results[0].status === 'fulfilled' ? results[0].value : {};
    const projectConfig = results[1].status === 'fulfilled' ? results[1].value : {};

    // Check file existence
    const [hasUser, hasProject] = await Promise.all([
      this.hasUserConfig(),
      this.hasProjectConfig(),
    ]);

    // Calculate merged config from the same snapshot
    const merged = this.mergeConfigs(userConfig, projectConfig);

    return {
      hasUserConfig: hasUser,
      hasProjectConfig: hasProject,
      userMCPServers: Object.keys(userConfig.mcpServers || {}).length,
      projectMCPServers: Object.keys(projectConfig.mcpServers || {}).length,
      totalMCPServers: Object.keys(merged.mcpServers || {}).length,
    };
  }
}

/**
 * Default ConfigManager instance with 1-minute cache
 */
export const defaultConfigManager = new ConfigManager(60000);
