/**
 * Storage Instances for CLI Commands
 *
 * Re-exports storage accessors from the CLI bootstrap module.
 * This file maintains backwards compatibility while delegating
 * to the centralized composition root.
 *
 * All storage initialization is handled by bootstrap.ts - the only
 * file in CLI that may import adapter implementations directly.
 *
 * Storage Mode (AX_STORAGE environment variable):
 * - 'sqlite' (default): Persistent storage using SQLite at ~/.automatosx/data.db
 * - 'memory': In-memory storage (data lost between invocations)
 *
 * Automatically falls back to in-memory storage if SQLite is unavailable.
 */

// Re-export storage accessors from bootstrap
// This maintains backwards compatibility for existing code that imports from this file
export {
  getCheckpointStorage,
  getTraceStore,
  getDLQ,
  isUsingSqlite,
  getStorageInfo,
  bootstrap as initializeStorageAsync,
  resetBootstrap as resetStorageInstances,
} from '../bootstrap.js';

// Re-export types from bootstrap
export type {
  CheckpointStorage,
  TraceStore,
  DeadLetterQueue,
} from '../bootstrap.js';
