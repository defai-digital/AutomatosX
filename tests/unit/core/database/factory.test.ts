/**
 * Tests for DatabaseFactory - Standardized SQLite database creation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync } from 'fs';
import Database from 'better-sqlite3';

// Mock dependencies
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../../src/core/validation-limits.js', () => ({
  DATABASE: {
    BUSY_TIMEOUT: 5000
  }
}));

describe('DatabaseFactory', () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a unique test directory for each test
    testDir = join(tmpdir(), `db-factory-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('DatabaseFactory.create', () => {
    it('should create in-memory database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.create(':memory:');

      expect(db).toBeDefined();
      expect(db.open).toBe(true);
      expect(db.memory).toBe(true);

      db.close();
    });

    it('should create database with default options', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const dbPath = join(testDir, 'test.db');
      const db = DatabaseFactory.create(dbPath);

      expect(db).toBeDefined();
      expect(db.open).toBe(true);
      expect(db.readonly).toBe(false);
      expect(existsSync(dbPath)).toBe(true);

      db.close();
    });

    it('should create directory if it does not exist', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const nestedDir = join(testDir, 'nested', 'deep', 'path');
      const dbPath = join(nestedDir, 'test.db');

      expect(existsSync(nestedDir)).toBe(false);

      const db = DatabaseFactory.create(dbPath);

      expect(existsSync(nestedDir)).toBe(true);
      expect(db.open).toBe(true);

      db.close();
    });

    it('should skip directory creation for in-memory database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // This should not throw even though the path looks like a directory
      const db = DatabaseFactory.create(':memory:', { createDir: true });

      expect(db.open).toBe(true);
      expect(db.memory).toBe(true);

      db.close();
    });

    it('should skip directory creation when createDir is false', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const nonExistentDir = join(testDir, 'nonexistent');
      const dbPath = join(nonExistentDir, 'test.db');

      // Should throw because directory doesn't exist and createDir is false
      expect(() => {
        DatabaseFactory.create(dbPath, { createDir: false });
      }).toThrow();
    });

    it('should create readonly database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // First create a regular database
      const dbPath = join(testDir, 'readonly-test.db');
      mkdirSync(testDir, { recursive: true });
      const writeDb = new Database(dbPath);
      writeDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      writeDb.close();

      // Now open it readonly
      const db = DatabaseFactory.create(dbPath, { readonly: true });

      expect(db.open).toBe(true);
      expect(db.readonly).toBe(true);

      // Should throw when trying to write
      expect(() => {
        db.exec('INSERT INTO test VALUES (1)');
      }).toThrow();

      db.close();
    });

    it('should configure busyTimeout', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.create(':memory:', { busyTimeout: 10000 });

      // Verify busy_timeout was set (we can check via pragma)
      const timeout = db.pragma('busy_timeout', { simple: true });
      expect(timeout).toBe(10000);

      db.close();
    });

    it('should skip busyTimeout when set to 0', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.create(':memory:', { busyTimeout: 0 });

      // With 0, the default SQLite behavior applies
      expect(db.open).toBe(true);

      db.close();
    });

    it('should enable WAL mode by default', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const dbPath = join(testDir, 'wal-test.db');
      const db = DatabaseFactory.create(dbPath);

      const journalMode = db.pragma('journal_mode', { simple: true });
      expect(journalMode).toBe('wal');

      db.close();
    });

    it('should skip WAL mode when disabled', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const dbPath = join(testDir, 'no-wal-test.db');
      const db = DatabaseFactory.create(dbPath, { enableWal: false });

      const journalMode = db.pragma('journal_mode', { simple: true });
      // Default is 'delete' when WAL is not enabled
      expect(journalMode).not.toBe('wal');

      db.close();
    });

    it('should skip WAL mode for readonly databases', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // First create a regular database
      const dbPath = join(testDir, 'readonly-wal-test.db');
      mkdirSync(testDir, { recursive: true });
      const writeDb = new Database(dbPath);
      writeDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      writeDb.close();

      // Open readonly with WAL enabled - should not try to set WAL
      const db = DatabaseFactory.create(dbPath, { readonly: true, enableWal: true });

      expect(db.open).toBe(true);
      expect(db.readonly).toBe(true);

      db.close();
    });

    it('should throw error for invalid path', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      expect(() => {
        DatabaseFactory.create('');
      }).toThrow('Invalid database path');

      expect(() => {
        DatabaseFactory.create(null as unknown as string);
      }).toThrow('Invalid database path');

      expect(() => {
        DatabaseFactory.create(undefined as unknown as string);
      }).toThrow('Invalid database path');
    });

    it('should enable verbose logging when requested', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      const db = DatabaseFactory.create(':memory:', { verbose: true });

      // Execute a query to trigger verbose logging
      db.exec('SELECT 1');

      // The verbose callback should have been set
      expect(db.open).toBe(true);

      db.close();
    });
  });

  describe('DatabaseFactory.createInMemory', () => {
    it('should create in-memory database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();

      expect(db.open).toBe(true);
      expect(db.memory).toBe(true);

      db.close();
    });

    it('should accept custom options', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory({ busyTimeout: 1000 });

      expect(db.open).toBe(true);
      const timeout = db.pragma('busy_timeout', { simple: true });
      expect(timeout).toBe(1000);

      db.close();
    });
  });

  describe('DatabaseFactory.createReadOnly', () => {
    it('should create readonly database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // First create a regular database
      const dbPath = join(testDir, 'readonly-test2.db');
      mkdirSync(testDir, { recursive: true });
      const writeDb = new Database(dbPath);
      writeDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      writeDb.close();

      const db = DatabaseFactory.createReadOnly(dbPath);

      expect(db.open).toBe(true);
      expect(db.readonly).toBe(true);

      db.close();
    });

    it('should accept additional options', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // First create a regular database
      const dbPath = join(testDir, 'readonly-opts-test.db');
      mkdirSync(testDir, { recursive: true });
      const writeDb = new Database(dbPath);
      writeDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      writeDb.close();

      const db = DatabaseFactory.createReadOnly(dbPath, { busyTimeout: 2000 });

      expect(db.readonly).toBe(true);
      const timeout = db.pragma('busy_timeout', { simple: true });
      expect(timeout).toBe(2000);

      db.close();
    });
  });

  describe('DatabaseFactory.testConnection', () => {
    it('should return true for valid connection', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();

      const result = DatabaseFactory.testConnection(db);

      expect(result).toBe(true);

      db.close();
    });

    it('should return false for closed connection', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();
      db.close();

      const result = DatabaseFactory.testConnection(db);

      expect(result).toBe(false);
    });
  });

  describe('DatabaseFactory.close', () => {
    it('should close open database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();
      expect(db.open).toBe(true);

      DatabaseFactory.close(db);

      expect(db.open).toBe(false);
    });

    it('should handle null database gracefully', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // Should not throw
      expect(() => {
        DatabaseFactory.close(null);
      }).not.toThrow();
    });

    it('should handle undefined database gracefully', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // Should not throw
      expect(() => {
        DatabaseFactory.close(undefined);
      }).not.toThrow();
    });

    it('should handle already closed database', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();
      db.close();

      // Should not throw
      expect(() => {
        DatabaseFactory.close(db);
      }).not.toThrow();
    });
  });

  describe('DatabaseFactory.getStats', () => {
    it('should return database statistics', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();

      const stats = DatabaseFactory.getStats(db);

      expect(stats.path).toBe(':memory:');
      expect(stats.readonly).toBe(false);
      expect(stats.open).toBe(true);
      expect(stats.memory).toBe(true);
      expect(stats.inTransaction).toBe(false);

      db.close();
    });

    it('should reflect readonly status', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      // First create a regular database
      const dbPath = join(testDir, 'stats-readonly-test.db');
      mkdirSync(testDir, { recursive: true });
      const writeDb = new Database(dbPath);
      writeDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      writeDb.close();

      const db = DatabaseFactory.createReadOnly(dbPath);

      const stats = DatabaseFactory.getStats(db);

      expect(stats.readonly).toBe(true);

      db.close();
    });

    it('should reflect transaction status', async () => {
      const { DatabaseFactory } = await import('../../../../src/core/database/factory.js');

      const db = DatabaseFactory.createInMemory();
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      // Start a transaction
      db.exec('BEGIN');

      const stats = DatabaseFactory.getStats(db);
      expect(stats.inTransaction).toBe(true);

      db.exec('COMMIT');

      const statsAfter = DatabaseFactory.getStats(db);
      expect(statsAfter.inTransaction).toBe(false);

      db.close();
    });
  });
});

describe('DbConnectionPool', () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = join(tmpdir(), `db-pool-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should create and cache connections', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    const db1 = pool.get('test', ':memory:');
    const db2 = pool.get('test', ':memory:');

    // Should return the same connection
    expect(db1).toBe(db2);
    expect(pool.size).toBe(1);

    pool.closeAll();
  });

  it('should create separate connections for different keys', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    const db1 = pool.get('conn1', ':memory:');
    const db2 = pool.get('conn2', ':memory:');

    expect(db1).not.toBe(db2);
    expect(pool.size).toBe(2);

    pool.closeAll();
  });

  it('should close specific connection', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    pool.get('conn1', ':memory:');
    pool.get('conn2', ':memory:');

    expect(pool.size).toBe(2);

    pool.close('conn1');

    expect(pool.size).toBe(1);

    pool.closeAll();
  });

  it('should close all connections', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    pool.get('conn1', ':memory:');
    pool.get('conn2', ':memory:');
    pool.get('conn3', ':memory:');

    expect(pool.size).toBe(3);

    pool.closeAll();

    expect(pool.size).toBe(0);
  });

  it('should recreate closed connection', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    const db1 = pool.get('test', ':memory:');
    db1.close();

    // Getting the same key should create a new connection
    const db2 = pool.get('test', ':memory:');

    expect(db2.open).toBe(true);
    expect(db1).not.toBe(db2);

    pool.closeAll();
  });

  it('should handle closing non-existent key', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    // Should not throw
    expect(() => {
      pool.close('nonexistent');
    }).not.toThrow();
  });

  it('should pass options to connection', async () => {
    const { DbConnectionPool } = await import('../../../../src/core/database/factory.js');

    const pool = new DbConnectionPool();

    const db = pool.get('test', ':memory:', { busyTimeout: 15000 });

    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(15000);

    pool.closeAll();
  });
});
