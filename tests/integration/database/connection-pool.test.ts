/**
 * Database Connection Pool Integration Tests
 *
 * Tests the connection pool behavior with real SQLite databases:
 * - Write-before-read initialization order (critical for fresh databases)
 * - Connection pooling and reuse
 * - Concurrent read/write operations
 * - Health checks and recovery
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { DatabaseConnectionPool } from '../../../src/core/database/connection-pool.js';

describe('Database Connection Pool Integration', () => {
  let testDir: string;
  let pool: DatabaseConnectionPool | null = null;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'db-pool-test-'));
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
      pool = null;
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Initialization Order', () => {
    it('should create database file when pool initializes with fresh path', async () => {
      const dbPath = join(testDir, 'fresh.db');

      // Verify database does NOT exist before pool creation
      const existsBefore = await access(dbPath).then(() => true).catch(() => false);
      expect(existsBefore).toBe(false);

      // Create pool - write connections should create the file
      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 2,
        writePoolSize: 1
      });

      // Verify database file was created
      const existsAfter = await access(dbPath).then(() => true).catch(() => false);
      expect(existsAfter).toBe(true);
    });

    it('should handle pre-created directory for database path', async () => {
      // Note: ConnectionPool doesn't create directories (unlike DatabaseFactory)
      // The directory must exist before creating the pool
      const nestedDir = join(testDir, 'nested', 'deeply');
      const nestedPath = join(nestedDir, 'db.sqlite');

      // Create the directory first (simulating normal application setup)
      await mkdir(nestedDir, { recursive: true });

      // Pool creation should succeed
      pool = new DatabaseConnectionPool({
        dbPath: nestedPath,
        readPoolSize: 1,
        writePoolSize: 1
      });

      // Database should be accessible
      const conn = await pool.acquire(false); // write connection
      expect(conn).toBeDefined();
      await pool.release(conn);
    });

    it('should work with existing database file', async () => {
      const dbPath = join(testDir, 'existing.db');

      // Create a minimal SQLite database file first
      const setupPool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 1,
        writePoolSize: 1
      });
      await setupPool.shutdown();

      // Now create a new pool with the existing database
      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 3,
        writePoolSize: 1
      });

      // Should be able to acquire connections
      const readConn = await pool.acquire(true);  // read
      const writeConn = await pool.acquire(false); // write

      expect(readConn).toBeDefined();
      expect(writeConn).toBeDefined();

      await pool.release(readConn);
      await pool.release(writeConn);
    });

    it('should create write connections before read connections (initialization order)', async () => {
      const dbPath = join(testDir, 'order-test.db');

      // This test verifies the bug fix: write connections must be created first
      // because they can create the database file, while read connections
      // require the file to exist (fileMustExist: true)

      // If read connections were created first, this would throw:
      // "Cannot open database because the file does not exist"
      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 3,
        writePoolSize: 1
      });

      // If we get here without error, the order is correct
      const stats = pool.getStats();
      expect(stats.writePool.total).toBe(1);
      expect(stats.readPool.total).toBe(3);
    });
  });

  describe('Connection Pooling', () => {
    it('should maintain separate read and write pools', async () => {
      const dbPath = join(testDir, 'pools.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 3,
        writePoolSize: 1
      });

      const stats = pool.getStats();
      expect(stats.readPool.total).toBe(3);
      expect(stats.writePool.total).toBe(1);
    });

    it('should track connection availability correctly', async () => {
      const dbPath = join(testDir, 'availability.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 2,
        writePoolSize: 1
      });

      // All connections should be idle initially
      let stats = pool.getStats();
      expect(stats.readPool.idle).toBe(2);
      expect(stats.writePool.idle).toBe(1);

      // Acquire a read connection
      const readConn = await pool.acquire(true);
      stats = pool.getStats();
      expect(stats.readPool.idle).toBe(1);
      expect(stats.readPool.busy).toBe(1);

      // Acquire write connection
      const writeConn = await pool.acquire(false);
      stats = pool.getStats();
      expect(stats.writePool.idle).toBe(0);
      expect(stats.writePool.busy).toBe(1);

      // Release connections
      await pool.release(readConn);
      await pool.release(writeConn);

      stats = pool.getStats();
      expect(stats.readPool.idle).toBe(2);
      expect(stats.writePool.idle).toBe(1);
    });

    it('should allow concurrent read connections', async () => {
      const dbPath = join(testDir, 'concurrent-read.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 3,
        writePoolSize: 1
      });

      // Acquire multiple read connections simultaneously
      const [conn1, conn2, conn3] = await Promise.all([
        pool.acquire(true),
        pool.acquire(true),
        pool.acquire(true)
      ]);

      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();
      expect(conn3).toBeDefined();

      // All different connections
      expect(conn1).not.toBe(conn2);
      expect(conn2).not.toBe(conn3);

      // Release all
      await Promise.all([
        pool.release(conn1),
        pool.release(conn2),
        pool.release(conn3)
      ]);
    });
  });

  describe('Database Operations', () => {
    it('should execute read and write operations correctly', async () => {
      const dbPath = join(testDir, 'operations.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 2,
        writePoolSize: 1
      });

      // Create table using write connection
      const writeConn = await pool.acquire(false);
      writeConn.db.exec(`
        CREATE TABLE IF NOT EXISTS test_data (
          id INTEGER PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      writeConn.db.prepare('INSERT INTO test_data (value) VALUES (?)').run('test-value');
      await pool.release(writeConn);

      // Read using read connection
      const readConn = await pool.acquire(true);
      const result = readConn.db.prepare('SELECT value FROM test_data WHERE id = 1').get() as { value: string };
      expect(result.value).toBe('test-value');
      await pool.release(readConn);
    });

    it('should handle concurrent reads during write', async () => {
      const dbPath = join(testDir, 'concurrent-ops.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 2,
        writePoolSize: 1
      });

      // Setup table
      const setupConn = await pool.acquire(false);
      setupConn.db.exec(`
        CREATE TABLE IF NOT EXISTS counter (
          id INTEGER PRIMARY KEY,
          count INTEGER DEFAULT 0
        )
      `);
      setupConn.db.prepare('INSERT INTO counter (count) VALUES (0)').run();
      await pool.release(setupConn);

      // Start a write operation
      const writeConn = await pool.acquire(false);

      // Concurrent read should still work (WAL mode)
      const readConn = await pool.acquire(true);
      const before = readConn.db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
      expect(before.count).toBe(0);
      await pool.release(readConn);

      // Complete write
      writeConn.db.prepare('UPDATE counter SET count = count + 1 WHERE id = 1').run();
      await pool.release(writeConn);

      // Verify write completed
      const verifyConn = await pool.acquire(true);
      const after = verifyConn.db.prepare('SELECT count FROM counter WHERE id = 1').get() as { count: number };
      expect(after.count).toBe(1);
      await pool.release(verifyConn);
    });
  });

  describe('Shutdown', () => {
    it('should cleanly shutdown all connections', async () => {
      const dbPath = join(testDir, 'shutdown.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 2,
        writePoolSize: 1
      });

      // Verify pool is active
      expect(pool.getStats().readPool.total).toBe(2);

      // Shutdown
      await pool.shutdown();

      // Stats should show zero connections
      const stats = pool.getStats();
      expect(stats.readPool.total).toBe(0);
      expect(stats.writePool.total).toBe(0);

      // Mark as null to prevent double shutdown in afterEach
      pool = null;
    });

    it('should handle shutdown with active connections gracefully', async () => {
      const dbPath = join(testDir, 'shutdown-active.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 2,
        writePoolSize: 1
      });

      // Acquire a connection but don't release it
      const conn = await pool.acquire(true);
      expect(conn).toBeDefined();

      // Shutdown should still complete (may log warning)
      await pool.shutdown();
      pool = null;
    });
  });

  describe('Dynamic Pool Sizing', () => {
    it('should use explicit pool size when provided', async () => {
      const dbPath = join(testDir, 'explicit-size.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 5,  // Explicit size
        writePoolSize: 2,
        autoDetect: true  // Should be ignored when explicit size provided
      });

      const stats = pool.getStats();
      expect(stats.readPool.total).toBe(5);
      expect(stats.writePool.total).toBe(2);
    });

    it('should use auto-detected size when enabled without explicit size', async () => {
      const dbPath = join(testDir, 'auto-size.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        // No explicit readPoolSize
        writePoolSize: 1,
        autoDetect: true,
        minPoolSize: 2,
        maxPoolSize: 8
      });

      const stats = pool.getStats();
      // Should be between min and max
      expect(stats.readPool.total).toBeGreaterThanOrEqual(2);
      expect(stats.readPool.total).toBeLessThanOrEqual(8);
    });
  });

  describe('Query Count Tracking', () => {
    it('should increment query count when connections are acquired', async () => {
      const dbPath = join(testDir, 'query-count.db');

      pool = new DatabaseConnectionPool({
        dbPath,
        readPoolSize: 1,
        writePoolSize: 1
      });

      // Initial query count should be 0
      let stats = pool.getStats();
      expect(stats.readPool.totalQueries).toBe(0);

      // Acquire and release read connection multiple times
      for (let i = 0; i < 3; i++) {
        const conn = await pool.acquire(true);
        await pool.release(conn);
      }

      stats = pool.getStats();
      expect(stats.readPool.totalQueries).toBe(3);
    });
  });
});
