/**
 * MCP Configuration Manager
 *
 * Manages MCP configuration with hot-reload capabilities.
 * Watches for configuration changes and applies them without restart.
 *
 * Phase 4C: Configuration Management
 *
 * @module mcp/config-manager
 */

import { watch, FSWatcher } from 'fs';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import type { UniversalMCPConfig } from './types-common.js';

/**
 * Configuration Change Event
 */
export interface ConfigChangeEvent {
  /** Change type */
  type: 'added' | 'modified' | 'removed';

  /** Configuration path */
  path: string;

  /** New configuration (if available) */
  config?: UniversalMCPConfig;

  /** Change timestamp */
  timestamp: Date;

  /** Validation errors (if any) */
  errors?: string[];
}

/**
 * Configuration Validation Result
 */
export interface ValidationResult {
  /** Whether configuration is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Warnings */
  warnings: string[];
}

/**
 * Configuration Change Handler
 */
export type ConfigChangeHandler = (event: ConfigChangeEvent) => void | Promise<void>;

/**
 * Configuration Manager Options
 */
export interface ConfigManagerOptions {
  /** Configuration file path */
  configPath: string;

  /** Enable hot-reload */
  hotReload?: boolean;

  /** Watch debounce delay (ms) */
  debounceMs?: number;

  /** Enable validation */
  validate?: boolean;

  /** Auto-apply changes */
  autoApply?: boolean;
}

/**
 * MCP Configuration Manager
 *
 * Manages MCP configuration with hot-reload and validation.
 */
export class ConfigManager {
  private configPath: string;
  private hotReload: boolean;
  private debounceMs: number;
  private validate: boolean;
  private autoApply: boolean;

  private currentConfig?: UniversalMCPConfig;
  private watcher?: FSWatcher;
  private changeHandlers: ConfigChangeHandler[] = [];
  private debounceTimeout?: NodeJS.Timeout;

  constructor(options: ConfigManagerOptions) {
    this.configPath = options.configPath;
    this.hotReload = options.hotReload ?? true;
    this.debounceMs = options.debounceMs ?? 1000;
    this.validate = options.validate ?? true;
    this.autoApply = options.autoApply ?? true;
  }

  /**
   * Initialize configuration manager
   *
   * Loads current configuration and starts watching if enabled.
   */
  async initialize(): Promise<UniversalMCPConfig> {
    logger.info('ConfigManager: Initializing', {
      configPath: this.configPath,
      hotReload: this.hotReload,
    });

    // Load initial configuration
    this.currentConfig = await this.loadConfig();

    // Start watching for changes
    if (this.hotReload) {
      this.startWatching();
    }

    logger.info('ConfigManager: Initialized successfully');
    return this.currentConfig;
  }

  /**
   * Get current configuration
   */
  getConfig(): UniversalMCPConfig | undefined {
    return this.currentConfig;
  }

  /**
   * Reload configuration from file
   */
  async reload(): Promise<UniversalMCPConfig> {
    logger.info('ConfigManager: Reloading configuration');

    const newConfig = await this.loadConfig();

    // Validate if enabled
    if (this.validate) {
      const validation = this.validateConfig(newConfig);
      if (!validation.valid) {
        throw new Error(
          `Configuration validation failed: ${validation.errors.join(', ')}`
        );
      }

      if (validation.warnings.length > 0) {
        logger.warn('ConfigManager: Configuration warnings', {
          warnings: validation.warnings,
        });
      }
    }

    // Update current configuration
    const oldConfig = this.currentConfig;
    this.currentConfig = newConfig;

    // Notify handlers
    await this.notifyChange({
      type: 'modified',
      path: this.configPath,
      config: newConfig,
      timestamp: new Date(),
    });

    logger.info('ConfigManager: Configuration reloaded successfully');
    return newConfig;
  }

  /**
   * Register change handler
   *
   * @param handler - Handler function to call on config changes
   */
  onConfigChange(handler: ConfigChangeHandler): void {
    this.changeHandlers.push(handler);
    logger.debug('ConfigManager: Registered change handler', {
      totalHandlers: this.changeHandlers.length,
    });
  }

  /**
   * Unregister change handler
   *
   * @param handler - Handler function to remove
   */
  offConfigChange(handler: ConfigChangeHandler): void {
    const index = this.changeHandlers.indexOf(handler);
    if (index !== -1) {
      this.changeHandlers.splice(index, 1);
      logger.debug('ConfigManager: Unregistered change handler', {
        totalHandlers: this.changeHandlers.length,
      });
    }
  }

