/**
 * MemoryCache - LRU cache for conversation and message data
 * Provides fast access to frequently accessed memory items
 */
import type { Conversation, Message, ConversationWithMessages } from '../types/schemas/memory.schema.js';
export interface MemoryCacheOptions {
    maxSize?: number;
    ttlMs?: number;
    enableStats?: boolean;
}
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
    totalAccesses: number;
}
/**
 * LRU Cache implementation with TTL support
 */
export declare class MemoryCache {
    private conversations;
    private conversationsWithMessages;
    private messages;
    private searchResults;
    private maxSize;
    private ttlMs;
    private enableStats;
    private hits;
    private misses;
    private evictions;
    constructor(options?: MemoryCacheOptions);
    /**
     * Get conversation from cache
     */
    getConversation(id: string): Conversation | null;
    /**
     * Set conversation in cache
     */
    setConversation(id: string, conversation: Conversation): void;
    /**
     * Delete conversation from cache
     */
    deleteConversation(id: string): void;
    /**
     * Get conversation with messages from cache
     */
    getConversationWithMessages(id: string): ConversationWithMessages | null;
    /**
     * Set conversation with messages in cache
     */
    setConversationWithMessages(id: string, conversation: ConversationWithMessages): void;
    /**
     * Get message from cache
     */
    getMessage(id: string): Message | null;
    /**
     * Set message in cache
     */
    setMessage(id: string, message: Message): void;
    /**
     * Delete message from cache
     */
    deleteMessage(id: string): void;
    /**
     * Get search results from cache
     */
    getSearchResults(query: string): Message[] | null;
    /**
     * Set search results in cache
     */
    setSearchResults(query: string, results: Message[]): void;
    /**
     * Generate cache key for search query
     */
    private getSearchCacheKey;
    /**
     * Check if entry is expired
     */
    private isExpired;
    /**
     * Evict least recently used entry if cache is full
     */
    private evictIfNeeded;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Clear expired entries
     */
    clearExpired(): void;
    /**
     * Clear expired entries from specific map
     */
    private clearExpiredFromMap;
    /**
     * Invalidate conversation cache (when updated)
     */
    invalidateConversation(id: string): void;
    /**
     * Invalidate message cache (when updated)
     */
    invalidateMessage(id: string): void;
    /**
     * Invalidate search cache (when data changes)
     */
    invalidateSearch(): void;
    /**
     * Record cache hit
     */
    private recordHit;
    /**
     * Record cache miss
     */
    private recordMiss;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get cache size breakdown
     */
    getSizeBreakdown(): {
        conversations: number;
        conversationsWithMessages: number;
        messages: number;
        searchResults: number;
        total: number;
    };
    /**
     * Estimate size of object in bytes (rough approximation)
     */
    private estimateSize;
}
//# sourceMappingURL=MemoryCache.d.ts.map