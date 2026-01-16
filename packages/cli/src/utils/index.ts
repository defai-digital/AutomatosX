/**
 * CLI Utilities
 */

export {
  checkDangerousOp,
  listDangerousOperations,
  isDangerousOp,
  type DangerousOpOptions,
} from './dangerous-op-guard.js';

export {
  formatDuration,
  formatBytes,
  formatAge,
  truncate,
  padEnd,
} from './formatters.js';

export {
  getCheckpointStorage,
  getTraceStore,
  getDLQ,
  initializeStorageAsync,
  isUsingSqlite,
  getStorageInfo,
  resetStorageInstances,
} from './storage-instances.js';

export {
  getDataDirectory,
  getDatabasePath,
  getStorageMode,
  getDatabase,
  getDatabaseConfig,
  closeDatabase,
  resetDatabaseState,
  isPersistentStorageAvailable,
  createDatabaseManager,
  type DatabaseConfig,
  type DatabaseManager,
} from './database.js';

export { COLORS, ICONS } from './terminal.js';

export { success, failure, failureWithCode } from './command-result.js';
