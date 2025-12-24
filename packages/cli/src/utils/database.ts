/**
 * Database Manager for CLI
 *
 * Manages SQLite database initialization and provides fallback to in-memory
 * storage when SQLite is unavailable.
 *
 * Database location: ~/.automatosx/data.db (or $AX_DATA_DIR/data.db)
 * Storage mode: AX_STORAGE=sqlite|memory (default: sqlite)
 */

import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  DATA_DIR_NAME,
  DATABASE_FILENAME,
  ENV_DATA_DIR,
  ENV_STORAGE_MODE,
  STORAGE_MODE_SQLITE,
  STORAGE_MODE_MEMORY,
} from '@automatosx/contracts';

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Database file path */
  path: string;
  /** Whether SQLite is available */
  sqliteAvailable: boolean;
  /** Storage mode (sqlite or memory) */
  storageMode: 'sqlite' | 'memory';
  /** Error if SQLite initialization failed */
  initError?: string;
}

/**
 * Gets the data directory path
 */
export function getDataDirectory(): string {
  const customDir = process.env[ENV_DATA_DIR];
  if (customDir) {
    return customDir;
  }
  return join(homedir(), DATA_DIR_NAME);
}

/**
 * Gets the database file path
 */
export function getDatabasePath(): string {
  return join(getDataDirectory(), DATABASE_FILENAME);
}

/**
 * Ensures the data directory exists
 */
export function ensureDataDirectory(): void {
  const dir = getDataDirectory();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Gets the configured storage mode
 */
export function getStorageMode(): 'sqlite' | 'memory' {
  const mode = process.env[ENV_STORAGE_MODE]?.toLowerCase();
  if (mode === STORAGE_MODE_MEMORY) {
    return STORAGE_MODE_MEMORY;
  }
  return STORAGE_MODE_SQLITE; // Default to sqlite
}

/**
 * Checks if SQLite is available by trying to import it
 */
export async function checkSqliteAvailable(): Promise<boolean> {
  try {
    // Dynamic import to avoid hard dependency
    await import('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

// Cached database instance
let _database: unknown = null;
let _databaseConfig: DatabaseConfig | null = null;

/**
 * Gets or creates the database instance
 *
 * Returns null if storage mode is 'memory' or SQLite is unavailable.
 * Callers should fall back to in-memory storage in this case.
 */
export async function getDatabase(): Promise<unknown | null> {
  if (_database !== null) {
    return _database;
  }

  const config = await getDatabaseConfig();
  if (!config.sqliteAvailable || config.storageMode === 'memory') {
    return null;
  }

  try {
    // Dynamic import
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    _database = new BetterSqlite3(config.path);
    return _database;
  } catch (error) {
    console.warn(
      `[WARN] Failed to initialize SQLite database: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Falling back to in-memory storage.'
    );
    return null;
  }
}

/**
 * Gets the database configuration
 */
export async function getDatabaseConfig(): Promise<DatabaseConfig> {
  if (_databaseConfig !== null) {
    return _databaseConfig;
  }

  const storageMode = getStorageMode();
  const path = getDatabasePath();

  // If memory mode is explicitly set, don't try SQLite
  if (storageMode === STORAGE_MODE_MEMORY) {
    _databaseConfig = {
      path,
      sqliteAvailable: false,
      storageMode: STORAGE_MODE_MEMORY,
    };
    return _databaseConfig;
  }

  // Try to initialize SQLite
  const sqliteAvailable = await checkSqliteAvailable();

  if (!sqliteAvailable) {
    _databaseConfig = {
      path,
      sqliteAvailable: false,
      storageMode: STORAGE_MODE_MEMORY,
      initError: 'better-sqlite3 package not available',
    };
    return _databaseConfig;
  }

  // Ensure data directory exists
  try {
    ensureDataDirectory();
  } catch (error) {
    _databaseConfig = {
      path,
      sqliteAvailable: false,
      storageMode: STORAGE_MODE_MEMORY,
      initError: `Failed to create data directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    return _databaseConfig;
  }

  _databaseConfig = {
    path,
    sqliteAvailable: true,
    storageMode: STORAGE_MODE_SQLITE,
  };

  return _databaseConfig;
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  if (_database !== null) {
    try {
      // Cast to any to call close method
      const db = _database as { close?: () => void };
      if (typeof db.close === 'function') {
        db.close();
      }
    } catch {
      // Ignore close errors
    }
    _database = null;
  }
}

/**
 * Resets database state (for testing)
 */
export function resetDatabaseState(): void {
  closeDatabase();
  _databaseConfig = null;
}

/**
 * Gets whether persistent storage is available
 */
export async function isPersistentStorageAvailable(): Promise<boolean> {
  const config = await getDatabaseConfig();
  return config.sqliteAvailable && config.storageMode === STORAGE_MODE_SQLITE;
}

/**
 * Database manager provides a unified interface for storage operations
 */
export interface DatabaseManager {
  /** Get database configuration */
  getConfig(): Promise<DatabaseConfig>;

  /** Get the database instance (null if unavailable) */
  getDatabase(): Promise<unknown | null>;

  /** Check if persistent storage is available */
  isPersistent(): Promise<boolean>;

  /** Close the database */
  close(): void;

  /** Reset state (for testing) */
  reset(): void;
}

/**
 * Creates a database manager instance
 */
export function createDatabaseManager(): DatabaseManager {
  return {
    getConfig: getDatabaseConfig,
    getDatabase,
    isPersistent: isPersistentStorageAvailable,
    close: closeDatabase,
    reset: resetDatabaseState,
  };
}
