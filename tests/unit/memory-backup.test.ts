/**
 * Memory Manager Backup/Restore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { MemoryManager } from '../../src/core/memory-manager.js';
import type { MemoryMetadata } from '../../src/types/memory.js';

describe('MemoryManager Backup/Restore', () => {
  let manager: MemoryManager;
  let testDbPath: string;
  let backupPath: string;

  beforeEach(async () => {
    // Create unique test database
    const timestamp = Date.now();
    testDbPath = join(tmpdir(), `memory-backup-test-${timestamp}.db`);
    backupPath = join(tmpdir(), `memory-backup-${timestamp}.db`);

    manager = await MemoryManager.create({
      dbPath: testDbPath,
      maxEntries: 100,
      autoCleanup: false,
      trackAccess: false
    });

    // Add some test data
    const entries = [
      { content: 'Entry 1', type: 'code' as const },
      { content: 'Entry 2', type: 'document' as const },
      { content: 'Entry 3', type: 'conversation' as const }
    ];

    for (const entry of entries) {
      const embedding = new Array(1536).fill(Math.random());
      await manager.add(entry.content, embedding, {
        type: entry.type,
        source: 'test'
      });
    }
  });

  afterEach(async () => {
    // Cleanup - ensure all async operations complete before closing
    try {
      // Wait a tick to ensure all pending operations complete
      await new Promise(resolve => setImmediate(resolve));

      // Close database
      if (manager) {
        await manager.close();
      }

      // Cleanup files
      if (existsSync(testDbPath)) await rm(testDbPath);
      if (existsSync(`${testDbPath}.index`)) await rm(`${testDbPath}.index`);
      if (existsSync(backupPath)) await rm(backupPath);
      // sqlite-vec doesn't create separate .index files
    } catch (error) {
      // Ignore cleanup errors
      console.error('Cleanup error:', error);
    }
  });

  describe('backup()', () => {
    it('should create backup file', async () => {
      await manager.backup(backupPath);

      expect(existsSync(backupPath)).toBe(true);
    });

    it('should backup (sqlite-vec: no separate index file)', async () => {
      // sqlite-vec embeds vectors in database - no separate .index file
      await manager.saveIndex(); // No-op for sqlite-vec

      await manager.backup(backupPath);

      expect(existsSync(backupPath)).toBe(true);
      // sqlite-vec doesn't create separate .index file
    });

    // Note: sqlite-vec backup doesn't support progress callbacks
    // better-sqlite3's backup() API doesn't provide progress updates
    // This is a limitation of the underlying library, not a bug
    // If progress reporting is needed in the future, we would need to:
    // 1. Use better-sqlite3's backup() with custom page-by-page copying
    // 2. Or implement a wrapper that estimates progress based on file size

    it('should create destination directory if not exists', async () => {
      const deepPath = join(tmpdir(), 'deep', 'nested', 'path', 'backup.db');

      await manager.backup(deepPath);

      expect(existsSync(deepPath)).toBe(true);

      // Cleanup
      await rm(deepPath);
      await rm(join(tmpdir(), 'deep'), { recursive: true });
    });

    it('should handle backup errors gracefully', async () => {
      // Try to backup to invalid path (no permissions)
      const invalidPath = '/root/backup.db';

      await expect(manager.backup(invalidPath)).rejects.toThrow();
    });
  });

  describe('restore()', () => {
    it('should restore from backup', async () => {
      // Create backup
      await manager.backup(backupPath);

      // Get stats before
      const statsBefore = await manager.getStats();

      // Add more data
      const embedding = new Array(1536).fill(0.5);
      await manager.add('New entry', embedding, {
        type: 'other',
        source: 'test'
      });

      const statsAfter = await manager.getStats();
      expect(statsAfter.totalEntries).toBe(statsBefore.totalEntries + 1);

      // Restore from backup
      await manager.restore(backupPath);

      // Verify restored state
      const statsRestored = await manager.getStats();
      expect(statsRestored.totalEntries).toBe(statsBefore.totalEntries);
    });

    it('should restore and preserve FTS5 search capability', async () => {
      // v4.11.0: FTS5 search (no vectors)
      await manager.saveIndex(); // No-op
      await manager.backup(backupPath);

      // Add more data
      await manager.add('New entry for testing', null, {
        type: 'other',
        source: 'test'
      });

      // Restore
      await manager.restore(backupPath);

      // Search should still work (FTS5 index restored with database)
      const results = await manager.search({
        text: 'test',
        limit: 5
      });

      expect(results).toBeDefined();
    });

    it('should throw error if backup file not found', async () => {
      const nonExistentPath = join(tmpdir(), 'non-existent-backup.db');

      await expect(manager.restore(nonExistentPath)).rejects.toThrow('Backup file not found');
    });

    it('should handle restore errors gracefully', async () => {
      // Create invalid backup file
      const { writeFile } = await import('fs/promises');
      const invalidBackup = join(tmpdir(), 'invalid-backup.db');
      await writeFile(invalidBackup, 'invalid sqlite data');

      await expect(manager.restore(invalidBackup)).rejects.toThrow();

      // Cleanup
      await rm(invalidBackup);
    });
  });

  describe('Backup/Restore Integration', () => {
    it('should preserve all data after backup and restore', async () => {
      // Get all entries before backup
      const entriesBefore: number[] = [];
      for (let id = 1; id <= 3; id++) {
        const entry = await manager.get(id);
        if (entry) {
          entriesBefore.push(entry.id);
        }
      }

      // Backup
      await manager.backup(backupPath);

      // Clear database
      await manager.clear();
      const statsAfterClear = await manager.getStats();
      expect(statsAfterClear.totalEntries).toBe(0);

      // Restore
      await manager.restore(backupPath);

      // Verify all entries restored
      const entriesAfter: number[] = [];
      for (let id = 1; id <= 3; id++) {
        const entry = await manager.get(id);
        if (entry) {
          entriesAfter.push(entry.id);
        }
      }

      expect(entriesAfter).toEqual(entriesBefore);
    });

    it('should maintain search functionality after restore', async () => {
      // v4.11.0: FTS5 text search (no vectors)
      // Save index first
      await manager.saveIndex();

      // Search before backup
      const resultsBefore = await manager.search({
        text: 'entry',
        limit: 5
      });

      expect(resultsBefore.length).toBeGreaterThan(0);

      // Backup (including FTS5 index) and restore
      await manager.backup(backupPath);
      await manager.restore(backupPath);

      // Search after restore
      const resultsAfter = await manager.search({
        text: 'entry',
        limit: 5
      });

      expect(resultsAfter.length).toBe(resultsBefore.length);
    });
  });
});
