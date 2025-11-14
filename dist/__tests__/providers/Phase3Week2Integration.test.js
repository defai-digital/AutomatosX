/**
 * Phase3Week2Integration.test.ts
 *
 * Integration tests for Phase 3 Week 2 features:
 * - Response caching
 * - Advanced routing
 * - Rate limiting
 *
 * Phase 3 Week 2 Day 10: Integration Testing
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../database/connection.js';
import { ProviderCache } from '../../cache/ProviderCache.js';
import { AdvancedRouter } from '../../services/AdvancedRouter.js';
import { ProviderRateLimiter } from '../../services/ProviderRateLimiter.js';
describe('Phase 3 Week 2 Integration Tests', () => {
    let db;
    let cache;
    let router;
    let limiter;
    beforeEach(() => {
        db = getDatabase();
        cache = new ProviderCache();
        router = new AdvancedRouter();
        limiter = new ProviderRateLimiter();
        // Clean up test data
        db.prepare('DELETE FROM provider_cache').run();
        db.prepare('DELETE FROM cache_stats').run();
        db.prepare('DELETE FROM provider_metrics').run();
        db.prepare('DELETE FROM rate_limit_buckets').run();
        db.prepare('DELETE FROM rate_limit_violations').run();
        db.prepare('DELETE FROM user_quotas').run();
    });
    afterEach(() => {
        // Clean up
        db.prepare('DELETE FROM provider_cache').run();
        db.prepare('DELETE FROM cache_stats').run();
        db.prepare('DELETE FROM provider_metrics').run();
        db.prepare('DELETE FROM rate_limit_buckets').run();
        db.prepare('DELETE FROM rate_limit_violations').run();
        db.prepare('DELETE FROM user_quotas').run();
    });
    describe('Response Caching', () => {
        it('should cache and retrieve responses', async () => {
            const request = {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: 'What is 2+2?' }],
                temperature: 0.7,
                maxTokens: 100,
            };
            const response = {
                id: 'test-1',
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                content: '2+2 equals 4.',
                tokens: { input: 10, output: 20, total: 30 },
                latency: 500,
                timestamp: Date.now(),
            };
            // First request - cache miss
            const result1 = await cache.lookup(request);
            expect(result1.hit).toBe(false);
            // Store response
            await cache.store(request, response);
            // Second request - cache hit
            const result2 = await cache.lookup(request);
            expect(result2.hit).toBe(true);
            expect(result2.entry).toBeDefined();
            expect(result2.entry.provider).toBe('claude');
        });
        it('should calculate cost savings', async () => {
            const request = {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: 'Test' }],
            };
            const response = {
                id: 'test-2',
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                content: 'Response',
                tokens: { input: 100, output: 200, total: 300 },
                latency: 500,
                timestamp: Date.now(),
            };
            await cache.store(request, response);
            // Second lookup should show cost savings
            const result = await cache.lookup(request);
            expect(result.hit).toBe(true);
            expect(result.savedCost).toBeGreaterThan(0);
            expect(result.savedTokens).toBe(300);
        });
        it('should respect TTL expiration', async () => {
            const request = {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: 'TTL test' }],
            };
            const response = {
                id: 'test-3',
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                content: 'Response',
                tokens: { input: 10, output: 10, total: 20 },
                latency: 500,
                timestamp: Date.now(),
            };
            // Store with 1 second TTL
            await cache.store(request, response, { ttl: 1 });
            // Immediate lookup should hit
            const result1 = await cache.lookup(request);
            expect(result1.hit).toBe(true);
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));
            // Should be expired now
            const result2 = await cache.lookup(request);
            expect(result2.hit).toBe(false);
        });
        it('should track hit rate metrics', async () => {
            const request = {
                provider: 'gemini',
                model: 'gemini-1.5-pro-latest',
                messages: [{ role: 'user', content: 'Metrics test' }],
            };
            const response = {
                id: 'test-4',
                provider: 'gemini',
                model: 'gemini-1.5-pro-latest',
                content: 'Response',
                tokens: { input: 10, output: 10, total: 20 },
                latency: 500,
                timestamp: Date.now(),
            };
            // First request - miss
            await cache.lookup(request);
            // Store
            await cache.store(request, response);
            // Multiple hits
            await cache.lookup(request);
            await cache.lookup(request);
            await cache.lookup(request);
            // Check metrics
            const metrics = await cache.getMetrics();
            expect(metrics.totalHits).toBe(3);
            expect(metrics.totalMisses).toBe(1);
            expect(metrics.hitRate).toBeCloseTo(75, 0); // 3/4 = 75%
        });
    });
    describe('Advanced Routing', () => {
        beforeEach(() => {
            // Insert mock provider metrics for routing decisions
            const now = Date.now();
            const stmt = db.prepare(`
        INSERT INTO provider_metrics
        (id, provider, model, duration, success, total_tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            // Claude metrics - fast but expensive
            for (let i = 0; i < 20; i++) {
                stmt.run(`claude-${i}`, 'claude', 'claude-3-5-sonnet-20241022', 800 + Math.random() * 200, // 800-1000ms
                1, 1000, now - i * 60000);
            }
            // Gemini metrics - fastest and cheapest
            for (let i = 0; i < 20; i++) {
                stmt.run(`gemini-${i}`, 'gemini', 'gemini-1.5-flash-latest', 600 + Math.random() * 100, // 600-700ms
                1, 800, now - i * 60000);
            }
            // OpenAI metrics - slower and expensive
            for (let i = 0; i < 20; i++) {
                stmt.run(`openai-${i}`, 'openai', 'gpt-4-turbo-preview', 1200 + Math.random() * 300, // 1200-1500ms
                1, 1200, now - i * 60000);
            }
        });
        it('should route by latency', async () => {
            const latencyRouter = new AdvancedRouter({ strategy: 'latency-based' });
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            const decision = await latencyRouter.selectProvider(request);
            // Gemini should be selected (fastest)
            expect(decision.provider).toBe('gemini');
            expect(decision.model).toBe('gemini-1.5-flash-latest');
            expect(decision.reason).toContain('latency');
            expect(decision.estimatedLatency).toBeLessThan(1000);
        });
        it('should route by cost', async () => {
            const costRouter = new AdvancedRouter({ strategy: 'cost-based' });
            const request = {
                messages: [{ role: 'user', content: 'Test message' }],
                maxTokens: 100,
            };
            const decision = await costRouter.selectProvider(request);
            // Gemini Flash should be selected (cheapest)
            expect(decision.provider).toBe('gemini');
            expect(decision.reason).toContain('cost');
            expect(decision.estimatedCost).toBeLessThan(0.001);
        });
        it('should route by weighted score', async () => {
            const weightedRouter = new AdvancedRouter({
                strategy: 'weighted',
                latencyWeightPercentage: 60,
                costWeightPercentage: 40,
            });
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            const decision = await weightedRouter.selectProvider(request);
            // Should select based on combined score
            expect(decision.reason).toContain('weighted');
            expect(decision.confidence).toBeGreaterThan(0);
            expect(decision.alternatives).toHaveLength(3);
        });
        it('should provide alternative providers', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            const decision = await router.selectProvider(request);
            expect(decision.alternatives).toBeDefined();
            expect(decision.alternatives.length).toBeGreaterThan(0);
            decision.alternatives.forEach(alt => {
                expect(alt.provider).toBeTruthy();
                expect(alt.model).toBeTruthy();
                expect(alt.score).toBeGreaterThan(0);
                expect(alt.score).toBeLessThanOrEqual(1);
            });
        });
        it('should calculate confidence scores', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            const decision = await router.selectProvider(request);
            expect(decision.confidence).toBeGreaterThan(0);
            expect(decision.confidence).toBeLessThanOrEqual(1);
        });
    });
    describe('Rate Limiting', () => {
        it('should allow requests within limit', async () => {
            const result = await limiter.checkLimit('user123', 'user', 1);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBeGreaterThan(0);
        });
        it('should deny requests exceeding limit', async () => {
            // Consume all tokens
            for (let i = 0; i < 110; i++) {
                await limiter.checkLimit('user456', 'user', 1);
            }
            // This should be denied
            const result = await limiter.checkLimit('user456', 'user', 1);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfter).toBeGreaterThan(0);
        });
        it('should refill tokens over time', async () => {
            // Consume some tokens
            await limiter.checkLimit('user789', 'user', 50);
            // Check remaining
            const status1 = await limiter.getStatus('user789', 'user');
            const remaining1 = status1.remaining;
            // Wait for refill
            await new Promise(resolve => setTimeout(resolve, 100));
            // Check again - should have more tokens
            const status2 = await limiter.getStatus('user789', 'user');
            const remaining2 = status2.remaining;
            expect(remaining2).toBeGreaterThan(remaining1);
        });
        it('should track violations', async () => {
            // Exceed limit
            for (let i = 0; i < 120; i++) {
                await limiter.checkLimit('violator', 'user', 1);
            }
            // Check violations
            const violations = await limiter.getViolations('violator', 'user', 10);
            expect(violations.length).toBeGreaterThan(0);
            expect(violations[0].key).toBe('violator');
            expect(violations[0].type).toBe('user');
        });
        it('should support custom user quotas', async () => {
            // Set custom quota: 10 requests per minute
            await limiter.setUserQuota('vip-user', 10, 60000, 2);
            // Check status
            const status = await limiter.getStatus('vip-user', 'user');
            expect(status.limit).toBe(12); // 10 + 2 burst
            // Use all tokens
            for (let i = 0; i < 12; i++) {
                const result = await limiter.checkLimit('vip-user', 'user', 1);
                expect(result.allowed).toBe(true);
            }
            // Next request should be denied
            const result = await limiter.checkLimit('vip-user', 'user', 1);
            expect(result.allowed).toBe(false);
        });
        it('should reset rate limits', async () => {
            // Consume tokens
            await limiter.checkLimit('reset-test', 'user', 50);
            // Check status
            const status1 = await limiter.getStatus('reset-test', 'user');
            expect(status1.remaining).toBeLessThan(100);
            // Reset
            await limiter.reset('reset-test', 'user');
            // Check again - should be full
            const status2 = await limiter.getStatus('reset-test', 'user');
            expect(status2.remaining).toBe(status2.limit);
        });
        it('should generate statistics', async () => {
            // Make some requests
            for (let i = 0; i < 50; i++) {
                await limiter.checkLimit(`user-${i}`, 'user', 1);
            }
            // Exceed limits for some users
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 120; j++) {
                    await limiter.checkLimit(`heavy-user-${i}`, 'user', 1);
                }
            }
            // Check statistics
            const today = new Date().toISOString().split('T')[0];
            const stats = await limiter.getStatistics(today, today, 'user');
            expect(stats.length).toBeGreaterThan(0);
            expect(stats[0].totalRequests).toBeGreaterThan(0);
            expect(stats[0].deniedRequests).toBeGreaterThan(0);
        });
        it('should cleanup old buckets', async () => {
            // Create some buckets
            for (let i = 0; i < 10; i++) {
                await limiter.checkLimit(`cleanup-${i}`, 'user', 1);
            }
            // Manually set old timestamps
            db.prepare('UPDATE rate_limit_buckets SET last_refill = ? WHERE key LIKE ?').run(Date.now() - 48 * 60 * 60 * 1000, 'cleanup-%');
            // Cleanup
            const removed = await limiter.cleanup();
            expect(removed).toBe(10);
        });
    });
    describe('Cache + Routing Integration', () => {
        it('should cache routing decisions', async () => {
            const request = {
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: 'Routing test' }],
            };
            const response = {
                id: 'test-routing-1',
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                content: 'Response',
                tokens: { input: 10, output: 10, total: 20 },
                latency: 500,
                timestamp: Date.now(),
            };
            // First request - route and cache
            const decision1 = await router.selectProvider(request);
            await cache.store(request, response);
            // Second request - should use cache
            const cached = await cache.lookup(request);
            expect(cached.hit).toBe(true);
            // Verify routing would give same result
            const decision2 = await router.selectProvider(request);
            expect(decision2.provider).toBe(decision1.provider);
        });
    });
    describe('Rate Limiting + Routing Integration', () => {
        it('should respect rate limits during routing', async () => {
            // Set low limit
            await limiter.setUserQuota('limited-user', 5, 60000, 0);
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            // Make requests up to limit
            for (let i = 0; i < 5; i++) {
                const allowed = await limiter.checkLimit('limited-user', 'user', 1);
                expect(allowed.allowed).toBe(true);
                await router.selectProvider(request);
            }
            // Next request should be denied
            const result = await limiter.checkLimit('limited-user', 'user', 1);
            expect(result.allowed).toBe(false);
        });
    });
    describe('Full Stack Integration', () => {
        it('should handle complete request flow with caching, routing, and rate limiting', async () => {
            const userId = 'integration-test-user';
            const request = {
                messages: [{ role: 'user', content: 'Full integration test' }],
                maxTokens: 100,
            };
            // Step 1: Check rate limit
            const rateLimitCheck = await limiter.checkLimit(userId, 'user', 1);
            expect(rateLimitCheck.allowed).toBe(true);
            // Step 2: Check cache
            const cacheResult = await cache.lookup(request);
            expect(cacheResult.hit).toBe(false);
            // Step 3: Route request
            const routingDecision = await router.selectProvider(request);
            expect(routingDecision.provider).toBeTruthy();
            expect(routingDecision.model).toBeTruthy();
            // Step 4: Simulate response
            const response = {
                id: 'integration-1',
                provider: routingDecision.provider,
                model: routingDecision.model,
                content: 'Integration test response',
                tokens: { input: 20, output: 30, total: 50 },
                latency: 800,
                timestamp: Date.now(),
            };
            // Step 5: Store in cache
            await cache.store(request, response);
            // Step 6: Verify cache hit on second request
            const cacheResult2 = await cache.lookup(request);
            expect(cacheResult2.hit).toBe(true);
            expect(cacheResult2.savedTokens).toBe(50);
            // Step 7: Verify rate limit still allows requests
            const rateLimitCheck2 = await limiter.checkLimit(userId, 'user', 1);
            expect(rateLimitCheck2.allowed).toBe(true);
        });
    });
});
//# sourceMappingURL=Phase3Week2Integration.test.js.map