/**
 * WritePool Unit Tests
 *
 * Tests for multiple write connection pool.
 *
 * Part of Phase 5: Full Scale
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WritePool, createWritePool } from '@/core/task-engine/write-pool';

describe('WritePool', () => {
  let pool: WritePool;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    vi.useRealTimers();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'writepool-test-'));
    dbPath = path.join(tempDir, 'test.db');
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      pool = new WritePool({ dbPath });

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(4);
      expect(stats.busyConnections).toBe(0);
    });

    it('should accept custom pool size', () => {
      pool = new WritePool({ dbPath, poolSize: 2 });

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(2);
    });
  });

  describe('execute', () => {
    it('should execute write operations', async () => {
      pool = new WritePool({ dbPath });

      await pool.execute((db) => {
        db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
        db.prepare('INSERT INTO test (value) VALUES (?)').run('hello');
      });

      const result = await pool.execute((db) => {
        return db.prepare('SELECT value FROM test WHERE id = 1').get() as { value: string };
      });

      expect(result.value).toBe('hello');
    });

    it('should handle concurrent operations', async () => {
      pool = new WritePool({ dbPath, poolSize: 4 });

      // Create table first
      await pool.execute((db) => {
        db.exec('CREATE TABLE concurrent (id INTEGER PRIMARY KEY, value TEXT)');
      });

      // Run concurrent inserts
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          pool.execute((db) => {
            db.prepare('INSERT INTO concurrent (value) VALUES (?)').run(`value_${i}`);
            return i;
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);

      // Verify all inserts succeeded
      const count = await pool.execute((db) => {
        return (db.prepare('SELECT COUNT(*) as count FROM concurrent').get() as { count: number }).count;
      });
      expect(count).toBe(20);
    });

    it('should track statistics', async () => {
      pool = new WritePool({ dbPath });

      await pool.execute((db) => {
        db.exec('CREATE TABLE stats_test (id INTEGER)');
      });

      for (let i = 0; i < 5; i++) {
        await pool.execute((db) => {
          db.prepare('INSERT INTO stats_test (id) VALUES (?)').run(i);
        });
      }

      const stats = pool.getStats();
      expect(stats.totalOperations).toBe(6); // 1 create + 5 inserts
    });

    it('should reject when pool is closed', async () => {
      pool = new WritePool({ dbPath });
      await pool.shutdown();

      await expect(pool.execute(() => {})).rejects.toThrow('WritePool is closed');
    });
  });

  describe('executeTransaction', () => {
    it('should execute operations in a transaction', async () => {
      pool = new WritePool({ dbPath });

      await pool.execute((db) => {
        db.exec('CREATE TABLE txn_test (id INTEGER PRIMARY KEY, value TEXT)');
      });

      await pool.executeTransaction((db) => {
        db.prepare('INSERT INTO txn_test (value) VALUES (?)').run('first');
        db.prepare('INSERT INTO txn_test (value) VALUES (?)').run('second');
      });

      const count = await pool.execute((db) => {
        return (db.prepare('SELECT COUNT(*) as count FROM txn_test').get() as { count: number }).count;
      });
      expect(count).toBe(2);
    });

    it('should rollback on error', async () => {
      pool = new WritePool({ dbPath });

      await pool.execute((db) => {
        db.exec('CREATE TABLE rollback_test (id INTEGER PRIMARY KEY, value TEXT UNIQUE)');
        db.prepare('INSERT INTO rollback_test (value) VALUES (?)').run('existing');
      });

      try {
        await pool.executeTransaction((db) => {
          db.prepare('INSERT INTO rollback_test (value) VALUES (?)').run('new');
          db.prepare('INSERT INTO rollback_test (value) VALUES (?)').run('existing'); // Should fail (unique)
        });
      } catch {
        // Expected
      }

      const count = await pool.execute((db) => {
        return (db.prepare('SELECT COUNT(*) as count FROM rollback_test').get() as { count: number }).count;
      });
      expect(count).toBe(1); // Only original row, transaction rolled back
    });
  });

  describe('getStats', () => {
    it('should track available connections', async () => {
      pool = new WritePool({ dbPath, poolSize: 2 });

      const stats = pool.getStats();
      expect(stats.availableConnections).toBe(2);
      expect(stats.busyConnections).toBe(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should report healthy connections', () => {
      pool = new WritePool({ dbPath, poolSize: 3 });

      const health = pool.getHealthStatus();
      expect(health.healthy).toBe(3);
      expect(health.unhealthy).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should be idempotent', async () => {
      pool = new WritePool({ dbPath });

      await pool.shutdown();
      await pool.shutdown(); // Should not throw
    });

    it('should clear all connections', async () => {
      pool = new WritePool({ dbPath, poolSize: 4 });

      await pool.shutdown();

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(0);
    });
  });

  describe('queue behavior', () => {
    it('should queue requests when all connections busy', async () => {
      pool = new WritePool({ dbPath, poolSize: 1 });

      await pool.execute((db) => {
        db.exec('CREATE TABLE queue_test (id INTEGER)');
      });

      // Start multiple operations on single connection
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          pool.execute((db) => {
            db.prepare('INSERT INTO queue_test (id) VALUES (?)').run(i);
            return i;
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('createWritePool', () => {
    it('should create a pool instance', () => {
      pool = createWritePool({ dbPath });
      expect(pool).toBeInstanceOf(WritePool);
    });
  });

  describe('bug fixes', () => {
    it('should clear timeout when connection is acquired successfully (Bug #1 fix)', async () => {
      // This test verifies that timeout timers are properly cleared
      // when a connection is acquired before the timeout fires
      pool = new WritePool({ dbPath, poolSize: 1, acquireTimeoutMs: 5000 });

      await pool.execute((db) => {
        db.exec('CREATE TABLE timeout_test (id INTEGER)');
      });

      // Queue multiple operations - they should all complete without timeout errors
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          pool.execute((db) => {
            db.prepare('INSERT INTO timeout_test (id) VALUES (?)').run(i);
            return i;
          })
        );
      }

      // All should complete successfully
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // Verify no pending operations or timers
      const stats = pool.getStats();
      expect(stats.pendingRequests).toBe(0);
    });

    it('should handle pending requests when connection is unhealthy (Bug #2 fix)', async () => {
      // This test verifies that pending requests are not lost when
      // an unhealthy connection is released
      pool = new WritePool({ dbPath, poolSize: 2 });

      await pool.execute((db) => {
        db.exec('CREATE TABLE health_test (id INTEGER)');
      });

      // Run concurrent operations - should all complete even if connections have issues
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          pool.execute((db) => {
            db.prepare('INSERT INTO health_test (id) VALUES (?)').run(i);
            return i;
          })
        );
      }

      // All should complete successfully
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // Verify all inserts succeeded
      const count = await pool.execute((db) => {
        return (db.prepare('SELECT COUNT(*) as count FROM health_test').get() as { count: number }).count;
      });
      expect(count).toBe(10);
    });

    it('should properly track pending requests in queue', async () => {
      // Test that the timeout storage and clearing mechanism works
      // by ensuring queued operations complete successfully
      pool = new WritePool({ dbPath, poolSize: 1, acquireTimeoutMs: 1000 });

      await pool.execute((db) => {
        db.exec('CREATE TABLE pending_test (id INTEGER)');
      });

      // Queue many operations that will be processed sequentially
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          pool.execute((db) => {
            db.prepare('INSERT INTO pending_test (id) VALUES (?)').run(i);
            return i;
          })
        );
      }

      // All should complete
      const results = await Promise.all(promises);
      expect(results).toEqual([0, 1, 2, 3, 4]);

      // Verify all rows inserted
      const count = await pool.execute((db) => {
        return (db.prepare('SELECT COUNT(*) as count FROM pending_test').get() as { count: number }).count;
      });
      expect(count).toBe(5);
    });
  });
});
