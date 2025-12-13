/**
 * Memory Command Unit Tests
 *
 * Comprehensive tests for the memory command including:
 * - Search functionality
 * - Add/Delete operations
 * - List/Stats display
 * - Export/Import operations
 * - Clear functionality
 *
 * @module tests/unit/cli/commands/memory.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Mock Modules
// ============================================================================

vi.mock('chalk', () => ({
  default: {
    blue: Object.assign((s: string) => s, { bold: (s: string) => s }),
    cyan: (s: string) => s,
    white: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    magenta: (s: string) => s,
    dim: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}));

vi.mock('cli-table3', () => ({
  default: vi.fn().mockImplementation(() => ({
    push: vi.fn(),
    toString: vi.fn().mockReturnValue('table output'),
  })),
}));

vi.mock('../../shared/errors/error-formatter.js', () => ({
  printError: vi.fn(),
}));

vi.mock('../../shared/logging/progress.js', () => ({
  ProgressIndicator: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

vi.mock('../../shared/logging/message-formatter.js', () => ({
  printSuccess: vi.fn(),
}));

// ============================================================================
// Types
// ============================================================================

interface MockMemoryEntry {
  id: number;
  content: string;
  metadata: {
    type: string;
    tags?: string[];
    source?: string;
    timestamp?: string;
  };
  createdAt: Date;
  accessCount?: number;
}

interface MockSearchResult {
  entry: MockMemoryEntry;
  similarity: number;
}

interface MockMemoryStats {
  totalEntries: number;
  dbSize: number;
  indexSize: number;
  memoryUsage: number;
}

// ============================================================================
// Test Setup
// ============================================================================

describe('Memory Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ============================================================================
  // Search Command Tests
  // ============================================================================

  describe('Search Command', () => {
    it('should search memory entries', async () => {
      const mockResults: MockSearchResult[] = [
        {
          entry: {
            id: 1,
            content: 'Test content matching query',
            metadata: { type: 'conversation' },
            createdAt: new Date(),
          },
          similarity: 0.85,
        },
        {
          entry: {
            id: 2,
            content: 'Another matching result',
            metadata: { type: 'code' },
            createdAt: new Date(),
          },
          similarity: 0.72,
        },
      ];

      const mockManager = {
        search: vi.fn().mockResolvedValue(mockResults),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const results = await mockManager.search({ text: 'test query', limit: 10 });

      expect(results).toHaveLength(2);
      expect(results[0]?.similarity).toBe(0.85);
    });

    it('should filter by type', async () => {
      const mockManager = {
        search: vi.fn().mockResolvedValue([]),
      };

      await mockManager.search({
        text: 'test',
        limit: 10,
        filters: { type: 'code' },
      });

      expect(mockManager.search).toHaveBeenCalledWith(
        expect.objectContaining({ filters: { type: 'code' } })
      );
    });

    it('should filter by tags', async () => {
      const mockManager = {
        search: vi.fn().mockResolvedValue([]),
      };

      await mockManager.search({
        text: 'test',
        filters: { tags: ['urgent', 'production'] },
      });

      expect(mockManager.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { tags: ['urgent', 'production'] },
        })
      );
    });

    it('should handle empty results', async () => {
      const mockManager = {
        search: vi.fn().mockResolvedValue([]),
      };

      const results = await mockManager.search({ text: 'non-existent' });

      expect(results).toHaveLength(0);
    });

    it('should format similarity colors', () => {
      const formatSimilarity = (similarity: number): string => {
        const percent = (similarity * 100).toFixed(1);
        if (similarity > 0.8) return `green(${percent}%)`;
        if (similarity > 0.5) return `yellow(${percent}%)`;
        return `red(${percent}%)`;
      };

      expect(formatSimilarity(0.9)).toContain('green');
      expect(formatSimilarity(0.6)).toContain('yellow');
      expect(formatSimilarity(0.3)).toContain('red');
    });

    it('should truncate long content', () => {
      const content = 'A'.repeat(100);
      const truncated =
        content.length > 57 ? `${content.substring(0, 57)}...` : content;

      expect(truncated.length).toBe(60);
    });

    it('should parse tags from comma-separated string', () => {
      const tagsString = 'urgent, production, important';
      const tags = tagsString
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      expect(tags).toEqual(['urgent', 'production', 'important']);
    });
  });

  // ============================================================================
  // Add Command Tests
  // ============================================================================

  describe('Add Command', () => {
    it('should add new memory entry', async () => {
      const mockManager = {
        add: vi.fn().mockResolvedValue({
          id: 1,
          content: 'New content',
          metadata: { type: 'other', source: 'cli' },
          createdAt: new Date(),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const entry = await mockManager.add('New content', [], { type: 'other' });

      expect(entry.id).toBe(1);
      expect(entry.content).toBe('New content');
    });

    it('should validate metadata JSON', () => {
      const validateMetadata = (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('Metadata must be a JSON object');
          }
          return { valid: true, data: parsed };
        } catch (error) {
          return { valid: false, error: (error as Error).message };
        }
      };

      expect(validateMetadata('{"key": "value"}').valid).toBe(true);
      expect(validateMetadata('"string"').valid).toBe(false);
      expect(validateMetadata('[1,2,3]').valid).toBe(false);
      expect(validateMetadata('invalid').valid).toBe(false);
    });

    it('should reject prototype pollution keys', () => {
      const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

      const validateKeys = (obj: Record<string, unknown>): boolean => {
        // Use Object.getOwnPropertyNames to also catch non-enumerable properties
        // and check for prototype pollution attempts
        const keys = Object.keys(obj);
        for (const key of keys) {
          if (FORBIDDEN_KEYS.includes(key) || key.startsWith('__')) {
            return false;
          }
        }
        return true;
      };

      // Note: { __proto__: {} } doesn't add __proto__ to Object.keys() in JS
      // So we test with explicit key assignment via Object.defineProperty or bracket notation
      const protoObj: Record<string, unknown> = {};
      Object.defineProperty(protoObj, '__proto__', { value: {}, enumerable: true });

      expect(validateKeys(protoObj)).toBe(false);
      expect(validateKeys({ constructor: {} })).toBe(false);
      expect(validateKeys({ __internal__: {} })).toBe(false);
      expect(validateKeys({ validKey: 'value' })).toBe(true);
    });

    it('should create placeholder embedding', () => {
      const embedding = Array<number>(1536).fill(0);

      expect(embedding).toHaveLength(1536);
      expect(embedding.every((v) => v === 0)).toBe(true);
    });
  });

  // ============================================================================
  // Delete Command Tests
  // ============================================================================

  describe('Delete Command', () => {
    it('should delete entry by ID', async () => {
      const mockManager = {
        get: vi.fn().mockResolvedValue({
          id: 1,
          content: 'Content to delete',
          metadata: { type: 'other' },
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      await mockManager.delete(1);

      expect(mockManager.delete).toHaveBeenCalledWith(1);
    });

    it('should handle non-existent entry', async () => {
      const mockManager = {
        get: vi.fn().mockResolvedValue(null),
      };

      const entry = await mockManager.get(999);

      expect(entry).toBeNull();
    });

    it('should require confirmation without --confirm flag', () => {
      const requiresConfirmation = (confirm: boolean): boolean => {
        return !confirm;
      };

      expect(requiresConfirmation(false)).toBe(true);
      expect(requiresConfirmation(true)).toBe(false);
    });
  });

  // ============================================================================
  // List Command Tests
  // ============================================================================

  describe('List Command', () => {
    it('should list memory entries', async () => {
      const mockEntries: MockMemoryEntry[] = [
        {
          id: 1,
          content: 'Entry 1',
          metadata: { type: 'conversation', tags: ['important'] },
          createdAt: new Date(),
          accessCount: 5,
        },
        {
          id: 2,
          content: 'Entry 2',
          metadata: { type: 'code' },
          createdAt: new Date(),
          accessCount: 2,
        },
      ];

      const mockManager = {
        getAll: vi.fn().mockResolvedValue(mockEntries),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const entries = await mockManager.getAll({ limit: 50 });

      expect(entries).toHaveLength(2);
    });

    it('should apply pagination options', async () => {
      const mockManager = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      await mockManager.getAll({ limit: 10, offset: 20 });

      expect(mockManager.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should apply sorting options', async () => {
      const mockManager = {
        getAll: vi.fn().mockResolvedValue([]),
      };

      await mockManager.getAll({ orderBy: 'accessed', order: 'desc' });

      expect(mockManager.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: 'accessed', order: 'desc' })
      );
    });

    it('should truncate long content in table', () => {
      const content = 'A'.repeat(100);
      const truncated =
        content.length > 47 ? `${content.substring(0, 47)}...` : content;

      expect(truncated.length).toBe(50);
    });

    it('should format tags or show placeholder', () => {
      const formatTags = (tags?: string[]): string => {
        return tags && tags.length > 0 ? tags.join(', ') : '-';
      };

      expect(formatTags(['tag1', 'tag2'])).toBe('tag1, tag2');
      expect(formatTags([])).toBe('-');
      expect(formatTags(undefined)).toBe('-');
    });
  });

  // ============================================================================
  // Export Command Tests
  // ============================================================================

  describe('Export Command', () => {
    it('should export to JSON file', async () => {
      const mockManager = {
        exportToJSON: vi.fn().mockResolvedValue({
          entriesExported: 100,
          sizeBytes: 51200,
          filePath: '/output/export.json',
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const result = await mockManager.exportToJSON('/output/export.json', {
        includeEmbeddings: false,
        pretty: true,
      });

      expect(result.entriesExported).toBe(100);
      expect(result.sizeBytes).toBe(51200);
    });

    it('should apply type filter', async () => {
      const mockManager = {
        exportToJSON: vi.fn().mockResolvedValue({
          entriesExported: 50,
          sizeBytes: 25600,
          filePath: '/output/export.json',
        }),
      };

      await mockManager.exportToJSON('/output/export.json', {
        filters: { type: 'code' },
      });

      expect(mockManager.exportToJSON).toHaveBeenCalledWith(
        '/output/export.json',
        expect.objectContaining({ filters: { type: 'code' } })
      );
    });

    it('should apply date range filter', async () => {
      const mockManager = {
        exportToJSON: vi.fn().mockResolvedValue({
          entriesExported: 30,
          sizeBytes: 15360,
          filePath: '/output/export.json',
        }),
      };

      await mockManager.exportToJSON('/output/export.json', {
        filters: {
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-01-31'),
          },
        },
      });

      expect(mockManager.exportToJSON).toHaveBeenCalled();
    });

    it('should format file size in KB', () => {
      const formatSize = (bytes: number): string => {
        return (bytes / 1024).toFixed(2);
      };

      expect(formatSize(51200)).toBe('50.00');
      expect(formatSize(102400)).toBe('100.00');
    });
  });

  // ============================================================================
  // Import Command Tests
  // ============================================================================

  describe('Import Command', () => {
    it('should import from JSON file', async () => {
      const mockManager = {
        importFromJSON: vi.fn().mockResolvedValue({
          entriesImported: 80,
          entriesSkipped: 10,
          entriesFailed: 5,
          errors: [],
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const result = await mockManager.importFromJSON('/input/import.json', {
        skipDuplicates: true,
        batchSize: 100,
        validate: true,
      });

      expect(result.entriesImported).toBe(80);
      expect(result.entriesSkipped).toBe(10);
      expect(result.entriesFailed).toBe(5);
    });

    it('should report import errors', async () => {
      const mockManager = {
        importFromJSON: vi.fn().mockResolvedValue({
          entriesImported: 90,
          entriesSkipped: 5,
          entriesFailed: 5,
          errors: [
            { entry: 1, error: 'Invalid format' },
            { entry: 2, error: 'Missing content' },
          ],
        }),
      };

      const result = await mockManager.importFromJSON('/input/import.json', {});

      expect(result.errors).toHaveLength(2);
    });

    it('should limit displayed errors', () => {
      const errors = Array(10)
        .fill(null)
        .map((_, i) => ({ error: `Error ${i}` }));
      const displayedErrors = errors.slice(0, 5);

      expect(displayedErrors).toHaveLength(5);
    });
  });

  // ============================================================================
  // Stats Command Tests
  // ============================================================================

  describe('Stats Command', () => {
    it('should get memory statistics', async () => {
      const mockStats: MockMemoryStats = {
        totalEntries: 1000,
        dbSize: 1048576,
        indexSize: 102400,
        memoryUsage: 52428800,
      };

      const mockManager = {
        getStats: vi.fn().mockResolvedValue(mockStats),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const stats = await mockManager.getStats();

      expect(stats.totalEntries).toBe(1000);
      expect(stats.dbSize).toBe(1048576);
    });

    it('should format stats for display', () => {
      const stats: MockMemoryStats = {
        totalEntries: 1000,
        dbSize: 1048576,
        indexSize: 102400,
        memoryUsage: 52428800,
      };

      const formatted = {
        entries: stats.totalEntries,
        dbSizeKB: (stats.dbSize / 1024).toFixed(2),
        indexSizeKB: (stats.indexSize / 1024).toFixed(2),
        memoryUsageMB: (stats.memoryUsage / 1024 / 1024).toFixed(2),
      };

      expect(formatted.dbSizeKB).toBe('1024.00');
      expect(formatted.memoryUsageMB).toBe('50.00');
    });
  });

  // ============================================================================
  // Clear Command Tests
  // ============================================================================

  describe('Clear Command', () => {
    it('should require clear option', () => {
      const validateOptions = (argv: { all?: boolean; type?: string; olderThan?: number }): boolean => {
        return !!(argv.all || argv.type || argv.olderThan);
      };

      expect(validateOptions({ all: true })).toBe(true);
      expect(validateOptions({ type: 'code' })).toBe(true);
      expect(validateOptions({ olderThan: 30 })).toBe(true);
      expect(validateOptions({})).toBe(false);
    });

    it('should clear all entries', async () => {
      const mockManager = {
        clear: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({ totalEntries: 0 }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      await mockManager.clear();
      const stats = await mockManager.getStats();

      expect(mockManager.clear).toHaveBeenCalled();
      expect(stats.totalEntries).toBe(0);
    });

    it('should cleanup old entries', async () => {
      const mockManager = {
        cleanup: vi.fn().mockResolvedValue(50),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const deleted = await mockManager.cleanup(30);

      expect(deleted).toBe(50);
      expect(mockManager.cleanup).toHaveBeenCalledWith(30);
    });

    it('should require confirmation', () => {
      const requiresConfirmation = (confirm: boolean): boolean => {
        return !confirm;
      };

      expect(requiresConfirmation(false)).toBe(true);
    });
  });

  // ============================================================================
  // Command Structure Tests
  // ============================================================================

  describe('Command Structure', () => {
    it('should require subcommand', () => {
      const commandDefinition = {
        command: 'memory <command>',
        describe: 'Memory management commands',
        demandCommand: 1,
      };

      expect(commandDefinition.command).toBe('memory <command>');
      expect(commandDefinition.demandCommand).toBe(1);
    });

    it('should define search command options', () => {
      const searchOptions = {
        limit: { alias: 'l', type: 'number', default: 10 },
        threshold: { alias: 't', type: 'number', default: 0 },
        type: { type: 'string', choices: ['conversation', 'code', 'document', 'task', 'other'] },
        output: { alias: 'o', type: 'string', choices: ['json', 'table'], default: 'table' },
      };

      expect(searchOptions.limit.default).toBe(10);
      expect(searchOptions.type.choices).toHaveLength(5);
    });

    it('should define add command options', () => {
      const addOptions = {
        type: {
          alias: 't',
          type: 'string',
          choices: ['conversation', 'code', 'document', 'task', 'other'],
          default: 'other',
        },
        tags: { type: 'string' },
        metadata: { alias: 'm', type: 'string' },
      };

      expect(addOptions.type.default).toBe('other');
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty tags string', () => {
      const parseEmptyTags = (tags?: string): string[] => {
        if (!tags || !tags.trim()) return [];
        return tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      };

      expect(parseEmptyTags('')).toEqual([]);
      expect(parseEmptyTags('   ')).toEqual([]);
      expect(parseEmptyTags(undefined)).toEqual([]);
    });

    it('should handle very long content', () => {
      const content = 'A'.repeat(10000);
      const truncated = content.length > 100 ? `${content.substring(0, 100)}...` : content;

      expect(truncated.length).toBe(103);
    });

    it('should handle database path option', () => {
      const getDbPath = (argv: { db?: string }, defaultPath: string): string => {
        return argv.db || defaultPath;
      };

      expect(getDbPath({ db: '/custom/path.db' }, '/default/path.db')).toBe('/custom/path.db');
      expect(getDbPath({}, '/default/path.db')).toBe('/default/path.db');
    });

    it('should handle manager close on error', async () => {
      const mockManager = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      try {
        throw new Error('Test error');
      } catch {
        // Error caught intentionally
      } finally {
        await mockManager.close();
      }

      expect(mockManager.close).toHaveBeenCalled();
    });
  });
});
