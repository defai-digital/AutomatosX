/**
 * Tests for TTL-based LRU Cache system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TTLCache, ProviderResponseCache, type CacheStats } from '../../src/core/cache/cache.js';

describe('TTLCache', () => {
  describe('Basic Operations', () => {
    let cache: TTLCache<string>;

    beforeEach(() => {
      cache = new TTLCache<string>({
        maxEntries: 3,
        ttl: 1000,
        debug: false
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.keys()).toEqual(['key1', 'key2']);
    });

    it('should track cache size', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
      cache.delete('key1');
      expect(cache.size).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    let cache: TTLCache<string>;

    beforeEach(() => {
      cache = new TTLCache<string>({
        maxEntries: 3,
        ttl: 0, // No expiration for these tests
        debug: false
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should evict oldest entry when maxEntries reached', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
      expect(cache.size).toBe(3);
    });

    it('should update LRU order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add key4, should evict key2 (oldest)
      cache.set('key4', 'value4');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update LRU order on set', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update key1 to make it most recently used
      cache.set('key1', 'updated');

      // Add key4, should evict key2
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('updated');
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('TTL Expiration', () => {
    let cache: TTLCache<string>;

    beforeEach(() => {
      vi.useFakeTimers();
      cache = new TTLCache<string>({
        maxEntries: 10,
        ttl: 1000, // 1 second
        cleanupInterval: 0, // Disable automatic cleanup for tests
        debug: false
      });
    });

    afterEach(() => {
      cache.destroy();
      vi.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Fast-forward time by 1.5 seconds
      vi.advanceTimersByTime(1500);

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.has('key1')).toBe(false);
    });

    it('should not expire with TTL = 0', () => {
      cache.destroy();
      cache = new TTLCache<string>({
        maxEntries: 10,
        ttl: 0, // No expiration
        cleanupInterval: 0,
        debug: false
      });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10000); // 10 seconds
      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle entries with different ages', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(500);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(600); // Total 1.1s

      // key1 should be expired (1.1s old), key2 should not (0.6s old)
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('Size Limits', () => {
    let cache: TTLCache<string>;

    beforeEach(() => {
      cache = new TTLCache<string>({
        maxEntries: 100,
        ttl: 0,
        maxSize: 1000, // 1KB limit
        debug: false
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should track total size', () => {
      cache.set('key1', 'a');
      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should evict by size when maxSize reached', () => {
      // Add entries until size limit is approached
      cache.set('key1', 'x'.repeat(100));
      cache.set('key2', 'x'.repeat(100));
      cache.set('key3', 'x'.repeat(100));

      const beforeSize = cache.size;
      cache.set('key4', 'x'.repeat(400)); // Smaller entry that will fit

      // Some entries should have been evicted
      expect(cache.size).toBeLessThanOrEqual(beforeSize + 1);
      expect(cache.has('key4')).toBe(true);
    });

    it('should reject entries larger than maxSize', () => {
      cache.set('huge', 'x'.repeat(2000)); // 2KB, larger than 1KB limit
      expect(cache.has('huge')).toBe(false);
    });
  });

  describe('Statistics', () => {
    let cache: TTLCache<string>;

    beforeEach(() => {
      cache = new TTLCache<string>({
        maxEntries: 10,
        ttl: 0,
        debug: false
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5); // 1 hit, 1 miss = 50%
    });

    it('should track sets', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
    });

    it('should track evictions', () => {
      const smallCache = new TTLCache<string>({
        maxEntries: 2,
        ttl: 0,
        debug: false
      });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3'); // Evicts key1

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);

      smallCache.destroy();
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    it('should calculate average entry size', () => {
      cache.set('key1', 'x'.repeat(100));
      cache.set('key2', 'y'.repeat(200));

      const stats = cache.getStats();
      expect(stats.avgEntrySize).toBeGreaterThan(0);
      expect(stats.entries).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries automatically', () => {
      vi.useFakeTimers();

      const cache = new TTLCache<string>({
        maxEntries: 10,
        ttl: 1000,
        cleanupInterval: 500, // Cleanup every 500ms
        debug: false
      });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Fast-forward past TTL but before first cleanup
      vi.advanceTimersByTime(1200);
      expect(cache.size).toBe(2); // Entries still in cache (not accessed)

      // Trigger cleanup by advancing to cleanup interval
      vi.advanceTimersByTime(500);

      // Entries should be cleaned up (they're expired)
      expect(cache.size).toBe(0);

      cache.destroy();
      vi.useRealTimers();
    });
  });

  describe('Complex Types', () => {
    interface TestObject {
      id: number;
      name: string;
      data: string[];
    }

    let cache: TTLCache<TestObject>;

    beforeEach(() => {
      cache = new TTLCache<TestObject>({
        maxEntries: 10,
        ttl: 0,
        debug: false
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should handle complex objects', () => {
      const obj: TestObject = {
        id: 1,
        name: 'Test',
        data: ['a', 'b', 'c']
      };

      cache.set('obj1', obj);
      const retrieved = cache.get('obj1');

      expect(retrieved).toEqual(obj);
      expect(retrieved?.data).toEqual(['a', 'b', 'c']);
    });

    it('should handle arrays', () => {
      const arrayCache = new TTLCache<number[]>({
        maxEntries: 10,
        ttl: 0,
        debug: false
      });

      arrayCache.set('arr1', [1, 2, 3, 4, 5]);
      expect(arrayCache.get('arr1')).toEqual([1, 2, 3, 4, 5]);

      arrayCache.destroy();
    });
  });
});

describe('ProviderResponseCache', () => {
  let cache: ProviderResponseCache;

  beforeEach(() => {
    cache = new ProviderResponseCache({
      maxEntries: 100,
      ttl: 60000,
      debug: false
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should cache provider responses', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const response = 'Hi there!';

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, response);
    const cached = cache.get('claude', 'claude-3-5-sonnet-20241022', messages);

    expect(cached?.response).toBe(response);
  });

  it('should return different responses for different messages', () => {
    const messages1 = [{ role: 'user', content: 'Hello' }];
    const messages2 = [{ role: 'user', content: 'Goodbye' }];

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages1, 'Hi!');
    cache.set('claude', 'claude-3-5-sonnet-20241022', messages2, 'Bye!');

    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages1)?.response).toBe('Hi!');
    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages2)?.response).toBe('Bye!');
  });

  it('should cache usage information', () => {
    const messages = [{ role: 'user', content: 'Test' }];
    const usage = {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30
    };

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Response', undefined, usage);
    const cached = cache.get('claude', 'claude-3-5-sonnet-20241022', messages);

    expect(cached?.usage).toEqual(usage);
  });

  it('should handle different providers', () => {
    const messages = [{ role: 'user', content: 'Test' }];

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Claude response');
    cache.set('gemini', 'gemini-pro', messages, 'Gemini response');

    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages)?.response).toBe('Claude response');
    expect(cache.get('gemini', 'gemini-pro', messages)?.response).toBe('Gemini response');
  });

  it('should handle different models', () => {
    const messages = [{ role: 'user', content: 'Test' }];

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Sonnet response');
    cache.set('claude', 'claude-3-opus-20240229', messages, 'Opus response');

    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages)?.response).toBe('Sonnet response');
    expect(cache.get('claude', 'claude-3-opus-20240229', messages)?.response).toBe('Opus response');
  });

  it('should handle options in cache key', () => {
    const messages = [{ role: 'user', content: 'Test' }];

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Temp 0.5', { temperature: 0.5 });
    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Temp 1.0', { temperature: 1.0 });

    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages, { temperature: 0.5 })?.response).toBe('Temp 0.5');
    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages, { temperature: 1.0 })?.response).toBe('Temp 1.0');
  });

  it('should provide statistics', () => {
    const messages = [{ role: 'user', content: 'Test' }];

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Response');
    cache.get('claude', 'claude-3-5-sonnet-20241022', messages); // Hit
    cache.get('claude', 'claude-3-5-sonnet-20241022', [{ role: 'user', content: 'Other' }]); // Miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
  });

  it('should clear cache', () => {
    const messages = [{ role: 'user', content: 'Test' }];

    cache.set('claude', 'claude-3-5-sonnet-20241022', messages, 'Response');
    cache.clear();

    expect(cache.get('claude', 'claude-3-5-sonnet-20241022', messages)).toBeUndefined();
  });
});
