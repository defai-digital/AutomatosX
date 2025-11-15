/**
 * migrations.ts
 *
 * Database migration system for AutomatosX v2
 * Tracks and applies SQL migrations in order
 */
import Database from 'better-sqlite3';
/**
 * Run all pending migrations
 *
 * @param db - Optional database instance (for testing)
 * @returns Number of migrations applied
 */
export declare function runMigrations(db?: Database.Database): number;
/**
 * Get migration status
 *
 * @param db - Optional database instance (for testing)
 */
export declare function getMigrationStatus(db?: Database.Database): {
    total: number;
    applied: number;
    pending: number;
};
//# sourceMappingURL=migrations.d.ts.map