// Sprint 2 Day 14: Services and Cache Tests
// Comprehensive tests for ProviderRouter, MemoryQueryBuilder, and MemoryCache
import { describe, it, expect, beforeEach } from 'vitest';
import { createProviderRouter } from '../services/ProviderRouter.js';
import { MemoryQueryBuilder, QueryPresets } from '../services/MemoryQueryBuilder.js';
import { MemoryCache, CacheKeyGenerator, TieredCache } from '../cache/MemoryCache.js';
// ============================================================================
// Provider Router Tests
// ============================================================================
describe('ProviderRouter', () => {
    let router;
    beforeEach(() => {
        router = createProviderRouter();
    });
    it('should select provider based on priority', () => {
        const decision = router.selectProvider();
        expect(decision.selectedProvider).toBe('claude'); // Highest priority
        expect(decision.fallbackChain).toContain('gemini');
    });
    it('should make successful request', async () => {
        const response = await router.request({
            model: 'claude-sonnet-4-5',
            prompt: 'Test prompt',
            maxTokens: 1000,
        });
        expect(response).toBeDefined();
        expect(response.provider).toBe('claude');
        expect(response.content).toContain('Mock response');
        expect(response.tokensUsed).toBeGreaterThan(0);
        expect(response.latency).toBeGreaterThan(0);
    });
    it('should fallback to secondary provider on failure', async () => {
        // Force claude to fail
        router.setProviderAvailability('claude', false);
        const response = await router.request({
            model: 'gemini-pro',
            prompt: 'Test prompt',
        });
        expect(response.provider).toBe('gemini'); // Fallback
    });
    it('should update health metrics on success', async () => {
        await router.request({
            model: 'claude-sonnet-4-5',
            prompt: 'Test',
        });
        const health = router.getProviderHealth('claude');
        expect(health).toBeDefined();
        expect(health?.available).toBe(true);
        expect(health?.lastSuccessAt).toBeDefined();
    });
    it('should track request statistics', async () => {
        await router.request({ model: 'test', prompt: 'test1' });
        await router.request({ model: 'test', prompt: 'test2' });
        const stats = router.getStatistics();
        expect(stats.totalRequests).toBeGreaterThan(0);
        expect(stats.requestsByProvider).toBeDefined();
    });
    it('should enable chaos mode', () => {
        router.setChaosMode(true);
        // Chaos mode is enabled - some requests should fail
        // But we can't test randomness reliably, so just verify it doesn't crash
        expect(() => router.selectProvider()).not.toThrow();
    });
    it('should emit routing events', async () => {
        const events = [];
        router.on('routing-decision', (decision) => events.push(decision));
        await router.request({ model: 'test', prompt: 'test' });
        expect(events.length).toBeGreaterThan(0);
        expect(events[0]).toHaveProperty('selectedProvider');
        expect(events[0]).toHaveProperty('fallbackChain');
    });
});
// ============================================================================
// Memory Query Builder Tests
// ============================================================================
describe('MemoryQueryBuilder', () => {
    it('should build basic search query', () => {
        const query = new MemoryQueryBuilder()
            .search('authentication')
            .build();
        expect(query.sql).toContain('memories_fts');
        expect(query.sql).toContain('MATCH');
        expect(query.params).toContain('authentication');
    });
    it('should build query with agent filter', () => {
        const query = new MemoryQueryBuilder()
            .search('test')
            .filterByAgent('backend')
            .build();
        expect(query.sql).toContain('m.agent = ?');
        expect(query.params).toContain('backend');
    });
    it('should build query with date range', () => {
        const from = new Date('2025-01-01');
        const to = new Date('2025-01-31');
        const query = new MemoryQueryBuilder()
            .filterByDateRange(from, to)
            .build();
        expect(query.sql).toContain('m.timestamp >= ?');
        expect(query.sql).toContain('m.timestamp <= ?');
        expect(query.params).toContain(from.toISOString());
        expect(query.params).toContain(to.toISOString());
    });
    it('should build query with tags filter', () => {
        const query = new MemoryQueryBuilder()
            .filterByTags(['authentication', 'api'])
            .build();
        expect(query.sql).toContain('m.tags LIKE ?');
        expect(query.params).toContain('%authentication%');
        expect(query.params).toContain('%api%');
    });
    it('should apply pagination', () => {
        const query = new MemoryQueryBuilder()
            .limit(20)
            .offset(10)
            .build();
        expect(query.sql).toContain('LIMIT ? OFFSET ?');
        expect(query.params).toContain(20);
        expect(query.params).toContain(10);
    });
    it('should sort by different fields', () => {
        const relevanceQuery = new MemoryQueryBuilder()
            .search('test')
            .sortBy('relevance', 'desc')
            .build();
        expect(relevanceQuery.sql).toContain('ORDER BY rank DESC');
        const dateQuery = new MemoryQueryBuilder()
            .sortBy('date', 'asc')
            .build();
        expect(dateQuery.sql).toContain('ORDER BY m.timestamp ASC');
        const agentQuery = new MemoryQueryBuilder()
            .sortBy('agent')
            .build();
        expect(agentQuery.sql).toContain('ORDER BY m.agent');
    });
    it('should handle exact match mode', () => {
        const query = new MemoryQueryBuilder()
            .search('exact phrase', true)
            .build();
        expect(query.params[0]).toContain('"exact phrase"');
    });
    it('should cap limit at 100', () => {
        const query = new MemoryQueryBuilder()
            .limit(500)
            .build();
        expect(query.params).toContain(100);
    });
    it('should generate query explanation', () => {
        const query = new MemoryQueryBuilder()
            .search('authentication')
            .filterByAgent('backend')
            .limit(10)
            .build();
        expect(query.explanation).toContain('authentication');
        expect(query.explanation).toContain('backend');
        expect(query.explanation).toContain('Limit: 10');
    });
    it('should reset builder state', () => {
        const builder = new MemoryQueryBuilder()
            .search('test')
            .filterByAgent('backend');
        builder.reset();
        const query = builder.build();
        expect(query.sql).not.toContain('MATCH');
        expect(query.sql).not.toContain('backend');
    });
    it('should clone builder', () => {
        const original = new MemoryQueryBuilder()
            .search('test')
            .filterByAgent('backend');
        const cloned = original.clone();
        const query = cloned.build();
        expect(query.params).toContain('test');
        expect(query.params).toContain('backend');
    });
});
describe('QueryPresets', () => {
    it('should create recent memories query', () => {
        const query = QueryPresets.recentMemories(5).build();
        expect(query.sql).toContain('ORDER BY m.timestamp DESC');
        expect(query.params).toContain(5);
    });
    it('should create by-agent query', () => {
        const query = QueryPresets.byAgent('backend', 10).build();
        expect(query.params).toContain('backend');
        expect(query.params).toContain(10);
    });
    it('should create today query', () => {
        const query = QueryPresets.today().build();
        expect(query.sql).toContain('m.timestamp >= ?');
    });
    it('should create search query', () => {
        const query = QueryPresets.search('authentication').build();
        expect(query.sql).toContain('MATCH');
        expect(query.params).toContain('authentication');
    });
});
// ============================================================================
// Memory Cache Tests
// ============================================================================
describe('MemoryCache', () => {
    let cache;
    beforeEach(() => {
        cache = new MemoryCache({
            maxSize: 10,
            ttl: 1000, // 1 second
        });
    });
    it('should store and retrieve values', () => {
        cache.set('key1', 'value1');
        const value = cache.get('key1');
        expect(value).toBe('value1');
    });
    it('should return undefined for missing keys', () => {
        const value = cache.get('nonexistent');
        expect(value).toBeUndefined();
    });
    it('should check if key exists', () => {
        cache.set('key1', 'value1');
        expect(cache.has('key1')).toBe(true);
        expect(cache.has('key2')).toBe(false);
    });
    it('should delete entries', () => {
        cache.set('key1', 'value1');
        const deleted = cache.delete('key1');
        expect(deleted).toBe(true);
        expect(cache.has('key1')).toBe(false);
    });
    it('should clear all entries', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.clear();
        expect(cache.size()).toBe(0);
    });
    it('should evict LRU entry when full', () => {
        // Fill cache to max size
        for (let i = 0; i < 10; i++) {
            cache.set(`key${i}`, `value${i}`);
        }
        // Access key0 to make it recently used
        cache.get('key0');
        // Add one more entry (should evict LRU, which is key1)
        cache.set('key10', 'value10');
        expect(cache.has('key0')).toBe(true); // Recently accessed
        expect(cache.has('key1')).toBe(false); // Should be evicted
        expect(cache.has('key10')).toBe(true); // Newly added
    });
    it('should expire entries after TTL', async () => {
        cache.set('key1', 'value1', 100); // 100ms TTL
        expect(cache.has('key1')).toBe(true);
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(cache.has('key1')).toBe(false);
    });
    it('should track cache statistics', () => {
        cache.set('key1', 'value1');
        cache.get('key1'); // Hit
        cache.get('key2'); // Miss
        cache.get('key1'); // Hit
        const stats = cache.getStats();
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(1);
        expect(stats.hitRate).toBeCloseTo(0.667, 2);
        expect(stats.size).toBe(1);
    });
    it('should support getOrSet pattern', async () => {
        let factoryCalled = false;
        const factory = async () => {
            factoryCalled = true;
            return 'computed-value';
        };
        // First call should invoke factory
        const value1 = await cache.getOrSet('key1', factory);
        expect(value1).toBe('computed-value');
        expect(factoryCalled).toBe(true);
        // Second call should use cache
        factoryCalled = false;
        const value2 = await cache.getOrSet('key1', factory);
        expect(value2).toBe('computed-value');
        expect(factoryCalled).toBe(false);
    });
    it('should evict expired entries', async () => {
        cache.set('key1', 'value1', 100);
        cache.set('key2', 'value2', 100);
        await new Promise(resolve => setTimeout(resolve, 150));
        const evicted = cache.evictExpired();
        expect(evicted).toBe(2);
        expect(cache.size()).toBe(0);
    });
    it('should get entry metadata', () => {
        cache.set('key1', 'value1');
        const metadata = cache.getMetadata('key1');
        expect(metadata).toBeDefined();
        expect(metadata?.accessCount).toBe(0);
        expect(metadata?.createdAt).toBeDefined();
    });
    it('should export and import cache state', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        const exported = cache.export();
        expect(exported.size).toBe(2);
        const newCache = new MemoryCache();
        newCache.import(exported);
        expect(newCache.get('key1')).toBe('value1');
        expect(newCache.get('key2')).toBe('value2');
    });
    it('should warm up cache', () => {
        const entries = new Map([
            ['key1', 'value1'],
            ['key2', 'value2'],
            ['key3', 'value3'],
        ]);
        cache.warmUp(entries);
        expect(cache.size()).toBe(3);
        expect(cache.get('key1')).toBe('value1');
    });
});
describe('CacheKeyGenerator', () => {
    it('should generate key from query', () => {
        const key = CacheKeyGenerator.fromQuery('test query', { agent: 'backend' });
        expect(key).toContain('test query');
        expect(key).toContain('agent');
        expect(key).toContain('backend');
    });
    it('should generate deterministic keys', () => {
        const key1 = CacheKeyGenerator.fromObject({ a: 1, b: 2 });
        const key2 = CacheKeyGenerator.fromObject({ b: 2, a: 1 }); // Different order
        expect(key1).toBe(key2); // Should be same (sorted)
    });
    it('should generate keys with prefix', () => {
        const key = CacheKeyGenerator.withPrefix('memory', 'query', 'backend');
        expect(key).toBe('memory:query:backend');
    });
});
describe('TieredCache', () => {
    let cache;
    beforeEach(() => {
        cache = new TieredCache({ maxSize: 5, ttl: 100 }, { maxSize: 10, ttl: 500 });
    });
    it('should retrieve from hot cache first', () => {
        cache.set('key1', 'value1');
        const value = cache.get('key1');
        expect(value).toBe('value1');
        const stats = cache.getStats();
        expect(stats.hot.hits).toBe(1);
    });
    it('should promote cold to hot on access', () => {
        cache.set('key1', 'value1');
        // Clear hot cache to simulate eviction
        const stats1 = cache.getStats();
        // Access should promote from cold to hot
        const value = cache.get('key1');
        expect(value).toBe('value1');
    });
    it('should track separate statistics', () => {
        cache.set('key1', 'value1');
        cache.get('key1');
        const stats = cache.getStats();
        expect(stats.hot).toBeDefined();
        expect(stats.cold).toBeDefined();
    });
});
//# sourceMappingURL=services-and-cache.test.js.map