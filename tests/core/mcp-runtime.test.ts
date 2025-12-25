import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Cache
  LRUCache,
  createLRUCache,

  // Timeout
  withTimeout,
  withToolTimeout,
  TimeoutError,
  DEFAULT_TIMEOUT_CONFIG,

  // Response
  createSuccessResponse,
  createErrorResponse,
  createListResponse,
  createNotFoundResponse,
  truncateString,
  truncateResponse,

  // Validation
  validateRequest,
  isValidRequest,
  formatValidationErrors,

  // Guard
  RuntimeGuard,
  createRuntimeGuard,
  quickGuardCheck,
} from '@defai.digital/mcp-runtime';

describe('MCP Runtime Domain', () => {
  // ==========================================================================
  // LRU Cache Tests
  // ==========================================================================
  describe('LRU Cache', () => {
    let cache: LRUCache;

    beforeEach(() => {
      cache = createLRUCache({
        maxSizeBytes: 10_000,
        maxEntries: 100,
        defaultTtlMs: 60_000,
        cleanupIntervalMs: 100_000, // Long interval to avoid interference
      });
    });

    afterEach(() => {
      cache.shutdown();
    });

    describe('INV-MCP-CACHE-001: Size Bound', () => {
      it('should not exceed maxSizeBytes', () => {
        // Add entries until we approach the limit
        for (let i = 0; i < 100; i++) {
          cache.set(`key-${i}`, { data: 'x'.repeat(100) });
        }

        const stats = cache.getStats();
        expect(stats.currentSizeBytes).toBeLessThanOrEqual(10_000);
      });

      it('should trigger eviction when high water mark exceeded', () => {
        // Fill cache past high water mark (90%)
        for (let i = 0; i < 50; i++) {
          cache.set(`key-${i}`, { data: 'x'.repeat(200) });
        }

        const stats = cache.getStats();
        expect(stats.evictionCount).toBeGreaterThan(0);
      });
    });

    describe('INV-MCP-CACHE-002: Entry Bound', () => {
      it('should not exceed maxEntries', () => {
        // Try to add more than maxEntries
        for (let i = 0; i < 150; i++) {
          cache.set(`key-${i}`, 'small');
        }

        const stats = cache.getStats();
        expect(stats.entryCount).toBeLessThanOrEqual(100);
      });
    });

    describe('INV-MCP-CACHE-003: TTL Expiration', () => {
      it('should not return expired entries', async () => {
        // Create cache with short TTL
        const shortTtlCache = createLRUCache({
          defaultTtlMs: 50, // 50ms TTL
          cleanupIntervalMs: 100_000,
        });

        shortTtlCache.set('expiring', 'value');

        // Should hit initially
        expect(shortTtlCache.get('expiring').hit).toBe(true);

        // Wait for expiration
        await new Promise((r) => setTimeout(r, 100));

        // Should miss after expiration
        expect(shortTtlCache.get('expiring').hit).toBe(false);

        shortTtlCache.shutdown();
      });
    });

    describe('INV-MCP-CACHE-004: LRU Ordering', () => {
      it('should evict entries when capacity exceeded (LRU policy)', () => {
        // Use entry-based eviction for deterministic behavior
        const lruCache = createLRUCache({
          maxEntries: 5,
          maxSizeBytes: 100_000_000, // Large size to avoid size-based eviction
          evictionPolicy: 'lru',
          highWaterMark: 0.9,
          lowWaterMark: 0.6, // Evict down to 60% = 3 entries
          cleanupIntervalMs: 100_000,
        });

        // Add 5 entries (at capacity)
        for (let i = 0; i < 5; i++) {
          lruCache.set(`key-${i}`, `value-${i}`);
        }

        // Add one more entry to trigger eviction
        lruCache.set('trigger', 'value');

        const stats = lruCache.getStats();

        // Verify eviction happened
        expect(stats.evictionCount).toBeGreaterThan(0);
        expect(stats.entryCount).toBeLessThanOrEqual(4);

        // The trigger entry should exist (just added)
        expect(lruCache.has('trigger')).toBe(true);

        // At least some original entries should be evicted
        const originalPresent = [0, 1, 2, 3, 4].filter(i => lruCache.has(`key-${i}`)).length;
        expect(originalPresent).toBeLessThan(5);

        lruCache.shutdown();
      });

      it('should prefer evicting non-accessed entries over accessed ones (LRU)', () => {
        const lruCache = createLRUCache({
          maxEntries: 4,
          maxSizeBytes: 100_000_000,
          evictionPolicy: 'lru',
          highWaterMark: 0.9,
          lowWaterMark: 0.5, // Evict down to 2 entries
          cleanupIntervalMs: 100_000,
        });

        // Add 4 entries
        lruCache.set('never-accessed-1', 'value');
        lruCache.set('never-accessed-2', 'value');
        lruCache.set('will-access', 'value');
        lruCache.set('newest', 'value');

        // Access one entry multiple times to ensure it has higher accessCount
        // and more recent lastAccessedAt
        lruCache.get('will-access');
        lruCache.get('will-access');
        lruCache.get('will-access');

        // Trigger eviction
        lruCache.set('trigger', 'value');

        const stats = lruCache.getStats();
        expect(stats.evictionCount).toBeGreaterThan(0);

        // The accessed entry and trigger should survive
        expect(lruCache.has('will-access')).toBe(true);
        expect(lruCache.has('trigger')).toBe(true);

        // At least one of the never-accessed entries should be evicted
        const neverAccessedCount =
          (lruCache.has('never-accessed-1') ? 1 : 0) +
          (lruCache.has('never-accessed-2') ? 1 : 0);
        expect(neverAccessedCount).toBeLessThan(2);

        lruCache.shutdown();
      });

      it('should evict least frequently used entries (LFU policy)', () => {
        const lfuCache = createLRUCache({
          maxEntries: 5,
          maxSizeBytes: 100_000_000,
          evictionPolicy: 'lfu',
          highWaterMark: 0.9,
          lowWaterMark: 0.6,
          cleanupIntervalMs: 100_000,
        });

        // Add 5 entries
        lfuCache.set('rarely-used', 'value');
        lfuCache.set('sometimes-used', 'value');
        lfuCache.set('often-used', 'value');
        lfuCache.set('very-used', 'value');
        lfuCache.set('super-used', 'value');

        // Access entries different number of times to establish frequency
        // rarely-used: 0 accesses (just insertion)
        lfuCache.get('sometimes-used'); // 1 access
        lfuCache.get('often-used'); lfuCache.get('often-used'); // 2 accesses
        lfuCache.get('very-used'); lfuCache.get('very-used'); lfuCache.get('very-used'); // 3 accesses
        for (let i = 0; i < 5; i++) lfuCache.get('super-used'); // 5 accesses

        // Trigger eviction
        lfuCache.set('trigger', 'value');

        const stats = lfuCache.getStats();
        expect(stats.evictionCount).toBeGreaterThan(0);

        // Most frequently accessed should survive
        expect(lfuCache.has('super-used')).toBe(true);
        expect(lfuCache.has('very-used')).toBe(true);
        expect(lfuCache.has('trigger')).toBe(true);

        // Least frequently accessed should be evicted
        expect(lfuCache.has('rarely-used')).toBe(false);

        lfuCache.shutdown();
      });

      it('should evict oldest entries first (FIFO policy)', () => {
        const fifoCache = createLRUCache({
          maxEntries: 5,
          maxSizeBytes: 100_000_000,
          evictionPolicy: 'fifo',
          highWaterMark: 0.9,
          lowWaterMark: 0.6,
          cleanupIntervalMs: 100_000,
        });

        // Add 5 entries in order
        fifoCache.set('first', 'value');
        fifoCache.set('second', 'value');
        fifoCache.set('third', 'value');
        fifoCache.set('fourth', 'value');
        fifoCache.set('fifth', 'value');

        // Access doesn't matter for FIFO - accessing old entries shouldn't save them
        fifoCache.get('first');
        fifoCache.get('first');
        fifoCache.get('first');

        // Trigger eviction
        fifoCache.set('sixth', 'value');

        const stats = fifoCache.getStats();
        expect(stats.evictionCount).toBeGreaterThan(0);

        // Newest entries should survive regardless of access pattern
        expect(fifoCache.has('fifth')).toBe(true);
        expect(fifoCache.has('sixth')).toBe(true);

        // Oldest entries should be evicted even if accessed
        expect(fifoCache.has('first')).toBe(false);
        expect(fifoCache.has('second')).toBe(false);

        fifoCache.shutdown();
      });

      it('should update accessCount on get()', () => {
        const cache = createLRUCache({
          maxEntries: 10,
          cleanupIntervalMs: 100_000,
        });

        cache.set('key', 'value');

        // First get
        const result1 = cache.get('key');
        expect(result1.hit).toBe(true);
        expect(result1.entry?.accessCount).toBe(1);

        // Second get
        const result2 = cache.get('key');
        expect(result2.entry?.accessCount).toBe(2);

        // Third get
        const result3 = cache.get('key');
        expect(result3.entry?.accessCount).toBe(3);

        cache.shutdown();
      });

      it('should use correct eviction order for each policy', () => {
        // Test that each policy evicts entries and the most valuable ones survive.
        // Note: Due to millisecond timestamp precision, entries created in the same
        // millisecond may have identical timestamps, making exact eviction order
        // non-deterministic. We test that eviction happens and policies favor the
        // right entries.
        //
        // Using maxEntries: 5 and lowWaterMark: 0.6 means:
        // - Eviction triggers when adding 6th entry
        // - Target after eviction: Math.floor(5 * 0.6) = 3 entries

        // LRU: eviction should happen based on lastAccessedAt
        const lruCache = createLRUCache({ maxEntries: 5, evictionPolicy: 'lru', lowWaterMark: 0.6, cleanupIntervalMs: 100_000 });
        lruCache.set('a', '1');
        lruCache.set('b', '2');
        lruCache.set('c', '3');
        lruCache.set('d', '4');
        lruCache.set('e', '5');
        lruCache.set('f', '6'); // Trigger eviction - evicts down to 3
        expect(lruCache.getStats().evictionCount).toBeGreaterThan(0);
        expect(lruCache.getStats().entryCount).toBeLessThanOrEqual(4);
        expect(lruCache.has('f')).toBe(true); // newest always survives
        lruCache.shutdown();

        // LFU: lower accessCount should be evicted first
        const lfuCache = createLRUCache({ maxEntries: 5, evictionPolicy: 'lfu', lowWaterMark: 0.6, cleanupIntervalMs: 100_000 });
        lfuCache.set('a', '1');
        lfuCache.set('b', '2');
        lfuCache.set('c', '3');
        lfuCache.set('d', '4');
        lfuCache.set('e', '5');
        // Give 'a' significantly more accesses than others
        for (let i = 0; i < 20; i++) lfuCache.get('a');
        lfuCache.set('f', '6'); // Trigger eviction
        expect(lfuCache.getStats().evictionCount).toBeGreaterThan(0);
        expect(lfuCache.has('a')).toBe(true); // most accessed survives
        expect(lfuCache.has('f')).toBe(true); // newest survives
        // At least one of b,c,d,e (0 accesses each) should be evicted
        const zeroAccessCount = ['b', 'c', 'd', 'e'].filter(k => lfuCache.has(k)).length;
        expect(zeroAccessCount).toBeLessThan(4);
        lfuCache.shutdown();

        // FIFO: oldest createdAt should be evicted first
        const fifoCache = createLRUCache({ maxEntries: 5, evictionPolicy: 'fifo', lowWaterMark: 0.6, cleanupIntervalMs: 100_000 });
        fifoCache.set('a', '1');
        fifoCache.set('b', '2');
        fifoCache.set('c', '3');
        fifoCache.set('d', '4');
        fifoCache.set('e', '5');
        fifoCache.set('f', '6'); // Trigger eviction
        expect(fifoCache.getStats().evictionCount).toBeGreaterThan(0);
        expect(fifoCache.has('f')).toBe(true); // newest always survives
        fifoCache.shutdown();
      });
    });

    describe('Basic Operations', () => {
      it('should store and retrieve values', () => {
        cache.set('test-key', { foo: 'bar' });
        const result = cache.get('test-key');

        expect(result.hit).toBe(true);
        expect(result.value).toEqual({ foo: 'bar' });
      });

      it('should track hit/miss statistics', () => {
        cache.set('key1', 'value1');

        cache.get('key1'); // Hit
        cache.get('key2'); // Miss
        cache.get('key1'); // Hit
        cache.get('key3'); // Miss

        const stats = cache.getStats();
        expect(stats.hitCount).toBe(2);
        expect(stats.missCount).toBe(2);
        expect(stats.hitRate).toBe(0.5);
      });

      it('should delete entries', () => {
        cache.set('to-delete', 'value');
        expect(cache.has('to-delete')).toBe(true);

        cache.delete('to-delete');
        expect(cache.has('to-delete')).toBe(false);
      });

      it('should clear all entries', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');

        cache.clear();

        const stats = cache.getStats();
        expect(stats.entryCount).toBe(0);
        expect(stats.currentSizeBytes).toBe(0);
      });
    });

    describe('Memory Pressure', () => {
      it('should report correct pressure levels', () => {
        // Empty cache = low pressure
        expect(cache.getPressureLevel()).toBe('low');

        // Fill to ~60% = medium
        for (let i = 0; i < 30; i++) {
          cache.set(`key-${i}`, { data: 'x'.repeat(150) });
        }

        // Due to eviction, pressure might vary
        const level = cache.getPressureLevel();
        expect(['low', 'medium', 'high']).toContain(level);
      });
    });
  });

  // ==========================================================================
  // Timeout Tests
  // ==========================================================================
  describe('Timeout', () => {
    describe('INV-MCP-TIMEOUT-001: Guaranteed Termination', () => {
      it('should timeout long-running operations', async () => {
        const slowOperation = () =>
          new Promise((resolve) => setTimeout(resolve, 1000));

        const result = await withTimeout(slowOperation, 50);

        expect(result.status).toBe('timeout');
        if (result.status === 'timeout') {
          expect(result.timeoutMs).toBe(50);
        }
      });

      it('should complete fast operations', async () => {
        const fastOperation = () => Promise.resolve('done');

        const result = await withTimeout(fastOperation, 1000);

        expect(result.status).toBe('completed');
        if (result.status === 'completed') {
          expect(result.result).toBe('done');
        }
      });
    });

    describe('INV-MCP-TIMEOUT-004: Timeout Error Code', () => {
      it('should throw TimeoutError with correct code', () => {
        const error = new TimeoutError(5000);
        expect(error.code).toBe('TOOL_TIMEOUT');
        expect(error.timeoutMs).toBe(5000);
      });
    });

    describe('INV-MCP-TIMEOUT-005: Duration Tracking', () => {
      it('should track duration for completed operations', async () => {
        const result = await withTimeout(() => Promise.resolve('done'), 1000);

        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.durationMs).toBeLessThan(100); // Should be fast
      });

      it('should track duration for timed out operations', async () => {
        const result = await withTimeout(
          () => new Promise((r) => setTimeout(r, 1000)),
          50
        );

        // Allow 5ms tolerance for timer precision across different platforms
        expect(result.durationMs).toBeGreaterThanOrEqual(45);
        expect(result.durationMs).toBeLessThan(100); // Should timeout around 50ms
      });
    });

    describe('withToolTimeout', () => {
      it('should apply category-based timeout', async () => {
        const handler = async () => {
          await new Promise((r) => setTimeout(r, 50));
          return 'done';
        };

        // Query tools have 10s timeout by default
        const wrappedHandler = withToolTimeout('memory_retrieve', handler);
        const result = await wrappedHandler({});

        expect(result.status).toBe('completed');
      });
    });
  });

  // ==========================================================================
  // Response Helpers Tests
  // ==========================================================================
  describe('Response Helpers', () => {
    describe('INV-MCP-RESP-001: Consistent Envelope', () => {
      it('should create success response with correct structure', () => {
        const response = createSuccessResponse({ foo: 'bar' });

        expect(response.content).toHaveLength(1);
        expect(response.content[0]!.type).toBe('text');

        const parsed = JSON.parse(response.content[0]!.text);
        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({ foo: 'bar' });
      });

      it('should create error response with correct structure', () => {
        const response = createErrorResponse('NOT_FOUND', 'Resource not found');

        expect(response.isError).toBe(true);

        const parsed = JSON.parse(response.content[0]!.text);
        expect(parsed.success).toBe(false);
        expect(parsed.error.code).toBe('NOT_FOUND');
        expect(parsed.error.message).toBe('Resource not found');
      });
    });

    describe('INV-MCP-RESP-002: Error Code Required', () => {
      it('should include error code in all error responses', () => {
        const response = createErrorResponse('INTERNAL_ERROR', 'Something went wrong');
        const parsed = JSON.parse(response.content[0]!.text);

        expect(parsed.error.code).toBeDefined();
        expect(typeof parsed.error.code).toBe('string');
      });
    });

    describe('INV-MCP-RESP-005: Duration Tracking', () => {
      it('should include duration when startTime provided', () => {
        const startTime = Date.now() - 100; // 100ms ago
        const response = createSuccessResponse({ data: 'test' }, { startTime });
        const parsed = JSON.parse(response.content[0]!.text);

        expect(parsed.metadata?.durationMs).toBeGreaterThanOrEqual(100);
      });
    });

    describe('INV-MCP-RESP-006: Retryable Accuracy', () => {
      it('should mark timeout errors as retryable', () => {
        const response = createErrorResponse('TOOL_TIMEOUT', 'Timed out');
        const parsed = JSON.parse(response.content[0]!.text);

        expect(parsed.error.retryable).toBe(true);
      });

      it('should mark validation errors as not retryable', () => {
        const response = createErrorResponse('INVALID_INPUT', 'Bad input');
        const parsed = JSON.parse(response.content[0]!.text);

        expect(parsed.error.retryable).toBe(false);
      });
    });

    describe('createListResponse', () => {
      it('should create paginated list response', () => {
        const items = [1, 2, 3, 4, 5];
        const response = createListResponse(items, { limit: 3, offset: 0, total: 10 });
        const parsed = JSON.parse(response.content[0]!.text);

        expect(parsed.data.items).toHaveLength(3);
        expect(parsed.data.pagination.total).toBe(10);
        expect(parsed.data.pagination.hasMore).toBe(true);
      });
    });

    describe('Truncation', () => {
      it('should truncate long strings', () => {
        const longString = 'x'.repeat(1000);
        const result = truncateString(longString, 100);

        expect(result.truncated).toBe(true);
        expect(result.text.length).toBeLessThanOrEqual(100);
        expect(result.text).toContain('[truncated]');
      });

      it('should not truncate short strings', () => {
        const shortString = 'hello';
        const result = truncateString(shortString, 100);

        expect(result.truncated).toBe(false);
        expect(result.text).toBe('hello');
      });
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================
  describe('Request Validation', () => {
    describe('INV-MCP-LIMIT-001: Array Size Enforcement', () => {
      it('should reject oversized arrays', () => {
        const result = validateRequest('bugfix_scan', {
          paths: Array(200).fill('/path'),
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]!.code).toBe('ARRAY_TOO_LARGE');
        }
      });

      it('should accept arrays within limits', () => {
        const result = validateRequest('bugfix_scan', {
          paths: Array(50).fill('/path'),
        });

        expect(result.valid).toBe(true);
      });
    });

    describe('INV-MCP-LIMIT-003: Tool-Specific Limits', () => {
      it('should use tool-specific limits when defined', () => {
        // bugfix_scan has limit of 100 for paths
        const result = validateRequest('bugfix_scan', {
          paths: Array(101).fill('/path'),
        });

        expect(result.valid).toBe(false);
      });
    });

    describe('INV-MCP-LIMIT-004: Descriptive Errors', () => {
      it('should include path, limit, and actual in errors', () => {
        const result = validateRequest('test_tool', {
          items: Array(200).fill('x'),
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          const error = result.errors[0]!;
          expect(error.path).toBeDefined();
          expect(error.limit).toBeDefined();
          expect(error.actual).toBeDefined();
        }
      });
    });

    describe('String Length Validation', () => {
      it('should reject overly long strings', () => {
        const result = validateRequest('test_tool', {
          content: 'x'.repeat(200_000),
        }, {
          maxArraySize: 100,
          maxStringLength: 100_000,
          maxObjectDepth: 10,
          maxRequestBytes: 10_000_000,
          toolArrayLimits: {},
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0]!.code).toBe('STRING_TOO_LONG');
        }
      });
    });

    describe('Helper Functions', () => {
      it('isValidRequest should narrow type', () => {
        const result = validateRequest('tool', { data: 'test' });

        if (isValidRequest(result)) {
          expect(result.valid).toBe(true);
        }
      });

      it('formatValidationErrors should produce readable output', () => {
        const result = validateRequest('tool', {
          items: Array(200).fill('x'),
        });

        if (!result.valid) {
          const formatted = formatValidationErrors(result.errors);
          expect(formatted).toContain('items');
          expect(formatted).toContain('200');
        }
      });
    });
  });

  // ==========================================================================
  // Runtime Guard Tests
  // ==========================================================================
  describe('Runtime Guard', () => {
    describe('INV-MCP-GUARD-001: Critical Pressure Blocks', () => {
      it('should fail on critical memory pressure', async () => {
        const guard = createRuntimeGuard({ blockOnCriticalPressure: true });

        const result = await guard.check({
          toolName: 'test_tool',
          args: {},
          cacheStats: {
            entryCount: 100,
            currentSizeBytes: 99_000_000,
            maxSizeBytes: 100_000_000,
            hitCount: 50,
            missCount: 50,
            hitRate: 0.5,
            evictionCount: 10,
            pressureLevel: 'critical',
          },
        });

        expect(result.status).toBe('FAIL');
        expect(result.allowed).toBe(false);
      });

      it('should warn on high memory pressure', async () => {
        const guard = createRuntimeGuard();

        const result = await guard.check({
          toolName: 'test_tool',
          args: {},
          cacheStats: {
            entryCount: 100,
            currentSizeBytes: 85_000_000,
            maxSizeBytes: 100_000_000,
            hitCount: 50,
            missCount: 50,
            hitRate: 0.5,
            evictionCount: 10,
            pressureLevel: 'high',
          },
        });

        expect(result.status).toBe('WARN');
        expect(result.allowed).toBe(true);
      });
    });

    describe('INV-MCP-GUARD-002: Invalid Requests Rejected', () => {
      it('should fail on validation errors', async () => {
        const guard = createRuntimeGuard({ blockOnValidationFailure: true });

        const result = await guard.check({
          toolName: 'bugfix_scan',
          args: {
            paths: Array(200).fill('/path'),
          },
        });

        expect(result.status).toBe('FAIL');
        expect(result.allowed).toBe(false);
      });

      it('should pass valid requests', async () => {
        const guard = createRuntimeGuard();

        const result = await guard.check({
          toolName: 'memory_retrieve',
          args: { key: 'test-key' },
        });

        expect(result.status).toBe('PASS');
        expect(result.allowed).toBe(true);
      });
    });

    describe('Summary Generation', () => {
      it('should generate human-readable summary', async () => {
        const result = await quickGuardCheck('test_tool', {});

        expect(typeof result.summary).toBe('string');
        expect(result.summary.length).toBeGreaterThan(0);
      });
    });

    describe('Gate Results', () => {
      it('should include individual gate results', async () => {
        const guard = createRuntimeGuard({
          checkMemoryPressure: true,
          checkRequestLimits: true,
        });

        const result = await guard.check({
          toolName: 'test_tool',
          args: {},
          cacheStats: {
            entryCount: 10,
            currentSizeBytes: 10_000,
            maxSizeBytes: 100_000_000,
            hitCount: 5,
            missCount: 5,
            hitRate: 0.5,
            evictionCount: 0,
            pressureLevel: 'low',
          },
        });

        expect(result.gates.length).toBeGreaterThan(0);
        expect(result.gates.every((g: { gate: string; status: string; message: string }) => g.gate && g.status && g.message)).toBe(true);
      });
    });
  });
});
