/**
 * ProviderCache.ts
 *
 * Intelligent response caching service for AI provider requests.
 * Implements content-based and semantic caching with TTL management.
 *
 * Phase 3 Week 1 Day 1-2: Response Caching Layer
 */
import type { CacheConfig, CacheRequestOptions, CacheLookupResult, CacheMetrics, CacheHitRateSummary, TopCachedResponse } from '../types/schemas/cache.schema.js';
import type { ProviderRequest, ProviderResponse } from '../types/schemas/provider.schema.js';
/**
 * ProviderCache provides intelligent caching for AI provider responses
 */
export declare class ProviderCache {
    private db;
    private config;
    private inMemoryCache;
    private readonly maxInMemorySize;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Lookup a cached response
     */
    lookup(request: ProviderRequest, options?: CacheRequestOptions): Promise<CacheLookupResult>;
    /**
     * Store a response in cache
     */
    store(request: ProviderRequest, response: ProviderResponse, options?: {
        ttl?: number;
        cost?: number;
    }): Promise<void>;
    /**
     * Invalidate cache entries
     */
    invalidate(pattern?: string): Promise<number>;
    /**
     * Get cache metrics
     */
    getMetrics(): Promise<CacheMetrics>;
    /**
     * Get cache statistics by provider
     */
    getStatsByProvider(): Promise<CacheHitRateSummary[]>;
    /**
     * Get top cached responses
     */
    getTopCached(limit?: number): Promise<TopCachedResponse[]>;
    /**
     * Clean up expired entries
     */
    cleanup(): Promise<number>;
    /**
     * Update cache configuration
     */
    updateConfig(config: Partial<CacheConfig>): void;
    /**
     * Private helper methods
     */
    private generateCacheKey;
    private generateRequestHash;
    private normalizeRequest;
    private semanticLookup;
    private recordHit;
    private recordMiss;
    private ensureCacheSize;
    private addToMemoryCache;
    private isExpired;
    private estimateCost;
}
//# sourceMappingURL=ProviderCache.d.ts.map