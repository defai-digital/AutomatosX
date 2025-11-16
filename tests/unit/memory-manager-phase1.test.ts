/**
 * Memory Manager Phase 1 Improvements Tests
 *
 * Tests for:
 * - Transaction atomicity in add() operation
 * - Internal entryCount accuracy
 * - Prepared statement performance
 * - Counter synchronization across all operations
 *
 * v5.0.9: Phase 1 improvements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { MemoryManager } from '../../src/core/memory-manager.js';

describe('Memory Manager - Phase 1 Improvements', () => {
  let memoryManager: MemoryManager;
  let testDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create isolated test directory
    testDir = join(process.cwd(), 'test-memory-phase1-' + Date.now());
    await mkdir(testDir, { recursive: true });

    dbPath = join(testDir, 'test-memory.db');

    memoryManager = await MemoryManager.create({
      dbPath,
      maxEntries: 100,
      cleanupDays: 30,
      autoCleanup: false,
      trackAccess: true
    });
  });

  afterEach(async () => {
    await memoryManager?.close();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Transaction Atomicity', () => {
    it('should atomically cleanup and insert when at maxEntries limit', async () => {
      // Fill to maxEntries
      for (let i = 0; i < 100; i++) {
        await memoryManager.add(
          `Test entry ${i}`,
          null,
          { type: 'other', source: 'unit-test' }
        );
      }

      const statsBefore = await memoryManager.getStats();
      expect(statsBefore.totalEntries).toBe(100);

      // This should trigger cleanup (remove 10) + insert (add 1) = 91 total
      await memoryManager.add(
        'Entry that triggers cleanup',
        null,
        { type: 'other', source: 'cleanup-trigger' }
      );

      const statsAfter = await memoryManager.getStats();
      // After cleanup: 100 - 10 (oldest removed) + 1 (new) = 91
      expect(statsAfter.totalEntries).toBe(91);

      // Verify the new entry was added
      const results = await memoryManager.search({
        text: 'cleanup-trigger',
        limit: 1
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.entry.metadata.source).toBe('cleanup-trigger');
    });

    it('should maintain entryCount consistency during concurrent operations', async () => {
      // Add initial entries
      for (let i = 0; i < 50; i++) {
        await memoryManager.add(
          `Initial entry ${i}`,
          null,
          { type: 'other', source: 'concurrent-test' }
        );
      }

      const statsInitial = await memoryManager.getStats();
      expect(statsInitial.totalEntries).toBe(50);

      // Perform multiple operations
      const entries = await memoryManager.getAll();
      const firstEntry = entries[0];

      if (firstEntry) {
        // Delete one entry
        await memoryManager.delete(firstEntry.id);

        const statsAfterDelete = await memoryManager.getStats();
        expect(statsAfterDelete.totalEntries).toBe(49);
      }

      // Add another entry
      await memoryManager.add(
        'New entry after delete',
        null,
        { type: 'other', source: 'after-delete' }
      );

      const statsFinal = await memoryManager.getStats();
      expect(statsFinal.totalEntries).toBe(50);
    });
  });

  describe('Internal Counter Accuracy', () => {
    it('should maintain accurate entryCount after add operations', async () => {
      for (let i = 0; i < 20; i++) {
        await memoryManager.add(
          `Entry ${i}`,
          null,
          { type: 'other', source: 'counter-test' }
        );

        const stats = await memoryManager.getStats();
        expect(stats.totalEntries).toBe(i + 1);
      }
    });

    it('should maintain accurate entryCount after delete operations', async () => {
      // Add 10 entries
      const addedIds: number[] = [];
      for (let i = 0; i < 10; i++) {
        const entry = await memoryManager.add(
          `Entry ${i}`,
          null,
          { type: 'other', source: 'delete-test' }
        );
        addedIds.push(entry.id);
      }

      let expectedCount = 10;
      const stats1 = await memoryManager.getStats();
      expect(stats1.totalEntries).toBe(expectedCount);

      // Delete entries one by one
      for (const id of addedIds) {
        await memoryManager.delete(id);
        expectedCount--;

        const stats = await memoryManager.getStats();
        expect(stats.totalEntries).toBe(expectedCount);
      }

      const statsFinal = await memoryManager.getStats();
      expect(statsFinal.totalEntries).toBe(0);
    });

    it('should reset entryCount to 0 after clear', async () => {
      // Add some entries
      for (let i = 0; i < 15; i++) {
        await memoryManager.add(
          `Entry ${i}`,
          null,
          { type: 'other', source: 'clear-test' }
        );
      }

      const statsBefore = await memoryManager.getStats();
      expect(statsBefore.totalEntries).toBe(15);

      // Clear all
      await memoryManager.clear();

      const statsAfter = await memoryManager.getStats();
      expect(statsAfter.totalEntries).toBe(0);
    });

    it('should maintain accurate entryCount after cleanup operations', async () => {
      // Add entries with different timestamps
      const now = Date.now();
      const oldTimestamp = now - (40 * 24 * 60 * 60 * 1000); // 40 days ago

      // We need to manually insert old entries for cleanup testing
      // Add 10 new entries
      for (let i = 0; i < 10; i++) {
        await memoryManager.add(
          `New entry ${i}`,
          null,
          { type: 'other', source: 'cleanup-test' }
        );
      }

      const statsBefore = await memoryManager.getStats();
      expect(statsBefore.totalEntries).toBe(10);

      // Run cleanup (should not delete anything since entries are fresh)
      const deleted = await memoryManager.cleanup(30);
      expect(deleted).toBe(0);

      const statsAfter = await memoryManager.getStats();
      expect(statsAfter.totalEntries).toBe(10);
    });
  });

  describe('Prepared Statement Performance', () => {
    it('should efficiently handle multiple add operations', async () => {
      const startTime = Date.now();

      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        await memoryManager.add(
          `Performance test entry ${i}`,
          null,
          { type: 'other', source: 'performance' }
        );
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);

      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(100);
    });

    it('should efficiently handle multiple delete operations', async () => {
      // Add 50 entries
      const addedIds: number[] = [];
      for (let i = 0; i < 50; i++) {
        const entry = await memoryManager.add(
          `Entry ${i}`,
          null,
          { type: 'other', source: 'delete-perf' }
        );
        addedIds.push(entry.id);
      }

      const startTime = Date.now();

      // Delete all entries
      for (const id of addedIds) {
        await memoryManager.delete(id);
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 500ms)
      expect(duration).toBeLessThan(500);

      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should efficiently update access tracking in search', async () => {
      // Add 30 searchable entries
      for (let i = 0; i < 30; i++) {
        await memoryManager.add(
          `Searchable content with keyword test${i}`,
          null,
          { type: 'other', source: 'search-perf' }
        );
      }

      const startTime = Date.now();

      // Perform 10 searches
      for (let i = 0; i < 10; i++) {
        await memoryManager.search({
          text: 'searchable',
          limit: 10
        });
      }

      const duration = Date.now() - startTime;

      // Should complete all searches in reasonable time (< 500ms)
      // Increased from 100ms to 500ms to account for environment variations
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Counter Synchronization', () => {
    it('should synchronize counter across add, delete, and cleanup', async () => {
      // Initial state
      let stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(0);

      // Add 20 entries
      for (let i = 0; i < 20; i++) {
        await memoryManager.add(
          `Entry ${i}`,
          null,
          { type: 'other', source: 'sync-test' }
        );
      }

      stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(20);

      // Get all entries for deletion
      const entries = await memoryManager.getAll();

      // Delete first 5
      for (let i = 0; i < 5; i++) {
        const entry = entries[i];
        if (entry) {
          await memoryManager.delete(entry.id);
        }
      }

      stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(15);

      // Clear all
      await memoryManager.clear();

      stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should handle rapid add/delete cycles', async () => {
      for (let cycle = 0; cycle < 5; cycle++) {
        // Add 10 entries
        const ids: number[] = [];
        for (let i = 0; i < 10; i++) {
          const entry = await memoryManager.add(
            `Cycle ${cycle} Entry ${i}`,
            null,
            { type: 'other', source: 'rapid-cycle' }
          );
          ids.push(entry.id);
        }

        const statsAfterAdd = await memoryManager.getStats();
        expect(statsAfterAdd.totalEntries).toBe(10);

        // Delete all
        for (const id of ids) {
          await memoryManager.delete(id);
        }

        const statsAfterDelete = await memoryManager.getStats();
        expect(statsAfterDelete.totalEntries).toBe(0);
      }

      const finalStats = await memoryManager.getStats();
      expect(finalStats.totalEntries).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxEntries limit correctly', async () => {
      // Fill exactly to maxEntries
      for (let i = 0; i < 100; i++) {
        await memoryManager.add(
          `Entry ${i}`,
          null,
          { type: 'other', source: 'limit-test' }
        );
      }

      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(100);

      // Adding one more should trigger cleanup
      await memoryManager.add(
        'Entry that triggers cleanup',
        null,
        { type: 'other', source: 'overflow' }
      );

      const statsAfter = await memoryManager.getStats();
      // Should be: 100 - 10 (cleanup) + 1 (new) = 91
      expect(statsAfter.totalEntries).toBe(91);
    });

    it('should handle empty database operations gracefully', async () => {
      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(0);

      // Try to delete non-existent entry
      await expect(memoryManager.delete(999)).rejects.toThrow('not found');

      // Clear empty database
      await memoryManager.clear();

      const statsAfter = await memoryManager.getStats();
      expect(statsAfter.totalEntries).toBe(0);

      // Cleanup empty database
      const deleted = await memoryManager.cleanup(30);
      expect(deleted).toBe(0);
    });
  });
});
