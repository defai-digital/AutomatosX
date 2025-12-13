/**
 * Memory Cleanup Strategies
 *
 * Provides intelligent cleanup strategies for managing memory entry limits.
 * Extracted from MemoryManager to improve maintainability and testability.
 *
 * ## Strategy Overview
 *
 * | Strategy        | Algorithm                           | Best For                          |
 * |-----------------|-------------------------------------|-----------------------------------|
 * | `oldest`        | FIFO (First In, First Out)          | Time-series data, logs            |
 * | `least_accessed`| LRU (Least Recently Used)           | Frequently-queried knowledge      |
 * | `hybrid`        | Low access count + age              | Mixed workloads (recommended)     |
 *
 * ## Configuration
 *
 * Cleanup is configured via `MemoryManagerConfig.cleanup`:
 *
 * ```typescript
 * {
 *   cleanup: {
 *     enabled: true,              // Enable auto-cleanup
 *     strategy: 'hybrid',         // Which strategy to use
 *     triggerThreshold: 0.9,      // Trigger cleanup at 90% capacity
 *     targetThreshold: 0.7,       // Clean down to 70% capacity
 *     minCleanupCount: 10,        // Always remove at least 10 entries
 *     maxCleanupCount: 1000,      // Never remove more than 1000 at once
 *     retentionDays: 30           // Delete entries older than 30 days
 *   }
 * }
 * ```
 *
 * ## Threshold Behavior
 *
 * ```
 * Entries: 0 ────────────────────────────────────────────── maxEntries
 *          │                    │                    │
 *          │                    │                    │
 *          │    Normal Zone     │   Warning Zone     │ Cleanup Zone
 *          │                    │                    │
 *          0%                  70%                  90%    100%
 *                         (target)              (trigger)
 *
 * When usage exceeds triggerThreshold (90%), cleanup removes entries
 * until usage drops to targetThreshold (70%), providing a buffer
 * before the next cleanup is needed.
 * ```
 *
 * @module core/memory/cleanup-strategies
 * @see src/core/memory/manager.ts
 */

import type Database from 'better-sqlite3';
import { logger } from '../../shared/logging/logger.js';

/**
 * Available cleanup strategies
 *
 * - `oldest`: Remove entries by creation date (FIFO - First In First Out)
 * - `least_accessed`: Remove entries with lowest access count (LRU-like)
 * - `hybrid`: Balance between access count and age (recommended default)
 */
export type CleanupStrategy = 'oldest' | 'least_accessed' | 'hybrid';

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Number of entries requested to delete */
  requested: number;
  /** Actual number of entries deleted (may be less if fewer exist) */
  deleted: number;
  /** Strategy that was used */
  strategy: CleanupStrategy;
}

/**
 * Context required for cleanup execution
 */
export interface CleanupContext {
  /** Active database connection */
  db: Database.Database;
  /** Current total entry count (for logging) */
  entryCount: number;
  /** Whether access tracking is enabled (required for least_accessed) */
  trackAccess: boolean;
  /** Cached prepared statements for performance */
  statements: {
    deleteOldest?: Database.Statement;
  };
}

