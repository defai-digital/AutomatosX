/**
 * SimpleQueryCache.ts
 *
 * Lightweight in-memory cache for query results with TTL and size limits
 */
/**
 * Simple LRU cache with TTL support
 * Uses Map to maintain insertion order
 */
export class SimpleQueryCache {
    cache;
    maxSize;
    ttl;
    hits = 0;
    misses = 0;
    evictions = 0;
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 300000; // 5 minutes default
        this.cache = new Map();
    }
    /**
     * Get value from cache
     * Returns null if not found or expired
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        // Cache hit - update access count
        entry.accessCount++;
        this.hits++;
        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }
    /**
     * Set value in cache
     * Evicts oldest entry if at max size
     */
    set(key, value) {
        // If key exists, update it
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Evict oldest entry if at max size
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
                this.evictions++;
            }
        }
        // Add new entry
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            accessCount: 0,
        });
    }
    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Remove entry from cache
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
    stats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total === 0 ? 0 : this.hits / total,
            evictions: this.evictions,
        };
    }
    /**
     * Get all keys in cache
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
     * Prune expired entries
     * Returns number of entries removed
     */
    prune() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp;
            if (age > this.ttl) {
                this.cache.delete(key);
                removed++;
            }
        }
        return removed;
    }
}
//# sourceMappingURL=SimpleQueryCache.js.map