/**
 * Shared Provider Cache
 *
 * Global cache for provider availability checks to avoid redundant CLI detection
 * across multiple provider instances. Implements TTL-based cache with automatic
 * expiration.
 *
 * This cache is shared across all provider instances to ensure:
 * 1. No redundant CLI detection when creating new provider instances
 * 2. Fast lookups for commands like `ax status` that need quick health checks
 * 3. Consistent availability state across the application
 *
 * @module provider-cache
 * @since v5.6.25
 */

import { logger } from '../../shared/logging/logger.js';

interface CacheEntry {
  available: boolean;
  timestamp: number;
  version?: string;
}

/**
 * Global provider availability cache.
 * Maps provider name to availability status with timestamp.
 */
class ProviderAvailabilityCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Get cached availability for a provider.
   *
   * @param providerName - Provider name (e.g., 'claude-code', 'gemini-cli', 'openai')
   * @param ttl - Time-to-live in milliseconds (default: 30000ms = 30s)
   * @returns Cached availability status, or undefined if cache miss or expired
   */
  get(providerName: string, ttl: number = 30000): boolean | undefined {
    const entry = this.cache.get(providerName);

    if (!entry) {
      logger.debug('Provider cache miss', { providerName, reason: 'not-found' });
      return undefined;
    }

    const age = Date.now() - entry.timestamp;

    if (age >= ttl) {
      logger.debug('Provider cache miss', { providerName, reason: 'expired', age, ttl });
      // Clean up expired entry
      this.cache.delete(providerName);
      return undefined;
    }

    logger.debug('Provider cache hit', {
      providerName,
      available: entry.available,
      age,
      ttl
    });

    return entry.available;
  }

  /**
   * Get cache entry with metadata (age, timestamp).
   * v5.7.2: Added for enhanced metrics tracking.
   */
  getWithMetadata(providerName: string, ttl: number = 30000): { available: boolean; age: number } | undefined {
    const entry = this.cache.get(providerName);

    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;

    if (age >= ttl) {
      this.cache.delete(providerName);
      return undefined;
    }

    return {
      available: entry.available,
      age
    };
  }

  /**
   * Set availability status for a provider.
   *
   * @param providerName - Provider name
   * @param available - Whether provider is available
   * @param version - Optional provider version string
   */
  set(providerName: string, available: boolean, version?: string): void {
    this.cache.set(providerName, {
      available,
      timestamp: Date.now(),
      version
    });

    logger.debug('Provider cache updated', {
      providerName,
      available,
      version: version || 'unknown'
    });
  }

  /**
   * Check if a provider has a valid cache entry.
   *
   * @param providerName - Provider name
   * @param ttl - Time-to-live in milliseconds
   * @returns True if cache entry exists and is not expired
   */
  has(providerName: string, ttl: number = 30000): boolean {
    const entry = this.cache.get(providerName);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age < ttl;
  }

  /**
   * Clear cache for a specific provider.
   *
   * @param providerName - Provider name to clear
   */
  clear(providerName: string): void {
    this.cache.delete(providerName);
    logger.debug('Provider cache cleared', { providerName });
  }

  /**
   * Clear all cached entries.
   */
  clearAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.debug('All provider cache cleared', { entriesCleared: count });
  }

  /**
   * Get cache statistics.
   *
   * @returns Object with cache statistics
   */
  getStats(): {
    entries: number;
    providers: string[];
    oldestEntryAge: number;
    newestEntryAge: number;
  } {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    if (entries.length === 0) {
      return {
        entries: 0,
        providers: [],
        oldestEntryAge: 0,
        newestEntryAge: 0
      };
    }

    const ages = entries.map(([_, entry]) => now - entry.timestamp);

    return {
      entries: entries.length,
      providers: entries.map(([name]) => name),
      oldestEntryAge: Math.max(...ages),
      newestEntryAge: Math.min(...ages)
    };
  }

  /**
   * Clean up expired entries.
   *
   * @param ttl - Time-to-live in milliseconds (default: 30000ms)
   * @returns Number of entries removed
   */
  cleanup(ttl: number = 30000): number {
    const now = Date.now();
    let removed = 0;

    for (const [name, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age >= ttl) {
        this.cache.delete(name);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Provider cache cleanup', { entriesRemoved: removed });
    }

    return removed;
  }
}

/**
 * Shared global instance of provider availability cache.
 * All provider instances should use this cache.
 */
export const providerCache = new ProviderAvailabilityCache();