/**
 * Memory Cleanup Strategies
 *
 * Static utility class implementing three cleanup algorithms:
 *
 * ## 1. Oldest Strategy (FIFO)
 *
 * Removes entries in order of creation time (oldest first).
 *
 * ```
 * Entry Timeline:  [A]──[B]──[C]──[D]──[E]──[F]  (A is oldest)
 * After cleanup:            [C]──[D]──[E]──[F]  (A, B removed)
 * ```
 *
 * **Pros:** Simple, predictable, good for time-series data
 * **Cons:** May remove frequently-accessed entries
 *
 * ## 2. Least Accessed Strategy (LRU-like)
 *
 * Removes entries with the lowest access count, breaking ties by
 * last access time (least recently accessed first).
 *
 * ```
 * Entry Access Counts:  A(5) B(1) C(3) D(1) E(7) F(2)
 * After cleanup:        A(5) C(3) E(7) F(2)  (B, D removed - lowest counts)
 * ```
 *
 * **Pros:** Preserves frequently-used knowledge
 * **Cons:** Requires trackAccess=true, new entries vulnerable
 *
 * ## 3. Hybrid Strategy (Recommended)
 *
 * Combines access count and age for balanced cleanup.
 * Orders by: access_count ASC, then created_at ASC
 *
 * This protects frequently-accessed entries while also
 * considering age, making it suitable for mixed workloads.
 *
 * ```
 * Entry Scores:  A(count:1, old) B(count:5, new) C(count:1, new)
 * Order:         A first (low count + old), C second (low count + new)
 * ```
 *
 * **Pros:** Balanced approach, works well for most use cases
 * **Cons:** Slightly more complex sorting
 *
 * @example
 * ```typescript
 * // Execute cleanup
 * const result = await MemoryCleanupStrategies.execute(
 *   'hybrid',
 *   100,  // Remove 100 entries
 *   { db, entryCount: 9500, trackAccess: true, statements: {} }
 * );
 *
 * console.log(`Deleted ${result.deleted} entries`);
 *
 * // Calculate cleanup count based on thresholds
 * const toRemove = MemoryCleanupStrategies.calculateCleanupCount(
 *   9500,   // current count
 *   10000,  // max entries
 *   0.7,    // target threshold (70%)
 *   10,     // min cleanup
 *   1000    // max cleanup
 * );
 * // Returns: 2500 (to get from 9500 to 7000)
 * ```
 */
export class MemoryCleanupStrategies {
  /**
   * Execute cleanup using the specified strategy
   */
  static async execute(
    strategy: CleanupStrategy,
    count: number,
    context: CleanupContext
  ): Promise<CleanupResult> {
    logger.debug('Executing cleanup strategy', {
      strategy,
      count,
      currentCount: context.entryCount
    });

    switch (strategy) {
      case 'oldest':
        return await this.cleanupOldest(count, context);

      case 'least_accessed':
        return await this.cleanupLeastAccessed(count, context);

      case 'hybrid':
        return await this.cleanupHybrid(count, context);

      default:
        throw new Error(`Unknown cleanup strategy: ${strategy}`);
    }
  }

  /**
   * Remove oldest entries (FIFO strategy)
   *
   * Deletes entries in chronological order, starting with the oldest.
   * This is the simplest and most predictable strategy.
   *
   * **SQL Query:**
   * ```sql
   * DELETE FROM memory_entries
   * WHERE id IN (
   *   SELECT id FROM memory_entries
   *   ORDER BY created_at ASC
   *   LIMIT ?
   * )
   * ```
   *
   * **Performance:** O(n log n) for sorting, uses prepared statement
   * for repeated calls.
   *
   * **Use When:**
   * - Memory entries are time-sensitive (logs, events)
   * - You want predictable, chronological cleanup
   * - Access patterns don't matter for your use case
   *
   * @param count Number of entries to remove
   * @param context Cleanup execution context
   * @returns Cleanup result with actual deleted count
   */
  private static async cleanupOldest(
    count: number,
    context: CleanupContext
  ): Promise<CleanupResult> {
    if (count <= 0) {
      return { requested: count, deleted: 0, strategy: 'oldest' };
    }

    try {
      // Use prepared statement if available, otherwise create one-time statement
      const deleteInfo = context.statements.deleteOldest
        ? context.statements.deleteOldest.run(count)
        : context.db.prepare(`
            DELETE FROM memory_entries
            WHERE id IN (
              SELECT id FROM memory_entries
              ORDER BY created_at ASC
              LIMIT ?
            )
          `).run(count);

      const deleted = deleteInfo.changes;

      logger.info('Cleaned up oldest entries', {
        requested: count,
        deleted,
        newCount: context.entryCount - deleted,
        strategy: 'oldest'
      });

      return { requested: count, deleted, strategy: 'oldest' };
    } catch (error) {
      logger.error('Failed to cleanup oldest entries', {
        count,
        error: (error as Error).message
      });
      return { requested: count, deleted: 0, strategy: 'oldest' };
    }
  }

