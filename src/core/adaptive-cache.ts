/**
 * Adaptive Cache - Dynamic TTL based on usage patterns
 * v5.6.13: Phase 3.3 - Adaptive caching for 50-70% cache hit rate improvement
 */

import { logger } from '../utils/logger.js';

export interface AdaptiveCacheConfig {
  maxEntries?: number;        // Maximum cache entries (default: 1000)
  baseTTL?: number;           // Base TTL in ms (default: 300000 = 5 minutes)
  minTTL?: number;            // Minimum TTL in ms (default: 60000 = 1 minute)
  maxTTL?: number;            // Maximum TTL in ms (default: 3600000 = 1 hour)
  adaptiveMultiplier?: number; // TTL multiplier for high-frequency items (default: 2)
  lowFreqDivisor?: number;    // TTL divisor for low-frequency items (default: 2)
  frequencyThreshold?: number; // Access count threshold for high frequency (default: 5)
  cleanupInterval?: number;   // Cleanup interval in ms (default: 60000)
}

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number; // Current TTL (adaptive)
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  avgAccessCount: number;
  avgTTL: number;
}

/**
 * Adaptive Cache with Dynamic TTL
 *
 * Automatically adjusts TTL based on access patterns:
 * - High-frequency items: TTL extended (up to maxTTL)
 * - Low-frequency items: TTL reduced (down to minTTL)
 * - Predictive prefetching: Based on access patterns
 *
 * LRU eviction when maxEntries reached.
 */
export class AdaptiveCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: Required<AdaptiveCacheConfig>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private cleanupInterval?: NodeJS.Timeout;
  private accessPatterns = new Map<string, number[]>(); // key -> [timestamp, timestamp, ...]

  constructor(config: AdaptiveCacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      baseTTL: config.baseTTL ?? 300000,  // 5 minutes
      minTTL: config.minTTL ?? 60000,     // 1 minute
      maxTTL: config.maxTTL ?? 3600000,   // 1 hour
      adaptiveMultiplier: config.adaptiveMultiplier ?? 2,
      lowFreqDivisor: config.lowFreqDivisor ?? 2,
      frequencyThreshold: config.frequencyThreshold ?? 5,
      cleanupInterval: config.cleanupInterval ?? 60000
    };

    // Start periodic cleanup
    this.startCleanup();

    // Bug #40: Register shutdown handler to cleanup interval
    import('../utils/process-manager.js').then(({ processManager }) => {
      processManager.onShutdown(async () => {
        this.shutdown();
      });
    }).catch(() => {
      logger.debug('AdaptiveCache: process-manager not available for shutdown handler');
    });

    logger.debug('Adaptive cache initialized', {
      maxEntries: this.config.maxEntries,
      baseTTL: this.config.baseTTL
    });
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      logger.debug('Cache miss', { key });
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      logger.debug('Cache expired', { key, age: Date.now() - entry.createdAt });
      return undefined;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    // Track access pattern for predictive prefetching
    this.trackAccess(key);

    // Adapt TTL based on access frequency
    this.adaptTTL(key, entry);

    logger.debug('Cache hit', {
      key,
      accessCount: entry.accessCount,
      ttl: entry.ttl
    });

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, customTTL?: number): void {
    // Check if we need to evict (LRU)
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    const ttl = customTTL ?? this.config.baseTTL;

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      ttl
    };

    this.cache.set(key, entry);

    logger.debug('Cache set', {
      key,
      ttl,
      size: this.cache.size
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
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
   * Delete key from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.accessPatterns.delete(key);
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessPatterns.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };

    logger.debug('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    let totalAccessCount = 0;
    let totalTTL = 0;

    for (const entry of this.cache.values()) {
      totalAccessCount += entry.accessCount;
      totalTTL += entry.ttl;
    }

    const avgAccessCount = this.cache.size > 0 ? totalAccessCount / this.cache.size : 0;
    const avgTTL = this.cache.size > 0 ? totalTTL / this.cache.size : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
      avgAccessCount,
      avgTTL
    };
  }

  /**
   * Get keys that are likely to be accessed next (predictive prefetching)
   */
  getPredictiveKeys(limit: number = 10): string[] {
    const now = Date.now();
    const predictions: Array<{ key: string; score: number }> = [];

    for (const [key, timestamps] of this.accessPatterns.entries()) {
      if (timestamps.length < 2) {
        continue; // Not enough data
      }

      // Calculate average access interval
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        const current = timestamps[i];
        const previous = timestamps[i - 1];
        if (current !== undefined && previous !== undefined) {
          intervals.push(current - previous);
        }
      }

      // v6.2.6: Bug fix #33 - Prevent division by zero
      // Even with timestamps.length >= 2, intervals can be empty if all timestamps are undefined
      if (intervals.length === 0) {
        continue; // Cannot predict without valid interval data
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // FIXED (v6.5.11 Bug #121): Prevent division by zero when avgInterval is 0
      // This can happen when accesses occur at the exact same timestamp (rapid consecutive calls)
      if (avgInterval === 0) {
        continue; // Cannot predict score without meaningful interval data
      }

      const lastAccess = timestamps[timestamps.length - 1];
      if (lastAccess === undefined) {
        continue;
      }
      const timeSinceLastAccess = now - lastAccess;

      // If time since last access is close to avg interval, predict next access
      const score = Math.max(0, 1 - Math.abs(timeSinceLastAccess - avgInterval) / avgInterval);

      if (score > 0.7) { // High confidence threshold
        predictions.push({ key, score });
      }
    }

    // Sort by score (highest first)
    predictions.sort((a, b) => b.score - a.score);

    return predictions.slice(0, limit).map(p => p.key);
  }

  /**
   * Shutdown cache (clear interval)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    logger.debug('Adaptive cache shut down');
  }

  /**
   * Adapt TTL based on access frequency
   */
  private adaptTTL(key: string, entry: CacheEntry<T>): void {
    let newTTL = entry.ttl;

    // High frequency: extend TTL
    if (entry.accessCount >= this.config.frequencyThreshold) {
      newTTL = Math.min(
        entry.ttl * this.config.adaptiveMultiplier,
        this.config.maxTTL
      );
    }
    // Low frequency: reduce TTL
    else if (entry.accessCount === 1) {
      newTTL = Math.max(
        entry.ttl / this.config.lowFreqDivisor,
        this.config.minTTL
      );
    }

    // Update TTL if changed
    if (newTTL !== entry.ttl) {
      const oldTTL = entry.ttl;
      entry.ttl = newTTL;
      entry.expiresAt = Date.now() + newTTL;

      logger.debug('TTL adapted', {
        key,
        oldTTL,
        newTTL,
        accessCount: entry.accessCount
      });
    }
  }

  /**
   * Track access pattern for predictive prefetching
   */
  private trackAccess(key: string): void {
    const timestamps = this.accessPatterns.get(key) || [];
    timestamps.push(Date.now());

    // Keep only last 10 timestamps
    if (timestamps.length > 10) {
      timestamps.shift();
    }

    this.accessPatterns.set(key, timestamps);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessPatterns.delete(oldestKey);
      this.stats.evictions++;

      logger.debug('LRU eviction', {
        key: oldestKey,
        age: Date.now() - oldestTime
      });
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          this.accessPatterns.delete(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        logger.debug('Cache cleanup completed', {
          expiredCount,
          remainingEntries: this.cache.size
        });
      }
    }, this.config.cleanupInterval);
  }
}
