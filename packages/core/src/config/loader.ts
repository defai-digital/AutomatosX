/**
 * Configuration Loader
 *
 * Loads and validates AutomatosX configuration from ax.config.json
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  type Config,
  ConfigSchema,
  DEFAULT_CONFIG,
  validateConfig,
  mergeConfig,
} from '@ax/schemas';

// =============================================================================
// Types
// =============================================================================

export interface ConfigLoaderOptions {
  /** Base directory to search for config */
  baseDir?: string;
  /** Config file name (default: ax.config.json) */
  fileName?: string;
  /** Environment variable prefix for overrides */
  envPrefix?: string;
  /** Whether to search parent directories */
  searchParents?: boolean;
}

export interface LoadedConfig {
  config: Config;
  configPath: string | null;
  source: 'file' | 'env' | 'default';
}

// =============================================================================
// Constants
// =============================================================================

const CONFIG_FILE_NAMES = ['ax.config.json', 'ax.config.yaml', 'ax.config.yml'];
const MAX_PARENT_SEARCH = 10;

/** Maximum allowed timeout in milliseconds (1 hour) */
const MAX_TIMEOUT_MS = 3600000;

/** Debug environment variable true values */
const DEBUG_TRUE_VALUES = ['true', '1'];

// =============================================================================
// Config Loader
// =============================================================================

/**
 * Find config file in directory or parent directories
 */
async function findConfigFile(
  startDir: string,
  searchParents: boolean = true
): Promise<string | null> {
  let currentDir = resolve(startDir);
  let searchCount = 0;

  while (searchCount < MAX_PARENT_SEARCH) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, fileName);
      try {
        const stats = await stat(configPath);
        if (stats.isFile()) {
          return configPath;
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    if (!searchParents) {
      break;
    }

    // Move to parent directory
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
    searchCount++;
  }

  return null;
}

/**
 * Parse config file content
 */
async function parseConfigFile(configPath: string): Promise<unknown> {
  const content = await readFile(configPath, 'utf-8');

  if (configPath.endsWith('.json')) {
    return JSON.parse(content);
  } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
    return parseYaml(content);
  }

  throw new Error(`Unsupported config file format: ${configPath}`);
}

/**
 * Get environment variable overrides
 */
function getEnvOverrides(prefix: string = 'AX'): Partial<Config> {
  const overrides: Record<string, unknown> = {};

  // Provider override
  const provider = process.env[`${prefix}_PROVIDER`];
  if (provider) {
    overrides['providers'] = { default: provider };
  }

  // Debug mode
  const debug = process.env[`${prefix}_DEBUG`];
  if (debug && DEBUG_TRUE_VALUES.includes(debug)) {
    overrides['logging'] = { level: 'debug' };
  }

  // Timeout override (validated: 1ms to 1 hour)
  const timeout = process.env[`${prefix}_TIMEOUT`];
  if (timeout) {
    // Validate format: must be purely numeric (no trailing characters like "123abc")
    if (!/^\d+$/.test(timeout.trim())) {
      console.warn(
        `[ax/config] Invalid ${prefix}_TIMEOUT format "${timeout}". ` +
          `Expected numeric value only. Using default.`
      );
    } else {
      const timeoutMs = parseInt(timeout, 10);
      // Validate: must be positive number between 1ms and 1 hour
      if (!isNaN(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_TIMEOUT_MS) {
        overrides['execution'] = { timeout: timeoutMs };
      } else {
        console.warn(
          `[ax/config] Invalid ${prefix}_TIMEOUT value "${timeout}". ` +
            `Expected positive integer between 1 and ${MAX_TIMEOUT_MS} (ms). Using default.`
        );
      }
    }
  }

  return overrides as Partial<Config>;
}

/**
 * Load configuration from file and environment
 */
export async function loadConfig(options: ConfigLoaderOptions = {}): Promise<LoadedConfig> {
  const {
    baseDir = process.cwd(),
    fileName,
    envPrefix = 'AX',
    searchParents = true,
  } = options;

  // Try to find config file
  let configPath: string | null = null;
  let fileConfig: Partial<Config> = {};

  if (fileName) {
    // Use specific file name - check if it exists first
    configPath = join(baseDir, fileName);
    try {
      const stats = await stat(configPath);
      if (!stats.isFile()) {
        console.warn(
          `[ax/config] Specified config path "${configPath}" is not a file. Using defaults.`
        );
        configPath = null;
      } else {
        fileConfig = (await parseConfigFile(configPath)) as Partial<Config>;
      }
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code === 'ENOENT') {
        // File doesn't exist - use defaults (same behavior as search)
        console.warn(
          `[ax/config] Specified config file "${configPath}" not found. Using defaults.`
        );
        configPath = null;
      } else {
        // Parse error or other error - throw (consistent with search behavior)
        throw new Error(
          `Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } else {
    // Search for config file
    configPath = await findConfigFile(baseDir, searchParents);
    if (configPath) {
      try {
        fileConfig = (await parseConfigFile(configPath)) as Partial<Config>;
      } catch (error) {
        throw new Error(
          `Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Get environment overrides
  const envOverrides = getEnvOverrides(envPrefix);

  // Helper to deep merge a config section with defaults < file < env precedence
  const mergeSection = <K extends keyof Config>(key: K): Config[K] => ({
    ...(DEFAULT_CONFIG[key] as object),
    ...((fileConfig[key] ?? {}) as object),
    ...((envOverrides[key] ?? {}) as object),
  }) as Config[K];

  // Merge configs: defaults < file < env
  // Deep merge all nested config sections to preserve defaults
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envOverrides,
    // Deep merge for all nested objects using helper
    providers: mergeSection('providers'),
    execution: mergeSection('execution'),
    memory: mergeSection('memory'),
    session: mergeSection('session'),
    checkpoint: mergeSection('checkpoint'),
    router: mergeSection('router'),
    workspace: mergeSection('workspace'),
    logging: mergeSection('logging'),
  };

  // Validate merged config
  const config = validateConfig(mergedConfig);

  // Determine source
  let source: LoadedConfig['source'] = 'default';
  if (Object.keys(envOverrides).length > 0) {
    source = 'env';
  } else if (configPath) {
    source = 'file';
  }

  return {
    config,
    configPath,
    source,
  };
}

/**
 * Load config synchronously (uses defaults + environment overrides)
 * Note: This does not read config files - use loadConfig() for full functionality.
 */
export function loadConfigSync(): Config {
  const envOverrides = getEnvOverrides('AX');

  // Helper to deep merge a config section with defaults < env precedence
  // Same logic as async loadConfig to ensure consistency
  const mergeSection = <K extends keyof Config>(key: K): Config[K] => ({
    ...(DEFAULT_CONFIG[key] as object),
    ...((envOverrides[key] ?? {}) as object),
  }) as Config[K];

  // Deep merge all nested config sections to preserve defaults
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...envOverrides,
    providers: mergeSection('providers'),
    execution: mergeSection('execution'),
    memory: mergeSection('memory'),
    session: mergeSection('session'),
    checkpoint: mergeSection('checkpoint'),
    router: mergeSection('router'),
    workspace: mergeSection('workspace'),
    logging: mergeSection('logging'),
  };

  return validateConfig(mergedConfig);
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

/**
 * Validate configuration object
 */
export function isValidConfig(config: unknown): config is Config {
  try {
    ConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}
