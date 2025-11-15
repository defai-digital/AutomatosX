/**
 * SimpleQueryCache.ts
 *
 * Lightweight in-memory cache for query results with TTL and size limits
 */
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    accessCount: number;
}
export interface CacheStats {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
}
export interface CacheOptions {
    maxSize?: number;
    ttl?: number;
}
/**
 * Simple LRU cache with TTL support
 * Uses Map to maintain insertion order
 */
export declare class SimpleQueryCache<T> {
    private cache;
    private maxSize;
    private ttl;
    private hits;
    private misses;
    private evictions;
    constructor(options?: CacheOptions);
    /**
     * Get value from cache
     * Returns null if not found or expired
     */
    get(key: string): T | null;
    /**
     * Set value in cache
     * Evicts oldest entry if at max size
     */
    set(key: string, value: T): void;
    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean;
    /**
     * Remove entry from cache
     */
    delete(key: string): boolean;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    stats(): CacheStats;
    /**
     * Get all keys in cache
     */
    keys(): string[];
    /**
     * Get cache size
     */
    size(): number;
    /**
     * Prune expired entries
     * Returns number of entries removed
     */
    prune(): number;
}
//# sourceMappingURL=SimpleQueryCache.d.ts.map