  /**
   * Remove least accessed entries (LRU-like strategy)
   *
   * Deletes entries with the lowest access count first. Entries with
   * equal access counts are ordered by last access time (oldest first).
   *
   * **SQL Query:**
   * ```sql
   * DELETE FROM memory_entries
   * WHERE id IN (
   *   SELECT id FROM memory_entries
   *   ORDER BY access_count ASC, last_accessed_at ASC
   *   LIMIT ?
   * )
   * ```
   *
   * **Requires:** `trackAccess: true` in MemoryManagerConfig.
   * Falls back to 'oldest' strategy if access tracking is disabled.
   *
   * **How It Works:**
   * 1. Each `search()` call increments `access_count` for matched entries
   * 2. `last_accessed_at` is updated on each access
   * 3. Cleanup targets entries with lowest access counts
   * 4. Ties are broken by last access time (LRU behavior)
   *
   * **Use When:**
   * - You want to preserve frequently-queried knowledge
   * - Memory contains valuable, reusable information
   * - Access patterns indicate entry importance
   *
   * **Caution:** New entries start with access_count=0, making them
   * vulnerable to immediate cleanup. Consider 'hybrid' for protection.
   *
   * @param count Number of entries to remove
   * @param context Cleanup execution context
   * @returns Cleanup result with actual deleted count
   */
  private static async cleanupLeastAccessed(
    count: number,
    context: CleanupContext
  ): Promise<CleanupResult> {
    if (count <= 0) {
      return { requested: count, deleted: 0, strategy: 'least_accessed' };
    }

    // Fallback to 'oldest' if access tracking is disabled
    if (!context.trackAccess) {
      logger.warn('least_accessed strategy requires trackAccess=true, falling back to oldest');
      return await this.cleanupOldest(count, context);
    }

    try {
      const deleteInfo = context.db.prepare(`
        DELETE FROM memory_entries
        WHERE id IN (
          SELECT id FROM memory_entries
          ORDER BY access_count ASC, last_accessed_at ASC
          LIMIT ?
        )
      `).run(count);

      const deleted = deleteInfo.changes;

      logger.info('Cleaned up least accessed entries', {
        requested: count,
        deleted,
        newCount: context.entryCount - deleted,
        strategy: 'least_accessed'
      });

      return { requested: count, deleted, strategy: 'least_accessed' };
    } catch (error) {
      logger.error('Failed to cleanup least accessed entries', {
        count,
        error: (error as Error).message
      });
      return { requested: count, deleted: 0, strategy: 'least_accessed' };
    }
  }

  /**
   * Remove entries using hybrid strategy (access count + age)
   *
   * The recommended default strategy. Balances between removing old entries
   * and infrequently accessed entries by considering both factors.
   *
   * **SQL Query:**
   * ```sql
   * DELETE FROM memory_entries
   * WHERE id IN (
   *   SELECT id FROM memory_entries
   *   ORDER BY access_count ASC, created_at ASC
   *   LIMIT ?
   * )
   * ```
   *
   * **Key Difference from least_accessed:**
   * Uses `created_at` instead of `last_accessed_at` for tie-breaking.
   * This means among entries with equal access counts, older entries
   * are removed first, providing some protection for new entries.
   *
   * **Selection Priority (entries removed first):**
   * ```
   * Priority 1: access_count=0, old     ← Stale, unused entries
   * Priority 2: access_count=0, new     ← New entries (some grace period)
   * Priority 3: access_count=1, old     ← Rarely used, old
   * Priority 4: access_count=1, new     ← Rarely used, new
   * ...
   * Priority N: access_count=high       ← Frequently used (protected)
   * ```
   *
   * **Use When:**
   * - You're unsure which strategy to use (safe default)
   * - You have a mix of time-series and knowledge data
   * - You want to protect both new and frequently-used entries
   *
   * @param count Number of entries to remove
   * @param context Cleanup execution context
   * @returns Cleanup result with actual deleted count
   */
  private static async cleanupHybrid(
    count: number,
    context: CleanupContext
  ): Promise<CleanupResult> {
    if (count <= 0) {
      return { requested: count, deleted: 0, strategy: 'hybrid' };
    }

    try {
      const deleteInfo = context.db.prepare(`
        DELETE FROM memory_entries
        WHERE id IN (
          SELECT id FROM memory_entries
          ORDER BY
            access_count ASC,
            created_at ASC
          LIMIT ?
        )
      `).run(count);

      const deleted = deleteInfo.changes;

      logger.info('Cleaned up entries using hybrid strategy', {
        requested: count,
        deleted,
        newCount: context.entryCount - deleted,
        strategy: 'hybrid'
      });

      return { requested: count, deleted, strategy: 'hybrid' };
    } catch (error) {
      logger.error('Failed to cleanup with hybrid strategy', {
        count,
        error: (error as Error).message
      });
      return { requested: count, deleted: 0, strategy: 'hybrid' };
    }
  }

