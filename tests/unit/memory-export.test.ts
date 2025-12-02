/**
 * Memory Manager Export/Import Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { MemoryManager } from '../../src/core/memory-manager.js';
import type { MemoryMetadata } from '../../src/types/memory.js';

describe('MemoryManager Export/Import', () => {
  let manager: MemoryManager;
  let testDbPath: string;
  let exportPath: string;

  beforeEach(async () => {
    // Create unique test database
    const timestamp = Date.now();
    testDbPath = join(tmpdir(), `memory-export-test-${timestamp}.db`);
    exportPath = join(tmpdir(), `memory-export-${timestamp}.json`);

    manager = await MemoryManager.create({
      dbPath: testDbPath,
      maxEntries: 100,
      autoCleanup: false,
      trackAccess: false
    });

    // Add test data
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
    // Cleanup
    await manager.close();

    try {
      if (existsSync(testDbPath)) await rm(testDbPath);
      if (existsSync(`${testDbPath}.index`)) await rm(`${testDbPath}.index`);
      if (existsSync(exportPath)) await rm(exportPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('exportToJSON()', () => {
    it('should export all entries to JSON', async () => {
      const result = await manager.exportToJSON(exportPath);

      expect(result.entriesExported).toBe(3);
      expect(existsSync(exportPath)).toBe(true);
      expect(result.filePath).toBe(exportPath);
    });

    it('should export with embeddings if requested', async () => {
      // v4.11.0: No embeddings in FTS5 mode (always false)
      await manager.saveIndex();

      const result = await manager.exportToJSON(exportPath, {
        includeEmbeddings: true  // Ignored in v4.11.0
      });

      expect(result.entriesExported).toBe(3);

      // Read and verify export file
      const { readFile } = await import('fs/promises');
      const content = await readFile(exportPath, 'utf-8');
      const data = JSON.parse(content);

      // v4.11.0: includesEmbeddings always false (FTS5 only, no vectors)
      expect(data.metadata.includesEmbeddings).toBe(false);
      // v4.11.0: No embeddings in entries
    });

    it('should export with filters', async () => {
      const result = await manager.exportToJSON(exportPath, {
        filters: {
          type: 'code'
        }
      });

      expect(result.entriesExported).toBe(1);

      // Verify filtered export
      const { readFile } = await import('fs/promises');
      const content = await readFile(exportPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].metadata.type).toBe('code');
    });

    it('should export with multiple type filters', async () => {
      const result = await manager.exportToJSON(exportPath, {
        filters: {
          type: ['code', 'document']
        }
      });

      expect(result.entriesExported).toBe(2);
    });

    it('should export with pretty formatting', async () => {
      await manager.exportToJSON(exportPath, {
        pretty: true
      });

      const { readFile } = await import('fs/promises');
      const content = await readFile(exportPath, 'utf-8');

      // Pretty formatted JSON has newlines
      expect(content).toContain('\n');
      expect(content).toContain('  '); // Indentation
    });

    it('should create destination directory if not exists', async () => {
      const deepPath = join(tmpdir(), 'deep', 'nested', 'path', 'export.json');

      await manager.exportToJSON(deepPath);

      expect(existsSync(deepPath)).toBe(true);

      // Cleanup
      await rm(deepPath);
      await rm(join(tmpdir(), 'deep'), { recursive: true });
    });

    it('should export with date range filter', async () => {
      const past = new Date(Date.now() - 10000);
      const future = new Date(Date.now() + 10000);

      const result = await manager.exportToJSON(exportPath, {
        filters: {
          dateRange: {
            from: past,
            to: future
          }
        }
      });

      expect(result.entriesExported).toBe(3);
    });
  });

  describe('importFromJSON()', () => {
    it('should import from JSON export', async () => {
      // Export first
      await manager.exportToJSON(exportPath, {
        includeEmbeddings: true
      });

      // Clear database
      await manager.clear();
      const statsAfterClear = await manager.getStats();
      expect(statsAfterClear.totalEntries).toBe(0);

      // Import
      const result = await manager.importFromJSON(exportPath);

      expect(result.entriesImported).toBe(3);
      expect(result.entriesFailed).toBe(0);

      const statsAfterImport = await manager.getStats();
      expect(statsAfterImport.totalEntries).toBe(3);
    });

    it('should skip duplicates when importing', async () => {
      await manager.exportToJSON(exportPath, {
        includeEmbeddings: true
      });

      // Import again without clearing (should skip duplicates)
      const result = await manager.importFromJSON(exportPath, {
        skipDuplicates: true
      });

      expect(result.entriesImported).toBe(0);
      expect(result.entriesSkipped).toBe(3);
    });

    it('should clear existing data if requested', async () => {
      await manager.exportToJSON(exportPath, {
        includeEmbeddings: true
      });

      const statsBefore = await manager.getStats();
      expect(statsBefore.totalEntries).toBe(3);

      // Import with clearExisting
      const result = await manager.importFromJSON(exportPath, {
        clearExisting: true
      });

      expect(result.entriesImported).toBe(3);

      const statsAfter = await manager.getStats();
      expect(statsAfter.totalEntries).toBe(3);
    });

    it('should validate entries before import', async () => {
      // Create invalid export file
      const { writeFile } = await import('fs/promises');
      const invalidData = {
        version: '1.0',
        metadata: {
          exportedAt: new Date().toISOString(),
          totalEntries: 1,
          includesEmbeddings: true
        },
        entries: [
          {
            id: 1,
            content: 'Test',
            embedding: new Array(1536).fill(0.5),
            // Missing metadata
            createdAt: new Date().toISOString(),
            accessCount: 0
          }
        ]
      };

      await writeFile(exportPath, JSON.stringify(invalidData));

      await manager.clear();

      const result = await manager.importFromJSON(exportPath, {
        validate: true
      });

      expect(result.entriesFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw error if import file not found', async () => {
      const nonExistentPath = join(tmpdir(), 'non-existent-export.json');

      await expect(manager.importFromJSON(nonExistentPath)).rejects.toThrow(
        'Import file not found'
      );
    });

    it('should throw error for unsupported format version', async () => {
      const { writeFile } = await import('fs/promises');
      const invalidData = {
        version: '2.0', // Unsupported version
        metadata: {
          exportedAt: new Date().toISOString(),
          totalEntries: 0,
          includesEmbeddings: false
        },
        entries: []
      };

      await writeFile(exportPath, JSON.stringify(invalidData));

      await expect(manager.importFromJSON(exportPath)).rejects.toThrow(
        'Unsupported export format version'
      );
    });

    it('should handle import with missing embeddings', async () => {
      // Export without embeddings
      await manager.exportToJSON(exportPath, {
        includeEmbeddings: false
      });

      await manager.clear();

      // Import should succeed using zero vectors as fallback
      const result = await manager.importFromJSON(exportPath);

      expect(result.entriesImported).toBe(3);
      expect(result.entriesFailed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify entries were imported (even with zero vectors)
      const stats = await manager.getStats();
      expect(stats.totalEntries).toBe(3);
    });
  });

  describe('Export/Import Integration', () => {
    it('should preserve all data after export and import', async () => {
      // v4.11.0: FTS5 only, no embeddings
      // Get all entries before export
      const statsBefore = await manager.getStats();
      expect(statsBefore.totalEntries).toBe(3);

      // Export (no embeddings in v4.11.0)
      await manager.saveIndex();
      await manager.exportToJSON(exportPath, {
        includeEmbeddings: false
      });

      // Clear and import
      await manager.clear();
      const statsAfterClear = await manager.getStats();
      expect(statsAfterClear.totalEntries).toBe(0);

      await manager.importFromJSON(exportPath);

      // Verify count restored
      const statsAfter = await manager.getStats();
      expect(statsAfter.totalEntries).toBe(statsBefore.totalEntries);

      // Verify content by searching (FTS5)
      const allEntries = await manager.search({
        text: 'entry',
        limit: 10
      });

      expect(allEntries.length).toBe(3);
    });

    it('should maintain search functionality after import', async () => {
      // v4.11.0: FTS5 text search (no vectors)
      await manager.saveIndex();

      // Export (no embeddings in v4.11.0)
      await manager.exportToJSON(exportPath, {
        includeEmbeddings: false
      });

      // Clear and import
      await manager.clear();
      await manager.importFromJSON(exportPath);

      // Search should work (FTS5)
      const results = await manager.search({
        text: 'test',
        limit: 5
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
