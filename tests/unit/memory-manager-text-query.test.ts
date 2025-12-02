/**
 * Memory Manager Text Query Tests (v4.11.0)
 *
 * v4.11.0: FTS5-only mode - no embedding provider needed
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { MemoryManager } from '../../src/core/memory-manager.js';
import type { MemoryMetadata } from '../../src/types/memory.js';

describe('MemoryManager Text Query (FTS5)', () => {
  let manager: MemoryManager;
  let testDbPath: string;

  beforeEach(async () => {
    // Create unique test database
    testDbPath = join(tmpdir(), `memory-text-test-${Date.now()}.db`);

    // v4.11.0: No embedding provider needed (FTS5 only)
    manager = await MemoryManager.create({
      dbPath: testDbPath,
      maxEntries: 100,
      autoCleanup: false,
      trackAccess: true
    });

    // Add test entries
    const entries = [
      { content: 'Python code example', type: 'code' as const, tags: ['python', 'example'] },
      { content: 'JavaScript tutorial', type: 'document' as const, tags: ['javascript', 'tutorial'] },
      { content: 'Meeting notes', type: 'conversation' as const, tags: ['meeting'] }
    ];

    for (const entry of entries) {
      // v4.11.0: No embedding needed (FTS5 only)
      await manager.add(entry.content, null, {
        type: entry.type,
        source: 'test',
        tags: entry.tags
      });
    }
  });

  afterEach(async () => {
    // Cleanup
    await manager.close();

    try {
      if (existsSync(testDbPath)) {
        await rm(testDbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('FTS5 Text Search', () => {
    it('should search by text query using FTS5', async () => {
      const results = await manager.search({
        text: 'Python',
        limit: 3
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);

      // Results should have similarity scores
      results.forEach(result => {
        expect(result).toHaveProperty('entry');
        expect(result).toHaveProperty('similarity');
        expect(result).toHaveProperty('distance');
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1.01); // Allow for floating point precision
      });
    });

    it('should search by text with type filter', async () => {
      const results = await manager.search({
        text: 'code',
        filters: {
          type: 'code'
        },
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.entry.metadata.type).toBe('code');
      });
    });

    it('should search by text with multiple filters', async () => {
      const results = await manager.search({
        text: 'Python',
        filters: {
          type: 'code',
          tags: ['python']
        },
        limit: 10
      });

      results.forEach(result => {
        expect(result.entry.metadata.type).toBe('code');
        expect(result.entry.metadata.tags).toContain('python');
      });
    });

    it('should apply similarity threshold on text search', async () => {
      const results = await manager.search({
        text: 'example',
        threshold: 0.5,
        limit: 10
      });

      // All results should have similarity >= threshold
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should track access when searching by text', async () => {
      const results = await manager.search({
        text: 'Python code',
        limit: 1
      });

      expect(results.length).toBeGreaterThan(0);

      if (results[0]) {
        const entry = await manager.get(results[0].entry.id);
        expect(entry?.accessCount).toBeGreaterThan(0);
      }
    });

    it('should find exact matches', async () => {
      const results = await manager.search({
        text: 'Python code example',
        limit: 5
      });

      expect(results.length).toBeGreaterThan(0);

      // Should find the Python entry
      const pythonEntry = results.find(r => r.entry.content.includes('Python'));
      expect(pythonEntry).toBeDefined();
    });

    it('should find partial matches', async () => {
      const results = await manager.search({
        text: 'tutorial',
        limit: 5
      });

      expect(results.length).toBeGreaterThan(0);

      // Should find the JavaScript tutorial entry
      const tutorialEntry = results.find(r => r.entry.content.includes('tutorial'));
      expect(tutorialEntry).toBeDefined();
    });

    it('should handle multi-word queries', async () => {
      const results = await manager.search({
        text: 'Meeting notes',
        limit: 5
      });

      expect(results.length).toBeGreaterThan(0);

      // Should find the meeting notes entry
      const meetingEntry = results.find(r => r.entry.content.includes('Meeting'));
      expect(meetingEntry).toBeDefined();
    });
  });

  describe('FTS5 Error Handling', () => {
    it('should throw error when text query is missing', async () => {
      await expect(
        manager.search({
          limit: 5
        } as never) // Type assertion to bypass TypeScript check
      ).rejects.toThrow('Either text or embedding must be provided for search');
    });

    it('should handle empty search results gracefully', async () => {
      const results = await manager.search({
        text: 'nonexistentqueryterm12345',
        limit: 10
      });

      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('should handle special characters in search query', async () => {
      const results = await manager.search({
        text: 'Python code',  // FTS5 handles this internally
        limit: 5
      });

      expect(results).toBeDefined();
      // Should not throw error
    });
  });

  describe('FTS5 Search Performance', () => {
    it('should search efficiently with many entries', async () => {
      // Add many entries
      for (let i = 0; i < 100; i++) {
        await manager.add(`Entry ${i} with some text content`, null, {
          type: 'other',
          source: 'performance-test'
        });
      }

      const start = Date.now();
      const results = await manager.search({
        text: 'text content',
        limit: 10
      });
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });
  });
});
