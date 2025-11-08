/**
 * SimpleQueryCache.ts
 *
 * Lightweight in-memory cache for query results with TTL and size limits
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time-to-live in milliseconds
}

/**
 * Simple LRU cache with TTL support
 * Uses Map to maintain insertion order
 */
export class SimpleQueryCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 300000; // 5 minutes default
    this.cache = new Map();
  }

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
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
  set(key: string, value: T): void {
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
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

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
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
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
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Prune expired entries
   * Returns number of entries removed
   */
  prune(): number {
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
