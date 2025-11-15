/**
 * index.ts
 *
 * Database module exports
 */
export { getDatabase, closeDatabase, DEFAULT_DB_PATH } from './connection.js';
export { runMigrations } from './migrations.js';
/**
 * Get the database path
 * Returns the default database path
 */
export declare function getDatabasePath(): string;
//# sourceMappingURL=index.d.ts.map