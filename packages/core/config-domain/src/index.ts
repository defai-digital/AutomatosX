/**
 * @automatosx/config-domain
 *
 * Configuration domain - config management following contract invariants.
 */

// Config Store
export {
  CONFIG_PATHS,
  DATA_PATHS,
  CONFIG_SUBDIRS,
  type ConfigStore,
  expandPath,
  getConfigPath,
  createConfigStore,
  initConfigDirectory,
  isSetupComplete,
} from './store.js';

// Config Operations
export {
  parsePath,
  getValue,
  setValue,
  removeValue,
  mergeConfigs,
  diffConfigs,
  hasPath,
  getAllPaths,
} from './operations.js';

// Config Aggregate
export {
  type ConfigAggregateState,
  ConfigAggregate,
  createConfigAggregate,
  createAggregateFromConfig,
} from './aggregate.js';

// Config Repository
export {
  type ConfigEventStore,
  type ConfigRepository,
  type ConfigRepositoryOptions,
  InMemoryConfigEventStore,
  createConfigRepository,
  getConfigRepository,
  setConfigRepository,
  resetConfigRepository,
} from './repository.js';

// Config Migrator
export {
  type ConfigMigration,
  type MigrationInfo,
  CURRENT_VERSION,
  MIN_SUPPORTED_VERSION,
  VERSION_ORDER,
  MIGRATIONS,
  getConfigVersion,
  compareVersions,
  isVersionSupported,
  getMigrationPath,
  needsMigration,
  migrateConfig,
  safeMigrateConfig,
  getMigrationInfo,
} from './migrator.js';

// Detection Port
export {
  type ProviderDetectionPort,
  type DetectionOptions,
  nullDetectionAdapter,
  setDetectionAdapter,
  getDetectionAdapter,
  resetDetectionAdapter,
} from './ports/detection.js';

// Config Resolver (Multi-Level)
export {
  type ConfigResolutionResult,
  type IConfigResolver,
  ConfigResolver,
  createConfigResolver,
  resolveConfig,
  resolveConfigFull,
} from './resolver.js';
