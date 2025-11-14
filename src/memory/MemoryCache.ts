/**
 * MemoryCache - LRU cache for conversation and message data
 * Provides fast access to frequently accessed memory items
 */

import type { Conversation, Message, ConversationWithMessages } from '../types/schemas/memory.schema.js';

interface CacheEntry<T> {
  key: string;
  value: T;
  accessCount: number;
  lastAccessedAt: number;
  createdAt: number;
  size: number; // Approximate size in bytes
}

export interface MemoryCacheOptions {
  maxSize?: number; // Maximum number of items
  ttlMs?: number; // Time to live in milliseconds
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
export class MemoryCache {
  private conversations: Map<string, CacheEntry<Conversation>> = new Map();
  private conversationsWithMessages: Map<string, CacheEntry<ConversationWithMessages>> = new Map();
  private messages: Map<string, CacheEntry<Message>> = new Map();
  private searchResults: Map<string, CacheEntry<Message[]>> = new Map();

  private maxSize: number;
  private ttlMs: number;
  private enableStats: boolean;

  // Statistics
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: MemoryCacheOptions = {}) {
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
  getConversation(id: string): Conversation | null {
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
  setConversation(id: string, conversation: Conversation): void {
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
  deleteConversation(id: string): void {
    this.conversations.delete(id);
    this.conversationsWithMessages.delete(id);
  }

  // ============================================================================
  // Conversation with Messages Cache
  // ============================================================================

  /**
   * Get conversation with messages from cache
   */
  getConversationWithMessages(id: string): ConversationWithMessages | null {
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
  setConversationWithMessages(id: string, conversation: ConversationWithMessages): void {
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
  getMessage(id: string): Message | null {
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
  setMessage(id: string, message: Message): void {
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
  deleteMessage(id: string): void {
    this.messages.delete(id);
  }

  // ============================================================================
  // Search Results Cache
  // ============================================================================

  /**
   * Get search results from cache
   */
  getSearchResults(query: string): Message[] | null {
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
  setSearchResults(query: string, results: Message[]): void {
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
  private getSearchCacheKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Check if entry is expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > this.ttlMs;
  }

  /**
   * Evict least recently used entry if cache is full
   */
  private evictIfNeeded<T>(cache: Map<string, CacheEntry<T>>): void {
    // Calculate total size across all caches
    const totalSize = this.conversations.size + this.conversationsWithMessages.size +
                      this.messages.size + this.searchResults.size;

    if (totalSize < this.maxSize) {
      return;
    }

    // Find LRU entry across all caches
    let lruKey: string | null = null;
    let lruTime = Date.now();
    let lruCache: Map<string, CacheEntry<any>> | null = null;

    // Check all caches for LRU entry
    const allCaches: Array<Map<string, CacheEntry<any>>> = [
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
  clear(): void {
    this.conversations.clear();
    this.conversationsWithMessages.clear();
    this.messages.clear();
    this.searchResults.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    this.clearExpiredFromMap(this.conversations);
    this.clearExpiredFromMap(this.conversationsWithMessages);
    this.clearExpiredFromMap(this.messages);
    this.clearExpiredFromMap(this.searchResults);
  }

  /**
   * Clear expired entries from specific map
   */
  private clearExpiredFromMap<T>(cache: Map<string, CacheEntry<T>>): void {
    const toDelete: string[] = [];

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
  invalidateConversation(id: string): void {
    this.deleteConversation(id);
  }

  /**
   * Invalidate message cache (when updated)
   */
  invalidateMessage(id: string): void {
    this.deleteMessage(id);
  }

  /**
   * Invalidate search cache (when data changes)
   */
  invalidateSearch(): void {
    this.searchResults.clear();
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Record cache hit
   */
  private recordHit(): void {
    if (this.enableStats) {
      this.hits++;
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    if (this.enableStats) {
      this.misses++;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
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
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache size breakdown
   */
  getSizeBreakdown(): {
    conversations: number;
    conversationsWithMessages: number;
    messages: number;
    searchResults: number;
    total: number;
  } {
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
  private estimateSize(obj: unknown): number {
    const str = JSON.stringify(obj);
    return str.length * 2; // 2 bytes per character (UTF-16)
  }
}
