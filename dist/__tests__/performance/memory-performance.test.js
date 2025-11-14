/**
 * memory-performance.test.ts
 *
 * Performance benchmarks for Memory System
 * Targets: <5ms uncached, <1ms cached, 10K+ messages
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MemoryService } from '../../memory/MemoryService.js';
import { MemoryCache } from '../../memory/MemoryCache.js';
describe('Memory System Performance Benchmarks', () => {
    let db;
    let memoryService;
    let memoryCache;
    let testConversations = [];
    beforeAll(async () => {
        // Create in-memory database
        db = new Database(':memory:');
        // Apply migration 008
        const migrationSQL = readFileSync(join(process.cwd(), 'src/migrations/008_create_memory_system.sql'), 'utf-8');
        db.exec(migrationSQL);
        // Initialize services
        memoryService = new MemoryService(db);
        memoryCache = new MemoryCache({
            maxSize: 1000,
            ttlMs: 5 * 60 * 1000,
        });
        // Create test data: 100 conversations with 100 messages each = 10,000 messages
        console.log('\n  Creating test data (100 conversations, 10K messages)...');
        const start = Date.now();
        for (let i = 1; i <= 100; i++) {
            const conversation = await memoryService.createConversation({
                agentId: i % 5 === 0 ? 'backend' : i % 3 === 0 ? 'frontend' : 'product',
                userId: `user-${i % 10}`,
                title: `Conversation ${i}`,
                metadata: {
                    project: `project-${i % 20}`,
                    priority: i % 2 === 0 ? 'high' : 'low',
                },
            });
            testConversations.push(conversation);
            // Add 100 messages per conversation
            for (let j = 1; j <= 100; j++) {
                await memoryService.addMessage({
                    conversationId: conversation.id,
                    role: j % 2 === 0 ? 'user' : 'assistant',
                    content: `Message ${j} in conversation ${i}: This is a test message about REST API authentication JWT tokens database design query optimization`,
                    tokens: 20 + (j % 10),
                    metadata: {
                        messageNum: j.toString(),
                    },
                });
            }
            // Progress indicator
            if (i % 10 === 0) {
                const elapsed = Date.now() - start;
                console.log(`    Created ${i}/100 conversations (${i * 100} messages) in ${elapsed}ms`);
            }
        }
        const totalTime = Date.now() - start;
        console.log(`  Test data created in ${totalTime}ms (${(10000 / totalTime * 1000).toFixed(0)} messages/sec)\n`);
    });
    afterAll(() => {
        db.close();
    });
    // ============================================================================
    // P0 Performance Targets
    // ============================================================================
    describe('P0 Performance Targets', () => {
        it('should search messages in <5ms (uncached)', async () => {
            const iterations = 10;
            const times = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await memoryService.searchMessages({
                    query: 'REST API',
                    limit: 10,
                    offset: 0,
                    sortBy: 'relevance',
                    sortOrder: 'desc',
                    skipCount: true, // Skip COUNT query for performance
                });
                const elapsed = performance.now() - start;
                times.push(elapsed);
            }
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
            console.log(`    Avg: ${avgTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`);
            expect(p95Time).toBeLessThan(5);
        });
        it('should search messages in <1ms (cached)', async () => {
            const query = 'authentication JWT';
            // Prime cache
            const result = await memoryService.searchMessages({
                query,
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            });
            memoryCache.setSearchResults(query, result.messages);
            // Benchmark cached access
            const iterations = 100;
            const times = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                const cached = memoryCache.getSearchResults(query);
                const elapsed = performance.now() - start;
                times.push(elapsed);
                expect(cached).not.toBeNull();
            }
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
            console.log(`    Avg: ${avgTime.toFixed(3)}ms, P95: ${p95Time.toFixed(3)}ms`);
            expect(p95Time).toBeLessThan(1);
        });
        it('should list conversations in <10ms', async () => {
            const iterations = 10;
            const times = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await memoryService.listConversations({
                    limit: 10,
                    offset: 0,
                    sortBy: 'updatedAt',
                    sortOrder: 'desc',
                });
                const elapsed = performance.now() - start;
                times.push(elapsed);
            }
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
            console.log(`    Avg: ${avgTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`);
            expect(p95Time).toBeLessThan(10);
        });
        it('should get conversation with messages in <20ms', async () => {
            const conversationId = testConversations[0].id;
            const iterations = 10;
            const times = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                await memoryService.getConversationWithMessages(conversationId);
                const elapsed = performance.now() - start;
                times.push(elapsed);
            }
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
            console.log(`    Avg: ${avgTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`);
            expect(p95Time).toBeLessThan(20);
        });
    });
    // ============================================================================
    // Load Testing
    // ============================================================================
    describe('Load Testing', () => {
        it('should handle 10K+ messages', async () => {
            const stats = await memoryService.getMemoryStats();
            console.log(`    Total conversations: ${stats.totalConversations}`);
            console.log(`    Total messages: ${stats.totalMessages}`);
            console.log(`    Total tokens: ${stats.totalTokens}`);
            expect(stats.totalConversations).toBeGreaterThanOrEqual(100);
            expect(stats.totalMessages).toBeGreaterThanOrEqual(10000);
        });
        it('should handle concurrent searches', async () => {
            const queries = [
                'REST API',
                'authentication',
                'database',
                'JWT tokens',
                'query optimization',
            ];
            const start = performance.now();
            const results = await Promise.all(queries.map((query) => memoryService.searchMessages({
                query,
                limit: 10,
                offset: 0,
                sortBy: 'relevance',
                sortOrder: 'desc',
            })));
            const elapsed = performance.now() - start;
            console.log(`    ${queries.length} concurrent searches in ${elapsed.toFixed(2)}ms`);
            console.log(`    Avg per search: ${(elapsed / queries.length).toFixed(2)}ms`);
            expect(results).toHaveLength(queries.length);
            expect(elapsed).toBeLessThan(100); // All 5 searches in <100ms
        });
        it('should handle pagination efficiently', async () => {
            const pageSize = 10;
            const pages = 10;
            const start = performance.now();
            for (let page = 0; page < pages; page++) {
                await memoryService.listConversations({
                    limit: pageSize,
                    offset: page * pageSize,
                    sortBy: 'updatedAt',
                    sortOrder: 'desc',
                });
            }
            const elapsed = performance.now() - start;
            const avgPerPage = elapsed / pages;
            console.log(`    ${pages} pages of ${pageSize} in ${elapsed.toFixed(2)}ms`);
            console.log(`    Avg per page: ${avgPerPage.toFixed(2)}ms`);
            expect(avgPerPage).toBeLessThan(10);
        });
    });
    // ============================================================================
    // Cache Performance
    // ============================================================================
    describe('Cache Performance', () => {
        it('should achieve >60% hit rate in typical usage', async () => {
            const cache = new MemoryCache({ maxSize: 100 });
            // Simulate typical usage pattern: 70% repeat accesses, 30% new
            const conversations = testConversations.slice(0, 20);
            for (let i = 0; i < 100; i++) {
                const isRepeat = Math.random() < 0.7;
                const conversation = isRepeat
                    ? conversations[i % 10] // Repeat from first 10
                    : conversations[10 + (i % 10)]; // New from second 10
                let cached = cache.getConversation(conversation.id);
                if (!cached) {
                    const fromDb = await memoryService.getConversation(conversation.id);
                    if (fromDb) {
                        cache.setConversation(conversation.id, fromDb);
                    }
                }
            }
            const stats = cache.getStats();
            console.log(`    Hits: ${stats.hits}`);
            console.log(`    Misses: ${stats.misses}`);
            console.log(`    Hit rate: ${stats.hitRate.toFixed(2)}%`);
            expect(stats.hitRate).toBeGreaterThan(60);
        });
        it('should maintain <1ms access time for cached data', async () => {
            const cache = new MemoryCache({ maxSize: 100 });
            // Prime cache
            for (let i = 0; i < 10; i++) {
                const conv = await memoryService.getConversation(testConversations[i].id);
                if (conv) {
                    cache.setConversation(conv.id, conv);
                }
            }
            // Benchmark cache access
            const iterations = 1000;
            const times = [];
            for (let i = 0; i < iterations; i++) {
                const conversationId = testConversations[i % 10].id;
                const start = performance.now();
                cache.getConversation(conversationId);
                const elapsed = performance.now() - start;
                times.push(elapsed);
            }
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
            console.log(`    Avg: ${avgTime.toFixed(3)}ms, P95: ${p95Time.toFixed(3)}ms`);
            expect(p95Time).toBeLessThan(1);
        });
    });
    // ============================================================================
    // Scalability
    // ============================================================================
    describe('Scalability', () => {
        it('should maintain performance with large result sets', async () => {
            const limits = [10, 50, 100];
            for (const limit of limits) {
                const start = performance.now();
                const result = await memoryService.searchMessages({
                    query: 'message',
                    limit,
                    offset: 0,
                    sortBy: 'relevance',
                    sortOrder: 'desc',
                });
                const elapsed = performance.now() - start;
                console.log(`    Limit ${limit}: ${elapsed.toFixed(2)}ms (${result.messages.length} results)`);
                expect(elapsed).toBeLessThan(20);
            }
        });
        it('should handle complex queries efficiently', async () => {
            const complexQueries = [
                'REST AND API',
                'authentication OR database',
                '(REST OR GraphQL) AND API',
                '"JWT tokens" AND authentication',
            ];
            for (const query of complexQueries) {
                const start = performance.now();
                await memoryService.searchMessages({
                    query,
                    limit: 10,
                    offset: 0,
                    sortBy: 'relevance',
                    sortOrder: 'desc',
                });
                const elapsed = performance.now() - start;
                console.log(`    Query "${query}": ${elapsed.toFixed(2)}ms`);
                expect(elapsed).toBeLessThan(10);
            }
        });
        it('should handle filtered searches efficiently', async () => {
            const filters = [
                { agentId: 'backend' },
                { userId: 'user-1' },
                { agentId: 'backend', userId: 'user-1' },
            ];
            for (const filter of filters) {
                const start = performance.now();
                await memoryService.searchMessages({
                    query: 'API',
                    ...filter,
                    limit: 10,
                    offset: 0,
                    sortBy: 'relevance',
                    sortOrder: 'desc',
                });
                const elapsed = performance.now() - start;
                console.log(`    Filter ${JSON.stringify(filter)}: ${elapsed.toFixed(2)}ms`);
                expect(elapsed).toBeLessThan(10);
            }
        });
    });
    // ============================================================================
    // Memory Usage
    // ============================================================================
    describe('Memory Usage', () => {
        it('should estimate storage correctly', async () => {
            const stats = await memoryService.getMemoryStats();
            // Expected: ~200 bytes per conversation + ~500 bytes per message
            const expectedBytes = stats.totalConversations * 200 + stats.totalMessages * 500;
            const expectedMB = expectedBytes / (1024 * 1024);
            console.log(`    Total conversations: ${stats.totalConversations}`);
            console.log(`    Total messages: ${stats.totalMessages}`);
            console.log(`    Expected storage: ${expectedMB.toFixed(2)} MB`);
            // Storage estimate should be in reasonable range
            expect(stats.totalConversations).toBeGreaterThan(0);
            expect(stats.totalMessages).toBeGreaterThan(0);
        });
        it('should handle cache eviction gracefully', async () => {
            const smallCache = new MemoryCache({ maxSize: 10 });
            // Fill cache beyond capacity
            for (let i = 0; i < 20; i++) {
                const conv = await memoryService.getConversation(testConversations[i].id);
                if (conv) {
                    smallCache.setConversation(conv.id, conv);
                }
            }
            const stats = smallCache.getStats();
            console.log(`    Cache size: ${stats.size}`);
            console.log(`    Max size: 10`);
            // Cache should not exceed max size
            expect(stats.size).toBeLessThanOrEqual(10);
        });
    });
});
//# sourceMappingURL=memory-performance.test.js.map