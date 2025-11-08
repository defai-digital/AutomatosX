// Sprint 2 Day 14: Memory Cache
// LRU cache with TTL for query result caching
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
export class MemoryCache {
    cache;
    maxSize;
    ttl;
    hits;
    misses;
    evictions;
    enableStats;
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 5 * 60 * 1000; // Default 5 minutes
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.enableStats = options.enableStats ?? true;
    }
    /**
     * Get value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            if (this.enableStats)
                this.misses++;
            return undefined;
        }
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            if (this.enableStats)
                this.misses++;
            return undefined;
        }
        // Update access metadata
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        if (this.enableStats)
            this.hits++;
        return entry.value;
    }
    /**
     * Set value in cache
     */
    set(key, value, ttl) {
        const effectiveTTL = ttl ?? this.ttl;
        const now = Date.now();
        const entry = {
            value,
            expiresAt: now + effectiveTTL,
            accessCount: 0,
            createdAt: now,
            lastAccessedAt: now,
        };
        // Check if we need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, entry);
    }
    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Delete entry from cache
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all entries
     */
    clear() {
        this.cache.clear();
        if (this.enableStats) {
            this.hits = 0;
            this.misses = 0;
            this.evictions = 0;
        }
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Get all keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
        // Calculate average age
        const now = Date.now();
        let totalAge = 0;
        for (const entry of this.cache.values()) {
            totalAge += now - entry.createdAt;
        }
        const averageAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate,
            size: this.cache.size,
            maxSize: this.maxSize,
            evictions: this.evictions,
            averageAge,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    /**
     * Get or set (lazy loading pattern)
     */
    async getOrSet(key, factory, ttl) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = await factory();
        this.set(key, value, ttl);
        return value;
    }
    /**
     * Evict expired entries
     */
    evictExpired() {
        const now = Date.now();
        let evicted = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                evicted++;
            }
        }
        if (this.enableStats) {
            this.evictions += evicted;
        }
        return evicted;
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldestKey = null;
        let oldestAccess = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessedAt < oldestAccess) {
                oldestAccess = entry.lastAccessedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            if (this.enableStats) {
                this.evictions++;
            }
        }
    }
    /**
     * Evict entries by predicate
     */
    evictBy(predicate) {
        let evicted = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (predicate(key, entry.value)) {
                this.cache.delete(key);
                evicted++;
            }
        }
        if (this.enableStats) {
            this.evictions += evicted;
        }
        return evicted;
    }
    /**
     * Get entry metadata
     */
    getMetadata(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        return {
            expiresAt: entry.expiresAt,
            accessCount: entry.accessCount,
            createdAt: entry.createdAt,
            lastAccessedAt: entry.lastAccessedAt,
        };
    }
    /**
     * Warm up cache with multiple entries
     */
    warmUp(entries, ttl) {
        entries.forEach((value, key) => {
            this.set(key, value, ttl);
        });
    }
    /**
     * Export cache state (for persistence)
     */
    export() {
        const exported = new Map();
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            // Only export non-expired entries
            if (now < entry.expiresAt) {
                exported.set(key, entry.value);
            }
        }
        return exported;
    }
    /**
     * Import cache state
     */
    import(data, ttl) {
        data.forEach((value, key) => {
            this.set(key, value, ttl);
        });
    }
}
/**
 * Cache key generator helpers
 */
export class CacheKeyGenerator {
    /**
     * Generate cache key from query parameters
     */
    static fromQuery(query, filters) {
        const parts = [query];
        if (filters) {
            const sortedKeys = Object.keys(filters).sort();
            sortedKeys.forEach(key => {
                const value = filters[key];
                parts.push(`${key}:${JSON.stringify(value)}`);
            });
        }
        return parts.join('|');
    }
    /**
     * Generate cache key from object (deterministic)
     */
    static fromObject(obj) {
        const sortedKeys = Object.keys(obj).sort();
        const parts = sortedKeys.map(key => `${key}:${JSON.stringify(obj[key])}`);
        return parts.join('|');
    }
    /**
     * Generate cache key with prefix
     */
    static withPrefix(prefix, ...parts) {
        return [prefix, ...parts].join(':');
    }
}
/**
 * Multi-layer cache for different TTLs
 */
export class TieredCache {
    hotCache;
    coldCache;
    constructor(hotOptions = {}, coldOptions = {}) {
        this.hotCache = new MemoryCache({
            maxSize: hotOptions.maxSize || 100,
            ttl: hotOptions.ttl || 60 * 1000, // 1 minute
            ...hotOptions,
        });
        this.coldCache = new MemoryCache({
            maxSize: coldOptions.maxSize || 1000,
            ttl: coldOptions.ttl || 5 * 60 * 1000, // 5 minutes
            ...coldOptions,
        });
    }
    /**
     * Get from hot cache first, then cold cache
     */
    get(key) {
        // Try hot cache first
        const hot = this.hotCache.get(key);
        if (hot !== undefined) {
            return hot;
        }
        // Try cold cache
        const cold = this.coldCache.get(key);
        if (cold !== undefined) {
            // Promote to hot cache
            this.hotCache.set(key, cold);
            return cold;
        }
        return undefined;
    }
    /**
     * Set in both caches
     */
    set(key, value) {
        this.hotCache.set(key, value);
        this.coldCache.set(key, value);
    }
    /**
     * Get combined statistics
     */
    getStats() {
        return {
            hot: this.hotCache.getStats(),
            cold: this.coldCache.getStats(),
        };
    }
    /**
     * Clear both caches
     */
    clear() {
        this.hotCache.clear();
        this.coldCache.clear();
    }
}
//# sourceMappingURL=MemoryCache.js.map