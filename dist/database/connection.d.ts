/**
 * connection.ts
 *
 * Database connection manager for AutomatosX
 * Manages SQLite database connection with better-sqlite3
 */
import Database from 'better-sqlite3';
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
export declare const DEFAULT_DB_PATH: string;
/**
 * Get or create database connection
 *
 * Thread-safe singleton with initialization lock to prevent race conditions.
 *
 * @param config - Database configuration
 * @returns Database instance
 */
export declare function getDatabase(config?: Partial<DatabaseConfig>): Database.Database;
/**
 * Get or create database connection (async-safe version)
 *
 * This version properly handles concurrent async calls by using a promise lock.
 * Recommended for use in async contexts to avoid race conditions.
 *
 * @param config - Database configuration
 * @returns Promise<Database instance>
 */
export declare function getDatabaseAsync(config?: Partial<DatabaseConfig>): Promise<Database.Database>;
/**
 * Close database connection and clear caches
 */
export declare function closeDatabase(): void;
/**
 * Set database instance (for testing)
 * @param db - Database instance to use
 */
export declare function setDatabase(db: Database.Database): void;
/**
 * Execute a query with parameters (cached prepared statement)
 *
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Array of results
 */
export declare function query<T = unknown>(sql: string, params?: unknown[]): T[];
/**
 * Execute a single-row query (cached prepared statement)
 *
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Single result or null
 */
export declare function queryOne<T = unknown>(sql: string, params?: unknown[]): T | null;
/**
 * Execute a write operation (INSERT, UPDATE, DELETE)
 * Uses cached prepared statement for better performance
 *
 * @param sql - SQL statement
 * @param params - Statement parameters
 * @returns Run result with lastInsertRowid and changes
 */
export declare function execute(sql: string, params?: unknown[]): Database.RunResult;
/**
 * Execute multiple statements in a transaction
 *
 * @param fn - Transaction function
 * @returns Transaction result
 */
export declare function transaction<T>(fn: () => T): T;
//# sourceMappingURL=connection.d.ts.map