/**
 * Cache Performance Benchmarks
 *
 * Measures cache operation performance (LRU + TTL)
 * Targets:
 * - Get: < 0.1ms (cache hit)
 * - Set: < 0.1ms
 * - Eviction: Automatic, no performance impact
 */
import { describe, bench, beforeEach } from 'vitest';
import { LRUCache } from '../utils/LRUCache.js';
describe('LRU Cache Performance', () => {
    let cache;
    beforeEach(() => {
        cache = new LRUCache({
            max: 1000,
            ttl: 60000, // 1 minute
        });
    });
    bench('set single item', () => {
        cache.set('key', { id: 1, data: 'test' });
    });
    bench('get single item (cache hit)', () => {
        cache.set('key', { id: 1, data: 'test' });
        cache.get('key');
    });
    bench('get single item (cache miss)', () => {
        cache.get('nonexistent-key');
    });
    bench('set 100 items sequentially', () => {
        for (let i = 0; i < 100; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
    });
    bench('get 100 items (cache hits)', () => {
        // Setup: populate cache
        for (let i = 0; i < 100; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
        // Benchmark gets
        for (let i = 0; i < 100; i++) {
            cache.get(`key-${i}`);
        }
    });
    bench('mixed operations (50 sets + 50 gets)', () => {
        // Setup: pre-populate with 50 items
        for (let i = 0; i < 50; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
        // Benchmark mixed operations
        for (let i = 0; i < 50; i++) {
            cache.set(`new-key-${i}`, { id: i + 50, data: `new-data-${i}` });
            cache.get(`key-${i % 50}`);
        }
    });
    bench('LRU eviction (1000 items, max=500)', () => {
        const smallCache = new LRUCache({ max: 500 });
        // This will trigger evictions after 500 items
        for (let i = 0; i < 1000; i++) {
            smallCache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
    });
    bench('has() check (cache hit)', () => {
        cache.set('key', { id: 1, data: 'test' });
        cache.has('key');
    });
    bench('has() check (cache miss)', () => {
        cache.has('nonexistent-key');
    });
    bench('delete single item', () => {
        cache.set('key', { id: 1, data: 'test' });
        cache.delete('key');
    });
    bench('clear cache (100 items)', () => {
        // Setup: populate cache
        for (let i = 0; i < 100; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
        // Benchmark clear
        cache.clear();
    });
});
describe('Cache with Different Data Sizes', () => {
    bench('set small value (10 bytes)', () => {
        const cache = new LRUCache({ max: 1000 });
        cache.set('key', 'small-val');
    });
    bench('set medium value (1KB)', () => {
        const cache = new LRUCache({ max: 1000 });
        const largeValue = 'x'.repeat(1024); // 1KB
        cache.set('key', largeValue);
    });
    bench('set large value (100KB)', () => {
        const cache = new LRUCache({ max: 100 });
        const largeValue = 'x'.repeat(100 * 1024); // 100KB
        cache.set('key', largeValue);
    });
    bench('get small value (10 bytes)', () => {
        const cache = new LRUCache({ max: 1000 });
        cache.set('key', 'small-val');
        cache.get('key');
    });
    bench('get medium value (1KB)', () => {
        const cache = new LRUCache({ max: 1000 });
        const largeValue = 'x'.repeat(1024);
        cache.set('key', largeValue);
        cache.get('key');
    });
    bench('get large value (100KB)', () => {
        const cache = new LRUCache({ max: 100 });
        const largeValue = 'x'.repeat(100 * 1024);
        cache.set('key', largeValue);
        cache.get('key');
    });
});
describe('Cache Concurrency Patterns', () => {
    bench('alternating set/get (simulates real usage)', () => {
        const cache = new LRUCache({ max: 1000 });
        // Simulate typical usage: 70% reads, 30% writes
        for (let i = 0; i < 100; i++) {
            if (i % 10 < 7) {
                // 70% reads
                cache.get(`key-${i % 50}`);
            }
            else {
                // 30% writes
                cache.set(`key-${i}`, { id: i, data: `data-${i}` });
            }
        }
    });
    bench('burst writes (100 rapid sets)', () => {
        const cache = new LRUCache({ max: 1000 });
        for (let i = 0; i < 100; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
    });
    bench('burst reads (100 rapid gets from warm cache)', () => {
        const cache = new LRUCache({ max: 1000 });
        // Warm up cache
        for (let i = 0; i < 100; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
        // Benchmark reads
        for (let i = 0; i < 100; i++) {
            cache.get(`key-${i % 100}`);
        }
    });
});
describe('TTL (Time-To-Live) Performance', () => {
    bench('set with TTL', () => {
        const cache = new LRUCache({
            max: 1000,
            ttl: 5000, // 5 seconds
        });
        cache.set('key', { id: 1, data: 'test' });
    });
    bench('get expired item (TTL check)', () => {
        const cache = new LRUCache({
            max: 1000,
            ttl: 1, // 1ms (will expire immediately)
        });
        cache.set('key', { id: 1, data: 'test' });
        // Wait for expiry
        const start = Date.now();
        while (Date.now() - start < 2) {
            // Busy wait 2ms
        }
        cache.get('key'); // Should detect expiry
    });
    bench('cleanup expired items (1000 items, 50% expired)', () => {
        const cache = new LRUCache({
            max: 1000,
            ttl: 1, // 1ms
        });
        // Set 500 items that will expire
        for (let i = 0; i < 500; i++) {
            cache.set(`expired-${i}`, { id: i, data: `data-${i}` });
        }
        // Wait for expiry
        const start = Date.now();
        while (Date.now() - start < 2) { }
        // Set 500 fresh items
        for (let i = 0; i < 500; i++) {
            cache.set(`fresh-${i}`, { id: i + 500, data: `data-${i}` });
        }
        // Accessing cache should trigger cleanup
        cache.get('fresh-0');
    });
});
describe('Memory and Size Characteristics', () => {
    bench('fill cache to max capacity (1000 items)', () => {
        const cache = new LRUCache({ max: 1000 });
        for (let i = 0; i < 1000; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
    });
    bench('exceed max capacity (2000 sets, max=1000)', () => {
        const cache = new LRUCache({ max: 1000 });
        // Setting 2000 items should evict 1000
        for (let i = 0; i < 2000; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
    });
    bench('get size (1000 items)', () => {
        const cache = new LRUCache({ max: 1000 });
        for (let i = 0; i < 1000; i++) {
            cache.set(`key-${i}`, { id: i, data: `data-${i}` });
        }
        cache.size;
    });
});
describe('Complex Object Caching', () => {
    bench('cache complex objects (50 items)', () => {
        const cache = new LRUCache({ max: 100 });
        for (let i = 0; i < 50; i++) {
            cache.set(`key-${i}`, {
                id: i,
                name: `Object ${i}`,
                nested: {
                    array: [1, 2, 3, 4, 5],
                    obj: { key: `value-${i}` },
                },
                timestamp: Date.now(),
            });
        }
    });
    bench('retrieve complex objects (50 items)', () => {
        const cache = new LRUCache({ max: 100 });
        // Setup
        for (let i = 0; i < 50; i++) {
            cache.set(`key-${i}`, {
                id: i,
                name: `Object ${i}`,
                nested: {
                    array: [1, 2, 3, 4, 5],
                    obj: { key: `value-${i}` },
                },
                timestamp: Date.now(),
            });
        }
        // Benchmark
        for (let i = 0; i < 50; i++) {
            cache.get(`key-${i}`);
        }
    });
});
//# sourceMappingURL=cache.bench.js.map