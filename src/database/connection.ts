/**
 * connection.ts
 *
 * Database connection manager for AutomatosX v2
 * Manages SQLite database connection with better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Database configuration
 */
export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
  readonly?: boolean;
}

/**
 * Default database path
 */
export const DEFAULT_DB_PATH = join(process.cwd(), '.automatosx', 'memory', 'code.db');

/**
 * Database connection singleton
 */
let dbInstance: Database.Database | null = null;

/**
 * Initialization lock to prevent race conditions
 */
let initializationPromise: Promise<Database.Database> | null = null;

/**
 * Statement cache for improved performance
 */
const statementCache = new Map<string, Database.Statement>();

/**
 * Initialize database instance with configuration
 * Extracted to avoid duplication between sync/async variants
 */
function initializeDatabase(config: Partial<DatabaseConfig>): Database.Database {
  const dbPath = config.path || DEFAULT_DB_PATH;
  const verbose = config.verbose ?? false;
  const readonly = config.readonly ?? false;

  // Ensure directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  const db = new Database(dbPath, {
    verbose: verbose ? console.log : undefined,
    readonly,
  });

  // Configure database with optimal settings
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
  db.pragma('synchronous = NORMAL'); // Faster writes, still safe
  db.pragma('cache_size = -64000'); // 64MB cache (negative = KB)
  db.pragma('temp_store = MEMORY'); // Store temp tables in memory

  return db;
}

/**
 * Get or create database connection
 *
 * Thread-safe singleton with initialization lock to prevent race conditions.
 *
 * @param config - Database configuration
 * @returns Database instance
 */
export function getDatabase(config?: Partial<DatabaseConfig>): Database.Database {
  // Fast path: instance already created
  if (dbInstance) {
    return dbInstance;
  }

  // Slow path: need to initialize
  if (initializationPromise) {
    throw new Error('Database initialization in progress. Use getDatabaseAsync() in async contexts.');
  }

  dbInstance = initializeDatabase(config || {});
  return dbInstance;
}

/**
 * Get or create database connection (async-safe version)
 *
 * This version properly handles concurrent async calls by using a promise lock.
 * Recommended for use in async contexts to avoid race conditions.
 *
 * @param config - Database configuration
 * @returns Promise<Database instance>
 */
export async function getDatabaseAsync(config?: Partial<DatabaseConfig>): Promise<Database.Database> {
  // Fast path: instance already created
  if (dbInstance) {
    return dbInstance;
  }

  // Check if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = Promise.resolve().then(() => {
    dbInstance = initializeDatabase(config || {});
    initializationPromise = null;
    return dbInstance;
  });

  return initializationPromise;
}

/**
 * Close database connection and clear caches
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  statementCache.clear();
  initializationPromise = null;
}

/**
 * Set database instance (for testing)
 * @param db - Database instance to use
 */
export function setDatabase(db: Database.Database): void {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = db;
  statementCache.clear();
}

/**
 * Get or create cached prepared statement
 * Significantly improves performance for repeated queries
 */
function getCachedStatement(sql: string): Database.Statement {
  let stmt = statementCache.get(sql);

  if (!stmt) {
    const db = getDatabase();
    stmt = db.prepare(sql);

    // Limit cache size to prevent memory bloat
    if (statementCache.size >= 100) {
      // Remove oldest entry (first in Map)
      const firstKey = statementCache.keys().next().value as string;
      statementCache.delete(firstKey);
    }

    statementCache.set(sql, stmt);
  }

  return stmt;
}

/**
 * Execute a query with parameters (cached prepared statement)
 *
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Array of results
 */
export function query<T = unknown>(sql: string, params?: unknown[]): T[] {
  const stmt = getCachedStatement(sql);
  return stmt.all(params ?? []) as T[];
}

/**
 * Execute a single-row query (cached prepared statement)
 *
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Single result or null
 */
export function queryOne<T = unknown>(sql: string, params?: unknown[]): T | null {
  const stmt = getCachedStatement(sql);
  return (stmt.get(params ?? []) as T) ?? null;
}

/**
 * Execute a write operation (INSERT, UPDATE, DELETE)
 * Uses cached prepared statement for better performance
 *
 * @param sql - SQL statement
 * @param params - Statement parameters
 * @returns Run result with lastInsertRowid and changes
 */
export function execute(sql: string, params?: unknown[]): Database.RunResult {
  const stmt = getCachedStatement(sql);
  return stmt.run(params ?? []);
}

/**
 * Execute multiple statements in a transaction
 *
 * @param fn - Transaction function
 * @returns Transaction result
 */
export function transaction<T>(fn: () => T): T {
  const db = getDatabase();
  const txn = db.transaction(fn);
  return txn();
}
