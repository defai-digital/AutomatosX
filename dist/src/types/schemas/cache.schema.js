/**
 * cache.schema.ts
 *
 * Type definitions and Zod schemas for provider response caching.
 *
 * Phase 3 Week 1 Day 1: Response Caching Layer
 */
import { z } from 'zod';
/**
 * Cache Entry Schema
 */
export const CacheEntrySchema = z.object({
    id: z.string().uuid(),
    cacheKey: z.string().min(1),
    requestHash: z.string().length(64), // SHA-256 hex
    provider: z.enum(['claude', 'gemini', 'openai']),
    model: z.string(),
    requestContent: z.string(),
    responseContent: z.string(),
    responseData: z.string(), // JSON string
    tokensUsed: z.number().int().nonnegative(),
    costSaved: z.number().nonnegative(),
    hitCount: z.number().int().nonnegative().default(0),
    lastHitAt: z.number().int().positive().optional(),
    ttlSeconds: z.number().int().positive().default(3600),
    expiresAt: z.number().int().positive(),
    createdAt: z.number().int().positive(),
    updatedAt: z.number().int().positive(),
});
/**
 * Cache Stats Schema
 */
export const CacheStatsSchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    provider: z.enum(['claude', 'gemini', 'openai']),
    cacheHits: z.number().int().nonnegative(),
    cacheMisses: z.number().int().nonnegative(),
    totalRequests: z.number().int().nonnegative(),
    hitRate: z.number().min(0).max(100),
    costSaved: z.number().nonnegative(),
    tokensSaved: z.number().int().nonnegative(),
    createdAt: z.number().int().positive(),
    updatedAt: z.number().int().positive(),
});
/**
 * Cache Configuration Schema
 */
export const CacheConfigSchema = z.object({
    enabled: z.boolean().default(true),
    defaultTTL: z.number().int().positive().default(3600), // 1 hour
    maxCacheSize: z.number().int().positive().default(10000),
    evictionPolicy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
    semanticThreshold: z.number().min(0).max(1).default(0.85),
});
/**
 * Cache Request Options Schema
 */
export const CacheRequestOptionsSchema = z.object({
    useCache: z.boolean().default(true),
    ttl: z.number().int().positive().optional(),
    skipCache: z.boolean().default(false),
    semanticMatch: z.boolean().default(false),
});
/**
 * Cache Lookup Result Schema
 */
export const CacheLookupResultSchema = z.object({
    hit: z.boolean(),
    entry: CacheEntrySchema.optional(),
    similarity: z.number().min(0).max(1).optional(), // For semantic matching
    savedCost: z.number().nonnegative().optional(),
    savedTokens: z.number().int().nonnegative().optional(),
});
/**
 * Cache Metrics Schema
 */
export const CacheMetricsSchema = z.object({
    totalEntries: z.number().int().nonnegative(),
    hitRate: z.number().min(0).max(100),
    totalHits: z.number().int().nonnegative(),
    totalMisses: z.number().int().nonnegative(),
    totalCostSaved: z.number().nonnegative(),
    totalTokensSaved: z.number().int().nonnegative(),
    averageTTL: z.number().nonnegative(),
    oldestEntry: z.number().int().positive().optional(),
    newestEntry: z.number().int().positive().optional(),
});
/**
 * Cache Event Schema
 */
export const CacheEventSchema = z.object({
    type: z.enum(['hit', 'miss', 'evict', 'expire', 'invalidate']),
    cacheKey: z.string(),
    provider: z.enum(['claude', 'gemini', 'openai']),
    timestamp: z.number().int().positive(),
    metadata: z.record(z.any()).optional(),
});
/**
 * Validation Functions
 */
export function validateCacheEntry(data) {
    return CacheEntrySchema.parse(data);
}
export function validateCacheStats(data) {
    return CacheStatsSchema.parse(data);
}
export function validateCacheConfig(data) {
    return CacheConfigSchema.parse(data);
}
export function validateCacheRequestOptions(data) {
    return CacheRequestOptionsSchema.parse(data);
}
export function validateCacheLookupResult(data) {
    return CacheLookupResultSchema.parse(data);
}
export function validateCacheMetrics(data) {
    return CacheMetricsSchema.parse(data);
}
export function validateCacheEvent(data) {
    return CacheEventSchema.parse(data);
}
//# sourceMappingURL=cache.schema.js.map