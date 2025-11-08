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
 * Get or create database connection
 *
 * @param config - Database configuration
 * @returns Database instance
 */
export function getDatabase(config?: Partial<DatabaseConfig>): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = config?.path || DEFAULT_DB_PATH;
  const verbose = config?.verbose || false;
  const readonly = config?.readonly || false;

  // Ensure directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  dbInstance = new Database(dbPath, {
    verbose: verbose ? console.log : undefined,
    readonly,
  });

  // Enable foreign keys
  dbInstance.pragma('foreign_keys = ON');

  // Optimize for performance
  dbInstance.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
  dbInstance.pragma('synchronous = NORMAL'); // Faster writes, still safe

  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Execute a query with parameters
 * Helper function for common database operations
 */
export function query<T = any>(sql: string, params?: any[]): T[] {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.all(params || []) as T[];
}

/**
 * Execute a single-row query
 */
export function queryOne<T = any>(sql: string, params?: any[]): T | null {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return (stmt.get(params || []) as T) || null;
}

/**
 * Execute a write operation (INSERT, UPDATE, DELETE)
 */
export function execute(sql: string, params?: any[]): Database.RunResult {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.run(params || []);
}

/**
 * Execute multiple statements in a transaction
 */
export function transaction<T>(fn: () => T): T {
  const db = getDatabase();
  const txn = db.transaction(fn);
  return txn();
}
