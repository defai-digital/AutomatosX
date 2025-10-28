/**
 * SpecCache - LRU cache for parsed specs
 *
 * Provides fast access to parsed specs with LRU eviction
 * Keyed by checksum + workspace path for invalidation
 * Thread-safe with hit/miss telemetry
 *
 * @module core/spec/SpecCache
 */

import type { SpecCacheEntry, SpecMetadata, ParsedSpec } from '../../types/spec.js';
import { logger } from '../../utils/logger.js';

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries in cache */
  size: number;

  /** Maximum cache size */
  maxSize: number;

  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Hit rate (0-1) */
  hitRate: number;

  /** Total bytes in cache (approximate) */
  totalBytes: number;

  /** Average entry size (bytes) */
  avgEntrySize: number;
}

/**
 * Cache entry with LRU tracking
 */
interface CacheEntryInternal extends SpecCacheEntry {
  /** Size in bytes (approximate) */
  sizeBytes: number;

  /** Previous entry in LRU list */
  prev: CacheEntryInternal | null;

  /** Next entry in LRU list */
  next: CacheEntryInternal | null;
}

/**
 * SpecCache options
 */
export interface SpecCacheOptions {
  /** Maximum number of entries */
  maxSize?: number;

  /** Maximum total bytes */
  maxBytes?: number;

  /** Enable telemetry */
  enableTelemetry?: boolean;
}

/**
 * Default cache options
 */
const DEFAULT_OPTIONS: Required<SpecCacheOptions> = {
  maxSize: 100,
  maxBytes: 100 * 1024 * 1024, // 100MB
  enableTelemetry: true
};

/**
 * SpecCache class
 * Implements LRU cache with size and byte limits
 */
export class SpecCache {
  private options: Required<SpecCacheOptions>;
  private cache: Map<string, CacheEntryInternal>;
  private head: CacheEntryInternal | null;
  private tail: CacheEntryInternal | null;
  private totalBytes: number;
  private hits: number;
  private misses: number;

  constructor(options?: SpecCacheOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.totalBytes = 0;
    this.hits = 0;
    this.misses = 0;

    logger.info('SpecCache initialized', {
      maxSize: this.options.maxSize,
      maxBytes: this.options.maxBytes
    });
  }

  /**
   * Generate cache key from workspace path and checksum
   */
  private static generateKey(workspacePath: string, checksum: string): string {
    return `${workspacePath}:${checksum}`;
  }

  /**
   * Generate cache key from metadata
   */
  static keyFromMetadata(metadata: SpecMetadata): string {
    return this.generateKey(metadata.workspacePath, metadata.checksum);
  }

  /**
   * Estimate entry size in bytes
   */
  private estimateSize(spec: ParsedSpec): number {
    // Approximate size calculation
    const contentSize =
      spec.content.spec.length +
      spec.content.plan.length +
      spec.content.tasks.length;

    const tasksSize = spec.tasks.reduce((sum, task) => {
      return sum +
        task.id.length +
        task.title.length +
        (task.description?.length || 0) +
        task.ops.length +
        task.deps.join(',').length +
        task.labels.join(',').length;
    }, 0);

    // Add overhead for objects and metadata
    const overhead = 1024; // 1KB overhead per entry

    return contentSize + tasksSize + overhead;
  }

  /**
   * Move entry to head (most recently used)
   */
  private moveToHead(entry: CacheEntryInternal): void {
    if (entry === this.head) {
      return;
    }

    // Remove from current position
    if (entry.prev) {
      entry.prev.next = entry.next;
    }
    if (entry.next) {
      entry.next.prev = entry.prev;
    }
    if (entry === this.tail) {
      this.tail = entry.prev;
    }

    // Move to head
    entry.prev = null;
    entry.next = this.head;
    if (this.head) {
      this.head.prev = entry;
    }
    this.head = entry;

    // Set tail if this is the first entry
    if (!this.tail) {
      this.tail = entry;
    }
  }

  /**
   * Remove entry from LRU list
   */
  private removeFromList(entry: CacheEntryInternal): void {
    if (entry.prev) {
      entry.prev.next = entry.next;
    } else {
      this.head = entry.next;
    }

    if (entry.next) {
      entry.next.prev = entry.prev;
    } else {
      this.tail = entry.prev;
    }

    entry.prev = null;
    entry.next = null;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const key = SpecCache.keyFromMetadata(this.tail.metadata);
    const entry = this.tail;

    logger.debug('Evicting LRU entry', {
      specId: entry.metadata.id,
      checksum: entry.metadata.checksum,
      sizeBytes: entry.sizeBytes
    });

    this.removeFromList(entry);
    this.cache.delete(key);
    this.totalBytes -= entry.sizeBytes;
  }

