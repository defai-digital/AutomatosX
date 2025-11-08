/**
 * ConfigLoader.ts
 *
 * Service for loading and merging configurations from multiple sources
 * with hierarchy: defaults → global → project → environment variables
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  AutomatosXConfigSchema,
  PartialConfigSchema,
  type AutomatosXConfig,
  type PartialConfig,
  type ConfigWithMetadata,
  type ValidationResult,
  ConfigSource,
} from '../types/Config.js';
import { z } from 'zod';

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = [
  'automatosx.config.json',
  '.automatosx.json',
  'automatosx.json',
];

/**
 * Environment variable prefix
 */
const ENV_PREFIX = 'AUTOMATOSX_';

export class ConfigLoader {
  private defaultConfig: AutomatosXConfig;
  private globalConfigPath: string;

  constructor() {
    // Initialize with default configuration
    // Pass empty objects to trigger nested defaults
    this.defaultConfig = AutomatosXConfigSchema.parse({
      search: {},
      indexing: {},
      database: {},
      performance: {},
      logging: {},
    });
    this.globalConfigPath = path.join(
      os.homedir(),
      '.automatosx',
      'config.json'
    );
  }

  /**
   * Load configuration with full hierarchy
   * @param projectRoot - Project root directory (optional)
   * @returns Configuration with metadata about sources
   */
  load(projectRoot?: string): ConfigWithMetadata {
    const sources = new Map<string, ConfigSource>();
    const mergedFrom: ConfigSource[] = [];

    // Start with default configuration
    let config: AutomatosXConfig = { ...this.defaultConfig };
    mergedFrom.push(ConfigSource.DEFAULT);
    this.markAllFields(sources, ConfigSource.DEFAULT);

    // Merge global configuration
    const globalConfig = this.loadGlobalConfig();
    if (globalConfig) {
      config = this.mergeConfigs(config, globalConfig);
      mergedFrom.push(ConfigSource.GLOBAL);
      this.markConfigFields(sources, globalConfig, ConfigSource.GLOBAL);
    }

    // Merge project configuration
    if (projectRoot) {
      const projectConfig = this.loadProjectConfig(projectRoot);
      if (projectConfig) {
        config = this.mergeConfigs(config, projectConfig);
        mergedFrom.push(ConfigSource.PROJECT);
        this.markConfigFields(sources, projectConfig, ConfigSource.PROJECT);
      }
    }

    // Merge environment variables
    const envConfig = this.loadEnvConfig();
    if (envConfig) {
      config = this.mergeConfigs(config, envConfig);
      mergedFrom.push(ConfigSource.ENV);
      this.markConfigFields(sources, envConfig, ConfigSource.ENV);
    }

    return {
      config,
      sources,
      mergedFrom,
    };
  }

  /**
   * Load global configuration from user's home directory
   */
  private loadGlobalConfig(): PartialConfig | null {
    try {
      if (fs.existsSync(this.globalConfigPath)) {
        const content = fs.readFileSync(this.globalConfigPath, 'utf-8');
        const parsed = JSON.parse(content);
        return PartialConfigSchema.parse(parsed);
      }
    } catch (error) {
      console.warn(`Failed to load global config: ${error}`);
    }
    return null;
  }

