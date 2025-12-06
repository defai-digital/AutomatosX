/**
 * WriteBatcher Unit Tests
 *
 * Tests for database write batching functionality.
 *
 * Part of Phase 3: Scaling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { WriteBatcher, createWriteBatcher } from '@/core/task-engine/write-batcher';

describe('WriteBatcher', () => {
  let db: Database.Database;
  let batcher: WriteBatcher;

  beforeEach(() => {
    vi.useRealTimers();
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE test_data (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  });

  afterEach(async () => {
    if (batcher) {
      await batcher.shutdown();
    }
    if (db) {
      db.close();
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      batcher = new WriteBatcher(db);
      expect(batcher.isClosed).toBe(false);
      expect(batcher.pendingCount).toBe(0);
    });

    it('should accept custom config', () => {
      batcher = new WriteBatcher(db, {
        batchWindowMs: 50,
        maxBatchSize: 10,
        debug: true
      });
      expect(batcher.isClosed).toBe(false);
    });
  });

  describe('enqueue', () => {
    it('should enqueue a single write operation', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 10 });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      const result = await batcher.enqueue(stmt, {
        id: 'test-1',
        value: 'hello',
        created_at: Date.now()
      });

      expect(result.changes).toBe(1);

      // Verify data was inserted
      const row = db.prepare('SELECT * FROM test_data WHERE id = ?').get('test-1') as { id: string; value: string };
      expect(row.value).toBe('hello');
    });

    it('should batch multiple writes', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 50, maxBatchSize: 10 });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Queue multiple writes
      const promises = [
        batcher.enqueue(stmt, { id: 'batch-1', value: 'a', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 'batch-2', value: 'b', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 'batch-3', value: 'c', created_at: Date.now() })
      ];

      await Promise.all(promises);

      // All should be inserted
      const count = (db.prepare('SELECT COUNT(*) as cnt FROM test_data').get() as { cnt: number }).cnt;
      expect(count).toBe(3);

      // Check stats
      const stats = batcher.getStats();
      expect(stats.totalOperations).toBe(3);
      expect(stats.totalBatches).toBe(1);
      expect(stats.avgBatchSize).toBe(3);
    });

    it('should flush immediately when batch is full', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 5000, maxBatchSize: 3 });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Queue exactly maxBatchSize writes
      const promises = [
        batcher.enqueue(stmt, { id: 'full-1', value: 'a', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 'full-2', value: 'b', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 'full-3', value: 'c', created_at: Date.now() })
      ];

      // Should complete quickly (not wait for batch window)
      const start = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - start;

      // Should not wait for 5s window
      expect(duration).toBeLessThan(1000);

      // All should be inserted
      const count = (db.prepare('SELECT COUNT(*) as cnt FROM test_data').get() as { cnt: number }).cnt;
      expect(count).toBe(3);
    });

    it('should reject when batcher is closed', async () => {
      batcher = new WriteBatcher(db);
      await batcher.shutdown();

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      await expect(batcher.enqueue(stmt, { id: '1', value: 'x', created_at: Date.now() }))
        .rejects.toThrow('WriteBatcher is closed');
    });
  });

  describe('flush', () => {
    it('should flush pending operations', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 10000 }); // Long window

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Queue writes (don't await yet)
      const promise = batcher.enqueue(stmt, { id: 'flush-1', value: 'test', created_at: Date.now() });

      // Force flush
      batcher.flush();

      // Should complete immediately after flush
      await promise;

      const row = db.prepare('SELECT * FROM test_data WHERE id = ?').get('flush-1') as { id: string };
      expect(row).toBeDefined();
    });

    it('should handle empty flush', () => {
      batcher = new WriteBatcher(db);

      // Should not throw
      expect(() => batcher.flush()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should reject all promises in batch on error', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 10 });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Queue a valid and an invalid write (duplicate key)
      const promise1 = batcher.enqueue(stmt, { id: 'dup-1', value: 'first', created_at: Date.now() });
      const promise2 = batcher.enqueue(stmt, { id: 'dup-1', value: 'second', created_at: Date.now() }); // Duplicate!

      // Both should reject because the transaction fails
      await expect(Promise.all([promise1, promise2])).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    it('should track statistics', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 10, maxBatchSize: 5 });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Two batches
      await Promise.all([
        batcher.enqueue(stmt, { id: 's1', value: 'a', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 's2', value: 'b', created_at: Date.now() })
      ]);

      await new Promise(r => setTimeout(r, 20)); // Wait for next batch window

      await Promise.all([
        batcher.enqueue(stmt, { id: 's3', value: 'c', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 's4', value: 'd', created_at: Date.now() }),
        batcher.enqueue(stmt, { id: 's5', value: 'e', created_at: Date.now() })
      ]);

      const stats = batcher.getStats();

      expect(stats.totalOperations).toBe(5);
      expect(stats.totalBatches).toBe(2);
      expect(stats.avgBatchSize).toBe(2.5);
      expect(stats.timeSavedMs).toBeGreaterThan(0);
      expect(stats.pendingOperations).toBe(0);
    });

    it('should reset statistics', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 10 });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      await batcher.enqueue(stmt, { id: 'reset-1', value: 'x', created_at: Date.now() });

      expect(batcher.getStats().totalOperations).toBe(1);

      batcher.resetStats();

      expect(batcher.getStats().totalOperations).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should flush pending on shutdown', async () => {
      batcher = new WriteBatcher(db, { batchWindowMs: 10000 }); // Long window

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Queue writes
      const promise = batcher.enqueue(stmt, { id: 'shutdown-1', value: 'final', created_at: Date.now() });

      // Shutdown (should flush)
      await batcher.shutdown();
      await promise;

      const row = db.prepare('SELECT * FROM test_data WHERE id = ?').get('shutdown-1') as { id: string };
      expect(row).toBeDefined();
    });

    it('should flush ALL pending operations even when queue > maxBatchSize (Bug fix)', async () => {
      // This test verifies the fix for a bug where shutdown only flushed one batch
      // instead of all pending operations
      batcher = new WriteBatcher(db, {
        batchWindowMs: 10000, // Long window (won't auto-flush)
        maxBatchSize: 3       // Small batch size
      });

      const stmt = db.prepare('INSERT INTO test_data (id, value, created_at) VALUES (@id, @value, @created_at)');

      // Queue MORE items than maxBatchSize (3)
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          batcher.enqueue(stmt, {
            id: `multi-${i}`,
            value: `value-${i}`,
            created_at: Date.now()
          })
        );
      }

      // Verify items are queued (some may have auto-flushed due to maxBatchSize)
      expect(promises.length).toBe(10);

      // Shutdown should flush ALL remaining operations
      await batcher.shutdown();
      await Promise.all(promises);

      // ALL 10 items should be inserted
      const count = (db.prepare('SELECT COUNT(*) as cnt FROM test_data').get() as { cnt: number }).cnt;
      expect(count).toBe(10);

      // Verify each item exists
      for (let i = 0; i < 10; i++) {
        const row = db.prepare('SELECT * FROM test_data WHERE id = ?').get(`multi-${i}`);
        expect(row).toBeDefined();
      }

      // Stats should show all operations processed
      const stats = batcher.getStats();
      expect(stats.totalOperations).toBe(10);
      expect(stats.pendingOperations).toBe(0);
    });

    it('should be idempotent', async () => {
      batcher = new WriteBatcher(db);

      await batcher.shutdown();
      await batcher.shutdown(); // Should not throw

      expect(batcher.isClosed).toBe(true);
    });
  });

  describe('createWriteBatcher', () => {
    it('should create a batcher instance', () => {
      batcher = createWriteBatcher(db);
      expect(batcher).toBeInstanceOf(WriteBatcher);
    });

    it('should accept custom config', () => {
      batcher = createWriteBatcher(db, { maxBatchSize: 100 });
      expect(batcher).toBeInstanceOf(WriteBatcher);
    });
  });
});