  /**
   * Ensure cache size limits
   */
  private ensureLimits(): void {
    // Evict by count
    while (this.cache.size > this.options.maxSize) {
      this.evictLRU();
    }

    // Evict by bytes
    while (this.totalBytes > this.options.maxBytes && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Get entry from cache
   */
  get(workspacePath: string, checksum: string): ParsedSpec | null {
    const key = SpecCache.generateKey(workspacePath, checksum);
    const entry = this.cache.get(key);

    if (entry) {
      // Update access tracking
      entry.lastAccessedAt = new Date();
      entry.accessCount++;

      // Move to head (most recently used)
      this.moveToHead(entry);

      // Update telemetry
      if (this.options.enableTelemetry) {
        this.hits++;
      }

      logger.debug('Cache hit', {
        specId: entry.metadata.id,
        checksum,
        accessCount: entry.accessCount
      });

      return entry.spec;
    }

    // Update telemetry
    if (this.options.enableTelemetry) {
      this.misses++;
    }

    logger.debug('Cache miss', { workspacePath, checksum });
    return null;
  }

  /**
   * Set entry in cache
   */
  set(spec: ParsedSpec): void {
    const key = SpecCache.keyFromMetadata(spec.metadata);
    const sizeBytes = this.estimateSize(spec);

    // Check if entry already exists
    const existing = this.cache.get(key);
    if (existing) {
      // Save old size before updating
      const oldSize = existing.sizeBytes;

      // Update existing entry
      existing.spec = spec;
      existing.lastAccessedAt = new Date();
      existing.sizeBytes = sizeBytes;

      // Update total bytes with correct old size
      this.totalBytes = this.totalBytes - oldSize + sizeBytes;

      // Move to head
      this.moveToHead(existing);

      logger.debug('Cache entry updated', {
        specId: spec.metadata.id,
        checksum: spec.metadata.checksum,
        sizeBytes
      });
      return;
    }

    // Create new entry
    const entry: CacheEntryInternal = {
      metadata: spec.metadata,
      spec,
      lastAccessedAt: new Date(),
      accessCount: 0,
      sizeBytes,
      prev: null,
      next: null
    };

    // Add to cache
    this.cache.set(key, entry);
    this.totalBytes += sizeBytes;

    // Add to head of LRU list
    entry.next = this.head;
    if (this.head) {
      this.head.prev = entry;
    }
    this.head = entry;
    if (!this.tail) {
      this.tail = entry;
    }

    // Ensure limits
    this.ensureLimits();

    logger.debug('Cache entry added', {
      specId: spec.metadata.id,
      checksum: spec.metadata.checksum,
      sizeBytes,
      cacheSize: this.cache.size
    });
  }

  /**
   * Invalidate specific entry
   */
  invalidate(workspacePath: string, checksum: string): boolean {
    const key = SpecCache.generateKey(workspacePath, checksum);
    const entry = this.cache.get(key);

    if (entry) {
      this.removeFromList(entry);
      this.cache.delete(key);
      this.totalBytes -= entry.sizeBytes;

      logger.info('Cache entry invalidated', {
        specId: entry.metadata.id,
        checksum
      });
      return true;
    }

    return false;
  }

  /**
   * Invalidate all entries for a workspace
   */
  invalidateWorkspace(workspacePath: string): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.workspacePath === workspacePath) {
        this.removeFromList(entry);
        this.cache.delete(key);
        this.totalBytes -= entry.sizeBytes;
        count++;
      }
    }

    if (count > 0) {
      logger.info('Workspace cache invalidated', {
        workspacePath,
        entriesRemoved: count
      });
    }

    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.totalBytes = 0;

    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    const avgEntrySize = this.cache.size > 0 ? this.totalBytes / this.cache.size : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      totalBytes: this.totalBytes,
      avgEntrySize
    };
  }

  /**
   * Get all cached spec IDs
   */
  getCachedSpecs(): SpecMetadata[] {
    return Array.from(this.cache.values()).map(entry => entry.metadata);
  }

  /**
   * Check if spec is cached
   */
  has(workspacePath: string, checksum: string): boolean {
    const key = SpecCache.generateKey(workspacePath, checksum);
    return this.cache.has(key);
  }

  /**
   * Get cache size in bytes
   */
  getSizeBytes(): number {
    return this.totalBytes;
  }

  /**
   * Get cache size (entry count)
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Reset telemetry counters
   */
  resetTelemetry(): void {
    this.hits = 0;
    this.misses = 0;
    logger.debug('Cache telemetry reset');
  }

  /**
   * Get LRU order (for debugging)
   */
  getLRUOrder(): string[] {
    const order: string[] = [];
    let current = this.head;

    while (current) {
      order.push(current.metadata.id);
      current = current.next;
    }

    return order;
  }
}

/**
 * Global cache instance (singleton)
 */
let globalCache: SpecCache | null = null;

/**
 * Get or create global cache instance
 */
export function getGlobalCache(options?: SpecCacheOptions): SpecCache {
  if (!globalCache) {
    globalCache = new SpecCache(options);
  }
  return globalCache;
}

/**
 * Reset global cache (for testing)
 */
export function resetGlobalCache(): void {
  globalCache = null;
}
