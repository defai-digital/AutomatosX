/**
 * Database Factory - Standardizes SQLite database creation
 *
 * v9.0.2: Extracted from duplicated patterns across 10 files
 *
 * Provides consistent database initialization with proper configuration.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../../shared/logging/logger.js';
import { DATABASE } from '../validation-limits.js';

export interface DbConnectionOptions {
  /** Open database in read-only mode (default: false) */
  readonly?: boolean;

  /** Busy timeout in milliseconds (default: DATABASE.BUSY_TIMEOUT) */
  busyTimeout?: number;

  /** Enable verbose logging of SQL statements (default: false) */
  verbose?: boolean;

  /** Enable WAL mode for better concurrency (default: true) */
  enableWal?: boolean;

  /** Create directory if it doesn't exist (default: true) */
  createDir?: boolean;
}

const DEFAULT_OPTIONS: Required<DbConnectionOptions> = {
  readonly: false,
  busyTimeout: DATABASE.BUSY_TIMEOUT,
  verbose: false,
  enableWal: true,
  createDir: true
};

/**
 * Database Factory
 *
 * Standardizes SQLite database creation with:
 * - Automatic directory creation
 * - Consistent busyTimeout configuration
 * - WAL mode for concurrency
 * - Proper error handling
 */
export class DatabaseFactory {
  /**
   * Create a new SQLite database connection
   *
   * @param dbPath - Path to database file
   * @param options - Connection options
   * @returns Configured Database instance
   *
   * @example
   * ```typescript
   * // Read-write database with defaults
   * const db = DatabaseFactory.create('./data/memories.db');
   *
   * // Read-only database
   * const readDb = DatabaseFactory.create('./data/memories.db', {
   *   readonly: true
   * });
   *
   * // Custom configuration
   * const customDb = DatabaseFactory.create('./data/cache.db', {
   *   busyTimeout: 10000,
   *   enableWal: false
   * });
   * ```
   */
  static create(
    dbPath: string,
    options: DbConnectionOptions = {}
  ): Database.Database {
    // Validate path
    if (!dbPath || typeof dbPath !== 'string') {
      throw new Error('Invalid database path: must be a non-empty string');
    }

    // Merge with defaults
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Create directory if needed (skip for in-memory databases)
    if (opts.createDir && dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
          logger.debug(`Created database directory: ${dir}`);
        } catch (error) {
          throw new Error(
            `Failed to create database directory ${dir}: ${(error as Error).message}`
          );
        }
      }
    }

    // Open database with configuration
    let db: Database.Database;
    try {
      db = new Database(dbPath, {
        readonly: opts.readonly,
        verbose: opts.verbose ? (msg) => logger.debug(`[SQL] ${msg}`) : undefined
      });
    } catch (error) {
      throw new Error(
        `Failed to open database ${dbPath}: ${(error as Error).message}`
      );
    }

    // Configure busyTimeout (prevents "database is locked" errors)
    if (opts.busyTimeout > 0) {
      db.pragma(`busy_timeout = ${opts.busyTimeout}`);
    }

    // Enable WAL mode for better concurrency (skip for readonly)
    if (opts.enableWal && !opts.readonly) {
      try {
        // Check if already in WAL mode
        const journalMode = db.pragma('journal_mode', { simple: true }) as string;
        if (journalMode !== 'wal') {
          db.pragma('journal_mode = WAL');
          logger.debug(`Enabled WAL mode for ${dbPath}`);
        }
      } catch (error) {
        // WAL mode might fail on some filesystems (e.g., network drives)
        // Log warning but don't fail
        logger.warn(`Failed to enable WAL mode for ${dbPath}`, {
          error: (error as Error).message
        });
      }
    }

    logger.debug('Database connection created', {
      path: dbPath,
      readonly: opts.readonly,
      busyTimeout: opts.busyTimeout,
      walMode: opts.enableWal && !opts.readonly
    });

    return db;
  }

  /**
   * Create an in-memory database (for testing)
   *
   * @param options - Connection options
   * @returns In-memory Database instance
   */
  static createInMemory(options: Omit<DbConnectionOptions, 'createDir'> = {}): Database.Database {
    return DatabaseFactory.create(':memory:', {
      ...options,
      createDir: false // No directory needed for in-memory
    });
  }

  /**
   * Create a read-only database connection
   *
   * Convenience method for read-only mode with optimal settings.
   *
   * @param dbPath - Path to database file
   * @param options - Additional connection options
   */
  static createReadOnly(
    dbPath: string,
    options: Omit<DbConnectionOptions, 'readonly'> = {}
  ): Database.Database {
    return DatabaseFactory.create(dbPath, {
      ...options,
      readonly: true,
      enableWal: false // WAL not needed for readonly
    });
  }

  /**
   * Test database connection
   *
   * Performs a simple query to verify database is accessible.
   *
   * @param db - Database instance to test
   * @returns true if connection is valid
   */
  static testConnection(db: Database.Database): boolean {
    try {
      // Simple integrity check
      const result = db.pragma('integrity_check', { simple: true });
      return result === 'ok';
    } catch (error) {
      logger.error('Database connection test failed', {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Close database with error handling
   *
   * @param db - Database instance to close
   */
  static close(db: Database.Database | null | undefined): void {
    if (!db) return;

    try {
      if (db.open) {
        db.close();
        logger.debug('Database connection closed');
      }
    } catch (error) {
      logger.warn('Error closing database', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Get database statistics
   *
   * @param db - Database instance
   * @returns Database metadata
   */
  static getStats(db: Database.Database): {
    path: string;
    readonly: boolean;
    inTransaction: boolean;
    open: boolean;
    memory: boolean;
  } {
    return {
      path: db.name,
      readonly: db.readonly,
      inTransaction: db.inTransaction,
      open: db.open,
      memory: db.memory
    };
  }
}

/**
 * Database Connection Pool Helper
 *
 * For managing multiple database connections with automatic cleanup.
 */
export class DbConnectionPool {
  private connections = new Map<string, Database.Database>();

  /**
   * Get or create database connection
   */
  get(key: string, dbPath: string, options?: DbConnectionOptions): Database.Database {
    let db = this.connections.get(key);

    if (!db || !db.open) {
      db = DatabaseFactory.create(dbPath, options);
      this.connections.set(key, db);
    }

    return db;
  }

  /**
   * Close specific connection
   */
  close(key: string): void {
    const db = this.connections.get(key);
    if (db) {
      DatabaseFactory.close(db);
      this.connections.delete(key);
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [key, db] of this.connections) {
      DatabaseFactory.close(db);
      this.connections.delete(key);
    }
  }

  /**
   * Get number of active connections
   */
  get size(): number {
    return this.connections.size;
  }
}
