/**
 * connection.ts
 *
 * Database connection manager for AutomatosX v2
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
 * @param config - Database configuration
 * @returns Database instance
 */
export declare function getDatabase(config?: Partial<DatabaseConfig>): Database.Database;
/**
 * Close database connection
 */
export declare function closeDatabase(): void;
/**
 * Set database instance (for testing)
 * @param db - Database instance to use
 */
export declare function setDatabase(db: Database.Database): void;
/**
 * Execute a query with parameters
 * Helper function for common database operations
 */
export declare function query<T = any>(sql: string, params?: any[]): T[];
/**
 * Execute a single-row query
 */
export declare function queryOne<T = any>(sql: string, params?: any[]): T | null;
/**
 * Execute a write operation (INSERT, UPDATE, DELETE)
 */
export declare function execute(sql: string, params?: any[]): Database.RunResult;
/**
 * Execute multiple statements in a transaction
 */
export declare function transaction<T>(fn: () => T): T;
//# sourceMappingURL=connection.d.ts.map