  /**
   * Validate configuration
   *
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: UniversalMCPConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (typeof config.enabled !== 'boolean') {
      errors.push('Field "enabled" must be a boolean');
    }

    if (!Array.isArray(config.servers)) {
      errors.push('Field "servers" must be an array');
    } else {
      // Validate each server
      config.servers.forEach((server, index) => {
        if (!server.name) {
          errors.push(`Server ${index}: Missing required field "name"`);
        }

        if (!server.command) {
          errors.push(`Server ${index}: Missing required field "command"`);
        }

        if (!Array.isArray(server.args)) {
          errors.push(`Server ${index}: Field "args" must be an array`);
        }

        // Warn about duplicate names
        const duplicates = config.servers.filter(s => s.name === server.name);
        if (duplicates.length > 1) {
          warnings.push(`Server "${server.name}": Duplicate name detected`);
        }
      });
    }

    // Validate discovery settings
    if (config.discovery) {
      if (
        config.discovery.searchPaths &&
        !Array.isArray(config.discovery.searchPaths)
      ) {
        errors.push('Field "discovery.searchPaths" must be an array');
      }

      if (
        config.discovery.packagePrefixes &&
        !Array.isArray(config.discovery.packagePrefixes)
      ) {
        errors.push('Field "discovery.packagePrefixes" must be an array');
      }
    }

    // Validate security settings
    if (config.security) {
      if (config.security.limits) {
        const { maxServers, maxMemoryPerServer, maxCpuPerServer } =
          config.security.limits;

        if (maxServers !== undefined && (maxServers < 1 || maxServers > 100)) {
          warnings.push('Field "security.limits.maxServers" should be between 1-100');
        }

        if (
          maxMemoryPerServer !== undefined &&
          (maxMemoryPerServer < 10 || maxMemoryPerServer > 10000)
        ) {
          warnings.push(
            'Field "security.limits.maxMemoryPerServer" should be between 10-10000 MB'
          );
        }

        if (
          maxCpuPerServer !== undefined &&
          (maxCpuPerServer < 1 || maxCpuPerServer > 100)
        ) {
          warnings.push(
            'Field "security.limits.maxCpuPerServer" should be between 1-100%'
          );
        }
      }
    }

    // Validate health check settings
    if (config.healthCheck) {
      const { intervalMs, timeoutMs } = config.healthCheck;

      if (intervalMs !== undefined && intervalMs < 1000) {
        warnings.push(
          'Field "healthCheck.intervalMs" should be at least 1000ms'
        );
      }

      if (timeoutMs !== undefined && timeoutMs < 100) {
        warnings.push('Field "healthCheck.timeoutMs" should be at least 100ms');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Stop configuration manager
   *
   * Stops watching for changes and cleans up resources.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      logger.info('ConfigManager: Stopped watching configuration');
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = undefined;
    }

    this.changeHandlers = [];
  }

  // ========== Private Methods ==========

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<UniversalMCPConfig> {
    try {
      if (!existsSync(this.configPath)) {
        logger.warn('ConfigManager: Config file not found, using defaults', {
          path: this.configPath,
        });

        return this.getDefaultConfig();
      }

      const content = await readFile(this.configPath, 'utf-8');
      const config = JSON.parse(content);

      logger.debug('ConfigManager: Loaded configuration', {
        serverCount: config.servers?.length || 0,
      });

      return config;
    } catch (error) {
      logger.error('ConfigManager: Failed to load configuration', {
        path: this.configPath,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): UniversalMCPConfig {
    return {
      enabled: true,
      servers: [],
      discovery: {
        enabled: false,
        searchPaths: [],
        packagePrefixes: ['@modelcontextprotocol/server-'],
      },
      security: {
        limits: {
          maxServers: 10,
          maxMemoryPerServer: 512,
          maxCpuPerServer: 50,
        },
      },
      healthCheck: {
        enabled: true,
        intervalMs: 60000,
        timeoutMs: 5000,
        restartOnFailure: true,
      },
      logging: {
        logServerOutput: false,
        logLevel: 'info',
      },
    };
  }

  /**
   * Start watching configuration file
   */
  private startWatching(): void {
    if (this.watcher) {
      logger.warn('ConfigManager: Already watching configuration');
      return;
    }

    try {
      this.watcher = watch(this.configPath, (eventType, filename) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });

      this.watcher.on('error', (error: Error) => {
        logger.error('ConfigManager: Watcher error', { error: error.message });
      });

      logger.info('ConfigManager: Started watching configuration', {
        path: this.configPath,
      });
    } catch (error) {
      logger.error('ConfigManager: Failed to start watching', {
        path: this.configPath,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle file change event (debounced)
   */
  private handleFileChange(): void {
    // Clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Set new timeout
    this.debounceTimeout = setTimeout(async () => {
      logger.info('ConfigManager: Configuration file changed');

      try {
        if (this.autoApply) {
          await this.reload();
        } else {
          await this.notifyChange({
            type: 'modified',
            path: this.configPath,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        logger.error('ConfigManager: Failed to handle configuration change', {
          error: (error as Error).message,
        });

        await this.notifyChange({
          type: 'modified',
          path: this.configPath,
          timestamp: new Date(),
          errors: [(error as Error).message],
        });
      }
    }, this.debounceMs);
  }

  /**
   * Notify change handlers
   */
  private async notifyChange(event: ConfigChangeEvent): Promise<void> {
    logger.debug('ConfigManager: Notifying change handlers', {
      type: event.type,
      handlerCount: this.changeHandlers.length,
    });

    await Promise.allSettled(
      this.changeHandlers.map(handler => handler(event))
    );
  }
}

/**
 * Default config manager instance
 */
let defaultManager: ConfigManager | undefined;

/**
 * Get default config manager
 */
export function getConfigManager(configPath: string): ConfigManager {
  if (!defaultManager) {
    defaultManager = new ConfigManager({ configPath });
  }
  return defaultManager;
}

/**
 * Initialize default config manager
 */
export async function initializeConfigManager(
  options: ConfigManagerOptions
): Promise<UniversalMCPConfig> {
  if (!defaultManager) {
    defaultManager = new ConfigManager(options);
  }
  return defaultManager.initialize();
}
