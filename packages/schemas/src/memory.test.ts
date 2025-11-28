/**
 * Memory Schema Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  MemoryMetadataSchema,
  MemoryEntrySchema,
  MemoryFilterSchema,
  MemorySearchOptionsSchema,
  MemorySearchResultSchema,
  MemoryAddInputSchema,
  MemoryCleanupConfigSchema,
  MemoryCleanupResultSchema,
  MemoryStatsSchema,
  CleanupStrategy,
  ExportFormat,
  validateMemoryEntry,
  validateMemoryAddInput,
  validateSearchOptions,
} from './memory.js';

// Valid UUIDs for testing
const TEST_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('CleanupStrategy', () => {
  it('should accept valid strategies', () => {
    expect(CleanupStrategy.parse('oldest')).toBe('oldest');
    expect(CleanupStrategy.parse('least_accessed')).toBe('least_accessed');
    expect(CleanupStrategy.parse('low_importance')).toBe('low_importance');
    expect(CleanupStrategy.parse('hybrid')).toBe('hybrid');
  });

  it('should reject invalid strategy', () => {
    expect(() => CleanupStrategy.parse('invalid')).toThrow();
  });
});

describe('ExportFormat', () => {
  it('should accept valid formats', () => {
    expect(ExportFormat.parse('json')).toBe('json');
    expect(ExportFormat.parse('jsonl')).toBe('jsonl');
    expect(ExportFormat.parse('csv')).toBe('csv');
  });
});

describe('MemoryMetadataSchema', () => {
  it('should validate minimal metadata', () => {
    const result = MemoryMetadataSchema.parse({
      type: 'document',
      source: 'user',
    });

    expect(result.type).toBe('document');
    expect(result.source).toBe('user');
  });

  it('should validate full metadata', () => {
    const result = MemoryMetadataSchema.parse({
      type: 'conversation',
      source: 'agent',
      agentId: 'backend',
      sessionId: TEST_SESSION_ID,
      tags: ['coding', 'api'],
      importance: 0.8,
    });

    expect(result.agentId).toBe('backend');
    expect(result.tags).toContain('api');
    expect(result.importance).toBe(0.8);
  });

  it('should reject invalid importance', () => {
    expect(() => MemoryMetadataSchema.parse({
      type: 'document',
      source: 'user',
      importance: 1.5, // > 1
    })).toThrow();
  });
});

describe('MemoryEntrySchema', () => {
  const validEntry = {
    id: 1,
    content: 'Test content',
    metadata: {
      type: 'document',
      source: 'user',
    },
    createdAt: new Date(),
    accessCount: 0,
  };

  it('should validate minimal entry', () => {
    const result = MemoryEntrySchema.parse(validEntry);

    expect(result.id).toBe(1);
    expect(result.content).toBe('Test content');
    expect(result.accessCount).toBe(0);
  });

  it('should validate full entry', () => {
    const result = MemoryEntrySchema.parse({
      ...validEntry,
      lastAccessedAt: new Date(),
      accessCount: 5,
      score: 0.95,
    });

    expect(result.lastAccessedAt).toBeDefined();
    expect(result.accessCount).toBe(5);
    expect(result.score).toBe(0.95);
  });
});

describe('MemoryFilterSchema', () => {
  it('should validate empty filter', () => {
    const result = MemoryFilterSchema.parse({});
    expect(result).toEqual({});
  });

  it('should validate full filter', () => {
    const result = MemoryFilterSchema.parse({
      type: 'document',
      source: 'agent',
      agentId: 'backend',
      sessionId: TEST_SESSION_ID,
      tags: ['api'],
      tagsAll: ['coding', 'backend'],
      minImportance: 0.5,
      minAccessCount: 2,
      createdAfter: new Date('2024-01-01'),
      createdBefore: new Date('2024-12-31'),
    });

    expect(result.type).toBe('document');
    expect(result.tags).toContain('api');
    expect(result.minImportance).toBe(0.5);
  });
});

describe('MemorySearchOptionsSchema', () => {
  it('should validate minimal options', () => {
    const result = MemorySearchOptionsSchema.parse({
      query: 'test query',
    });

    expect(result.query).toBe('test query');
  });

  it('should validate full options', () => {
    const result = MemorySearchOptionsSchema.parse({
      query: 'test query',
      limit: 20,
      offset: 10,
      filter: {
        type: 'document',
      },
    });

    expect(result.limit).toBe(20);
    expect(result.offset).toBe(10);
    expect(result.filter?.type).toBe('document');
  });

  it('should reject empty query', () => {
    expect(() => MemorySearchOptionsSchema.parse({
      query: '',
    })).toThrow();
  });
});

describe('MemorySearchResultSchema', () => {
  it('should validate empty result', () => {
    const result = MemorySearchResultSchema.parse({
      entries: [],
      total: 0,
      duration: 5,
      query: 'test',
      hasMore: false,
    });

    expect(result.entries).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('should validate result with entries', () => {
    const result = MemorySearchResultSchema.parse({
      entries: [{
        id: 1,
        content: 'Found content',
        metadata: { type: 'document', source: 'user' },
        createdAt: new Date(),
        accessCount: 0,
        score: 0.9,
      }],
      total: 10,
      duration: 15,
      query: 'test',
      hasMore: true,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
  });
});

describe('MemoryAddInputSchema', () => {
  it('should validate minimal input', () => {
    const result = MemoryAddInputSchema.parse({
      content: 'New memory content',
      metadata: {
        type: 'document',
        source: 'user',
      },
    });

    expect(result.content).toBe('New memory content');
  });

  it('should validate input with full metadata', () => {
    const result = MemoryAddInputSchema.parse({
      content: 'Agent conversation log',
      metadata: {
        type: 'conversation',
        source: 'agent',
        agentId: 'backend',
        sessionId: TEST_SESSION_ID,
        tags: ['api', 'design'],
        importance: 0.7,
      },
    });

    expect(result.metadata.agentId).toBe('backend');
    expect(result.metadata.tags).toContain('design');
  });

  it('should reject empty content', () => {
    expect(() => MemoryAddInputSchema.parse({
      content: '',
      metadata: { type: 'document', source: 'user' },
    })).toThrow();
  });
});

describe('MemoryCleanupConfigSchema', () => {
  it('should use defaults', () => {
    const result = MemoryCleanupConfigSchema.parse({});

    expect(result.enabled).toBe(true);
    expect(result.strategy).toBe('hybrid');
    expect(result.triggerThreshold).toBe(0.9);
    expect(result.targetThreshold).toBe(0.7);
  });

  it('should validate custom config', () => {
    const result = MemoryCleanupConfigSchema.parse({
      enabled: true,
      strategy: 'oldest',
      triggerThreshold: 0.8,
      targetThreshold: 0.6,
      retentionDays: 30,
      minCleanupCount: 50,
      maxCleanupCount: 500,
      preserveTags: ['important', 'pinned'],
    });

    expect(result.strategy).toBe('oldest');
    expect(result.retentionDays).toBe(30);
    expect(result.preserveTags).toContain('important');
  });

  it('should reject invalid thresholds', () => {
    expect(() => MemoryCleanupConfigSchema.parse({
      triggerThreshold: 1.5, // > 1
    })).toThrow();
  });
});

describe('MemoryCleanupResultSchema', () => {
  it('should validate cleanup result', () => {
    const result = MemoryCleanupResultSchema.parse({
      deletedCount: 100,
      strategy: 'oldest',
      duration: 250,
      entriesBefore: 1000,
      entriesAfter: 900,
    });

    expect(result.deletedCount).toBe(100);
    expect(result.entriesBefore - result.entriesAfter).toBe(100);
  });
});

describe('MemoryStatsSchema', () => {
  it('should validate empty stats', () => {
    const result = MemoryStatsSchema.parse({
      totalEntries: 0,
      entriesByType: {},
      databaseSizeBytes: 4096,
      avgContentLength: 0,
      totalAccessCount: 0,
      topTags: [],
    });

    expect(result.totalEntries).toBe(0);
  });

  it('should validate full stats', () => {
    const result = MemoryStatsSchema.parse({
      totalEntries: 1000,
      entriesByType: {
        document: 500,
        conversation: 300,
        code: 200,
      },
      databaseSizeBytes: 1048576,
      oldestEntry: new Date('2024-01-01'),
      newestEntry: new Date('2024-06-01'),
      avgContentLength: 250,
      totalAccessCount: 5000,
      topTags: [
        { tag: 'api', count: 100 },
        { tag: 'coding', count: 80 },
      ],
    });

    expect(result.entriesByType['document']).toBe(500);
    expect(result.topTags).toHaveLength(2);
    expect(result.topTags[0]?.tag).toBe('api');
  });
});

describe('validateMemoryEntry', () => {
  it('should validate valid entry', () => {
    const entry = validateMemoryEntry({
      id: 1,
      content: 'Test',
      metadata: { type: 'document', source: 'user' },
      createdAt: new Date(),
      accessCount: 0,
    });

    expect(entry.id).toBe(1);
  });

  it('should throw for invalid entry', () => {
    expect(() => validateMemoryEntry({
      id: 'invalid', // should be number
    })).toThrow();
  });
});

describe('validateMemoryAddInput', () => {
  it('should validate valid input', () => {
    const input = validateMemoryAddInput({
      content: 'Test content',
      metadata: { type: 'document', source: 'user' },
    });

    expect(input.content).toBe('Test content');
  });
});

describe('validateSearchOptions', () => {
  it('should validate valid options', () => {
    const options = validateSearchOptions({
      query: 'test',
      limit: 10,
    });

    expect(options.query).toBe('test');
  });
});
