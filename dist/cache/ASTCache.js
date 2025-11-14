/**
 * AST Cache
 *
 * LRU cache for parsed Abstract Syntax Trees
 * Keyed by file path + content hash to ensure correctness
 */
import * as crypto from 'crypto';
/**
 * LRU Cache for parsed ASTs
 */
export class ASTCache {
    cache = new Map();
    lruOrder = [];
    maxSize;
    ttl;
    hits = 0;
    misses = 0;
    evictions = 0;
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.ttl = options.ttl || 3600000; // 1 hour default
    }
    /**
     * Compute SHA-256 hash of content
     */
    computeHash(content) {
        return crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')
            .slice(0, 16);
    }
    /**
     * Generate cache key
     */
    getCacheKey(filePath, content) {
        const hash = this.computeHash(content);
        return `${filePath}:${hash}`;
    }
    /**
     * Get cached AST
     */
    get(filePath, content) {
        const key = this.getCacheKey(filePath, content);
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        // Check TTL
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            this.lruOrder = this.lruOrder.filter(k => k !== key);
            this.misses++;
            return null;
        }
        // Update LRU order (move to end = most recently used)
        this.lruOrder = this.lruOrder.filter(k => k !== key);
        this.lruOrder.push(key);
        // Update stats
        entry.hits++;
        this.hits++;
        return entry.ast;
    }
    /**
     * Store AST in cache
     */
    set(filePath, content, ast) {
        const key = this.getCacheKey(filePath, content);
        const hash = this.computeHash(content);
        // If already exists, update
        if (this.cache.has(key)) {
            const entry = this.cache.get(key);
            entry.ast = ast;
            entry.timestamp = Date.now();
            // Move to end of LRU
            this.lruOrder = this.lruOrder.filter(k => k !== key);
            this.lruOrder.push(key);
            return;
        }
        // Evict LRU entry if cache is full
        if (this.cache.size >= this.maxSize) {
            const evictKey = this.lruOrder.shift();
            if (evictKey) {
                this.cache.delete(evictKey);
                this.evictions++;
            }
        }
        // Add new entry
        this.cache.set(key, {
            ast,
            hash,
            filePath,
            timestamp: Date.now(),
            hits: 0,
        });
        this.lruOrder.push(key);
    }
    /**
     * Invalidate all entries for a file path
     */
    invalidate(filePath) {
        const keysToRemove = [];
        for (const [key, entry] of this.cache.entries()) {
            if (entry.filePath === filePath) {
                keysToRemove.push(key);
            }
        }
        for (const key of keysToRemove) {
            this.cache.delete(key);
            this.lruOrder = this.lruOrder.filter(k => k !== key);
        }
    }
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
        this.lruOrder = [];
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
            hitRate: total > 0 ? this.hits / total : 0,
            evictions: this.evictions,
            totalEntries: this.cache.size,
        };
    }
    /**
     * Get top N most accessed files
     */
    getTopFiles(n = 10) {
        const entries = Array.from(this.cache.values());
        entries.sort((a, b) => b.hits - a.hits);
        return entries.slice(0, n).map(e => ({
            filePath: e.filePath,
            hits: e.hits,
        }));
    }
    /**
     * Get cache memory usage estimate (MB)
     */
    getMemoryUsage() {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            // Rough estimate: symbols + metadata
            totalSize += JSON.stringify(entry.ast).length;
            totalSize += entry.filePath.length;
            totalSize += 100; // Overhead
        }
        return totalSize / 1024 / 1024; // Convert to MB
    }
}
//# sourceMappingURL=ASTCache.js.map