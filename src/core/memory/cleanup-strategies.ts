/**
 * Memory Cleanup Strategies
 *
 * Extracted from MemoryManager to improve maintainability and testability.
 * Provides three cleanup strategies: oldest, least_accessed, and hybrid.
 *
 * @see src/core/memory/manager.ts (original implementation)
 */

import type Database from 'better-sqlite3';
import { logger } from '../../shared/logging/logger.js';

export type CleanupStrategy = 'oldest' | 'least_accessed' | 'hybrid';

export interface CleanupResult {
  requested: number;
  deleted: number;
  strategy: CleanupStrategy;
}

export interface CleanupContext {
  db: Database.Database;
  entryCount: number;
  trackAccess: boolean;
  statements: {
    deleteOldest?: Database.Statement;
  };
}

/**
 * Memory cleanup strategies implementation
 *
 * Features:
 * - Oldest: Remove entries by creation date (FIFO)
 * - Least Accessed: Remove entries by access count and last access time
 * - Hybrid: Combine access count and age for balanced cleanup
 *
 * All strategies return the actual number of deleted entries.
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
   * Uses prepared statement for optimal performance.
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
   * Remove least accessed entries (LRU strategy)
   *
   * Orders by access_count ASC, then last_accessed_at ASC.
   * Falls back to 'oldest' strategy if trackAccess is disabled.
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
   * Balances between removing old entries and infrequently accessed entries.
   * Orders by access_count ASC, then created_at ASC.
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
   * @param currentCount Current number of entries
   * @param maxEntries Maximum allowed entries
   * @param targetThreshold Target usage threshold (0.0-1.0)
   * @param minCleanup Minimum entries to remove
   * @param maxCleanup Maximum entries to remove
   * @returns Number of entries to remove
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
   * @param currentCount Current number of entries
   * @param maxEntries Maximum allowed entries
   * @param triggerThreshold Trigger threshold (0.0-1.0)
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
