/**
 * SimpleQueryCache.test.ts
 *
 * Tests for SimpleQueryCache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleQueryCache } from '../SimpleQueryCache.js';

describe('SimpleQueryCache', () => {
  let cache: SimpleQueryCache<string>;

  beforeEach(() => {
    cache = new SimpleQueryCache<string>({ maxSize: 3, ttl: 1000 });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest entry when max size reached', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size()).toBe(3);

      // Adding 4th item should evict key1 (oldest)
      cache.set('key4', 'value4');
      expect(cache.size()).toBe(3);
      expect(cache.get('key1')).toBeNull(); // Evicted
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should move accessed item to end (LRU)', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 - moves it to end
      cache.get('key1');

      // Adding key4 should evict key2 (now oldest)
      cache.set('key4', 'value4');
      expect(cache.get('key1')).toBe('value1'); // Still present
      expect(cache.get('key2')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should track evictions in stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Evicts key1

      const stats = cache.stats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('TTL (Time-to-Live)', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new SimpleQueryCache<string>({ ttl: 50 });
      shortCache.set('key1', 'value1');

      expect(shortCache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(shortCache.get('key1')).toBeNull();
      expect(shortCache.has('key1')).toBe(false);
    });

    it('should prune expired entries', async () => {
      const shortCache = new SimpleQueryCache<string>({ ttl: 50 });
      shortCache.set('key1', 'value1');
      shortCache.set('key2', 'value2');

      expect(shortCache.size()).toBe(2);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      const removed = shortCache.prune();
      expect(removed).toBe(2);
      expect(shortCache.size()).toBe(0);
    });

    it('should not expire entries before TTL', async () => {
      const longCache = new SimpleQueryCache<string>({ ttl: 10000 });
      longCache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(longCache.get('key1')).toBe('value1');
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should calculate hit rate correctly', () => {
      // No accesses yet
      expect(cache.stats().hitRate).toBe(0);

      cache.set('key1', 'value1');
      cache.get('key1'); // 1 hit
      cache.get('key2'); // 1 miss

      expect(cache.stats().hitRate).toBe(0.5);
    });

    it('should include size and maxSize in stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });

    it('should reset stats when cleared', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');

      cache.clear();

      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('Keys and Size', () => {
    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return current size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('Complex Values', () => {
    it('should handle object values', () => {
      const objCache = new SimpleQueryCache<{ name: string; value: number }>();
      const obj = { name: 'test', value: 42 };

      objCache.set('obj1', obj);
      expect(objCache.get('obj1')).toEqual(obj);
    });

    it('should handle array values', () => {
      const arrCache = new SimpleQueryCache<string[]>();
      const arr = ['a', 'b', 'c'];

      arrCache.set('arr1', arr);
      expect(arrCache.get('arr1')).toEqual(arr);
    });
  });
});
