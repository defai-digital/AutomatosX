/**
 * Task Cache with LRU Eviction
 *
 * Provides in-memory caching for task results with:
 * - LRU (Least Recently Used) eviction policy
 * - Configurable max size and TTL
 * - Hit/miss statistics
 * - Optional key hashing for large payloads
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module core/task-engine/cache
 * @version 1.0.0
 */

import * as crypto from 'node:crypto';
import { logger } from '../../shared/logging/logger.js';

/**
 * Cached task result entry
 */
export interface CacheEntry<T = unknown> {
  /** Cached value */
  value: T;
  /** When the entry was created (ms timestamp) */
  createdAt: number;
  /** When the entry was last accessed (ms timestamp) */
  lastAccessedAt: number;
  /** Number of times this entry was accessed */
  accessCount: number;
  /** Size of the entry in bytes (approximate) */
  sizeBytes: number;
  /** TTL override for this specific entry */
  ttlMs?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Current number of entries */
  size: number;
  /** Maximum allowed entries */
  maxSize: number;
  /** Total bytes stored (approximate) */
  totalBytes: number;
  /** Maximum bytes allowed */
  maxBytes: number;
  /** Number of evictions */
  evictions: number;
  /** Number of expirations */
  expirations: number;
}

/**
 * Cache configuration
 */
export interface TaskCacheConfig {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Maximum total size in bytes (default: 50MB) */
  maxBytes?: number;
  /** Default TTL in milliseconds (default: 3600000 = 1 hour) */
  defaultTtlMs?: number;
  /** Enable entry size calculation (default: true) */
  trackSize?: boolean;
  /** Clean interval in milliseconds (default: 60000 = 1 minute) */
  cleanIntervalMs?: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: Required<TaskCacheConfig> = {
  maxSize: 1000,
  maxBytes: 50 * 1024 * 1024, // 50MB
  defaultTtlMs: 3600000, // 1 hour
  trackSize: true,
  cleanIntervalMs: 60000 // 1 minute
};

/**
 * Deep sort object keys for stable JSON serialization
 * Ensures { a: 1, b: 2 } and { b: 2, a: 1 } produce the same JSON string
 */
function deepSortKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Generate a cache key from task parameters
 * Uses deep-sorted keys for stable serialization
 */
export function generateCacheKey(
  type: string,
  payload: Record<string, unknown>,
  engine?: string
): string {
  // Deep sort all keys for stable serialization
  const keyObject = deepSortKeys({
    engine: engine ?? 'auto',
    payload,
    type
  });
  const json = JSON.stringify(keyObject);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
}

/**
 * LRU Cache for task results
 */
export class TaskCache<T = unknown> {
  private readonly cache: Map<string, CacheEntry<T>>;
  private readonly config: Required<TaskCacheConfig>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
    totalBytes: number;
  };
  private cleanTimer: NodeJS.Timeout | null = null;

  constructor(config: TaskCacheConfig = {}) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      totalBytes: 0
    };

    // Start periodic cleanup
    if (this.config.cleanIntervalMs > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    const ttl = entry.ttlMs ?? this.config.defaultTtlMs;
    if (Date.now() - entry.createdAt > ttl) {
      this.delete(key);
      this.stats.misses++;
      this.stats.expirations++;
      return undefined;
    }

    // Update access stats
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const sizeBytes = this.config.trackSize ? this.estimateSize(value) : 0;

    // Remove existing entry FIRST to get accurate capacity calculation
    // This prevents unnecessary evictions when updating existing keys
    const existing = this.cache.get(key);
    if (existing) {
      this.stats.totalBytes -= existing.sizeBytes;
      this.cache.delete(key);
    }

    // Check if we need to evict (now that existing entry is removed)
    this.ensureCapacity(sizeBytes);

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      sizeBytes,
      ttlMs
    };

    this.cache.set(key, entry);
    this.stats.totalBytes += sizeBytes;

    logger.debug('[TaskCache] Entry set', {
      key: key.slice(0, 8) + '...',
      sizeBytes,
      ttlMs: ttlMs ?? this.config.defaultTtlMs
    });
  }

  /**
   * Check if key exists (without updating access stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    const ttl = entry.ttlMs ?? this.config.defaultTtlMs;
    if (Date.now() - entry.createdAt > ttl) {
      this.delete(key);
      this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete an entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.totalBytes -= entry.sizeBytes;
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.totalBytes = 0;
    logger.debug('[TaskCache] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalBytes: this.stats.totalBytes,
      maxBytes: this.config.maxBytes,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.stats.expirations = 0;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Shutdown cache (stop timers)
   */
  shutdown(): void {
    if (this.cleanTimer) {
      clearInterval(this.cleanTimer);
      this.cleanTimer = null;
    }
    this.clear();
  }

  /**
   * Ensure capacity for new entry
   */
  private ensureCapacity(newEntrySize: number): void {
    // Evict by count if needed
    while (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Evict by size if needed
    while (this.stats.totalBytes + newEntrySize > this.config.maxBytes && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    // Map maintains insertion order, first key is LRU
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey);
      if (entry) {
        this.stats.totalBytes -= entry.sizeBytes;
      }
      this.cache.delete(firstKey);
      this.stats.evictions++;

      logger.debug('[TaskCache] LRU eviction', {
        key: firstKey.slice(0, 8) + '...'
      });
    }
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: T): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf-8');
    } catch {
      return 0;
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanTimer = setInterval(() => {
      this.cleanExpired();
    }, this.config.cleanIntervalMs);

    // Don't prevent process exit
    if (this.cleanTimer.unref) {
      this.cleanTimer.unref();
    }
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      const ttl = entry.ttlMs ?? this.config.defaultTtlMs;
      if (now - entry.createdAt > ttl) {
        this.stats.totalBytes -= entry.sizeBytes;
        this.cache.delete(key);
        this.stats.expirations++;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('[TaskCache] Expired entries cleaned', { count: cleaned });
    }
  }
}

/**
 * Global task cache instance
 */
let globalTaskCache: TaskCache | null = null;

/**
 * Get or create the global task cache
 */
export function getTaskCache(config?: TaskCacheConfig): TaskCache {
  if (!globalTaskCache) {
    globalTaskCache = new TaskCache(config);
  }
  return globalTaskCache;
}

/**
 * Reset the global task cache
 */
export function resetTaskCache(): void {
  if (globalTaskCache) {
    globalTaskCache.shutdown();
    globalTaskCache = null;
  }
}

/**
 * Create a new task cache instance
 */
export function createTaskCache(config?: TaskCacheConfig): TaskCache {
  return new TaskCache(config);
}
