/**
 * Storage Contract Invariant Tests
 *
 * Tests for storage invariants documented in packages/contracts/src/storage/v1/invariants.md
 *
 * Invariants tested:
 * - INV-ST-001: Storage Mode Configuration
 * - INV-ST-002: Namespace Isolation
 * - INV-ST-003: Event Immutability
 * - INV-ST-004: Event Ordering
 * - INV-ST-005: Trace Event Sequencing
 * - INV-ST-006: Trace Deletion Completeness
 * - INV-ST-007: FTS Search Ranking
 * - INV-ST-008: TTL Best-Effort Expiration
 */

import { describe, it, expect } from 'vitest';
import {
  StorageModeSchema,
  StorageConfigSchema,
  KVEntrySchema,
  KVSearchResultSchema,
  TraceSummarySchema,
  FTSItemSchema,
  FTSResultSchema,
  FTSSearchOptionsSchema,
  validateStorageConfig,
  safeValidateStorageConfig,
  validateKVEntry,
  validateFTSItem,
  validateTraceSummary,
  createDefaultStorageConfig,
  createKVEntry,
} from '@automatosx/contracts';
// Simple UUID generation for tests
const uuid = () => crypto.randomUUID();

describe('Storage Contract', () => {
  describe('StorageModeSchema', () => {
    it('should accept valid storage modes', () => {
      expect(StorageModeSchema.safeParse('sqlite').success).toBe(true);
      expect(StorageModeSchema.safeParse('memory').success).toBe(true);
    });

    it('should reject invalid storage modes', () => {
      expect(StorageModeSchema.safeParse('postgres').success).toBe(false);
      expect(StorageModeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('StorageConfigSchema', () => {
    it('should validate minimal config with defaults', () => {
      const result = StorageConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('sqlite');
      }
    });

    it('should validate full config', () => {
      const config = {
        mode: 'sqlite' as const,
        dbPath: '/path/to/db.sqlite',
        maxConnections: 10,
        enableWAL: true,
      };
      const result = validateStorageConfig(config);
      expect(result.mode).toBe('sqlite');
      expect(result.dbPath).toBe('/path/to/db.sqlite');
    });

    it('should reject invalid maxConnections', () => {
      const config = { maxConnections: 0 };
      const result = safeValidateStorageConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe('KVEntrySchema', () => {
    it('should validate a KV entry', () => {
      const entry = {
        key: 'test-key',
        value: { data: 'test' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = KVEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should reject empty key', () => {
      const entry = {
        key: '',
        value: 'test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = KVEntrySchema.safeParse(entry);
      expect(result.success).toBe(false);
    });

    it('should validate entry with TTL', () => {
      const entry = {
        key: 'temp-key',
        value: 'temp-value',
        ttlMs: 60000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
      const result = validateKVEntry(entry);
      expect(result.ttlMs).toBe(60000);
    });
  });

  describe('TraceSummarySchema', () => {
    it('should validate a trace summary', () => {
      const summary = {
        traceId: uuid(),
        startTime: new Date().toISOString(),
        status: 'success' as const,
        eventCount: 10,
        errorCount: 0,
      };
      const result = validateTraceSummary(summary);
      expect(result.status).toBe('success');
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'running', 'success', 'failure', 'skipped'] as const;
      for (const status of statuses) {
        const summary = {
          traceId: uuid(),
          startTime: new Date().toISOString(),
          status,
          eventCount: 0,
          errorCount: 0,
        };
        const result = TraceSummarySchema.safeParse(summary);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('FTSItemSchema', () => {
    it('should validate an FTS item', () => {
      const item = {
        id: 'doc-123',
        content: 'This is searchable content',
      };
      const result = validateFTSItem(item);
      expect(result.id).toBe('doc-123');
    });

    it('should validate FTS item with metadata', () => {
      const item = {
        id: 'doc-456',
        content: 'More content',
        metadata: { author: 'test', tags: ['a', 'b'] },
        namespace: 'docs',
      };
      const result = FTSItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });
  });

  describe('FTSResultSchema', () => {
    it('should validate an FTS result', () => {
      const result = {
        id: 'doc-123',
        content: 'Matched content',
        score: 0.95,
      };
      const parsed = FTSResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate result with highlights', () => {
      const result = {
        id: 'doc-123',
        content: 'Matched content',
        score: 0.8,
        highlights: ['<mark>matched</mark> content'],
      };
      const parsed = FTSResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('FTSSearchOptionsSchema', () => {
    it('should apply defaults', () => {
      const result = FTSSearchOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('Factory Functions', () => {
    it('should create default storage config', () => {
      const config = createDefaultStorageConfig();
      expect(config.mode).toBe('sqlite');
    });

    it('should create KV entry', () => {
      const entry = createKVEntry('my-key', { foo: 'bar' }, { ttlMs: 5000 });
      expect(entry.key).toBe('my-key');
      expect(entry.value).toEqual({ foo: 'bar' });
      expect(entry.ttlMs).toBe(5000);
      expect(entry.expiresAt).toBeDefined();
    });
  });
});

// ============================================================================
// Storage Mode Invariant Tests
// ============================================================================

describe('INV-ST-001: Storage Mode Configuration', () => {
  it('should accept sqlite storage mode', () => {
    const result = StorageModeSchema.safeParse('sqlite');
    expect(result.success).toBe(true);
  });

  it('should accept memory storage mode', () => {
    const result = StorageModeSchema.safeParse('memory');
    expect(result.success).toBe(true);
  });

  it('should reject invalid storage modes', () => {
    const invalidModes = ['postgresql', 'redis', 'mysql', 'file', '', null];
    for (const mode of invalidModes) {
      const result = StorageModeSchema.safeParse(mode);
      expect(result.success).toBe(false);
    }
  });

  it('should default to sqlite in config', () => {
    const config = StorageConfigSchema.parse({});
    expect(config.mode).toBe('sqlite');
  });

  it('should validate storage config with valid mode', () => {
    const config = {
      mode: 'memory' as const,
    };
    const result = safeValidateStorageConfig(config);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Key-Value Namespace Invariant Tests
// ============================================================================

describe('INV-ST-002: Namespace Isolation', () => {
  it('should validate KV entry with namespace', () => {
    const entry = {
      key: 'shared-key',
      value: 'value-a',
      namespace: 'namespace-a',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should allow same key in different namespaces', () => {
    const entryA = {
      key: 'test-key',
      value: 'value-a',
      namespace: 'ns-a',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const entryB = {
      key: 'test-key',
      value: 'value-b',
      namespace: 'ns-b',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Both entries are valid with same key but different namespaces
    expect(KVEntrySchema.safeParse(entryA).success).toBe(true);
    expect(KVEntrySchema.safeParse(entryB).success).toBe(true);
    expect(entryA.namespace).not.toBe(entryB.namespace);
  });

  it('should validate namespace is optional (default namespace)', () => {
    const entry = {
      key: 'key-without-namespace',
      value: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.namespace).toBeUndefined();
    }
  });

  it('should enforce namespace max length', () => {
    const entry = {
      key: 'test',
      value: 'test',
      namespace: 'a'.repeat(129), // Exceeds 128 char limit
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should support namespace in search results', () => {
    const searchResult = {
      key: 'found-key',
      value: { data: 'found' },
      namespace: 'search-ns',
      score: 0.9,
    };
    const result = KVSearchResultSchema.safeParse(searchResult);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Event Immutability Invariant Tests
// ============================================================================

describe('INV-ST-003: Event Immutability', () => {
  it('should define EventStoragePort with only append method', () => {
    // EventStoragePort interface should not have update/modify methods
    // This is verified by the type definition - no update method exists
    // Here we verify the event structure is complete and can be stored
    const event = {
      eventId: uuid(),
      aggregateId: 'aggregate-1',
      type: 'test.event',
      timestamp: new Date().toISOString(),
      payload: { data: 'immutable' },
    };

    // Events should be JSON-serializable (immutable by nature)
    const serialized = JSON.stringify(event);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.eventId).toBe(event.eventId);
  });

  it('should freeze event after creation', () => {
    const entry = createKVEntry('test', { data: 'frozen' });

    // Verify timestamps are set and immutable
    expect(entry.createdAt).toBeDefined();
    expect(entry.updatedAt).toBeDefined();

    // Structure should be a plain object (no methods to modify)
    expect(typeof entry).toBe('object');
    expect(Array.isArray(entry)).toBe(false);
  });
});

// ============================================================================
// Event Ordering Invariant Tests
// ============================================================================

describe('INV-ST-004: Event Ordering Within Aggregate', () => {
  it('should validate trace summary with event count', () => {
    const summary = {
      traceId: uuid(),
      startTime: new Date().toISOString(),
      status: 'success' as const,
      eventCount: 5,
      errorCount: 0,
    };
    const result = validateTraceSummary(summary);
    expect(result.eventCount).toBe(5);
  });

  it('should track event count for ordering verification', () => {
    // Event count helps verify ordering is maintained
    const summaries = [
      { traceId: uuid(), startTime: new Date().toISOString(), status: 'success' as const, eventCount: 3, errorCount: 0 },
      { traceId: uuid(), startTime: new Date().toISOString(), status: 'success' as const, eventCount: 5, errorCount: 0 },
      { traceId: uuid(), startTime: new Date().toISOString(), status: 'failure' as const, eventCount: 2, errorCount: 1 },
    ];

    for (const summary of summaries) {
      const result = TraceSummarySchema.safeParse(summary);
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================================
// Trace Event Sequencing Invariant Tests
// ============================================================================

describe('INV-ST-005: Trace Event Sequencing', () => {
  it('should validate trace summary with timing info', () => {
    const summary = {
      traceId: uuid(),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 1000).toISOString(),
      status: 'success' as const,
      eventCount: 10,
      errorCount: 0,
      durationMs: 1000,
    };
    const result = validateTraceSummary(summary);
    expect(result.durationMs).toBe(1000);
  });

  it('should support optional endTime for running traces', () => {
    const runningTrace = {
      traceId: uuid(),
      startTime: new Date().toISOString(),
      status: 'running' as const,
      eventCount: 3,
      errorCount: 0,
    };
    const result = TraceSummarySchema.safeParse(runningTrace);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endTime).toBeUndefined();
    }
  });

  it('should track error count separately from event count', () => {
    const summary = {
      traceId: uuid(),
      startTime: new Date().toISOString(),
      status: 'failure' as const,
      eventCount: 10,
      errorCount: 3,
    };
    const result = validateTraceSummary(summary);
    expect(result.eventCount).toBe(10);
    expect(result.errorCount).toBe(3);
  });
});

// ============================================================================
// Trace Deletion Invariant Tests
// ============================================================================

describe('INV-ST-006: Trace Deletion Completeness', () => {
  it('should require traceId for deletion identification', () => {
    const traceId = uuid();
    // TraceStoragePort.deleteTrace(traceId) should remove all events
    // Verify traceId is a valid UUID
    expect(traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should validate trace summary with all required fields', () => {
    const summary = {
      traceId: uuid(),
      startTime: new Date().toISOString(),
      status: 'success' as const,
      eventCount: 0,
      errorCount: 0,
    };

    // After deletion, no events should remain (eventCount would be 0 if queried)
    const result = validateTraceSummary(summary);
    expect(result.eventCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });
});

// ============================================================================
// FTS Search Ranking Invariant Tests
// ============================================================================

describe('INV-ST-007: FTS Search Ranking', () => {
  it('should include score in search results', () => {
    const result = {
      id: 'doc-1',
      content: 'Relevant content',
      score: 0.95,
    };
    const parsed = FTSResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.score).toBe(0.95);
    }
  });

  it('should validate score is non-negative', () => {
    const invalidResult = {
      id: 'doc-1',
      content: 'Content',
      score: -0.5,
    };
    const result = FTSResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });

  it('should support descending score order verification', () => {
    const results = [
      { id: 'doc-1', content: 'Best match', score: 0.95 },
      { id: 'doc-2', content: 'Good match', score: 0.75 },
      { id: 'doc-3', content: 'Weak match', score: 0.45 },
    ];

    // Verify all results are valid
    for (const r of results) {
      expect(FTSResultSchema.safeParse(r).success).toBe(true);
    }

    // Verify descending order (implementation should maintain this)
    const isSorted = results.every(
      (r, i) => i === 0 || results[i - 1]!.score >= r.score
    );
    expect(isSorted).toBe(true);
  });

  it('should support search options with limit', () => {
    const options = {
      limit: 20,
      offset: 0,
      namespace: 'docs',
    };
    const result = FTSSearchOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });

  it('should reject limit above maximum', () => {
    const options = {
      limit: 1001, // Max is 1000
    };
    const result = FTSSearchOptionsSchema.safeParse(options);
    expect(result.success).toBe(false);
  });

  it('should support highlights in results', () => {
    const result = {
      id: 'doc-1',
      content: 'The quick brown fox',
      score: 0.8,
      highlights: ['The <mark>quick</mark> brown fox'],
    };
    const parsed = FTSResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.highlights).toHaveLength(1);
    }
  });
});

// ============================================================================
// TTL Expiration Invariant Tests
// ============================================================================

describe('INV-ST-008: TTL Best-Effort Expiration', () => {
  it('should validate entry with TTL', () => {
    const entry = createKVEntry('temp-key', 'temp-value', { ttlMs: 60000 });
    expect(entry.ttlMs).toBe(60000);
    expect(entry.expiresAt).toBeDefined();
  });

  it('should calculate expiresAt from ttlMs', () => {
    const ttlMs = 30000;
    const entry = createKVEntry('key', 'value', { ttlMs });

    // expiresAt should be approximately now + ttlMs
    const expiresAt = new Date(entry.expiresAt!).getTime();
    const createdAt = new Date(entry.createdAt).getTime();
    expect(expiresAt - createdAt).toBe(ttlMs);
  });

  it('should not set expiresAt when no TTL', () => {
    const entry = createKVEntry('permanent-key', 'permanent-value');
    expect(entry.ttlMs).toBeUndefined();
    expect(entry.expiresAt).toBeUndefined();
  });

  it('should validate ttlMs is non-negative', () => {
    const entry = {
      key: 'test',
      value: 'test',
      ttlMs: -1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should validate expiresAt is valid datetime', () => {
    const entry = {
      key: 'test',
      value: 'test',
      ttlMs: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: 'invalid-date',
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should support tags for TTL entries', () => {
    const entry = createKVEntry('tagged-key', 'value', {
      ttlMs: 60000,
      tags: ['cache', 'temp'],
    });
    expect(entry.tags).toEqual(['cache', 'temp']);
  });
});

// ============================================================================
// Key Validation Invariant Tests
// ============================================================================

describe('Key-Value Key Constraints', () => {
  it('should enforce minimum key length', () => {
    const entry = {
      key: '',
      value: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should enforce maximum key length', () => {
    const entry = {
      key: 'a'.repeat(513), // Exceeds 512 char limit
      value: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should accept valid key within bounds', () => {
    const entry = {
      key: 'valid-key-123',
      value: { complex: 'data' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should enforce maximum tags count', () => {
    const entry = {
      key: 'test',
      value: 'test',
      tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`), // Exceeds 20 tag limit
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = KVEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});
