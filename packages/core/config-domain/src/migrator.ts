/**
 * Config Version Migration
 *
 * Handles schema migrations for configuration files across versions.
 *
 * Invariants:
 * - INV-CFG-MIG-001: Migrations are idempotent
 * - INV-CFG-MIG-002: Version order is strictly increasing
 * - INV-CFG-MIG-003: Unknown versions fail fast
 */

import {
  type AutomatosXConfig,
  validateConfig,
  safeValidateConfig,
  DEFAULT_CONFIG,
  ConfigErrorCode,
  ConfigError,
} from '@automatosx/contracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Migration function signature
 * Takes a config of any shape and returns a transformed config
 */
export type ConfigMigration = (config: unknown) => unknown;

/**
 * Migration metadata
 */
export interface MigrationInfo {
  /** Source version this migration applies to */
  fromVersion: string;
  /** Target version after migration */
  toVersion: string;
  /** Description of changes */
  description: string;
  /** Migration function */
  migrate: ConfigMigration;
}

// ============================================================================
// Version Constants
// ============================================================================

/**
 * Current config schema version
 */
export const CURRENT_VERSION = '1.0.0';

/**
 * Minimum supported version (older versions cannot be migrated)
 */
export const MIN_SUPPORTED_VERSION = '0.9.0';

/**
 * Version order for migration path calculation
 */
export const VERSION_ORDER: readonly string[] = [
  '0.9.0',
  '0.9.1',
  '0.10.0',
  '1.0.0',
] as const;

// ============================================================================
// Migration Registry
// ============================================================================

/**
 * Registered migrations by source version
 * Each migration transforms config from fromVersion to toVersion
 */
export const MIGRATIONS: Record<string, MigrationInfo> = {
  // Example migration from 0.9.0 to 0.9.1
  '0.9.0': {
    fromVersion: '0.9.0',
    toVersion: '0.9.1',
    description: 'Add features field with defaults',
    migrate: (config: unknown): unknown => {
      const cfg = config as Record<string, unknown>;
      return {
        ...cfg,
        features: cfg['features'] ?? DEFAULT_CONFIG.features,
        version: '0.9.1',
      };
    },
  },

  // Migration from 0.9.1 to 0.10.0
  '0.9.1': {
    fromVersion: '0.9.1',
    toVersion: '0.10.0',
    description: 'Add workspace configuration field',
    migrate: (config: unknown): unknown => {
      const cfg = config as Record<string, unknown>;
      return {
        ...cfg,
        workspace: cfg['workspace'] ?? DEFAULT_CONFIG.workspace,
        version: '0.10.0',
      };
    },
  },

  // Migration from 0.10.0 to 1.0.0
  '0.10.0': {
    fromVersion: '0.10.0',
    toVersion: '1.0.0',
    description: 'Stable release - normalize provider configuration to Record format',
    migrate: (config: unknown): unknown => {
      const cfg = config as Record<string, unknown>;
      // Convert providers from array to Record format if needed
      let providers: Record<string, unknown> = {};

      if (Array.isArray(cfg['providers'])) {
        // Convert array format to Record format
        for (const p of cfg['providers']) {
          const provider = p as Record<string, unknown>;
          const providerId = provider['providerId'] as string;
          if (providerId) {
            providers[providerId] = {
              enabled: provider['enabled'] ?? true,
              priority: provider['priority'] ?? 50,
              command: provider['command'],
            };
          }
        }
      } else if (cfg['providers'] && typeof cfg['providers'] === 'object') {
        // Already in Record format
        providers = cfg['providers'] as Record<string, unknown>;
      }

      return {
        ...cfg,
        providers,
        version: '1.0.0',
      };
    },
  },
};

// ============================================================================
// Version Utilities
// ============================================================================

/**
 * Gets the version from a config object
 */
export function getConfigVersion(config: unknown): string | undefined {
  if (config === null || typeof config !== 'object') {
    return undefined;
  }
  const cfg = config as Record<string, unknown>;
  const version = cfg['version'];
  if (typeof version !== 'string') {
    return undefined;
  }
  return version;
}

/**
 * Compares two version strings
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const indexA = VERSION_ORDER.indexOf(a);
  const indexB = VERSION_ORDER.indexOf(b);

  // Unknown versions sort to end
  if (indexA === -1 && indexB === -1) return 0;
  if (indexA === -1) return 1;
  if (indexB === -1) return -1;

  return indexA - indexB;
}

/**
 * Checks if a version is supported for migration
 */
