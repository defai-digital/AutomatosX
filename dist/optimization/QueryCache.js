/**
 * Query Cache with LRU and TTL
 * Sprint 5 Day 42: High-performance query result caching
 */
/**
 * Query Cache with LRU eviction and TTL
 */
export class QueryCache {
    cache = new Map();
    maxSize;
    ttl;
    hits = 0;
    misses = 0;
    evictions = 0;
    onEvict;
    constructor(options = {}) {
        this.maxSize = options.maxSize ?? 1000;
        this.ttl = options.ttl ?? 300000; // 5 minutes default
        this.onEvict = options.onEvict;
    }
    /**
     * Get value from cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        // Check if expired
        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        // Update access stats
        entry.accessCount++;
        entry.lastAccessed = now;
        this.hits++;
        return entry.value;
    }
    /**
     * Set value in cache
     */
    set(key, value) {
        const now = Date.now();
        // Check if we need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value,
            timestamp: now,
            accessCount: 0,
            lastAccessed: now,
        });
    }
    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
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
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? this.hits / total : 0;
        return {
            hits: this.hits,
            misses: this.misses,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate,
            evictions: this.evictions,
        };
    }
    /**
     * Get all keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let lruKey = null;
        let lruTime = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < lruTime) {
                lruTime = entry.lastAccessed;
                lruKey = key;
            }
        }
        if (lruKey) {
            const entry = this.cache.get(lruKey);
            this.cache.delete(lruKey);
            this.evictions++;
            if (this.onEvict && entry) {
                this.onEvict(lruKey, entry.value);
            }
        }
    }
    /**
     * Clean expired entries
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        return cleaned;
    }
    /**
     * Get entry with metadata
     */
    getEntry(key) {
        return this.cache.get(key);
    }
    /**
     * Update TTL for specific entry
     */
    touch(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        entry.timestamp = Date.now();
        entry.lastAccessed = Date.now();
        return true;
    }
    /**
     * Resize cache
     */
    resize(newMaxSize) {
        this.maxSize = newMaxSize;
        // Evict excess entries if needed
        while (this.cache.size > this.maxSize) {
            this.evictLRU();
        }
    }
    /**
     * Set new TTL
     */
    setTTL(newTTL) {
        this.ttl = newTTL;
    }
}
/**
 * Create query cache
 */
export function createQueryCache(options) {
    return new QueryCache(options);
}
//# sourceMappingURL=QueryCache.js.map