  /**
   * Calculate how many entries should be removed to reach target threshold
   *
   * This method determines the optimal cleanup count based on the
   * difference between current usage and target threshold.
   *
   * **Formula:**
   * ```
   * targetCount = maxEntries × targetThreshold
   * toRemove = currentCount - targetCount
   * result = clamp(toRemove, minCleanup, maxCleanup)
   * ```
   *
   * **Example:**
   * ```
   * currentCount = 9500
   * maxEntries = 10000
   * targetThreshold = 0.7 (70%)
   *
   * targetCount = 10000 × 0.7 = 7000
   * toRemove = 9500 - 7000 = 2500
   * result = 2500 (within min/max bounds)
   * ```
   *
   * @param currentCount Current number of entries
   * @param maxEntries Maximum allowed entries
   * @param targetThreshold Target usage threshold (0.0-1.0)
   * @param minCleanup Minimum entries to remove (default: 10)
   * @param maxCleanup Maximum entries to remove (default: 1000)
   * @returns Number of entries to remove, or 0 if already below target
   */
  static calculateCleanupCount(
    currentCount: number,
    maxEntries: number,
    targetThreshold: number,
    minCleanup: number = 10,
    maxCleanup: number = 1000
  ): number {
    const targetCount = Math.floor(maxEntries * targetThreshold);
    const toRemove = currentCount - targetCount;

    // If already below target, don't cleanup
    if (toRemove <= 0) {
      return 0;
    }

    // Enforce min/max bounds
    return Math.max(minCleanup, Math.min(maxCleanup, toRemove));
  }

  /**
   * Check if cleanup should be triggered based on usage threshold
   *
   * Compares current usage against the trigger threshold.
   * Typically used before calling `calculateCleanupCount()`.
   *
   * **Formula:**
   * ```
   * currentUsage = currentCount / maxEntries
   * shouldTrigger = currentUsage >= triggerThreshold
   * ```
   *
   * **Example:**
   * ```
   * currentCount = 9200
   * maxEntries = 10000
   * triggerThreshold = 0.9 (90%)
   *
   * currentUsage = 9200 / 10000 = 0.92 (92%)
   * shouldTrigger = 0.92 >= 0.9 → true
   * ```
   *
   * **Typical Usage:**
   * ```typescript
   * if (MemoryCleanupStrategies.shouldTriggerCleanup(count, max, 0.9)) {
   *   const toRemove = MemoryCleanupStrategies.calculateCleanupCount(
   *     count, max, 0.7, 10, 1000
   *   );
   *   await MemoryCleanupStrategies.execute('hybrid', toRemove, context);
   * }
   * ```
   *
   * @param currentCount Current number of entries
   * @param maxEntries Maximum allowed entries
   * @param triggerThreshold Trigger threshold (0.0-1.0), typically 0.9
   * @returns true if cleanup should be triggered
   */
  static shouldTriggerCleanup(
    currentCount: number,
    maxEntries: number,
    triggerThreshold: number
  ): boolean {
    const currentUsage = currentCount / maxEntries;
    return currentUsage >= triggerThreshold;
  }
}
