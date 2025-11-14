/**
 * MemoryCache - LRU cache for conversation and message data
 * Provides fast access to frequently accessed memory items
 */
/**
 * LRU Cache implementation with TTL support
 */
export class MemoryCache {
    constructor(options = {}) {
        this.conversations = new Map();
        this.conversationsWithMessages = new Map();
        this.messages = new Map();
        this.searchResults = new Map();
        // Statistics
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.maxSize = options.maxSize || 1000;
        this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes default
        this.enableStats = options.enableStats !== false;
    }
    // ============================================================================
    // Conversation Cache
    // ============================================================================
    /**
     * Get conversation from cache
     */
    getConversation(id) {
        const entry = this.conversations.get(id);
        if (!entry) {
            this.recordMiss();
            return null;
        }
        // Check TTL
        if (this.isExpired(entry)) {
            this.conversations.delete(id);
            this.recordMiss();
            return null;
        }
        // Update access metadata
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        this.recordHit();
        return entry.value;
    }
    /**
     * Set conversation in cache
     */
    setConversation(id, conversation) {
        this.evictIfNeeded(this.conversations);
        this.conversations.set(id, {
            key: id,
            value: conversation,
            accessCount: 0,
            lastAccessedAt: Date.now(),
            createdAt: Date.now(),
            size: this.estimateSize(conversation),
        });
    }
    /**
     * Delete conversation from cache
     */
    deleteConversation(id) {
        this.conversations.delete(id);
        this.conversationsWithMessages.delete(id);
    }
    // ============================================================================
    // Conversation with Messages Cache
    // ============================================================================
    /**
     * Get conversation with messages from cache
     */
    getConversationWithMessages(id) {
        const entry = this.conversationsWithMessages.get(id);
        if (!entry) {
            this.recordMiss();
            return null;
        }
        if (this.isExpired(entry)) {
            this.conversationsWithMessages.delete(id);
            this.recordMiss();
            return null;
        }
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        this.recordHit();
        return entry.value;
    }
    /**
     * Set conversation with messages in cache
     */
    setConversationWithMessages(id, conversation) {
        this.evictIfNeeded(this.conversationsWithMessages);
        this.conversationsWithMessages.set(id, {
            key: id,
            value: conversation,
            accessCount: 0,
            lastAccessedAt: Date.now(),
            createdAt: Date.now(),
            size: this.estimateSize(conversation),
        });
    }
    // ============================================================================
    // Message Cache
    // ============================================================================
    /**
     * Get message from cache
     */
    getMessage(id) {
        const entry = this.messages.get(id);
        if (!entry) {
            this.recordMiss();
            return null;
        }
        if (this.isExpired(entry)) {
            this.messages.delete(id);
            this.recordMiss();
            return null;
        }
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        this.recordHit();
        return entry.value;
    }
    /**
     * Set message in cache
     */
    setMessage(id, message) {
        this.evictIfNeeded(this.messages);
        this.messages.set(id, {
            key: id,
            value: message,
            accessCount: 0,
            lastAccessedAt: Date.now(),
            createdAt: Date.now(),
            size: this.estimateSize(message),
        });
    }
    /**
     * Delete message from cache
     */
    deleteMessage(id) {
        this.messages.delete(id);
    }
    // ============================================================================
    // Search Results Cache
    // ============================================================================
    /**
     * Get search results from cache
     */
    getSearchResults(query) {
        const cacheKey = this.getSearchCacheKey(query);
        const entry = this.searchResults.get(cacheKey);
        if (!entry) {
            this.recordMiss();
            return null;
        }
        if (this.isExpired(entry)) {
            this.searchResults.delete(cacheKey);
            this.recordMiss();
            return null;
        }
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        this.recordHit();
        return entry.value;
    }
    /**
     * Set search results in cache
     */
    setSearchResults(query, results) {
        const cacheKey = this.getSearchCacheKey(query);
        this.evictIfNeeded(this.searchResults);
        this.searchResults.set(cacheKey, {
            key: cacheKey,
            value: results,
            accessCount: 0,
            lastAccessedAt: Date.now(),
            createdAt: Date.now(),
            size: this.estimateSize(results),
        });
    }
    /**
     * Generate cache key for search query
     */
    getSearchCacheKey(query) {
        return `search:${query.toLowerCase().trim()}`;
    }
    // ============================================================================
    // Cache Management
    // ============================================================================
    /**
     * Check if entry is expired
     */
    isExpired(entry) {
        return Date.now() - entry.createdAt > this.ttlMs;
    }
    /**
     * Evict least recently used entry if cache is full
     */
    evictIfNeeded(cache) {
        // Calculate total size across all caches
        const totalSize = this.conversations.size + this.conversationsWithMessages.size +
            this.messages.size + this.searchResults.size;
        if (totalSize < this.maxSize) {
            return;
        }
        // Find LRU entry across all caches
        let lruKey = null;
        let lruTime = Date.now();
        let lruCache = null;
        // Check all caches for LRU entry
        const allCaches = [
            this.conversations,
            this.conversationsWithMessages,
            this.messages,
            this.searchResults,
        ];
        for (const cacheMap of allCaches) {
            for (const [key, entry] of cacheMap) {
                if (entry.lastAccessedAt < lruTime) {
                    lruTime = entry.lastAccessedAt;
                    lruKey = key;
                    lruCache = cacheMap;
                }
            }
        }
        if (lruKey && lruCache) {
            lruCache.delete(lruKey);
            this.evictions++;
        }
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.conversations.clear();
        this.conversationsWithMessages.clear();
        this.messages.clear();
        this.searchResults.clear();
    }
    /**
     * Clear expired entries
     */
    clearExpired() {
        this.clearExpiredFromMap(this.conversations);
        this.clearExpiredFromMap(this.conversationsWithMessages);
        this.clearExpiredFromMap(this.messages);
        this.clearExpiredFromMap(this.searchResults);
    }
    /**
     * Clear expired entries from specific map
     */
    clearExpiredFromMap(cache) {
        const toDelete = [];
        for (const [key, entry] of cache) {
            if (this.isExpired(entry)) {
                toDelete.push(key);
            }
        }
        for (const key of toDelete) {
            cache.delete(key);
        }
    }
    /**
     * Invalidate conversation cache (when updated)
     */
    invalidateConversation(id) {
        this.deleteConversation(id);
    }
    /**
     * Invalidate message cache (when updated)
     */
    invalidateMessage(id) {
        this.deleteMessage(id);
    }
    /**
     * Invalidate search cache (when data changes)
     */
    invalidateSearch() {
        this.searchResults.clear();
    }
    // ============================================================================
    // Statistics
    // ============================================================================
    /**
     * Record cache hit
     */
    recordHit() {
        if (this.enableStats) {
            this.hits++;
        }
    }
    /**
     * Record cache miss
     */
    recordMiss() {
        if (this.enableStats) {
            this.misses++;
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const totalAccesses = this.hits + this.misses;
        const hitRate = totalAccesses > 0 ? (this.hits / totalAccesses) * 100 : 0;
        const size = this.conversations.size + this.conversationsWithMessages.size +
            this.messages.size + this.searchResults.size;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate,
            size,
            maxSize: this.maxSize,
            evictions: this.evictions,
            totalAccesses,
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
     * Get cache size breakdown
     */
    getSizeBreakdown() {
        return {
            conversations: this.conversations.size,
            conversationsWithMessages: this.conversationsWithMessages.size,
            messages: this.messages.size,
            searchResults: this.searchResults.size,
            total: this.conversations.size + this.conversationsWithMessages.size +
                this.messages.size + this.searchResults.size,
        };
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Estimate size of object in bytes (rough approximation)
     */
    estimateSize(obj) {
        const str = JSON.stringify(obj);
        return str.length * 2; // 2 bytes per character (UTF-16)
    }
}