  /**
   * Load project configuration from project root
   */
  private loadProjectConfig(projectRoot: string): PartialConfig | null {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(projectRoot, fileName);
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          const parsed = JSON.parse(content);
          return PartialConfigSchema.parse(parsed);
        }
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}: ${error}`);
      }
    }
    return null;
  }

  /**
   * Load configuration from environment variables
   * Supports: AUTOMATOSX_DATABASE_PATH, AUTOMATOSX_SEARCH_DEFAULT_LIMIT, etc.
   */
  private loadEnvConfig(): PartialConfig | null {
    const envConfig: any = {};
    let hasAnyConfig = false;

    // Scan all environment variables with our prefix
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(ENV_PREFIX) && value !== undefined) {
        const remaining = key.slice(ENV_PREFIX.length);
        const configPath = this.envKeyToConfigPath(remaining);
        this.setNestedValue(envConfig, configPath, this.parseEnvValue(value));
        hasAnyConfig = true;
      }
    }

    if (!hasAnyConfig) {
      return null;
    }

    try {
      return PartialConfigSchema.parse(envConfig);
    } catch (error) {
      console.warn(`Failed to parse environment config: ${error}`);
      return null;
    }
  }

  /**
   * Convert environment variable key to config path
   * Example: SEARCH_DEFAULT_LIMIT → ['search', 'defaultLimit']
   */
  private envKeyToConfigPath(envKey: string): string[] {
    const parts = envKey.split('_');
    const result: string[] = [];

    let i = 0;
    while (i < parts.length) {
      // Check if this part and the next should be combined into camelCase
      // e.g., DEFAULT_LIMIT → defaultLimit
      const currentLower = parts[i].toLowerCase();

      if (i === 0) {
        // First part stays as-is (lowercase)
        result.push(currentLower);
        i++;
      } else {
        // Subsequent parts: check if we should camelCase with previous
        // We'll combine if it looks like a compound word
        // For now, simple approach: combine consecutive parts until we hit a known top-level key
        const combined = currentLower.charAt(0).toUpperCase() + currentLower.slice(1);

        // If the last result entry doesn't look like a top-level key, combine
        if (result.length > 0 && !this.isTopLevelKey(result[result.length - 1])) {
          result[result.length - 1] += combined;
        } else {
          result.push(currentLower);
        }
        i++;
      }
    }

    return result;
  }

  /**
   * Check if a key is a top-level configuration key
   */
  private isTopLevelKey(key: string): boolean {
    return ['version', 'languages', 'search', 'indexing', 'database', 'performance', 'logging'].includes(key);
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(value: string): any {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;

    // JSON array or object
    if (value.startsWith('[') || value.startsWith('{')) {
      try {
        return JSON.parse(value);
      } catch {
        // Fall through to string
      }
    }

    // String
    return value;
  }

  /**
   * Set nested value in object using path array
   */
  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  /**
   * Deep merge two configurations
   * Later config takes precedence for conflicts
   */
  private mergeConfigs(
    base: AutomatosXConfig,
    override: PartialConfig
  ): AutomatosXConfig {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone
    this.deepMerge(merged, override);
    return merged;
  }

  /**
   * Recursively merge objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] === undefined || source[key] === null) {
        continue;
      }

      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        key in target &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Mark all fields in sources map with given source
   */
  private markAllFields(
    sources: Map<string, ConfigSource>,
    source: ConfigSource
  ): void {
    const allPaths = this.getAllConfigPaths(this.defaultConfig);
    for (const path of allPaths) {
      sources.set(path, source);
    }
  }

  /**
   * Mark fields from partial config with given source
   */
  private markConfigFields(
    sources: Map<string, ConfigSource>,
    config: PartialConfig,
    source: ConfigSource
  ): void {
    const paths = this.getAllConfigPaths(config);
    for (const path of paths) {
      sources.set(path, source);
    }
  }

  /**
   * Get all dot-notation paths in a config object
   */
  private getAllConfigPaths(obj: any, prefix: string = ''): string[] {
    const paths: string[] = [];
    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        paths.push(path);
        paths.push(...this.getAllConfigPaths(obj[key], path));
      } else {
        paths.push(path);
      }
    }
    return paths;
  }

  /**
   * Validate a configuration object
   * Partial configs are merged with defaults before validation
   */
  validate(config: unknown): ValidationResult {
    try {
      // First validate it's a valid partial config
      const partialConfig = PartialConfigSchema.parse(config);

      // Merge with defaults to fill in missing fields
      const completeConfig = this.mergeConfigs(this.defaultConfig, partialConfig);

      // Validate the complete config
      const validatedConfig = AutomatosXConfigSchema.parse(completeConfig);

      return {
        valid: true,
        config: validatedConfig,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error,
        };
      }
      throw error;
    }
  }

  /**
   * Save configuration to a file
   * @param config - Configuration to save
   * @param filePath - File path to save to
   */
  save(config: AutomatosXConfig | PartialConfig, filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Initialize a new project configuration file
   */
  initProjectConfig(projectRoot: string): string {
    const configPath = path.join(projectRoot, 'automatosx.config.json');
    if (fs.existsSync(configPath)) {
      throw new Error(`Configuration file already exists: ${configPath}`);
    }

    // Create a minimal starter config
    const starterConfig: PartialConfig = {
      version: '1.0.0',
      languages: {
        typescript: { enabled: true },
        javascript: { enabled: true },
        python: { enabled: true },
      },
      indexing: {
        excludePatterns: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
        ],
      },
    };

    this.save(starterConfig, configPath);
    return configPath;
  }

  /**
   * Get the default configuration
   */
  getDefault(): AutomatosXConfig {
    return { ...this.defaultConfig };
  }
}
