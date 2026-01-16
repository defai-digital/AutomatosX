/**
 * Shared validation utilities for SQLite adapters
 *
 * Centralizes common validation logic to avoid duplication across stores.
 */

/**
 * Validates a SQL table name to prevent SQL injection.
 * Only allows alphanumeric characters and underscores, must start with letter or underscore.
 *
 * @param name - The table name to validate
 * @returns true if valid, false otherwise
 */
export function isValidTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 64;
}

/**
 * Error code for invalid table name (shared across stores)
 */
export const INVALID_TABLE_NAME_ERROR = 'SQLITE_INVALID_TABLE_NAME';

/**
 * Generates a consistent error message for invalid table names
 */
export function invalidTableNameMessage(tableName: string): string {
  return `Invalid table name: ${tableName}. Must start with letter or underscore, contain only alphanumeric and underscores, max 64 chars.`;
}
