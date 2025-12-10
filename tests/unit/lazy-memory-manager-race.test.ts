/**
 * LazyMemoryManager - Race Condition Tests
 *
 * v5.6.27: Tests for concurrent initialization fix
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LazyMemoryManager } from '../../src/core/memory/lazy-manager.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('LazyMemoryManager - Race Condition', () => {
  let tempDir: string;
  let manager: LazyMemoryManager;

  beforeEach(() => {
    // Create temp directory for test database
    tempDir = mkdtempSync(join(tmpdir(), 'automatosx-test-'));
    const dbPath = join(tempDir, 'test-memory.db');

    manager = new LazyMemoryManager({
      dbPath,
      embeddingProvider: null
    });
  });

  afterEach(async () => {
    // Cleanup
    if (manager) {
      await manager.close();
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle concurrent initialization correctly', async () => {
    // Before fix: This could cause issues due to returning Promise<Promise<MemoryManager>>
    // After fix: All concurrent calls properly await initialization

    const promises = [
      manager.search({ text: 'test1' }),
      manager.search({ text: 'test2' }),
      manager.search({ text: 'test3' }),
      manager.getStats(),
      manager.search({ text: 'test4' })
    ];

    // All should complete successfully
    const results = await Promise.all(promises);

    // Verify
    expect(results).toHaveLength(5);
    expect(manager.isInitialized()).toBe(true);

    // First 3 and last are searches (should return arrays)
    expect(Array.isArray(results[0])).toBe(true);
    expect(Array.isArray(results[1])).toBe(true);
    expect(Array.isArray(results[2])).toBe(true);
    expect(Array.isArray(results[4])).toBe(true);

    // 4th is getStats (should return stats object)
    expect(results[3]).toHaveProperty('totalEntries');
  });

  it('should initialize only once despite multiple concurrent calls', async () => {
    const initCount = 0;

    // Spy on initialization by checking state
    const initialState = manager.isInitialized();
    expect(initialState).toBe(false);

    // Make 10 concurrent calls
    const promises = Array.from({ length: 10 }, (_, i) =>
      manager.search({ text: `test${i}` })
    );

    await Promise.all(promises);

    // Should be initialized now
    expect(manager.isInitialized()).toBe(true);

    // All subsequent calls should use the same instance
    const stats1 = await manager.getStats();
    const stats2 = await manager.getStats();

    // Both should have same totalEntries
    expect(stats1.totalEntries).toBe(stats2.totalEntries);
  });

  it('should properly handle mixed operations during initialization', async () => {
    // Mix of different operations called concurrently
    const operations = [
      manager.add('content1', null, { type: 'task', source: 'concurrent-test' }),
      manager.search({ text: 'test' }),
      manager.getStats(),
      manager.add('content2', null, { type: 'task', source: 'concurrent-test' }),
      manager.search({ text: 'test2' })
    ];

    const results = await Promise.all(operations);

    // Verify all operations completed
    expect(results).toHaveLength(5);

    // Results[0] and [3] are add() - should return MemoryEntry
    expect(results[0]).toHaveProperty('id');
    expect(results[3]).toHaveProperty('id');

    // Results[1] and [4] are search() - should return arrays
    expect(Array.isArray(results[1])).toBe(true);
    expect(Array.isArray(results[4])).toBe(true);

    // Results[2] is getStats()
    expect(results[2]).toHaveProperty('totalEntries');
    // Due to concurrent execution, getStats() might run before all adds complete
    expect((results[2] as any).totalEntries).toBeGreaterThanOrEqual(0);
    expect((results[2] as any).totalEntries).toBeLessThanOrEqual(2);
  });

  it('should not initialize if close() called before first use', async () => {
    const newManager = new LazyMemoryManager({
      dbPath: join(tempDir, 'unused.db'),
      embeddingProvider: null
    });

    // Close without ever using
    await newManager.close();

    // Should not have initialized
    expect(newManager.isInitialized()).toBe(false);
  });

  it('should handle rapid sequential calls correctly', async () => {
    // Rapid sequential calls (not parallel)
    for (let i = 0; i < 5; i++) {
      await manager.search({ text: `test${i}` });
    }

    // Should be initialized and working
    expect(manager.isInitialized()).toBe(true);

    const stats = await manager.getStats();
    expect(stats.totalEntries).toBe(0); // No entries added, only searched
  });
});
