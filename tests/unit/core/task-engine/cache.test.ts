/**
 * Task Cache Unit Tests
 *
 * Tests for LRU cache implementation:
 * - Basic get/set operations
 * - LRU eviction
 * - TTL expiration
 * - Size tracking
 * - Statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TaskCache,
  createTaskCache,
  getTaskCache,
  resetTaskCache,
  generateCacheKey,
  DEFAULT_CACHE_CONFIG
} from '@/core/task-engine/cache';

describe('TaskCache', () => {
  let cache: TaskCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createTaskCache({
      maxSize: 10,
      maxBytes: 1024 * 1024,
      defaultTtlMs: 60000,
      cleanIntervalMs: 0 // Disable auto-cleanup for tests
    });
  });

  afterEach(() => {
    cache.shutdown();
    vi.useRealTimers();
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', { data: 'value1' });
      const result = cache.get('key1');

      expect(result).toEqual({ data: 'value1' });
    });

    it('should return undefined for missing keys', () => {
      const result = cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', { data: 'value1' });
      cache.set('key1', { data: 'value2' });

      const result = cache.get('key1');

      expect(result).toEqual({ data: 'value2' });
    });

    it('should track access count', () => {
      cache.set('key1', { data: 'value1' });

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // Access stats are tracked internally
      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', { data: 'value1' });

      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should not update access stats', () => {
      cache.set('key1', { data: 'value1' });

      cache.has('key1');
      cache.has('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(0); // has() doesn't count as hit
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', { data: 'value1' });
      const deleted = cache.delete('key1');

      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should return false for missing keys', () => {
      const deleted = cache.delete('nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', { data: 'value1' });
      cache.set('key2', { data: 'value2' });
      cache.set('key3', { data: 'value3' });

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key1', { data: 'value1' });

      // Advance time past TTL
      vi.advanceTimersByTime(61000);

      const result = cache.get('key1');

      expect(result).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      cache.set('key1', { data: 'value1' });

      // Advance time but not past TTL
      vi.advanceTimersByTime(30000);

      const result = cache.get('key1');

      expect(result).toEqual({ data: 'value1' });
    });

    it('should respect custom TTL per entry', () => {
      cache.set('short', { data: 'short' }, 5000);
      cache.set('long', { data: 'long' }, 120000);

      vi.advanceTimersByTime(10000);

      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toEqual({ data: 'long' });
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, { data: `value${i}` });
      }

      expect(cache.size).toBe(10);

      // Add one more - should evict key0 (LRU)
      cache.set('key10', { data: 'value10' });

      expect(cache.size).toBe(10);
      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key10')).toBe(true);
    });

    it('should preserve recently accessed entries', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, { data: `value${i}` });
      }

      // Access key0 to make it recently used
      cache.get('key0');

      // Add one more - should evict key1 (now LRU) instead of key0
      cache.set('key10', { data: 'value10' });

      expect(cache.has('key0')).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should track eviction count', () => {
      for (let i = 0; i < 15; i++) {
        cache.set(`key${i}`, { data: `value${i}` });
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBe(5);
    });
  });

  describe('size tracking', () => {
    it('should track total bytes', () => {
      cache.set('key1', { data: 'x'.repeat(100) });
      cache.set('key2', { data: 'y'.repeat(100) });

      const stats = cache.getStats();
      expect(stats.totalBytes).toBeGreaterThan(200);
    });

    it('should update size on delete', () => {
      cache.set('key1', { data: 'x'.repeat(100) });
      const statsBeforeDelete = cache.getStats();

      cache.delete('key1');
      const statsAfterDelete = cache.getStats();

      expect(statsAfterDelete.totalBytes).toBeLessThan(statsBeforeDelete.totalBytes);
    });

    it('should evict by size when maxBytes exceeded', () => {
      const smallCache = createTaskCache({
        maxSize: 1000,
        maxBytes: 500,
        cleanIntervalMs: 0
      });

      try {
        smallCache.set('key1', { data: 'x'.repeat(200) });
        smallCache.set('key2', { data: 'y'.repeat(200) });
        smallCache.set('key3', { data: 'z'.repeat(200) });

        // Should have evicted some entries due to size
        const stats = smallCache.getStats();
        expect(stats.totalBytes).toBeLessThanOrEqual(500);
      } finally {
        smallCache.shutdown();
      }
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', { data: 'value1' });

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key3'); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track size correctly', () => {
      cache.set('key1', { data: 'value1' });
      cache.set('key2', { data: 'value2' });

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
    });

    it('should reset statistics', () => {
      cache.set('key1', { data: 'value1' });
      cache.get('key1');
      cache.get('miss');

      cache.resetStats();
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      cache.set('key1', { data: 'value1' });
      cache.set('key2', { data: 'value2' });
      cache.set('key3', { data: 'value3' });

      const keys = cache.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys for same input', () => {
    const key1 = generateCacheKey('web_search', { query: 'test' });
    const key2 = generateCacheKey('web_search', { query: 'test' });

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const key1 = generateCacheKey('web_search', { query: 'test1' });
    const key2 = generateCacheKey('web_search', { query: 'test2' });

    expect(key1).not.toBe(key2);
  });

  it('should include engine in key', () => {
    const key1 = generateCacheKey('web_search', { query: 'test' }, 'gemini');
    const key2 = generateCacheKey('web_search', { query: 'test' }, 'claude');

    expect(key1).not.toBe(key2);
  });

  it('should generate 32-character keys', () => {
    const key = generateCacheKey('analysis', { data: [1, 2, 3] });

    expect(key).toHaveLength(32);
  });

  // Bug fix tests: stable key generation regardless of key order
  it('should generate same key regardless of object key order', () => {
    const key1 = generateCacheKey('search', { b: 2, a: 1 });
    const key2 = generateCacheKey('search', { a: 1, b: 2 });

    expect(key1).toBe(key2);
  });

  it('should generate same key for nested objects with different key order', () => {
    const key1 = generateCacheKey('search', {
      outer: { z: 3, y: 2, x: 1 },
      config: { enabled: true, name: 'test' }
    });
    const key2 = generateCacheKey('search', {
      config: { name: 'test', enabled: true },
      outer: { x: 1, y: 2, z: 3 }
    });

    expect(key1).toBe(key2);
  });

  it('should generate same key for deeply nested objects', () => {
    const key1 = generateCacheKey('analysis', {
      level1: {
        level2: {
          level3: { c: 3, b: 2, a: 1 }
        }
      }
    });
    const key2 = generateCacheKey('analysis', {
      level1: {
        level2: {
          level3: { a: 1, b: 2, c: 3 }
        }
      }
    });

    expect(key1).toBe(key2);
  });

  it('should handle arrays in payloads (order preserved)', () => {
    const key1 = generateCacheKey('search', { items: [1, 2, 3] });
    const key2 = generateCacheKey('search', { items: [1, 2, 3] });
    const key3 = generateCacheKey('search', { items: [3, 2, 1] });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3); // Array order matters
  });

  it('should handle null and undefined values', () => {
    const key1 = generateCacheKey('search', { a: null, b: undefined });
    const key2 = generateCacheKey('search', { b: undefined, a: null });

    expect(key1).toBe(key2);
  });
});

describe('Global cache functions', () => {
  afterEach(() => {
    resetTaskCache();
  });

  it('should return same instance from getTaskCache', () => {
    const cache1 = getTaskCache();
    const cache2 = getTaskCache();

    expect(cache1).toBe(cache2);
  });

  it('should reset global cache', () => {
    const cache1 = getTaskCache();
    cache1.set('key', { data: 'value' });

    resetTaskCache();

    const cache2 = getTaskCache();
    expect(cache2.has('key')).toBe(false);
  });
});

describe('DEFAULT_CACHE_CONFIG', () => {
  it('should have expected defaults', () => {
    expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
    expect(DEFAULT_CACHE_CONFIG.maxBytes).toBe(50 * 1024 * 1024);
    expect(DEFAULT_CACHE_CONFIG.defaultTtlMs).toBe(3600000);
    expect(DEFAULT_CACHE_CONFIG.trackSize).toBe(true);
    expect(DEFAULT_CACHE_CONFIG.cleanIntervalMs).toBe(60000);
  });
});

describe('bug fixes', () => {
  it('should NOT evict entries when updating existing key at full capacity (Bug fix)', () => {
    // This test verifies that updating an existing key does not cause
    // unnecessary evictions when the cache is at max capacity.
    // The bug was: ensureCapacity() was called BEFORE removing the existing entry,
    // causing the cache to think it needed to evict to make room.
    const smallCache = createTaskCache({
      maxSize: 3,
      maxBytes: 1024 * 1024,
      cleanIntervalMs: 0
    });

    try {
      // Fill cache to capacity
      smallCache.set('key1', { data: 'value1' });
      smallCache.set('key2', { data: 'value2' });
      smallCache.set('key3', { data: 'value3' });

      expect(smallCache.size).toBe(3);
      const statsBeforeUpdate = smallCache.getStats();
      expect(statsBeforeUpdate.evictions).toBe(0);

      // Update existing key - should NOT cause any evictions
      smallCache.set('key1', { data: 'updated_value1' });

      // Cache should still have all 3 entries
      expect(smallCache.size).toBe(3);
      expect(smallCache.get('key1')).toEqual({ data: 'updated_value1' });
      expect(smallCache.get('key2')).toEqual({ data: 'value2' });
      expect(smallCache.get('key3')).toEqual({ data: 'value3' });

      // No evictions should have occurred
      const statsAfterUpdate = smallCache.getStats();
      expect(statsAfterUpdate.evictions).toBe(0);
    } finally {
      smallCache.shutdown();
    }
  });

  it('should correctly evict when adding NEW key at full capacity', () => {
    // Verify that eviction still works correctly for new keys
    const smallCache = createTaskCache({
      maxSize: 3,
      maxBytes: 1024 * 1024,
      cleanIntervalMs: 0
    });

    try {
      // Fill cache to capacity
      smallCache.set('key1', { data: 'value1' });
      smallCache.set('key2', { data: 'value2' });
      smallCache.set('key3', { data: 'value3' });

      expect(smallCache.size).toBe(3);

      // Add new key - should evict LRU entry (key1)
      smallCache.set('key4', { data: 'value4' });

      expect(smallCache.size).toBe(3);
      expect(smallCache.has('key1')).toBe(false); // Evicted (LRU)
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    } finally {
      smallCache.shutdown();
    }
  });

  it('should update totalBytes correctly when updating existing key', () => {
    const smallCache = createTaskCache({
      maxSize: 10,
      maxBytes: 1024 * 1024,
      trackSize: true,
      cleanIntervalMs: 0
    });

    try {
      // Set initial value
      smallCache.set('key1', { data: 'short' });
      const bytesAfterFirst = smallCache.getStats().totalBytes;

      // Update with larger value
      smallCache.set('key1', { data: 'much longer value here' });
      const bytesAfterUpdate = smallCache.getStats().totalBytes;

      // Bytes should increase (larger value)
      expect(bytesAfterUpdate).toBeGreaterThan(bytesAfterFirst);

      // Update with smaller value
      smallCache.set('key1', { data: 'x' });
      const bytesAfterSmaller = smallCache.getStats().totalBytes;

      // Bytes should decrease
      expect(bytesAfterSmaller).toBeLessThan(bytesAfterUpdate);
    } finally {
      smallCache.shutdown();
    }
  });
});
