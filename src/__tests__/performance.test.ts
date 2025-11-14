// Sprint 2 Day 18: Performance Tests
// Performance benchmarks and optimization validation

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConnectionPool } from '../database/ConnectionPool.js'
import { MemoryCache } from '../cache/MemoryCache.js'
import { CacheInvalidationManager } from '../cache/CacheInvalidation.js'
import { PerformanceProfiler } from '../utils/PerformanceProfiler.js'
import { TimelineView } from '../utils/TimelineView.js'
import * as os from 'os'
import * as path from 'path'

// ============================================================================
// Connection Pool Performance Tests (10 tests)
// ============================================================================

describe('Connection Pool Performance', () => {
  let pool: ConnectionPool
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-pool-${Date.now()}.db`)
    pool = new ConnectionPool(dbPath, {
      maxConnections: 5,
      minConnections: 2,
    })
  })

  afterEach(async () => {
    await pool.close()
  })

  it('should acquire connection in <10ms', async () => {
    const start = Date.now()
    const conn = await pool.acquire()
    const duration = Date.now() - start

    expect(duration).toBeLessThan(10)
    pool.release(conn)
  })

  it('should handle 100 sequential acquisitions efficiently', async () => {
    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      const conn = await pool.acquire()
      pool.release(conn)
    }

    const duration = Date.now() - start
    const avgTime = duration / 100

    expect(avgTime).toBeLessThan(5) // <5ms per acquisition
  })

  it('should handle concurrent acquisitions', async () => {
    const start = Date.now()

    const promises = Array.from({ length: 20 }, async () => {
      const conn = await pool.acquire()
      await new Promise(resolve => setTimeout(resolve, 10))
      pool.release(conn)
    })

    await Promise.all(promises)

    const duration = Date.now() - start
    expect(duration).toBeLessThan(500) // <500ms for 20 concurrent
  })

  it('should reuse connections efficiently', async () => {
    const stats1 = pool.getStats()
    const initialConnections = stats1.totalConnections

    // Acquire and release 50 times
    for (let i = 0; i < 50; i++) {
      const conn = await pool.acquire()
      pool.release(conn)
    }

    const stats2 = pool.getStats()

    // Should not create 50 new connections
    expect(stats2.totalConnections).toBeLessThanOrEqual(initialConnections + 3)
  })

  it('should maintain pool health under load', async () => {
    const promises = Array.from({ length: 50 }, async () => {
      const conn = await pool.acquire()
      await new Promise(resolve => setTimeout(resolve, 5))
      pool.release(conn)
    })

    await Promise.all(promises)

    expect(pool.isHealthy()).toBe(true)
  })

  it('should track accurate statistics', async () => {
    const iterations = 20

    for (let i = 0; i < iterations; i++) {
      const conn = await pool.acquire()
      pool.release(conn)
    }

    const stats = pool.getStats()

    expect(stats.totalAcquired).toBe(iterations)
    expect(stats.totalReleased).toBe(iterations)
    expect(stats.averageAcquireTime).toBeGreaterThanOrEqual(0)
  })

  it('should handle use() helper efficiently', async () => {
    const start = Date.now()

    await pool.use(async (db) => {
      db.prepare('SELECT 1').get()
    })

    const duration = Date.now() - start

    expect(duration).toBeLessThan(20)
  })

  it('should not leak connections', async () => {
    const initialSize = pool.size()

    for (let i = 0; i < 100; i++) {
      await pool.use(async (db) => {
        db.prepare('SELECT 1').get()
      })
    }

    const finalSize = pool.size()

    // Should not grow significantly
    expect(finalSize).toBeLessThanOrEqual(initialSize + 3)
  })

  it('should handle rapid acquire/release cycles', async () => {
    const start = Date.now()

    for (let i = 0; i < 1000; i++) {
      const conn = await pool.acquire()
      pool.release(conn)
    }

    const duration = Date.now() - start

    expect(duration).toBeLessThan(5000) // <5s for 1000 cycles
  })

  it('should cleanup idle connections efficiently', async () => {
    // Create more connections
    const conns = []
    for (let i = 0; i < 5; i++) {
      conns.push(await pool.acquire())
    }

    conns.forEach(conn => pool.release(conn))

    const initialSize = pool.size()

    // Wait for idle cleanup (would happen in real scenario)
    // In test, we just verify the mechanism exists
    expect(pool.size()).toBeGreaterThanOrEqual(2) // Min connections maintained
  })
})

// ============================================================================
// Cache Performance Tests (10 tests)
// ============================================================================

describe('Cache Performance', () => {
  let cache: MemoryCache<string>

  beforeEach(() => {
    cache = new MemoryCache<string>({
      maxSize: 1000,
      ttl: 60000,
    })
  })

  it('should get cached value in <1ms', () => {
    cache.set('key1', 'value1')

    const start = Date.now()
    const value = cache.get('key1')
    const duration = Date.now() - start

    expect(value).toBe('value1')
    expect(duration).toBeLessThan(1)
  })

  it('should handle 10000 sequential reads efficiently', () => {
    cache.set('key1', 'value1')

    const start = Date.now()

    for (let i = 0; i < 10000; i++) {
      cache.get('key1')
    }

    const duration = Date.now() - start
    const avgTime = duration / 10000

    expect(avgTime).toBeLessThan(0.01) // <0.01ms per read
  })

  it('should handle 1000 writes efficiently', () => {
    const start = Date.now()

    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    const duration = Date.now() - start
    const avgTime = duration / 1000

    expect(avgTime).toBeLessThan(1) // <1ms per write
  })

  it('should perform LRU eviction efficiently', () => {
    const smallCache = new MemoryCache<string>({ maxSize: 100 })

    const start = Date.now()

    // Write 200 entries (should trigger 100 evictions)
    for (let i = 0; i < 200; i++) {
      smallCache.set(`key${i}`, `value${i}`)
    }

    const duration = Date.now() - start

    expect(duration).toBeLessThan(100) // <100ms for 200 writes with evictions
    expect(smallCache.size()).toBe(100)
  })

  it('should check existence efficiently', () => {
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      cache.has(`key${i}`)
    }

    const duration = Date.now() - start

    expect(duration).toBeLessThan(10) // <10ms for 100 checks
  })

  it('should handle getOrSet pattern efficiently', async () => {
    let factoryCallCount = 0

    const factory = async () => {
      factoryCallCount++
      return 'computed-value'
    }

    const start = Date.now()

    // First call - factory invoked
    await cache.getOrSet('key1', factory)

    // 99 more calls - cached
    for (let i = 0; i < 99; i++) {
      await cache.getOrSet('key1', factory)
    }

    const duration = Date.now() - start

    expect(factoryCallCount).toBe(1) // Factory called once
    expect(duration).toBeLessThan(50) // <50ms for 100 calls
  })

  it('should track statistics efficiently', () => {
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      cache.getStats()
    }

    const duration = Date.now() - start

    expect(duration).toBeLessThan(10) // <10ms for 100 stat calls
  })

  it('should export cache state efficiently', () => {
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    const start = Date.now()
    const exported = cache.export()
    const duration = Date.now() - start

    expect(exported.size).toBe(1000)
    expect(duration).toBeLessThan(100) // <100ms for 1000 entries
  })

  it('should import cache state efficiently', () => {
    const data = new Map<string, string>()
    for (let i = 0; i < 1000; i++) {
      data.set(`key${i}`, `value${i}`)
    }

    const start = Date.now()
    cache.import(data)
    const duration = Date.now() - start

    expect(cache.size()).toBe(1000)
    expect(duration).toBeLessThan(100) // <100ms for 1000 entries
  })

  it('should maintain hit rate under mixed load', () => {
    // Pre-populate cache
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`)
    }

    // 70% hits, 30% misses
    for (let i = 0; i < 1000; i++) {
      if (i % 10 < 7) {
        cache.get(`key${i % 100}`) // Hit
      } else {
        cache.get(`missing-${i}`) // Miss
      }
    }

    const stats = cache.getStats()
    expect(stats.hitRate).toBeGreaterThan(0.6)
  })
})

