/**
 * Storage Contract V1
 *
 * Defines storage port interfaces for the Ports & Adapters pattern.
 * Application and core layers depend on these interfaces.
 * Adapter layer provides concrete implementations.
 */

export {
  // Configuration Schemas
  StorageModeSchema,
  StorageConfigSchema,

  // Key-Value Schemas
  KVEntrySchema,
  KVSearchResultSchema,

  // Trace Schemas
  TraceSummarySchema,

  // FTS Schemas
  FTSItemSchema,
  FTSResultSchema,
  FTSSearchOptionsSchema,

  // Validation Functions
  validateStorageConfig,
  safeValidateStorageConfig,
  validateKVEntry,
  validateFTSItem,
  validateTraceSummary,

  // Factory Functions
  createDefaultStorageConfig,
  createKVEntry,

  // Types
  type StorageMode,
  type StorageConfig,
  type KVEntry,
  type KVSearchResult,
  type TraceSummary,
  type FTSItem,
  type FTSResult,
  type FTSSearchOptions,

  // Port Interfaces
  type KVStoragePort,
  type EventStoragePort,
  type TraceStoragePort,
  type FTSStoragePort,
} from './schema.js';
