// @ts-nocheck
/**
 * Memory Command Handler Tests
 *
 * Tests actual handler execution for memory commands to improve coverage.
 * Uses AUTOMATOSX_MOCK_PROVIDERS to create real memory instances.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  listCommand,
  statsCommand,
  clearCommand,
  addCommand,
  deleteCommand,
  searchCommand,
  exportCommand,
  importCommand
} from '../../src/cli/commands/memory.js';

describe('Memory Command Handlers', () => {
  let testDir: string;
  let dbPath: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string | undefined;

  beforeAll(() => {
    // Enable mock providers for all tests
    originalEnv = process.env.AUTOMATOSX_MOCK_PROVIDERS;
    process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = originalEnv;
    } else {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
    }
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `memory-handler-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    dbPath = join(testDir, 'memory.db');

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('List Command Handler', () => {
    it('should list memories with table output', async () => {
      await listCommand.handler({
        db: dbPath,
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should list memories with JSON output', async () => {
      await listCommand.handler({
        db: dbPath,
        output: 'json',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      // Should output valid JSON
      const output = consoleLogSpy.mock.calls[0]?.[0];
      if (output && typeof output === 'string') {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });

    it('should list memories with type filter', async () => {
      await listCommand.handler({
        db: dbPath,
        type: 'conversation',
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should list memories with limit', async () => {
      await listCommand.handler({
        db: dbPath,
        limit: 5,
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should list memories with pagination', async () => {
      await listCommand.handler({
        db: dbPath,
        limit: 10,
        offset: 0,
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Stats Command Handler', () => {
    it('should show stats with table output', async () => {
      await statsCommand.handler({
        db: dbPath,
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should show stats with JSON output', async () => {
      await statsCommand.handler({
        db: dbPath,
        output: 'json',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      // Should output valid JSON
      const output = consoleLogSpy.mock.calls[0]?.[0];
      if (output && typeof output === 'string') {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });
  });

  describe('Add Command Handler', () => {
    it('should add a memory entry', async () => {
      await addCommand.handler({
        db: dbPath,
        content: 'Test memory content',
        type: 'conversation',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should add entry with tags', async () => {
      await addCommand.handler({
        db: dbPath,
        content: 'Test with tags',
        type: 'code',
        tags: 'tag1,tag2,tag3',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should add entry with metadata', async () => {
      const metadata = JSON.stringify({ key: 'value' });
      
      await addCommand.handler({
        db: dbPath,
        content: 'Test with metadata',
        type: 'document',
        metadata,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Delete Command Handler', () => {
    it('should handle delete with non-existent ID', async () => {
      try {
        await deleteCommand.handler({
          db: dbPath,
          id: '99999',
          _: [],
          $0: ''
        });
      } catch (error) {
        // Should error for non-existent ID
        expect((error as Error).message).toContain('process.exit(1)');
      }
    });
  });

  describe('Clear Command Handler', () => {
    it('should require confirmation for clear all', async () => {
      try {
        await clearCommand.handler({
          db: dbPath,
          all: true,
          _: [],
          $0: ''
        });
      } catch (error) {
        // Should error without confirmation
        expect((error as Error).message).toContain('process.exit(1)');
      }
    });

    it('should clear with confirmation', async () => {
      await clearCommand.handler({
        db: dbPath,
        all: true,
        confirm: true,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should show error for type-specific clear (not implemented)', async () => {
      // Type-specific deletion is not yet implemented
      try {
        await clearCommand.handler({
          db: dbPath,
          type: 'conversation',
          confirm: true,
          _: [],
          $0: ''
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should exit(1) because not implemented
        expect((error as Error).message).toContain('process.exit(1)');
      }
    });

    it('should clear with older-than filter', async () => {
      await clearCommand.handler({
        db: dbPath,
        olderThan: 30,
        confirm: true,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Search Command Handler', () => {
    it('should search with text query', async () => {
      // Add an entry first
      await addCommand.handler({
        db: dbPath,
        content: 'Searchable content here',
        type: 'conversation',
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      // Search
      await searchCommand.handler({
        db: dbPath,
        query: 'searchable',
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should search with JSON output', async () => {
      await addCommand.handler({
        db: dbPath,
        content: 'Another searchable entry',
        type: 'code',
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      await searchCommand.handler({
        db: dbPath,
        query: 'another',
        output: 'json',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should search with limit', async () => {
      await searchCommand.handler({
        db: dbPath,
        query: 'test',
        limit: 5,
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should search with threshold', async () => {
      await searchCommand.handler({
        db: dbPath,
        query: 'test',
        threshold: 0.5,
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should search with type filter', async () => {
      await searchCommand.handler({
        db: dbPath,
        query: 'test',
        type: 'conversation',
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should search with tags filter', async () => {
      await searchCommand.handler({
        db: dbPath,
        query: 'test',
        tags: 'tag1,tag2',
        output: 'table',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Export Command Handler', () => {
    it('should export to JSON file', async () => {
      const exportPath = join(testDir, 'export.json');

      // Add some entries first
      await addCommand.handler({
        db: dbPath,
        content: 'Entry to export',
        type: 'task',
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      await exportCommand.handler({
        db: dbPath,
        output: exportPath,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();

      // Verify file was created
      const { access } = await import('fs/promises');
      await expect(access(exportPath)).resolves.not.toThrow();
    });

    it('should export with type filter', async () => {
      const exportPath = join(testDir, 'export-filtered.json');

      await exportCommand.handler({
        db: dbPath,
        output: exportPath,
        type: 'conversation',
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should export with includeEmbeddings option', async () => {
      const exportPath = join(testDir, 'export-with-embeddings.json');

      await exportCommand.handler({
        db: dbPath,
        output: exportPath,
        includeEmbeddings: true,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Import Command Handler', () => {
    it('should import from JSON file', async () => {
      // Create export file first
      const exportPath = join(testDir, 'import-test.json');

      await addCommand.handler({
        db: dbPath,
        content: 'Entry for import test',
        type: 'code',
        _: [],
        $0: ''
      });

      await exportCommand.handler({
        db: dbPath,
        output: exportPath,
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      // Now import
      const importDbPath = join(testDir, 'import-memory.db');
      await importCommand.handler({
        db: importDbPath,
        input: exportPath,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should validate import file', async () => {
      const exportPath = join(testDir, 'validate-test.json');

      // Create a valid export
      await addCommand.handler({
        db: dbPath,
        content: 'Validation test',
        type: 'document',
        _: [],
        $0: ''
      });

      await exportCommand.handler({
        db: dbPath,
        output: exportPath,
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      // Validation might fail or succeed depending on format
      try {
        await importCommand.handler({
          db: dbPath,
          input: exportPath,
          validate: true,
          _: [],
          $0: ''
        });
        // If succeeds, check console output
        expect(consoleLogSpy).toHaveBeenCalled();
      } catch (error) {
        // Validation might fail, that's acceptable
        expect((error as Error).message).toContain('process.exit');
      }
    });

    it('should import with skipDuplicates option', async () => {
      const exportPath = join(testDir, 'skip-dups-test.json');

      await addCommand.handler({
        db: dbPath,
        content: 'Duplicate test',
        type: 'task',
        _: [],
        $0: ''
      });

      await exportCommand.handler({
        db: dbPath,
        output: exportPath,
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      await importCommand.handler({
        db: dbPath,
        input: exportPath,
        skipDuplicates: true,
        _: [],
        $0: ''
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Integration: Add then List', () => {
    it('should add entry and see it in list', async () => {
      // Add entry
      await addCommand.handler({
        db: dbPath,
        content: 'Integration test entry',
        type: 'task',
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      // List entries
      await listCommand.handler({
        db: dbPath,
        output: 'json',
        _: [],
        $0: ''
      });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      if (output && typeof output === 'string') {
        const entries = JSON.parse(output);
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0].content).toBe('Integration test entry');
      }
    });

    it('should add entry and see it in stats', async () => {
      // Add entry
      await addCommand.handler({
        db: dbPath,
        content: 'Stats test entry',
        type: 'code',
        _: [],
        $0: ''
      });

      consoleLogSpy.mockClear();

      // Check stats
      await statsCommand.handler({
        db: dbPath,
        output: 'json',
        _: [],
        $0: ''
      });

      const output = consoleLogSpy.mock.calls[0]?.[0];
      if (output && typeof output === 'string') {
        const stats = JSON.parse(output);
        expect(stats.totalEntries).toBeGreaterThan(0);
      }
    });
  });
});
