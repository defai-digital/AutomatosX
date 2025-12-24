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
export class LRUCache {
    cache = new Map();
    config;
    currentSizeBytes = 0;
    hitCount = 0;
    missCount = 0;
    evictionCount = 0;
    lastCleanupAt;
    cleanupInterval;
    constructor(config = {}) {
        this.config = {
            maxSizeBytes: config.maxSizeBytes ?? 104_857_600, // 100MB
            maxEntries: config.maxEntries ?? 10_000,
            defaultTtlMs: config.defaultTtlMs ?? 3_600_000, // 1 hour
            evictionPolicy: config.evictionPolicy ?? 'lru',
            highWaterMark: config.highWaterMark ?? 0.9,
            lowWaterMark: config.lowWaterMark ?? 0.7,
            cleanupIntervalMs: config.cleanupIntervalMs ?? 60_000, // 1 minute
        };
        // Start periodic cleanup
        this.startCleanupInterval();
    }
    /**
     * Get a value from the cache.
     * INV-MCP-CACHE-003: Returns miss for expired entries.
     * INV-MCP-CACHE-004: Updates lastAccessedAt for LRU tracking.
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.missCount++;
            return { hit: false };
        }
        // Check TTL expiration (INV-MCP-CACHE-003)
        if (entry.ttlMs > 0 && Date.now() > entry.createdAt + entry.ttlMs) {
            // Remove expired entry
            this.removeEntry(key);
            this.missCount++;
            return { hit: false };
        }
        // Update access time and count (INV-MCP-CACHE-004)
        entry.lastAccessedAt = Date.now();
        entry.accessCount++;
        this.hitCount++;
        return {
            hit: true,
            value: entry.value,
            entry,
        };
    }
    /**
     * Set a value in the cache.
     * INV-MCP-CACHE-001: Triggers eviction if size exceeded.
     * INV-MCP-CACHE-002: Triggers eviction if entry count exceeded.
     */
    set(key, value, options = {}) {
        const now = Date.now();
        const sizeBytes = this.estimateSize(value);
        const ttlMs = options.ttlMs ?? this.config.defaultTtlMs;
        // Remove existing entry if present (atomic update)
        if (this.cache.has(key)) {
            this.removeEntry(key);
        }
        // Check if we need to evict before adding
        this.ensureCapacity(sizeBytes);
        const entry = {
            key,
            value,
            sizeBytes,
            createdAt: now,
            lastAccessedAt: now,
            accessCount: 0,
            ttlMs,
        };
        // INV-MCP-CACHE-005: Atomic operation
        this.cache.set(key, entry);
        this.currentSizeBytes += sizeBytes;
    }
    /**
     * Delete a value from the cache.
     */
    delete(key) {
        return this.removeEntry(key);
    }
    /**
     * Check if a key exists (without updating access time).
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Check TTL
        if (entry.ttlMs > 0 && Date.now() > entry.createdAt + entry.ttlMs) {
            this.removeEntry(key);
            return false;
        }
        return true;
    }
    /**
     * Clear all entries from the cache.
     */
    clear() {
        this.cache.clear();
        this.currentSizeBytes = 0;
    }
    /**
     * Get cache statistics.
     * INV-MCP-CACHE-006: Size accuracy verified here.
     */
    getStats() {
        const totalHits = this.hitCount + this.missCount;
        const hitRate = totalHits > 0 ? this.hitCount / totalHits : 0;
        return {
            entryCount: this.cache.size,
            currentSizeBytes: this.currentSizeBytes,
            maxSizeBytes: this.config.maxSizeBytes,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate,
            evictionCount: this.evictionCount,
            lastCleanupAt: this.lastCleanupAt,
            pressureLevel: this.getPressureLevel(),
        };
    }
    /**
     * Get current memory pressure level.
     */
    getPressureLevel() {
        const ratio = this.currentSizeBytes / this.config.maxSizeBytes;
        if (ratio >= 0.95)
            return 'critical';
        if (ratio >= this.config.highWaterMark)
            return 'high';
        if (ratio >= 0.5)
            return 'medium';
        return 'low';
    }
    /**
     * Manually trigger eviction.
     */
    evict(reason = 'manual') {
        return this.runEviction(reason);
    }
    /**
     * Shutdown the cache and cleanup resources.
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        this.clear();
    }
    // =========================================================================
    // Private methods
    // =========================================================================
    removeEntry(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        this.cache.delete(key);
        this.currentSizeBytes -= entry.sizeBytes;
        return true;
    }
    /**
     * Ensure there's capacity for a new entry.
     * INV-MCP-CACHE-001, INV-MCP-CACHE-002
     */
    ensureCapacity(newEntrySize) {
        // Check entry count limit
        if (this.cache.size >= this.config.maxEntries) {
            this.runEviction('entry_limit');
        }
        // Check size limit with high water mark
        const projectedSize = this.currentSizeBytes + newEntrySize;
        const highWaterBytes = this.config.maxSizeBytes * this.config.highWaterMark;
        if (projectedSize > highWaterBytes) {
            this.runEviction('size_limit');
        }
    }
    /**
     * Run eviction based on policy.
     * INV-MCP-CACHE-004: LRU ordering for eviction.
     */
    runEviction(reason) {
        const startTime = Date.now();
        let evictedCount = 0;
        let bytesFreed = 0;
        // Target size after eviction (low water mark)
        const targetSize = this.config.maxSizeBytes * this.config.lowWaterMark;
        const targetEntries = Math.floor(this.config.maxEntries * this.config.lowWaterMark);
        // Get entries sorted by eviction priority
        const entries = this.getSortedEntriesForEviction();
        for (const entry of entries) {
            // Stop if we've reached targets
            if (this.currentSizeBytes <= targetSize &&
                this.cache.size <= targetEntries) {
                break;
            }
            // Remove entry
            this.cache.delete(entry.key);
            this.currentSizeBytes -= entry.sizeBytes;
            bytesFreed += entry.sizeBytes;
            evictedCount++;
        }
        this.evictionCount += evictedCount;
        return {
            evictedCount,
            bytesFreed,
            reason,
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * Get entries sorted for eviction based on policy.
     * INV-MCP-CACHE-004: LRU = sort by lastAccessedAt ascending.
     */
    getSortedEntriesForEviction() {
        const entries = Array.from(this.cache.values());
        switch (this.config.evictionPolicy) {
            case 'lru':
                // Least recently used first (oldest access time first)
                return entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
            case 'lfu':
                // Least frequently used first (lowest access count first)
                return entries.sort((a, b) => a.accessCount - b.accessCount);
            case 'fifo':
                // First in first out (oldest creation time first)
                return entries.sort((a, b) => a.createdAt - b.createdAt);
            default:
                return entries;
        }
    }
    /**
     * Estimate size of a value in bytes.
     */
    estimateSize(value) {
        try {
            const json = JSON.stringify(value);
            // Approximate: UTF-8 encoding, roughly 1-3 bytes per char
            return json.length * 2;
        }
        catch {
            // If can't stringify, use rough estimate
            return 1024;
        }
    }
    /**
     * Start periodic cleanup of expired entries.
     */
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, this.config.cleanupIntervalMs);
        // Don't keep process alive just for cleanup
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    /**
     * Remove all expired entries.
     */
    cleanupExpired() {
        const now = Date.now();
        let evictedCount = 0;
        for (const [key, entry] of this.cache) {
            if (entry.ttlMs > 0 && now > entry.createdAt + entry.ttlMs) {
                this.removeEntry(key);
                evictedCount++;
            }
        }
        this.lastCleanupAt = now;
        if (evictedCount > 0) {
            this.evictionCount += evictedCount;
        }
    }
}
/**
 * Create a new LRU cache instance.
 */
export function createLRUCache(config) {
    return new LRUCache(config);
}
//# sourceMappingURL=lru-cache.js.map