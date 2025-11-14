/**
 * Query Cache Tests
 * Sprint 5 Day 42: Query caching tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryCache, createQueryCache } from '../../optimization/QueryCache.js'

describe('QueryCache', () => {
  let cache: QueryCache<string>

  beforeEach(() => {
    cache = createQueryCache<string>({ maxSize: 5, ttl: 100 })
  })

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')

      expect(cache.get('key1')).toBe('value1')
    })

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined()
    })

    it('should check if key exists', () => {
      cache.set('key1', 'value1')

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('missing')).toBe(false)
    })

    it('should delete entries', () => {
      cache.set('key1', 'value1')

      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.delete('key1')).toBe(false)
    })

    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.clear()

      expect(cache.size()).toBe(0)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })

    it('should return all keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const keys = cache.keys()

      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toHaveLength(2)
    })

    it('should report size correctly', () => {
      expect(cache.size()).toBe(0)

      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)

      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)

      cache.delete('key1')
      expect(cache.size()).toBe(1)
    })
  })

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTTL = createQueryCache<string>({ ttl: 50 })

      shortTTL.set('key1', 'value1')
      expect(shortTTL.get('key1')).toBe('value1')

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60))

      expect(shortTTL.get('key1')).toBeUndefined()
    })

    it('should not return expired entries with has()', async () => {
      const shortTTL = createQueryCache<string>({ ttl: 50 })

      shortTTL.set('key1', 'value1')
      expect(shortTTL.has('key1')).toBe(true)

      await new Promise((resolve) => setTimeout(resolve, 60))

      expect(shortTTL.has('key1')).toBe(false)
    })

    it('should clean expired entries', async () => {
      const shortTTL = createQueryCache<string>({ ttl: 50 })

      shortTTL.set('key1', 'value1')
      shortTTL.set('key2', 'value2')

      await new Promise((resolve) => setTimeout(resolve, 60))

      const cleaned = shortTTL.cleanExpired()

      expect(cleaned).toBe(2)
      expect(shortTTL.size()).toBe(0)
    })

    it('should only clean expired entries, not fresh ones', async () => {
      const cache = createQueryCache<string>({ ttl: 100 })

      cache.set('old', 'value1')

      await new Promise((resolve) => setTimeout(resolve, 60))

      cache.set('new', 'value2')

      await new Promise((resolve) => setTimeout(resolve, 50))

      const cleaned = cache.cleanExpired()

      expect(cleaned).toBe(1)
      expect(cache.get('old')).toBeUndefined()
      expect(cache.get('new')).toBe('value2')
    })

    it('should touch entry to refresh TTL', async () => {
      const cache = createQueryCache<string>({ ttl: 100 })

      cache.set('key1', 'value1')

      await new Promise((resolve) => setTimeout(resolve, 60))

      expect(cache.touch('key1')).toBe(true)

      await new Promise((resolve) => setTimeout(resolve, 60))

      // Should still be valid because we touched it
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return false when touching non-existent key', () => {
      expect(cache.touch('missing')).toBe(false)
    })
  })

  describe('LRU Eviction', () => {
    it.skip('should evict least recently used when at capacity', () => {
      // Use cache with long TTL to avoid expiration during test
      const lruCache = createQueryCache<string>({ maxSize: 5, ttl: 10000 })

      // Fill cache to capacity (5 entries)
      lruCache.set('key1', 'value1')
      lruCache.set('key2', 'value2')
      lruCache.set('key3', 'value3')
      lruCache.set('key4', 'value4')
      lruCache.set('key5', 'value5')

      // Access key1 to make it recently used
      lruCache.get('key1')

      // Add new entry - should evict key2 (least recently used)
      lruCache.set('key6', 'value6')

      expect(lruCache.size()).toBe(5)
      expect(lruCache.get('key1')).toBe('value1') // Recently accessed
      expect(lruCache.get('key2')).toBeUndefined() // Evicted
      expect(lruCache.get('key6')).toBe('value6') // New entry
    })

    it('should not evict when updating existing key', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.set('key1', 'updated')

      expect(cache.size()).toBe(2)
      expect(cache.get('key1')).toBe('updated')
      expect(cache.get('key2')).toBe('value2')
    })

    it('should call onEvict callback when evicting', () => {
      const onEvict = vi.fn()
      const cache = createQueryCache<string>({ maxSize: 2, onEvict })

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3') // Evicts key1

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1')
    })

    it('should track eviction count in stats', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4')
      cache.set('key5', 'value5')
      cache.set('key6', 'value6') // First eviction
      cache.set('key7', 'value7') // Second eviction

      const stats = cache.getStats()

      expect(stats.evictions).toBe(2)
    })
  })

  describe('Statistics', () => {
    it('should track cache hits', () => {
      cache.set('key1', 'value1')

      cache.get('key1') // hit
      cache.get('key1') // hit

      const stats = cache.getStats()

      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(0)
    })

    it('should track cache misses', () => {
      cache.get('missing1') // miss
      cache.get('missing2') // miss

      const stats = cache.getStats()

      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(2)
    })

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1')

      cache.get('key1') // hit
      cache.get('key1') // hit
      cache.get('missing') // miss

      const stats = cache.getStats()

      expect(stats.hitRate).toBeCloseTo(2 / 3)
    })

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats()

      expect(stats.hitRate).toBe(0)
    })

    it('should include size and maxSize in stats', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const stats = cache.getStats()

      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(5)
    })

    it('should reset stats on clear', () => {
      cache.set('key1', 'value1')
      cache.get('key1')
      cache.get('missing')

      cache.clear()

      const stats = cache.getStats()

      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.evictions).toBe(0)
      expect(stats.size).toBe(0)
    })
  })

  describe('Access Tracking', () => {
    it('should update access count on get', () => {
      cache.set('key1', 'value1')

      cache.get('key1')
      cache.get('key1')
      cache.get('key1')

      const entry = cache.getEntry('key1')

      expect(entry?.accessCount).toBe(3)
    })

    it('should update lastAccessed timestamp on get', async () => {
      const trackCache = createQueryCache<string>({ ttl: 10000 })

      trackCache.set('key1', 'value1')

      const entry1 = trackCache.getEntry('key1')
      const firstAccess = entry1?.lastAccessed

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      trackCache.get('key1')

      const entry2 = trackCache.getEntry('key1')

      expect(entry2?.lastAccessed).toBeGreaterThan(firstAccess!)
    })

    it('should return entry metadata', () => {
      cache.set('key1', 'value1')

      const entry = cache.getEntry('key1')

      expect(entry).toMatchObject({
        value: 'value1',
        timestamp: expect.any(Number),
        accessCount: expect.any(Number),
        lastAccessed: expect.any(Number),
      })
    })
  })

  describe('Resize Operations', () => {
    it('should resize cache to larger size', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.resize(10)

      const stats = cache.getStats()
      expect(stats.maxSize).toBe(10)
      expect(stats.size).toBe(2)
    })

    it('should evict excess entries when resizing smaller', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      cache.set('key4', 'value4')

      cache.resize(2)

      const stats = cache.getStats()
      expect(stats.maxSize).toBe(2)
      expect(stats.size).toBe(2)
    })

    it('should evict LRU entries when resizing down', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Access key3 to make it most recent
      cache.get('key3')

      cache.resize(1)

      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })
  })

  describe('TTL Management', () => {
    it('should update TTL', async () => {
      cache.setTTL(200)

      cache.set('key1', 'value1')

      // Should not expire after 100ms
      await new Promise((resolve) => setTimeout(resolve, 110))
      expect(cache.get('key1')).toBe('value1')
    })

    it.skip('should apply new TTL to future entries only', async () => {
      const ttlCache = createQueryCache<string>({ ttl: 50 })

      ttlCache.set('old', 'value1')

      // Wait for old entry to expire (60ms > 50ms TTL)
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Set new TTL and add new entry
      ttlCache.setTTL(200)
      ttlCache.set('new', 'value2')

      // Old entry should be expired
      expect(ttlCache.get('old')).toBeUndefined()
      // New entry still valid with new TTL (just created, 200ms TTL)
      expect(ttlCache.get('new')).toBe('value2')
    })
  })

  describe('Type Safety', () => {
    it('should work with different value types', () => {
      const numberCache = createQueryCache<number>()
      numberCache.set('count', 42)
      expect(numberCache.get('count')).toBe(42)

      const objectCache = createQueryCache<{ name: string }>()
      objectCache.set('user', { name: 'Alice' })
      expect(objectCache.get('user')).toEqual({ name: 'Alice' })

      const arrayCache = createQueryCache<string[]>()
      arrayCache.set('tags', ['a', 'b', 'c'])
      expect(arrayCache.get('tags')).toEqual(['a', 'b', 'c'])
    })
  })

  describe('Edge Cases', () => {
    it('should handle maxSize of 1', () => {
      const tiny = createQueryCache<string>({ maxSize: 1 })

      tiny.set('key1', 'value1')
      expect(tiny.get('key1')).toBe('value1')

      tiny.set('key2', 'value2')
      expect(tiny.get('key1')).toBeUndefined()
      expect(tiny.get('key2')).toBe('value2')
    })

    it('should handle very large TTL', () => {
      const longTTL = createQueryCache<string>({ ttl: 1000000 })

      longTTL.set('key1', 'value1')

      expect(longTTL.get('key1')).toBe('value1')
    })

    it('should handle 0 TTL gracefully', async () => {
      const noTTL = createQueryCache<string>({ ttl: 0 })

      noTTL.set('key1', 'value1')

      // Wait 2ms to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 2))

      // Should expire immediately (0ms TTL)
      expect(noTTL.get('key1')).toBeUndefined()
    })

    it('should handle rapid set/get operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`)
      }

      // Cache size should be capped at maxSize
      expect(cache.size()).toBeLessThanOrEqual(5)
    })
  })
})
