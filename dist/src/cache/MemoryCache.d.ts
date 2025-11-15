/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    accessCount: number;
    createdAt: number;
    lastAccessedAt: number;
}
/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
    averageAge: number;
}
/**
 * Cache options
 */
export interface MemoryCacheOptions {
    maxSize?: number;
    ttl?: number;
    enableStats?: boolean;
}
/**
 * Memory Cache with LRU eviction and TTL
 *
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time To Live) for automatic expiration
 * - Cache statistics (hit rate, size, evictions)
 * - Type-safe with generics
 *
 * @example
 * ```typescript
 * const cache = new MemoryCache<QueryResult>({
 *   maxSize: 1000,
 *   ttl: 5 * 60 * 1000 // 5 minutes
 * })
 *
 * // Set value
 * cache.set('key', result)
 *
 * // Get value
 * const cached = cache.get('key')
 * if (cached) {
 *   console.log('Cache hit!')
 * }
 *
 * // Check stats
 * const stats = cache.getStats()
 * console.log(`Hit rate: ${stats.hitRate * 100}%`)
 * ```
 */
export declare class MemoryCache<T> {
    private cache;
    private maxSize;
    private ttl;
    private hits;
    private misses;
    private evictions;
    private enableStats;
    constructor(options?: MemoryCacheOptions);
    /**
     * Get value from cache
     */
    get(key: string): T | undefined;
    /**
     * Set value in cache
     */
    set(key: string, value: T, ttl?: number): void;
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
     * Get cache size
     */
    size(): number;
    /**
     * Get all keys
     */
    keys(): string[];
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get or set (lazy loading pattern)
     */
    getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Evict expired entries
     */
    evictExpired(): number;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Evict entries by predicate
     */
    evictBy(predicate: (key: string, value: T) => boolean): number;
    /**
     * Get entry metadata
     */
    getMetadata(key: string): Omit<CacheEntry<T>, 'value'> | undefined;
    /**
     * Warm up cache with multiple entries
     */
    warmUp(entries: Map<string, T>, ttl?: number): void;
    /**
     * Export cache state (for persistence)
     */
    export(): Map<string, T>;
    /**
     * Import cache state
     */
    import(data: Map<string, T>, ttl?: number): void;
}
/**
 * Cache key generator helpers
 */
export declare class CacheKeyGenerator {
    /**
     * Generate cache key from query parameters
     */
    static fromQuery(query: string, filters?: Record<string, any>): string;
    /**
     * Generate cache key from object (deterministic)
     */
    static fromObject(obj: Record<string, any>): string;
    /**
     * Generate cache key with prefix
     */
    static withPrefix(prefix: string, ...parts: string[]): string;
}
/**
 * Multi-layer cache for different TTLs
 */
export declare class TieredCache<T> {
    private hotCache;
    private coldCache;
    constructor(hotOptions?: MemoryCacheOptions, coldOptions?: MemoryCacheOptions);
    /**
     * Get from hot cache first, then cold cache
     */
    get(key: string): T | undefined;
    /**
     * Set in both caches
     */
    set(key: string, value: T): void;
    /**
     * Get combined statistics
     */
    getStats(): {
        hot: CacheStats;
        cold: CacheStats;
    };
    /**
     * Clear both caches
     */
    clear(): void;
}
export {};
//# sourceMappingURL=MemoryCache.d.ts.map