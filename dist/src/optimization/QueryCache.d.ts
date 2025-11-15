/**
 * Query Cache with LRU and TTL
 * Sprint 5 Day 42: High-performance query result caching
 */
/**
 * Cache entry
 */
interface CacheEntry<T> {
    value: T;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
}
/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
    evictions: number;
}
/**
 * Query Cache Options
 */
export interface QueryCacheOptions {
    maxSize?: number;
    ttl?: number;
    onEvict?: (key: string, value: any) => void;
}
/**
 * Query Cache with LRU eviction and TTL
 */
export declare class QueryCache<T = any> {
    private cache;
    private maxSize;
    private ttl;
    private hits;
    private misses;
    private evictions;
    private onEvict?;
    constructor(options?: QueryCacheOptions);
    /**
     * Get value from cache
     */
    get(key: string): T | undefined;
    /**
     * Set value in cache
     */
    set(key: string, value: T): void;
    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean;
    /**
     * Delete entry from cache
     */
    delete(key: string): boolean;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get all keys
     */
    keys(): string[];
    /**
     * Get cache size
     */
    size(): number;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Clean expired entries
     */
    cleanExpired(): number;
    /**
     * Get entry with metadata
     */
    getEntry(key: string): CacheEntry<T> | undefined;
    /**
     * Update TTL for specific entry
     */
    touch(key: string): boolean;
    /**
     * Resize cache
     */
    resize(newMaxSize: number): void;
    /**
     * Set new TTL
     */
    setTTL(newTTL: number): void;
}
/**
 * Create query cache
 */
export declare function createQueryCache<T = any>(options?: QueryCacheOptions): QueryCache<T>;
export {};
//# sourceMappingURL=QueryCache.d.ts.map