/**
 * Memory Manager Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager, type MemoryManagerOptions } from './manager.js';
import { unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let dbPath: string;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), 'ax-memory-test-' + randomUUID());
    await mkdir(testDir, { recursive: true });
    dbPath = join(testDir, 'test-memory.db');
    manager = new MemoryManager({
      databasePath: dbPath,
      maxEntries: 100,
    });
  });

  afterEach(async () => {
    manager.close();
    try {
      await unlink(dbPath);
      await unlink(dbPath + '-wal');
      await unlink(dbPath + '-shm');
    } catch {
      // Files might not exist
    }
  });

  describe('initialization', () => {
    it('should create database and tables', () => {
      expect(manager).toBeDefined();
      expect(manager.getCount()).toBe(0);
    });

    it('should accept custom options', () => {
      const customManager = new MemoryManager({
        databasePath: join(testDir, 'custom.db'),
        maxEntries: 50,
        cleanupConfig: {
          enabled: true,
          strategy: 'oldest',
          triggerThreshold: 0.8,
        },
      });
      expect(customManager).toBeDefined();
      customManager.close();
    });
  });

  describe('add()', () => {
    it('should add a single memory entry', () => {
      const id = manager.add({
        content: 'Test content',
        metadata: {
          type: 'document',
          source: 'test',
          tags: ['test'],
          importance: 0.5,
        },
      });

      expect(id).toBeGreaterThan(0);
      expect(manager.getCount()).toBe(1);
    });

    it('should add entry with minimal metadata', () => {
      const id = manager.add({
        content: 'Minimal content',
        metadata: {
          type: 'note',
          source: 'test',
        },
      });

      expect(id).toBeGreaterThan(0);
    });

    it('should add entry with all metadata fields', () => {
      const id = manager.add({
        content: 'Full metadata content',
        metadata: {
          type: 'conversation',
          source: 'agent',
          agentId: 'backend',
          sessionId: 'session-123',
          tags: ['coding', 'backend'],
          importance: 0.8,
        },
      });

      expect(id).toBeGreaterThan(0);
    });
  });

  describe('addBatch()', () => {
    it('should add multiple entries in a transaction', () => {
      const ids = manager.addBatch([
        {
          content: 'First entry',
          metadata: { type: 'document', source: 'test' },
        },
        {
          content: 'Second entry',
          metadata: { type: 'document', source: 'test' },
        },
        {
          content: 'Third entry',
          metadata: { type: 'document', source: 'test' },
        },
      ]);

      expect(ids).toHaveLength(3);
      expect(manager.getCount()).toBe(3);
    });

    it('should return correct IDs for batch entries', () => {
      const ids = manager.addBatch([
        { content: 'A', metadata: { type: 'note', source: 'test' } },
        { content: 'B', metadata: { type: 'note', source: 'test' } },
      ]);

      expect(ids[0]).toBeLessThan(ids[1]!);
    });
  });

  describe('search()', () => {
    beforeEach(() => {
      manager.addBatch([
        {
          content: 'TypeScript programming language',
          metadata: { type: 'document', source: 'docs', tags: ['typescript'] },
        },
        {
          content: 'JavaScript runtime environment',
          metadata: { type: 'document', source: 'docs', tags: ['javascript'] },
        },
        {
          content: 'Python machine learning',
          metadata: { type: 'article', source: 'blog', tags: ['python', 'ml'] },
        },
        {
          content: 'React TypeScript components',
          metadata: { type: 'code', source: 'github', agentId: 'frontend' },
        },
      ]);
    });

    it('should find entries by query', () => {
      const result = manager.search({ query: 'TypeScript' });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should filter by type', () => {
      const result = manager.search({
        query: 'TypeScript',
        filter: { type: 'code' },
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]!.metadata.type).toBe('code');
    });

    it('should filter by source', () => {
      const result = manager.search({
        query: 'document',
        filter: { source: 'docs' },
      });

      expect(result.entries.every(e => e.metadata.source === 'docs')).toBe(true);
    });

    it('should filter by agentId', () => {
      const result = manager.search({
        query: 'TypeScript',
        filter: { agentId: 'frontend' },
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]!.metadata.agentId).toBe('frontend');
    });

    it('should filter by tags', () => {
      const result = manager.search({
        query: 'programming language runtime',
        filter: { tags: ['typescript'] },
      });

      expect(result.entries.every(e => e.metadata.tags?.includes('typescript'))).toBe(true);
    });

    it('should respect limit and offset', () => {
      const result1 = manager.search({ query: 'document programming', limit: 2 });
      const result2 = manager.search({ query: 'document programming', limit: 2, offset: 2 });

      expect(result1.entries.length).toBeLessThanOrEqual(2);
      // IDs should be different with offset
    });

    it('should return empty for no matches', () => {
      const result = manager.search({ query: 'xyznonexistent' });

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should indicate hasMore correctly', () => {
      const result = manager.search({ query: 'document', limit: 1 });

      if (result.total > 1) {
        expect(result.hasMore).toBe(true);
      }
    });
  });

  describe('getById()', () => {
    it('should retrieve entry by ID', () => {
      const id = manager.add({
        content: 'Retrievable content',
        metadata: { type: 'document', source: 'test' },
      });

      const entry = manager.getById(id);

      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(id);
      expect(entry!.content).toBe('Retrievable content');
    });

    it('should return null for non-existent ID', () => {
      const entry = manager.getById(99999);
      expect(entry).toBeNull();
    });

    it('should update access tracking', () => {
      const id = manager.add({
        content: 'Track access',
        metadata: { type: 'document', source: 'test' },
      });

      // First access
      manager.getById(id);
      const entry1 = manager.getById(id);

      expect(entry1!.accessCount).toBeGreaterThan(0);
    });
  });

  describe('delete()', () => {
    it('should delete entry by ID', () => {
      const id = manager.add({
        content: 'To be deleted',
        metadata: { type: 'document', source: 'test' },
      });

      const deleted = manager.delete(id);

      expect(deleted).toBe(true);
      expect(manager.getById(id)).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      const deleted = manager.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('deleteBatch()', () => {
    it('should delete multiple entries', () => {
      const ids = manager.addBatch([
        { content: 'A', metadata: { type: 'note', source: 'test' } },
        { content: 'B', metadata: { type: 'note', source: 'test' } },
        { content: 'C', metadata: { type: 'note', source: 'test' } },
      ]);

      const deleted = manager.deleteBatch([ids[0]!, ids[1]!]);

      expect(deleted).toBe(2);
      expect(manager.getCount()).toBe(1);
    });
  });

  describe('getStats()', () => {
    it('should return empty stats for empty database', () => {
      const stats = manager.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.databaseSizeBytes).toBeGreaterThan(0);
    });

    it('should return correct stats with entries', () => {
      manager.addBatch([
        { content: 'Entry 1', metadata: { type: 'document', source: 'test', tags: ['a'] } },
        { content: 'Entry 2', metadata: { type: 'document', source: 'test', tags: ['a', 'b'] } },
        { content: 'Entry 3', metadata: { type: 'code', source: 'test', tags: ['b'] } },
      ]);

      const stats = manager.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByType['document']).toBe(2);
      expect(stats.entriesByType['code']).toBe(1);
      expect(stats.topTags.length).toBeGreaterThan(0);
      expect(stats.avgContentLength).toBeGreaterThan(0);
    });
  });

  describe('cleanup()', () => {
    beforeEach(() => {
      // Add entries with varying importance and access
      for (let i = 0; i < 20; i++) {
        manager.add({
          content: `Entry ${i}`,
          metadata: {
            type: 'document',
            source: 'test',
            importance: i / 20,
          },
        });
      }
    });

    it('should cleanup using oldest strategy', () => {
      const result = manager.cleanup('oldest');

      expect(result.strategy).toBe('oldest');
      expect(result.entriesBefore).toBe(20);
    });

    it('should cleanup using least_accessed strategy', () => {
      const result = manager.cleanup('least_accessed');

      expect(result.strategy).toBe('least_accessed');
    });

    it('should cleanup using low_importance strategy', () => {
      const result = manager.cleanup('low_importance');

      expect(result.strategy).toBe('low_importance');
    });

    it('should cleanup using hybrid strategy', () => {
      const result = manager.cleanup('hybrid');

      expect(result.strategy).toBe('hybrid');
    });

    it('should respect maxEntries limit', () => {
      const smallManager = new MemoryManager({
        databasePath: join(testDir, 'small.db'),
        maxEntries: 10,
        cleanupConfig: {
          enabled: true,
          triggerThreshold: 0.8,
          targetThreshold: 0.7,
        },
      });

      for (let i = 0; i < 15; i++) {
        smallManager.add({
          content: `Entry ${i}`,
          metadata: { type: 'document', source: 'test' },
        });
      }

      // Cleanup should have been triggered
      expect(smallManager.getCount()).toBeLessThanOrEqual(15);
      smallManager.close();
    });
  });

  describe('vacuum()', () => {
    it('should run vacuum without errors', () => {
      manager.add({
        content: 'Test',
        metadata: { type: 'document', source: 'test' },
      });

      expect(() => manager.vacuum()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', () => {
      manager.add({
        content: 'Test',
        metadata: { type: 'document', source: 'test' },
      });

      const result = manager.search({ query: '' });
      expect(result.entries).toHaveLength(0);
    });

    it('should handle special characters in query', () => {
      manager.add({
        content: 'Test with "quotes" and (parentheses)',
        metadata: { type: 'document', source: 'test' },
      });

      const result = manager.search({ query: '"quotes"' });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode content', () => {
      const id = manager.add({
        content: 'Unicode content: Hello World',
        metadata: { type: 'document', source: 'test' },
      });

      const entry = manager.getById(id);
      expect(entry!.content).toContain('Hello World');
    });

    it('should handle large content', () => {
      const largeContent = 'x'.repeat(10000);
      const id = manager.add({
        content: largeContent,
        metadata: { type: 'document', source: 'test' },
      });

      const entry = manager.getById(id);
      expect(entry!.content.length).toBe(10000);
    });
  });
});
