import type { MCPCacheConfig, MCPCacheStats, CacheGetResult, CacheSetOptions, EvictionResult, MemoryPressureLevel } from '@automatosx/contracts';
/**
 * LRU Cache with size-based eviction.
 *
 * Invariants enforced:
 * - INV-MCP-CACHE-001: Size bound (currentSizeBytes <= maxSizeBytes)
 * - INV-MCP-CACHE-002: Entry bound (entryCount <= maxEntries)
 * - INV-MCP-CACHE-003: TTL expiration (expired entries not returned)
 * - INV-MCP-CACHE-004: LRU ordering (least recently accessed evicted first)
 * - INV-MCP-CACHE-005: Atomic operations
 * - INV-MCP-CACHE-006: Size accuracy
 */
export declare class LRUCache {
    private readonly cache;
    private readonly config;
    private currentSizeBytes;
    private hitCount;
    private missCount;
    private evictionCount;
    private lastCleanupAt?;
    private cleanupInterval?;
    constructor(config?: Partial<MCPCacheConfig>);
    /**
     * Get a value from the cache.
     * INV-MCP-CACHE-003: Returns miss for expired entries.
     * INV-MCP-CACHE-004: Updates lastAccessedAt for LRU tracking.
     */
    get(key: string): CacheGetResult;
    /**
     * Set a value in the cache.
     * INV-MCP-CACHE-001: Triggers eviction if size exceeded.
     * INV-MCP-CACHE-002: Triggers eviction if entry count exceeded.
     */
    set(key: string, value: unknown, options?: Partial<CacheSetOptions>): void;
    /**
     * Delete a value from the cache.
     */
    delete(key: string): boolean;
    /**
     * Check if a key exists (without updating access time).
     */
    has(key: string): boolean;
    /**
     * Clear all entries from the cache.
     */
    clear(): void;
    /**
     * Get cache statistics.
     * INV-MCP-CACHE-006: Size accuracy verified here.
     */
    getStats(): MCPCacheStats;
    /**
     * Get current memory pressure level.
     */
    getPressureLevel(): MemoryPressureLevel;
    /**
     * Manually trigger eviction.
     */
    evict(reason?: EvictionResult['reason']): EvictionResult;
    /**
     * Shutdown the cache and cleanup resources.
     */
    shutdown(): void;
    private removeEntry;
    /**
     * Ensure there's capacity for a new entry.
     * INV-MCP-CACHE-001, INV-MCP-CACHE-002
     */
    private ensureCapacity;
    /**
     * Run eviction based on policy.
     * INV-MCP-CACHE-004: LRU ordering for eviction.
     */
    private runEviction;
    /**
     * Get entries sorted for eviction based on policy.
     * INV-MCP-CACHE-004: LRU = sort by lastAccessedAt ascending.
     */
    private getSortedEntriesForEviction;
    /**
     * Estimate size of a value in bytes.
     */
    private estimateSize;
    /**
     * Start periodic cleanup of expired entries.
     */
    private startCleanupInterval;
    /**
     * Remove all expired entries.
     */
    private cleanupExpired;
}
/**
 * Create a new LRU cache instance.
 */
export declare function createLRUCache(config?: Partial<MCPCacheConfig>): LRUCache;
//# sourceMappingURL=lru-cache.d.ts.map