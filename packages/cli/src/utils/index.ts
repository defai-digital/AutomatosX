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
