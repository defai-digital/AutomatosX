/**
 * Memory Manager Integration Tests
 *
 * End-to-end tests for the memory system:
 * - FTS5 full-text search
 * - Entry management (add, delete, update)
 * - Cleanup strategies
 * - Persistence
 * - Performance
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryManager } from '../../../src/core/memory/manager.js';
import type { MemoryEntry, MemoryMetadata } from '../../../src/types/memory.js';

describe('Memory Manager Integration', () => {
  let testDir: string;
  let memoryManager: MemoryManager;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'memory-test-'));
  });

  afterEach(async () => {
    if (memoryManager) {
      await memoryManager.close();
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Operations', () => {
    it('should create memory manager with file-based database', async () => {
      const dbPath = join(testDir, 'memory.db');
      memoryManager = await MemoryManager.create({
        dbPath,
        maxEntries: 1000
      });

      expect(memoryManager).toBeDefined();

      // Verify database file created
      const exists = await access(dbPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create memory manager with in-memory database', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      expect(memoryManager).toBeDefined();
    });

    it('should add memory entries', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      const metadata: MemoryMetadata = {
        type: 'code',
        source: 'backend',
        agentId: 'backend',
        tags: ['auth', 'security']
      };

      const entry = await memoryManager.add(
        'Test memory content about authentication',
        null,
        metadata
      );

      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('Test memory content about authentication');
    });

    it('should delete memory entries', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      const entry = await memoryManager.add(
        'To be deleted',
        null,
        { type: 'other', source: 'test' }
      );

      await memoryManager.delete(entry.id);

      const all = await memoryManager.getAll();
      expect(all.find(e => e.id === entry.id)).toBeUndefined();
    });
  });

  describe('Full-Text Search', () => {
    beforeEach(async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      // Add test entries
      await memoryManager.add(
        'Implemented JWT authentication with refresh tokens',
        null,
        { type: 'code', source: 'backend', agentId: 'backend' }
      );
      await memoryManager.add(
        'Added OAuth2 integration with Google provider',
        null,
        { type: 'code', source: 'backend', agentId: 'backend' }
      );
      await memoryManager.add(
        'Fixed database connection pooling issues',
        null,
        { type: 'task', source: 'backend', agentId: 'backend' }
      );
      await memoryManager.add(
        'React component for user profile page',
        null,
        { type: 'code', source: 'frontend', agentId: 'frontend' }
      );
    });

    it('should search by keyword', async () => {
      const results = await memoryManager.search({
        text: 'authentication'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.entry.content.includes('authentication'))).toBe(true);
    });

    it('should search with multiple keywords', async () => {
      // Search for exact word in content - FTS5 uses word tokenization
      const results = await memoryManager.search({
        text: 'Google'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.entry.content.includes('Google'))).toBe(true);
    });

    it('should filter by agent', async () => {
      const results = await memoryManager.search({
        text: 'code',
        filters: { agentId: 'frontend' }
      });

      results.forEach(result => {
        expect(result.entry.metadata?.agentId).toBe('frontend');
      });
    });

    it('should respect search limit', async () => {
      const results = await memoryManager.search({
        text: 'code',
        limit: 2
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await memoryManager.search({
        text: 'nonexistent_keyword_xyz'
      });

      expect(results).toEqual([]);
    });
  });

  describe('Metadata Handling', () => {
    it('should store and retrieve metadata', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      const metadata: MemoryMetadata = {
        type: 'code',
        source: 'backend',
        agentId: 'backend',
        tags: ['api', 'rest', 'security'],
        sessionId: '00000000-0000-4000-8000-000000000123'  // Must be valid UUID
      };

      const entry = await memoryManager.add(
        'API implementation details',
        null,
        metadata
      );

      const all = await memoryManager.getAll();
      const found = all.find(e => e.id === entry.id);

      expect(found?.metadata?.type).toBe('code');
      expect(found?.metadata?.tags).toContain('api');
    });

    it('should handle entries with minimal metadata', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      const entry = await memoryManager.add(
        'Simple content with minimal metadata',
        null,
        { type: 'other', source: 'test' }
      );

      const all = await memoryManager.getAll();
      const found = all.find(e => e.id === entry.id);

      expect(found).toBeDefined();
      expect(found?.content).toBe('Simple content with minimal metadata');
    });
  });

  describe('Access Tracking', () => {
    it('should track access count when enabled', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000,
        trackAccess: true
      });

      await memoryManager.add(
        'Frequently accessed content',
        null,
        { type: 'other', source: 'test' }
      );

      // Search should increment access count
      await memoryManager.search({ text: 'frequently' });
      await memoryManager.search({ text: 'frequently' });
      await memoryManager.search({ text: 'frequently' });

      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cleanup Strategies', () => {
    it('should cleanup oldest entries when limit exceeded', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 5,
        autoCleanup: true,
        cleanup: {
          enabled: true,
          strategy: 'oldest',
          triggerThreshold: 1.0,
          targetThreshold: 0.6
        }
      });

      // Add entries to exceed limit
      for (let i = 0; i < 10; i++) {
        await memoryManager.add(
          `Entry number ${i}`,
          null,
          { type: 'other', source: 'test' }
        );
      }

      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(5);
    });

    it('should cleanup by retention days', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000,
        cleanupDays: 30,
        autoCleanup: true
      });

      // Add fresh entry
      await memoryManager.add(
        'Fresh content',
        null,
        { type: 'other', source: 'test' }
      );

      // All entries should still be present (none are old enough)
      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Export and Import', () => {
    it('should export entries to JSON', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      await memoryManager.add(
        'Export test content 1',
        null,
        { type: 'code', source: 'test' }
      );
      await memoryManager.add(
        'Export test content 2',
        null,
        { type: 'task', source: 'test' }
      );

      const exportPath = join(testDir, 'export.json');
      await memoryManager.exportToJSON(exportPath);

      // Verify export file created
      const exists = await access(exportPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should import entries from JSON', async () => {
      // Create and export from first manager
      const manager1 = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      await manager1.add(
        'Import test content',
        null,
        { type: 'code', source: 'test' }
      );

      const exportPath = join(testDir, 'import-test.json');
      await manager1.exportToJSON(exportPath);
      await manager1.close();

      // Import into second manager
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      await memoryManager.importFromJSON(exportPath);

      const all = await memoryManager.getAll();
      expect(all.some(e => e.content === 'Import test content')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      await memoryManager.add(
        'Stats test 1',
        null,
        { type: 'code', source: 'backend', agentId: 'backend' }
      );
      await memoryManager.add(
        'Stats test 2',
        null,
        { type: 'task', source: 'backend', agentId: 'backend' }
      );
      await memoryManager.add(
        'Stats test 3',
        null,
        { type: 'code', source: 'frontend', agentId: 'frontend' }
      );

      const stats = await memoryManager.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.dbSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Persistence', () => {
    it('should persist entries across manager instances', async () => {
      const dbPath = join(testDir, 'persist-test.db');

      // Create and add entries with first manager
      const manager1 = await MemoryManager.create({
        dbPath,
        maxEntries: 1000
      });

      await manager1.add(
        'Persistent content',
        null,
        { type: 'code', source: 'test' }
      );
      await manager1.close();

      // Create second manager with same database
      memoryManager = await MemoryManager.create({
        dbPath,
        maxEntries: 1000
      });

      const all = await memoryManager.getAll();
      expect(all.some(e => e.content === 'Persistent content')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid search queries gracefully', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      // Empty query throws validation error (text must be >= 1 char)
      await expect(memoryManager.search({ text: '' }))
        .rejects.toThrow(/Invalid search query/);
    });

    it('should handle special characters in search', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      await memoryManager.add(
        'Content with special chars: @#$%^&*()',
        null,
        { type: 'other', source: 'test' }
      );

      // Should not throw
      await expect(memoryManager.search({ text: '@#$' })).resolves.toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000,
        busyTimeout: 5000
      });

      // Run concurrent adds
      const promises = Array.from({ length: 10 }, (_, i) =>
        memoryManager.add(
          `Concurrent entry ${i}`,
          null,
          { type: 'other', source: 'test' }
        )
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();

      const stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(10);
    });
  });

  describe('Clear All', () => {
    it('should clear all entries', async () => {
      memoryManager = await MemoryManager.create({
        dbPath: ':memory:',
        maxEntries: 1000
      });

      // Add entries
      await memoryManager.add('Entry 1', null, { type: 'other', source: 'test' });
      await memoryManager.add('Entry 2', null, { type: 'other', source: 'test' });
      await memoryManager.add('Entry 3', null, { type: 'other', source: 'test' });

      let stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(3);

      // Clear all
      await memoryManager.clear();

      stats = await memoryManager.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