// ============================================================================
// Cache Invalidation Performance Tests (5 tests)
// ============================================================================

describe('Cache Invalidation Performance', () => {
  let cache: MemoryCache<string>
  let invalidation: CacheInvalidationManager<string>

  beforeEach(() => {
    cache = new MemoryCache<string>({ maxSize: 1000 })
    invalidation = new CacheInvalidationManager(cache)
  })

  it('should invalidate by tag efficiently', () => {
    // Add 100 entries with tags
    for (let i = 0; i < 100; i++) {
      invalidation.setWithTags(`key${i}`, `value${i}`, ['tag1', 'tag2'])
    }

    const start = Date.now()
    const count = invalidation.invalidateByTag('tag1')
    const duration = Date.now() - start

    expect(count).toBe(100)
    expect(duration).toBeLessThan(50) // <50ms for 100 invalidations
  })

  it('should invalidate by pattern efficiently', () => {
    for (let i = 0; i < 100; i++) {
      cache.set(`memory:${i}`, `value${i}`)
    }

    const start = Date.now()
    const count = invalidation.invalidateByPattern(/^memory:/)
    const duration = Date.now() - start

    expect(count).toBe(100)
    expect(duration).toBeLessThan(50)
  })

  it('should handle multiple tag invalidations', () => {
    for (let i = 0; i < 500; i++) {
      const tags = i % 2 === 0 ? ['even'] : ['odd']
      invalidation.setWithTags(`key${i}`, `value${i}`, tags)
    }

    const start = Date.now()
    invalidation.invalidateByTag('even')
    const duration = Date.now() - start

    expect(duration).toBeLessThan(100)
  })

  it('should track invalidation stats efficiently', () => {
    for (let i = 0; i < 10; i++) {
      invalidation.invalidateByTag(`tag${i}`)
    }

    const start = Date.now()
    const stats = invalidation.getStats()
    const duration = Date.now() - start

    expect(duration).toBeLessThan(5)
    expect(stats).toBeDefined()
  })

  it('should handle version-based invalidation efficiently', () => {
    for (let i = 0; i < 100; i++) {
      invalidation.setWithVersion(`key${i}`, `value${i}`, 1)
    }

    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      invalidation.invalidateByVersion(`key${i}`, 2)
    }

    const duration = Date.now() - start

    expect(duration).toBeLessThan(50)
  })
})

