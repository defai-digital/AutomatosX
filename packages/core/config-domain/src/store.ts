/**
 * Configuration Store
 *
 * Handles file-based configuration storage with atomic writes.
 *
 * Invariants:
 * - INV-CFG-ADP-001: Atomic writes (temp + rename)
 * - INV-CFG-DOM-001: Schema validation before write
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  type AutomatosXConfig,
  validateConfig,
  safeValidateConfig,
  DEFAULT_CONFIG,
  ConfigErrorCode,
  ConfigError,
  DATA_DIR_NAME,
  CONFIG_FILENAME,
} from '@defai.digital/contracts';

// ============================================================================
// Constants
// ============================================================================

/**
 * Configuration file paths
 */
export const CONFIG_PATHS = {
  global: path.join(os.homedir(), DATA_DIR_NAME, CONFIG_FILENAME),
  local: path.join(process.cwd(), DATA_DIR_NAME, CONFIG_FILENAME),
} as const;

/**
 * Data directory paths
 */
export const DATA_PATHS = {
  global: path.join(os.homedir(), DATA_DIR_NAME),
  local: path.join(process.cwd(), DATA_DIR_NAME),
} as const;

// ============================================================================
// Config Store Interface
// ============================================================================

/**
 * Config store interface
 */
export interface ConfigStore {
  /**
   * Checks if configuration exists
   */
  exists(scope?: 'global' | 'local'): Promise<boolean>;

  /**
   * Reads configuration from file
   */
  read(scope?: 'global' | 'local'): Promise<AutomatosXConfig | undefined>;

  /**
   * Writes configuration to file
   * INV-CFG-ADP-001: Uses atomic write
   */
  write(config: AutomatosXConfig, scope?: 'global' | 'local'): Promise<void>;

  /**
   * Deletes configuration file
   */
  delete(scope?: 'global' | 'local'): Promise<boolean>;

  /**
   * Gets the resolved config path
   */
  getPath(scope?: 'global' | 'local'): string;

  /**
   * Merges local config over global config
   */
  readMerged(): Promise<AutomatosXConfig>;
}

// ============================================================================
// File Operations (Pure Functions)
// ============================================================================

/**
 * Expands ~ to home directory
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Gets config path for scope
 */
export function getConfigPath(scope: 'global' | 'local' = 'global'): string {
  return CONFIG_PATHS[scope];
}

/**
 * Ensures directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * Checks if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads JSON file
 */
async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw new ConfigError(
      ConfigErrorCode.CONFIG_READ_ERROR,
      `Failed to read config file: ${filePath}`,
      { path: filePath, error: String(error) }
    );
  }
}

/**
 * Writes JSON file atomically
 * INV-CFG-ADP-001: Write to temp file, then rename
 */
async function writeJsonFileAtomic<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    const content = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tempPath, content, 'utf-8');
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new ConfigError(
      ConfigErrorCode.CONFIG_WRITE_ERROR,
      `Failed to write config file: ${filePath}`,
      { path: filePath, error: String(error) }
    );
  }
}

/**
 * Deletes file if exists
 */
async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw new ConfigError(
      ConfigErrorCode.CONFIG_WRITE_ERROR,
      `Failed to delete config file: ${filePath}`,
      { path: filePath, error: String(error) }
    );
  }
}

// ============================================================================
// Config Merging
// ============================================================================

/**
 * Deep merges two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  const result = { ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideValue = override[key];
    const baseValue = base[key];

    if (overrideValue === undefined) {
      continue;
    }

    if (
      typeof overrideValue === 'object' &&
      overrideValue !== null &&
      !Array.isArray(overrideValue) &&
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = overrideValue as T[keyof T];
    }
  }

  return result;
}

// ============================================================================
// Config Store Implementation
// ============================================================================

/**
 * Creates a config store
 */
export function createConfigStore(): ConfigStore {
  return {
    async exists(scope: 'global' | 'local' = 'global'): Promise<boolean> {
      const configPath = getConfigPath(scope);
      return fileExists(configPath);
    },

    async read(scope: 'global' | 'local' = 'global'): Promise<AutomatosXConfig | undefined> {
      const configPath = getConfigPath(scope);
      const data = await readJsonFile<unknown>(configPath);

      if (data === undefined) {
        return undefined;
      }

      // Validate with schema
      const result = safeValidateConfig(data);
      if (!result.success) {
        throw new ConfigError(
          ConfigErrorCode.CONFIG_VALIDATION_ERROR,
          `Config validation failed for ${scope} config`,
          {
            path: configPath,
            errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
          }
        );
      }

      return result.data;
    },

    async write(config: AutomatosXConfig, scope: 'global' | 'local' = 'global'): Promise<void> {
      // INV-CFG-DOM-001: Validate before write
      const validated = validateConfig(config);

      // Add/update timestamps
      const now = new Date().toISOString();
      const configWithTimestamps: AutomatosXConfig = {
        ...validated,
        updatedAt: now,
        createdAt: validated.createdAt ?? now,
      };

      const configPath = getConfigPath(scope);
      await writeJsonFileAtomic(configPath, configWithTimestamps);
    },

    async delete(scope: 'global' | 'local' = 'global'): Promise<boolean> {
      const configPath = getConfigPath(scope);
      return deleteFile(configPath);
    },

    getPath(scope: 'global' | 'local' = 'global'): string {
      return getConfigPath(scope);
    },

    async readMerged(): Promise<AutomatosXConfig> {
      const globalConfig = await this.read('global');
      const localConfig = await this.read('local');

      // Start with defaults
      let merged = { ...DEFAULT_CONFIG };

      // Merge global config
      if (globalConfig !== undefined) {
        merged = deepMerge(merged, globalConfig);
      }

      // Merge local config (highest priority)
      if (localConfig !== undefined) {
        merged = deepMerge(merged, localConfig);
      }

      return merged;
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Subdirectories to create during setup
 * Per PRD Section 9: File Structure
 */
export const CONFIG_SUBDIRS = ['providers', 'cache', 'data'] as const;

/**
 * Initializes config directory structure
 * Creates:
 * - ~/.automatosx/
 * - ~/.automatosx/providers/
 * - ~/.automatosx/cache/
 * - ~/.automatosx/data/
 */
export async function initConfigDirectory(scope: 'global' | 'local' = 'global'): Promise<string> {
  const dataPath = DATA_PATHS[scope];

  // Create main directory
  await ensureDir(dataPath);

  // Create subdirectories
  for (const subdir of CONFIG_SUBDIRS) {
    await ensureDir(path.join(dataPath, subdir));
  }

  return dataPath;
}

/**
 * Checks if setup has been completed
 */
export async function isSetupComplete(): Promise<boolean> {
  const store = createConfigStore();
  return store.exists('global');
}
