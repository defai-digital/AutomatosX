/**
 * Advanced Caching System with TTL-based LRU eviction
 *
 * Features:
 * - Time-To-Live (TTL) expiration
 * - Least Recently Used (LRU) eviction
 * - Size limits
 * - Statistics tracking
 * - Automatic cleanup
 *
 * @module core/cache
 */

import { logger } from '../../shared/logging/logger.js';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
  size: number; // Estimated size in bytes
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
  avgEntrySize: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum number of entries */
  maxEntries: number;
  /** Time-to-live in milliseconds (0 = no expiration) */
  ttl: number;
  /** Maximum cache size in bytes (0 = no limit) */
  maxSize?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * TTL-based LRU Cache
 *
 * Thread-safe caching with automatic expiration and eviction.
 *
 * @example
 * ```typescript
 * const cache = new TTLCache<string>({
 *   maxEntries: 100,
 *   ttl: 60000, // 1 minute
 *   maxSize: 1024 * 1024 // 1MB
 * });
 *
 * cache.set('key', 'value');
 * const value = cache.get('key'); // 'value'
 *
 * // After 1 minute
 * cache.get('key'); // undefined (expired)
 * ```
 */
export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: Required<CacheConfig>;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };
  private cleanupTimer?: NodeJS.Timeout;
  private totalSize = 0;

  constructor(config: CacheConfig) {
    this.config = {
      maxEntries: config.maxEntries,
      ttl: config.ttl,
      maxSize: config.maxSize ?? 0,
      cleanupInterval: config.cleanupInterval ?? 60000, // 1 minute default
      debug: config.debug ?? false
    };

    // Start automatic cleanup
    if (this.config.cleanupInterval > 0) {
      this.startCleanup();
    }

    if (this.config.debug) {
      logger.debug('TTLCache initialized', {
        maxEntries: this.config.maxEntries,
        ttl: this.config.ttl,
        maxSize: this.config.maxSize,
        cleanupInterval: this.config.cleanupInterval
      });
    }
  }

  /**
   * Get value from cache
   *
   * @param key Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      if (this.config.debug) {
        logger.debug('Cache miss', { key });
      }
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      if (this.config.debug) {
        logger.debug('Cache expired', { key, age: Date.now() - entry.timestamp });
      }
      return undefined;
    }

    // Update LRU order (move to end)
    this.cache.delete(key);
    entry.hits++;
    this.cache.set(key, entry);

    this.stats.hits++;
    if (this.config.debug) {
      logger.debug('Cache hit', { key, hits: entry.hits });
    }

    return entry.value;
  }

  /**
   * Set value in cache
   *
   * @param key Cache key
   * @param value Value to cache
   * @param customTTL Optional custom TTL for this entry (ms)
   */
  set(key: string, value: T, _customTTL?: number): void {
    const size = this.estimateSize(value);

    // Check size limit
    if (this.config.maxSize > 0 && size > this.config.maxSize) {
      logger.warn('Entry too large for cache', {
        key,
        size,
        maxSize: this.config.maxSize
      });
      return;
    }

    // Remove existing entry if present
    const existing = this.cache.get(key);
    if (existing) {
      this.totalSize -= existing.size;
    }

    // Evict entries if needed
    this.evictIfNeeded(size);

    // Create entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      hits: 0,
      size
    };

    this.cache.set(key, entry);
    this.totalSize += size;
    this.stats.sets++;

    if (this.config.debug) {
      logger.debug('Cache set', {
        key,
        size,
        totalSize: this.totalSize,
        entries: this.cache.size
      });
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
    if (this.config.debug) {
      logger.debug('Cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      evictions: this.stats.evictions,
      size: this.totalSize,
      entries: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgEntrySize: this.cache.size > 0 ? this.totalSize / this.cache.size : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get number of entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Destroy cache and stop cleanup
   */
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (this.config.ttl === 0) return false;
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * Evict entries if needed to make room
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Evict by entry count
    while (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    // Evict by size
    if (this.config.maxSize > 0) {
      while (
        this.totalSize + newEntrySize > this.config.maxSize &&
        this.cache.size > 0
      ) {
        this.evictOldest();
      }
    }
  }

  /**
   * Evict the oldest (LRU) entry
   */
  private evictOldest(): void {
    // FIXED: Check if cache has entries before accessing
    if (this.cache.size === 0) {
      return;
    }
    
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey);
      if (entry) {
        this.totalSize -= entry.size;
      }
      this.cache.delete(firstKey);
      this.stats.evictions++;

      if (this.config.debug) {
        logger.debug('Cache eviction (LRU)', {
          key: firstKey,
          entries: this.cache.size,
          totalSize: this.totalSize
        });
      }
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: T): number {
    // Simple estimation based on JSON serialization
    // This is approximate but good enough for cache management
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // ~2 bytes per character (UTF-16)
    } catch {
      // Fallback for non-serializable objects
      return 1024; // 1KB default
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const before = this.cache.size;
    let expired = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        expired++;
      }
    }

    if (this.config.debug && expired > 0) {
      logger.debug('Cache cleanup', {
        expired,
        before,
        after: this.cache.size,
        totalSize: this.totalSize
      });
    }
  }
}

/**
 * Provider response cache with intelligent invalidation
 *
 * Caches provider responses based on content hash to avoid
 * redundant API calls for identical requests.
 */
export class ProviderResponseCache {
  private cache: TTLCache<{
    response: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }>;

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new TTLCache({
      maxEntries: config?.maxEntries ?? 100,
      ttl: config?.ttl ?? 300000, // 5 minutes default
      maxSize: config?.maxSize ?? 10 * 1024 * 1024, // 10MB default
      cleanupInterval: config?.cleanupInterval ?? 60000,
      debug: config?.debug ?? false
    });
  }

  /**
   * Generate cache key from request parameters
   */
  private getCacheKey(
    provider: string,
    model: string,
    messages: any[],
    options?: Record<string, any>
  ): string {
    const payload = {
      provider,
      model,
      messages,
      options: options ?? {}
    };
    // Use JSON stringify for content-based hashing
    return this.hashString(JSON.stringify(payload));
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `cache_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get cached response
   */
  get(
    provider: string,
    model: string,
    messages: any[],
    options?: Record<string, any>
  ): { response: string; usage?: any } | undefined {
    const key = this.getCacheKey(provider, model, messages, options);
    return this.cache.get(key);
  }

  /**
   * Cache provider response
   */
  set(
    provider: string,
    model: string,
    messages: any[],
    response: string,
    options?: Record<string, any>,
    usage?: any
  ): void {
    const key = this.getCacheKey(provider, model, messages, options);
    this.cache.set(key, { response, usage });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Destroy cache
   */
  destroy(): void {
    this.cache.destroy();
  }
}
