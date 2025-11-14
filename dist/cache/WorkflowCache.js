/**
 * WorkflowCache.ts
 *
 * Multi-level caching system for workflow execution results
 * Phase 5 Week 1: Performance Optimization
 */
import { EventEmitter } from 'events';
import crypto from 'crypto';
/**
 * Cache invalidation strategy
 */
export var InvalidationStrategy;
(function (InvalidationStrategy) {
    InvalidationStrategy["TTL"] = "ttl";
    InvalidationStrategy["MANUAL"] = "manual";
    InvalidationStrategy["TAG_BASED"] = "tag_based";
    InvalidationStrategy["DEPENDENCY"] = "dependency";
})(InvalidationStrategy || (InvalidationStrategy = {}));
/**
 * WorkflowCache - Multi-level LRU cache with statistics
 */
export class WorkflowCache extends EventEmitter {
    cache;
    config;
    stats;
    accessOrder; // For LRU eviction
    accessFrequency; // For LFU eviction
    constructor(config) {
        super();
        this.config = {
            maxSize: 100 * 1024 * 1024, // 100 MB default
            maxEntries: 10000,
            ttl: 3600000, // 1 hour default
            evictionPolicy: 'lru',
            enableL2: false,
            ...config,
        };
        this.cache = new Map();
        this.accessOrder = [];
        this.accessFrequency = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalEntries: 0,
            totalSize: 0,
            evictions: 0,
            averageHitTime: 0,
            averageMissTime: 0,
        };
        // Start cleanup interval
        this.startCleanup();
    }
    /**
     * Generate cache key from workflow definition and context
     */
    generateKey(workflowName, context) {
        const contextHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(context))
            .digest('hex')
            .substring(0, 16);
        return `workflow:${workflowName}:${contextHash}`;
    }
    /**
     * Get cached workflow result
     */
    get(workflowName, context) {
        const startTime = Date.now();
        const key = this.generateKey(workflowName, context);
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            this.updateHitRate();
            this.emit('cache_miss', { key, workflowName });
            return null;
        }
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            this.stats.misses++;
            this.stats.totalEntries--;
            this.stats.totalSize -= entry.size;
            this.updateHitRate();
            this.emit('cache_expired', { key, workflowName });
            return null;
        }
        // Cache hit
        this.stats.hits++;
        entry.hits++;
        this.updateAccessOrder(key);
        this.updateAccessFrequency(key);
        this.updateHitRate();
        const hitTime = Date.now() - startTime;
        this.stats.averageHitTime =
            (this.stats.averageHitTime * (this.stats.hits - 1) + hitTime) / this.stats.hits;
        this.emit('cache_hit', { key, workflowName, hitTime });
        return entry.value;
    }
    /**
     * Set workflow result in cache
     */
    set(workflowName, context, result, options) {
        const key = this.generateKey(workflowName, context);
        const size = this.estimateSize(result);
        const ttl = options?.ttl || this.config.ttl;
        const tags = options?.tags || [workflowName];
        // Check if we need to evict entries
        while (this.shouldEvict(size)) {
            this.evict();
        }
        const entry = {
            key,
            value: result,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl,
            hits: 0,
            size,
            tags,
        };
        // Remove old entry if exists
        const oldEntry = this.cache.get(key);
        if (oldEntry) {
            this.stats.totalSize -= oldEntry.size;
            this.stats.totalEntries--;
        }
        // Add new entry
        this.cache.set(key, entry);
        this.stats.totalEntries++;
        this.stats.totalSize += size;
        this.updateAccessOrder(key);
        this.accessFrequency.set(key, 0);
        this.emit('cache_set', { key, workflowName, size, ttl });
    }
    /**
     * Check if eviction is needed
     */
    shouldEvict(newSize) {
        return (this.stats.totalSize + newSize > this.config.maxSize ||
            this.stats.totalEntries >= this.config.maxEntries);
    }
    /**
     * Evict entry based on policy
     */
    evict() {
        let keyToEvict = null;
        switch (this.config.evictionPolicy) {
            case 'lru':
                keyToEvict = this.evictLRU();
                break;
            case 'lfu':
                keyToEvict = this.evictLFU();
                break;
            case 'fifo':
                keyToEvict = this.evictFIFO();
                break;
        }
        if (keyToEvict) {
            const entry = this.cache.get(keyToEvict);
            if (entry) {
                this.cache.delete(keyToEvict);
                this.removeFromAccessOrder(keyToEvict);
                this.accessFrequency.delete(keyToEvict);
                this.stats.totalEntries--;
                this.stats.totalSize -= entry.size;
                this.stats.evictions++;
                this.emit('cache_evict', { key: keyToEvict, policy: this.config.evictionPolicy });
            }
        }
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        return this.accessOrder[0] || null;
    }
    /**
     * Evict least frequently used entry
     */
    evictLFU() {
        let minFrequency = Infinity;
        let keyToEvict = null;
        for (const [key, frequency] of this.accessFrequency) {
            if (frequency < minFrequency) {
                minFrequency = frequency;
                keyToEvict = key;
            }
        }
        return keyToEvict;
    }
    /**
     * Evict first in, first out
     */
    evictFIFO() {
        // Find oldest entry by timestamp
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        return oldestKey;
    }
    /**
     * Update access order for LRU
     */
    updateAccessOrder(key) {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }
    /**
     * Remove from access order
     */
    removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index !== -1) {
            this.accessOrder.splice(index, 1);
        }
    }
    /**
     * Update access frequency for LFU
     */
    updateAccessFrequency(key) {
        const freq = this.accessFrequency.get(key) || 0;
        this.accessFrequency.set(key, freq + 1);
    }
    /**
     * Estimate size of result in bytes
     */
    estimateSize(result) {
        return JSON.stringify(result).length * 2; // Rough estimate (UTF-16)
    }
    /**
     * Update hit rate
     */
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
    /**
     * Invalidate cache entry
     */
    invalidate(workflowName, context) {
        const key = this.generateKey(workflowName, context);
        const entry = this.cache.get(key);
        if (entry) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            this.accessFrequency.delete(key);
            this.stats.totalEntries--;
            this.stats.totalSize -= entry.size;
            this.emit('cache_invalidate', { key, workflowName });
            return true;
        }
        return false;
    }
    /**
     * Invalidate by tag
     */
    invalidateByTag(tag) {
        let count = 0;
        for (const [key, entry] of this.cache) {
            if (entry.tags.includes(tag)) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                this.accessFrequency.delete(key);
                this.stats.totalEntries--;
                this.stats.totalSize -= entry.size;
                count++;
            }
        }
        if (count > 0) {
            this.emit('cache_invalidate_by_tag', { tag, count });
        }
        return count;
    }
    /**
     * Invalidate all entries
     */
    invalidateAll() {
        const count = this.cache.size;
        this.cache.clear();
        this.accessOrder = [];
        this.accessFrequency.clear();
        this.stats.totalEntries = 0;
        this.stats.totalSize = 0;
        this.emit('cache_invalidate_all', { count });
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get cache entries (for debugging)
     */
    getEntries() {
        const now = Date.now();
        const entries = [];
        for (const [key, entry] of this.cache) {
            entries.push({
                key,
                size: entry.size,
                hits: entry.hits,
                age: now - entry.timestamp,
                tags: entry.tags,
            });
        }
        return entries.sort((a, b) => b.hits - a.hits);
    }
    /**
     * Start periodic cleanup
     */
    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, 60000); // Every minute
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                this.accessFrequency.delete(key);
                this.stats.totalEntries--;
                this.stats.totalSize -= entry.size;
                removed++;
            }
        }
        if (removed > 0) {
            this.emit('cache_cleanup', { removed });
        }
    }
    /**
     * Warm cache with frequently used workflows
     */
    async warm(workflows) {
        for (const workflow of workflows) {
            this.set(workflow.name, workflow.context, workflow.result, {
                tags: [workflow.name, 'warmed'],
            });
        }
        this.emit('cache_warmed', { count: workflows.length });
    }
    /**
     * Export cache for persistence (future: Redis integration)
     */
    export() {
        const exported = [];
        for (const [key, entry] of this.cache) {
            exported.push({
                key,
                value: entry.value,
                metadata: {
                    timestamp: entry.timestamp,
                    expiresAt: entry.expiresAt,
                    hits: entry.hits,
                    size: entry.size,
                    tags: entry.tags,
                },
            });
        }
        return exported;
    }
    /**
     * Import cache from persistence
     */
    import(data) {
        let imported = 0;
        for (const item of data) {
            // Skip expired entries
            if (Date.now() > item.metadata.expiresAt) {
                continue;
            }
            this.cache.set(item.key, {
                key: item.key,
                value: item.value,
                timestamp: item.metadata.timestamp,
                expiresAt: item.metadata.expiresAt,
                hits: item.metadata.hits,
                size: item.metadata.size,
                tags: item.metadata.tags,
            });
            this.accessOrder.push(item.key);
            this.accessFrequency.set(item.key, item.metadata.hits);
            this.stats.totalEntries++;
            this.stats.totalSize += item.metadata.size;
            imported++;
        }
        this.emit('cache_imported', { count: imported });
        return imported;
    }
}
//# sourceMappingURL=WorkflowCache.js.map