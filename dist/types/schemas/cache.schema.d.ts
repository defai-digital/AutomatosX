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
export declare const CacheEntrySchema: z.ZodObject<{
    id: z.ZodString;
    cacheKey: z.ZodString;
    requestHash: z.ZodString;
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    model: z.ZodString;
    requestContent: z.ZodString;
    responseContent: z.ZodString;
    responseData: z.ZodString;
    tokensUsed: z.ZodNumber;
    costSaved: z.ZodNumber;
    hitCount: z.ZodDefault<z.ZodNumber>;
    lastHitAt: z.ZodOptional<z.ZodNumber>;
    ttlSeconds: z.ZodDefault<z.ZodNumber>;
    expiresAt: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
/**
 * Cache Stats Schema
 */
export declare const CacheStatsSchema: z.ZodObject<{
    id: z.ZodString;
    date: z.ZodString;
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    cacheHits: z.ZodNumber;
    cacheMisses: z.ZodNumber;
    totalRequests: z.ZodNumber;
    hitRate: z.ZodNumber;
    costSaved: z.ZodNumber;
    tokensSaved: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export type CacheStats = z.infer<typeof CacheStatsSchema>;
/**
 * Cache Configuration Schema
 */
export declare const CacheConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    defaultTTL: z.ZodDefault<z.ZodNumber>;
    maxCacheSize: z.ZodDefault<z.ZodNumber>;
    evictionPolicy: z.ZodDefault<z.ZodEnum<{
        lru: "lru";
        lfu: "lfu";
        fifo: "fifo";
    }>>;
    semanticThreshold: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
/**
 * Cache Request Options Schema
 */
export declare const CacheRequestOptionsSchema: z.ZodObject<{
    useCache: z.ZodDefault<z.ZodBoolean>;
    ttl: z.ZodOptional<z.ZodNumber>;
    skipCache: z.ZodDefault<z.ZodBoolean>;
    semanticMatch: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type CacheRequestOptions = z.infer<typeof CacheRequestOptionsSchema>;
/**
 * Cache Lookup Result Schema
 */
export declare const CacheLookupResultSchema: z.ZodObject<{
    hit: z.ZodBoolean;
    entry: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        cacheKey: z.ZodString;
        requestHash: z.ZodString;
        provider: z.ZodEnum<{
            claude: "claude";
            gemini: "gemini";
            openai: "openai";
        }>;
        model: z.ZodString;
        requestContent: z.ZodString;
        responseContent: z.ZodString;
        responseData: z.ZodString;
        tokensUsed: z.ZodNumber;
        costSaved: z.ZodNumber;
        hitCount: z.ZodDefault<z.ZodNumber>;
        lastHitAt: z.ZodOptional<z.ZodNumber>;
        ttlSeconds: z.ZodDefault<z.ZodNumber>;
        expiresAt: z.ZodNumber;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>>;
    similarity: z.ZodOptional<z.ZodNumber>;
    savedCost: z.ZodOptional<z.ZodNumber>;
    savedTokens: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CacheLookupResult = z.infer<typeof CacheLookupResultSchema>;
/**
 * Cache Metrics Schema
 */
export declare const CacheMetricsSchema: z.ZodObject<{
    totalEntries: z.ZodNumber;
    hitRate: z.ZodNumber;
    totalHits: z.ZodNumber;
    totalMisses: z.ZodNumber;
    totalCostSaved: z.ZodNumber;
    totalTokensSaved: z.ZodNumber;
    averageTTL: z.ZodNumber;
    oldestEntry: z.ZodOptional<z.ZodNumber>;
    newestEntry: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CacheMetrics = z.infer<typeof CacheMetricsSchema>;
/**
 * Eviction Policy Types
 */
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo';
/**
 * Cache Event Schema
 */
export declare const CacheEventSchema: z.ZodObject<{
    type: z.ZodEnum<{
        hit: "hit";
        miss: "miss";
        evict: "evict";
        expire: "expire";
        invalidate: "invalidate";
    }>;
    cacheKey: z.ZodString;
    provider: z.ZodEnum<{
        claude: "claude";
        gemini: "gemini";
        openai: "openai";
    }>;
    timestamp: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodAny, z.core.SomeType>>;
}, z.core.$strip>;
export type CacheEvent = z.infer<typeof CacheEventSchema>;
/**
 * Validation Functions
 */
export declare function validateCacheEntry(data: unknown): CacheEntry;
export declare function validateCacheStats(data: unknown): CacheStats;
export declare function validateCacheConfig(data: unknown): CacheConfig;
export declare function validateCacheRequestOptions(data: unknown): CacheRequestOptions;
export declare function validateCacheLookupResult(data: unknown): CacheLookupResult;
export declare function validateCacheMetrics(data: unknown): CacheMetrics;
export declare function validateCacheEvent(data: unknown): CacheEvent;
/**
 * Helper Types
 */
export interface CacheHitRateSummary {
    provider: string;
    totalHits: number;
    totalMisses: number;
    totalRequests: number;
    overallHitRate: number;
    totalCostSaved: number;
    totalTokensSaved: number;
}
export interface TopCachedResponse {
    id: string;
    provider: string;
    model: string;
    requestContent: string;
    hitCount: number;
    costSaved: number;
    tokensUsed: number;
    createdAt: number;
    lastHitAt: number | null;
}
//# sourceMappingURL=cache.schema.d.ts.map