export function isVersionSupported(version: string): boolean {
  return VERSION_ORDER.includes(version);
}

/**
 * Gets the migration path from one version to another
 */
export function getMigrationPath(fromVersion: string, toVersion: string): MigrationInfo[] {
  const path: MigrationInfo[] = [];

  let currentVersion = fromVersion;

  while (compareVersions(currentVersion, toVersion) < 0) {
    const migration = MIGRATIONS[currentVersion];
    if (migration === undefined) {
      // No migration available for this version
      break;
    }
    path.push(migration);
    currentVersion = migration.toVersion;
  }

  return path;
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Checks if a config needs migration
 */
export function needsMigration(config: unknown): boolean {
  const version = getConfigVersion(config);

  // No version field - needs migration to add it
  if (version === undefined) {
    return true;
  }

  // Already at current version
  if (version === CURRENT_VERSION) {
    return false;
  }

  // Check if we have a migration path
  return compareVersions(version, CURRENT_VERSION) < 0;
}

/**
 * Migrates a config to the latest version
 *
 * @throws ConfigError if migration fails or version is unsupported
 */
export function migrateConfig(config: unknown): AutomatosXConfig {
  // Handle null/undefined
  if (config === null || config === undefined) {
    return { ...DEFAULT_CONFIG, version: CURRENT_VERSION };
  }

  // Get current version
  let version = getConfigVersion(config);

  // If no version, assume oldest supported version
  if (version === undefined) {
    version = MIN_SUPPORTED_VERSION;
    config = { ...(config as Record<string, unknown>), version };
  }

  // Check if version is supported
  if (!isVersionSupported(version)) {
    throw new ConfigError(
      ConfigErrorCode.CONFIG_MIGRATION_FAILED,
      `Config version ${version} is not supported. Minimum supported version is ${MIN_SUPPORTED_VERSION}`,
      { version, minSupported: MIN_SUPPORTED_VERSION }
    );
  }

  // Already at current version - validate and return
  if (version === CURRENT_VERSION) {
    const result = safeValidateConfig(config);
    if (!result.success) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_VALIDATION_ERROR,
        'Config validation failed after migration',
        { errors: result.error.errors.map((e) => e.message) }
      );
    }
    return result.data;
  }

  // Get migration path
  const migrations = getMigrationPath(version, CURRENT_VERSION);

  if (migrations.length === 0) {
    throw new ConfigError(
      ConfigErrorCode.CONFIG_MIGRATION_FAILED,
      `No migration path found from version ${version} to ${CURRENT_VERSION}`,
      { fromVersion: version, toVersion: CURRENT_VERSION }
    );
  }

  // Apply migrations in order
  let migratedConfig: unknown = config;

  for (const migration of migrations) {
    try {
      migratedConfig = migration.migrate(migratedConfig);
    } catch (error) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_MIGRATION_FAILED,
        `Migration from ${migration.fromVersion} to ${migration.toVersion} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          error: String(error),
        }
      );
    }
  }

  // Validate final result
  const validated = validateConfig(migratedConfig);
  return validated;
}

/**
 * Safely migrates a config, returning undefined on failure
 */
export function safeMigrateConfig(
  config: unknown
): { success: true; data: AutomatosXConfig } | { success: false; error: ConfigError } {
  try {
    const result = migrateConfig(config);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new ConfigError(
        ConfigErrorCode.CONFIG_MIGRATION_FAILED,
        error instanceof Error ? error.message : 'Unknown migration error',
        { error: String(error) }
      ),
    };
  }
}

/**
 * Gets migration info for a config
 */
export function getMigrationInfo(config: unknown): {
  currentVersion: string | undefined;
  targetVersion: string;
  needsMigration: boolean;
  migrationPath: MigrationInfo[];
} {
  const currentVersion = getConfigVersion(config);
  const effectiveVersion = currentVersion ?? MIN_SUPPORTED_VERSION;
  const requires = needsMigration(config);
  const path = requires ? getMigrationPath(effectiveVersion, CURRENT_VERSION) : [];

  return {
    currentVersion,
    targetVersion: CURRENT_VERSION,
    needsMigration: requires,
    migrationPath: path,
  };
}
