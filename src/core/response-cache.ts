/**
 * Response Cache - Provider response caching layer
 *
 * Implements a dual-layer caching strategy:
 * - L1: In-memory LRU cache for fast access
 * - L2: SQLite persistent cache for cross-session sharing
 *
 * Features:
 * - Optional (disabled by default)
 * - TTL-based expiration
 * - Size limits
 * - Cache statistics (hit rate, size, entries)
 * - Project-isolated (.automatosx/cache/)
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

/**
 * Cache entry structure
 */
export interface CacheEntry {
  key: string;
  provider: string;
  prompt: string;
  promptHash: string;
  response: string;
  modelParams: string | null; // JSON string of temperature, maxTokens, etc.
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  enabled: boolean;
  totalEntries: number;
  l1Entries: number; // Memory cache
  l2Entries: number; // SQLite cache
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  size: number; // Bytes
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time-to-live in seconds (default: 86400 = 24 hours)
  maxSize: number; // Max L2 (SQLite) entries (default: 1000)
  maxMemorySize: number; // Max L1 (RAM) entries (default: 100)
  dbPath: string; // Path to cache database
}

/**
 * Simple LRU Cache implementation for L1
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Response Cache Manager
 */
export class ResponseCache {
  private db: Database.Database | null = null;
  private config: Required<CacheConfig>;
  private l1Cache: LRUCache<string, CacheEntry>;
  private initialized: boolean = false;

  // Statistics
  private stats = {
    hits: 0,
    misses: 0
  };

  // Prepared statements for performance
  private statements: {
    get?: Database.Statement;
    set?: Database.Statement;
    updateAccess?: Database.Statement;
    delete?: Database.Statement;
    clear?: Database.Statement;
    count?: Database.Statement;
    deleteExpired?: Database.Statement;
    deleteOldest?: Database.Statement;
    getStats?: Database.Statement;
  } = {};

