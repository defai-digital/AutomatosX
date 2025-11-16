/**
 * migrations.ts
 *
 * Database migration system for AutomatosX
 * Tracks and applies SQL migrations in order
 */

import { getDatabase } from './connection.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

/**
 * Migration record
 */
interface Migration {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Initialize migrations tracking table
 */
function initMigrationsTable(db?: Database.Database): void {
  const database = db || getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(db?: Database.Database): Set<string> {
  const database = db || getDatabase();

  const stmt = database.prepare('SELECT name FROM migrations ORDER BY id');
  const rows = stmt.all() as Migration[];

  return new Set(rows.map((row) => row.name));
}

/**
 * Get list of migration files
 */
function getMigrationFiles(): string[] {
  const migrationsDir = join(process.cwd(), 'src', 'migrations');
  const files = readdirSync(migrationsDir);

  return files
    .filter((file) => file.endsWith('.sql'))
    .sort(); // Sort alphabetically (001_xxx.sql, 002_xxx.sql, etc.)
}

/**
 * Apply a single migration
 */
function applyMigration(name: string, sql: string, db?: Database.Database): void {
  const database = db || getDatabase();

  console.log(`  Applying migration: ${name}`);

  // Execute migration in a transaction
  const transaction = database.transaction(() => {
    // Execute the migration SQL
    database.exec(sql);

    // Record migration as applied
    const stmt = database.prepare('INSERT INTO migrations (name) VALUES (?)');
    stmt.run(name);
  });

  transaction();

  console.log(`  ✓ Applied: ${name}`);
}

/**
 * Run all pending migrations
 *
 * @param db - Optional database instance (for testing)
 * @returns Number of migrations applied
 */
export function runMigrations(db?: Database.Database): number {
  console.log('Running database migrations...');

  // Initialize migrations table
  initMigrationsTable(db);

  // Get applied migrations
  const appliedMigrations = getAppliedMigrations(db);

  // Get migration files
  const migrationFiles = getMigrationFiles();

  if (migrationFiles.length === 0) {
    console.log('  No migrations found.');
    return 0;
  }

  // Find pending migrations
  const pendingMigrations = migrationFiles.filter(
    (file) => !appliedMigrations.has(file)
  );

  if (pendingMigrations.length === 0) {
    console.log('  All migrations already applied.');
    return 0;
  }

  console.log(`  Found ${pendingMigrations.length} pending migration(s)`);

  // Apply pending migrations
  const migrationsDir = join(process.cwd(), 'src', 'migrations');

  for (const migrationFile of pendingMigrations) {
    const migrationPath = join(migrationsDir, migrationFile);
    const sql = readFileSync(migrationPath, 'utf-8');

    applyMigration(migrationFile, sql, db);
  }

  console.log(`✓ Migrations complete (${pendingMigrations.length} applied)`);

  return pendingMigrations.length;
}

/**
 * Get migration status
 *
 * @param db - Optional database instance (for testing)
 */
export function getMigrationStatus(db?: Database.Database): {
  total: number;
  applied: number;
  pending: number;
} {
  initMigrationsTable(db);

  const appliedMigrations = getAppliedMigrations(db);
  const migrationFiles = getMigrationFiles();

  return {
    total: migrationFiles.length,
    applied: appliedMigrations.size,
    pending: migrationFiles.length - appliedMigrations.size,
  };
}