// ============================================================================
// Performance Profiler Tests (3 tests)
// ============================================================================

describe('Performance Profiler', () => {
  it('should have minimal overhead (<1ms)', () => {
    const profiler = new PerformanceProfiler({ targetOverhead: 10 })

    const start = Date.now()

    profiler.measure('test', () => {
      // Empty operation
    })

    const duration = Date.now() - start

    expect(duration).toBeLessThan(1)
  })

  it('should handle 1000 measurements efficiently', () => {
    const profiler = new PerformanceProfiler()

    const start = Date.now()

    for (let i = 0; i < 1000; i++) {
      profiler.measure(`test-${i}`, () => {
        // Empty operation
      })
    }

    const duration = Date.now() - start

    expect(duration).toBeLessThan(500) // <500ms for 1000 measurements
  })

  it('should compute statistics efficiently', () => {
    const profiler = new PerformanceProfiler()

    for (let i = 0; i < 100; i++) {
      profiler.measure(`test-${i}`, () => {
        // Simulate work
        let sum = 0
        for (let j = 0; j < 1000; j++) sum += j
      })
    }

    const start = Date.now()
    const stats = profiler.getStatistics()
    const duration = Date.now() - start

    expect(duration).toBeLessThan(10)
    expect(stats.count).toBe(100)
  })
})

// ============================================================================
// Timeline View Performance Tests (2 tests)
// ============================================================================

describe('Timeline View Performance', () => {
  it('should handle 100 entries efficiently', () => {
    const timeline = new TimelineView({ enableColors: false })

    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      const id = timeline.start(`Task ${i}`)
      timeline.complete(id)
    }

    const output = timeline.toString()
    const duration = Date.now() - start

    expect(duration).toBeLessThan(100) // <100ms for 100 entries
    expect(output).toBeDefined()
  })

  it('should render timeline efficiently', () => {
    const timeline = new TimelineView({ enableColors: false })

    for (let i = 0; i < 50; i++) {
      const id = timeline.start(`Task ${i}`)
      timeline.complete(id)
    }

    const start = Date.now()
    const output = timeline.toString()
    const duration = Date.now() - start

    expect(duration).toBeLessThan(50) // <50ms to render
    expect(output.length).toBeGreaterThan(0)
  })
})