  constructor(config: Partial<CacheConfig>) {
    // Set defaults
    this.config = {
      enabled: config.enabled ?? false, // Disabled by default
      ttl: config.ttl ?? 86400, // 24 hours
      maxSize: config.maxSize ?? 1000,
      maxMemorySize: config.maxMemorySize ?? 100,
      dbPath: config.dbPath ?? '.automatosx/cache/responses.db'
    };

    // Initialize L1 cache
    this.l1Cache = new LRUCache(this.config.maxMemorySize);

    // Only initialize database if enabled
    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize database and create tables
   */
  private initialize(): void {
    if (this.initialized || !this.config.enabled) {
      return;
    }

    try {
      // Ensure directory exists
      const dbDir = dirname(this.config.dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      // Open database
      this.db = new Database(this.config.dbPath);

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      // Create cache table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          prompt TEXT NOT NULL,
          promptHash TEXT NOT NULL,
          response TEXT NOT NULL,
          modelParams TEXT,
          timestamp INTEGER NOT NULL,
          expiresAt INTEGER NOT NULL,
          accessCount INTEGER DEFAULT 0,
          lastAccessedAt INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cache_provider ON cache(provider);
        CREATE INDEX IF NOT EXISTS idx_cache_promptHash ON cache(promptHash);
        CREATE INDEX IF NOT EXISTS idx_cache_expiresAt ON cache(expiresAt);
        CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON cache(timestamp);
      `);

      // Prepare statements
      this.statements.get = this.db.prepare(`
        SELECT * FROM cache WHERE key = ? AND expiresAt > ?
      `);

      this.statements.set = this.db.prepare(`
        INSERT OR REPLACE INTO cache (
          key, provider, prompt, promptHash, response, modelParams,
          timestamp, expiresAt, accessCount, lastAccessedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.statements.updateAccess = this.db.prepare(`
        UPDATE cache
        SET accessCount = accessCount + 1, lastAccessedAt = ?
        WHERE key = ?
      `);

      this.statements.delete = this.db.prepare(`
        DELETE FROM cache WHERE key = ?
      `);

      this.statements.clear = this.db.prepare(`
        DELETE FROM cache
      `);

      this.statements.count = this.db.prepare(`
        SELECT COUNT(*) as count FROM cache WHERE expiresAt > ?
      `);

      this.statements.deleteExpired = this.db.prepare(`
        DELETE FROM cache WHERE expiresAt <= ?
      `);

      this.statements.deleteOldest = this.db.prepare(`
        DELETE FROM cache WHERE key IN (
          SELECT key FROM cache ORDER BY timestamp ASC LIMIT ?
        )
      `);

      this.statements.getStats = this.db.prepare(`
        SELECT
          COUNT(*) as totalEntries,
          SUM(LENGTH(response)) as totalSize,
          MIN(timestamp) as oldestEntry,
          MAX(timestamp) as newestEntry
        FROM cache
        WHERE expiresAt > ?
      `);

      this.initialized = true;

      logger.info('ResponseCache initialized successfully', {
        dbPath: this.config.dbPath,
        ttl: this.config.ttl,
        maxSize: this.config.maxSize,
        maxMemorySize: this.config.maxMemorySize
      });

      // Clean up expired entries on initialization
      this.cleanupExpired();
    } catch (error) {
      logger.error('Failed to initialize ResponseCache', { error });
      throw error;
    }
  }

  /**
   * Generate cache key from provider, prompt, and model params
   */
  private generateKey(provider: string, prompt: string, modelParams?: Record<string, any>): string {
    const paramsStr = modelParams ? JSON.stringify(modelParams) : '';
    const data = `${provider}:${prompt}:${paramsStr}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate prompt hash (for indexing)
   */
  private generatePromptHash(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex').substring(0, 16);
  }

  /**
   * Get cached response
   */
  get(provider: string, prompt: string, modelParams?: Record<string, any>): string | null {
    if (!this.config.enabled || !this.initialized) {
      return null;
    }

    const key = this.generateKey(provider, prompt, modelParams);
    const now = Date.now();

    // Try L1 cache first (memory)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiresAt > now) {
      this.stats.hits++;
      logger.debug('Cache hit (L1)', { provider, key: key.substring(0, 8) });

      // Update access stats in L2 (background, non-blocking)
      if (this.statements.updateAccess) {
        try {
          this.statements.updateAccess.run(now, key);
        } catch (error) {
          // Non-critical, just log
          logger.debug('Failed to update access stats', { error });
        }
      }

      return l1Entry.response;
    }

    // Try L2 cache (SQLite)
    if (this.statements.get) {
      try {
        const entry = this.statements.get.get(key, now) as CacheEntry | undefined;

        if (entry) {
          this.stats.hits++;
          logger.debug('Cache hit (L2)', { provider, key: key.substring(0, 8) });

          // Promote to L1
          this.l1Cache.set(key, entry);

          // Update access stats
          if (this.statements.updateAccess) {
            this.statements.updateAccess.run(now, key);
          }

          return entry.response;
        }
      } catch (error) {
        logger.error('Failed to get from cache', { error, provider, key: key.substring(0, 8) });
      }
    }

    // Cache miss
    this.stats.misses++;
    logger.debug('Cache miss', { provider, key: key.substring(0, 8) });
    return null;
  }

  /**
   * Set cached response
   */
  set(provider: string, prompt: string, response: string, modelParams?: Record<string, any>): void {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    const key = this.generateKey(provider, prompt, modelParams);
    const promptHash = this.generatePromptHash(prompt);
    const now = Date.now();
    const expiresAt = now + (this.config.ttl * 1000);
    const modelParamsStr = modelParams ? JSON.stringify(modelParams) : null;

    const entry: CacheEntry = {
      key,
      provider,
      prompt,
      promptHash,
      response,
      modelParams: modelParamsStr,
      timestamp: now,
      expiresAt,
      accessCount: 0,
      lastAccessedAt: now
    };

    // Set in L1 (memory)
    this.l1Cache.set(key, entry);

    // Set in L2 (SQLite)
    if (this.statements.set) {
      try {
        this.statements.set.run(
          entry.key,
          entry.provider,
          entry.prompt,
          entry.promptHash,
          entry.response,
          entry.modelParams,
          entry.timestamp,
          entry.expiresAt,
          entry.accessCount,
          entry.lastAccessedAt
        );

        logger.debug('Cache set', { provider, key: key.substring(0, 8) });

        // Check if we need to evict old entries
        this.checkAndEvict();
      } catch (error) {
        logger.error('Failed to set cache', { error, provider, key: key.substring(0, 8) });
      }
    }
  }

  /**
   * Check cache size and evict if necessary
   */
  private checkAndEvict(): void {
    if (!this.statements.count || !this.statements.deleteOldest) {
      return;
    }

    try {
      const result = this.statements.count.get(Date.now()) as { count: number } | undefined;
      const count = result?.count ?? 0;

      if (count > this.config.maxSize) {
        const toDelete = count - Math.floor(this.config.maxSize * 0.8); // Keep 80%
        this.statements.deleteOldest.run(toDelete);

        logger.info('Cache eviction', {
          deleted: toDelete,
          remaining: this.config.maxSize * 0.8
        });
      }
    } catch (error) {
      logger.error('Failed to evict cache entries', { error });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    if (!this.statements.deleteExpired) {
      return;
    }

    try {
      const result = this.statements.deleteExpired.run(Date.now());
      if (result.changes > 0) {
        logger.info('Cache expired cleanup', { deleted: result.changes });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired entries', { error });
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    if (!this.config.enabled) {
      return;
    }

    // Clear L1
    this.l1Cache.clear();

    // Clear L2
    if (this.statements.clear) {
      try {
        this.statements.clear.run();
        logger.info('Cache cleared');
      } catch (error) {
        logger.error('Failed to clear cache', { error });
      }
    }

    // Reset stats
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const defaultStats: CacheStats = {
      enabled: this.config.enabled,
      totalEntries: 0,
      l1Entries: this.l1Cache.size,
      l2Entries: 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0,
      size: 0,
      oldestEntry: null,
      newestEntry: null
    };

    if (!this.config.enabled || !this.initialized || !this.statements.getStats) {
      return defaultStats;
    }

    try {
      const result = this.statements.getStats.get(Date.now()) as {
        totalEntries: number;
        totalSize: number;
        oldestEntry: number | null;
        newestEntry: number | null;
      } | undefined;

      if (result) {
        return {
          enabled: this.config.enabled,
          totalEntries: result.totalEntries,
          l1Entries: this.l1Cache.size,
          l2Entries: result.totalEntries,
          totalHits: this.stats.hits,
          totalMisses: this.stats.misses,
          hitRate: this.stats.hits + this.stats.misses > 0
            ? this.stats.hits / (this.stats.hits + this.stats.misses)
            : 0,
          size: result.totalSize,
          oldestEntry: result.oldestEntry,
          newestEntry: result.newestEntry
        };
      }
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
    }

    return defaultStats;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      try {
        // Clear prepared statements explicitly
        // (Note: better-sqlite3 does this automatically on db.close(),
        //  but being explicit is clearer and more defensive)
        this.statements = {};

        this.db.close();
        this.db = null;
        this.initialized = false;
        logger.info('ResponseCache closed');
      } catch (error) {
        logger.error('Failed to close ResponseCache', { error });
      }
    }
  }

  /**
   * Check if cache is enabled
   */
  get isEnabled(): boolean {
    return this.config.enabled;
  }
}
