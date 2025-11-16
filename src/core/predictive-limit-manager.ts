/**
 * Predictive Limit Manager
 *
 * Extends ProviderLimitManager with predictive capabilities
 *
 * Phase 3: Predict quota exhaustion before hitting limits
 *
 * Features:
 * - Usage trend tracking (rolling windows)
 * - Time-to-exhaustion prediction
 * - Proactive rotation before limits
 * - Confidence scoring
 *
 * @module core/predictive-limit-manager
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  UsageEntry,
  UsageTrends,
  ProviderLimits,
  PredictionResult,
  PredictiveLimitConfig
} from '../types/usage.js';
import { logger } from '../utils/logger.js';

/**
 * Predictive Limit Manager
 *
 * Predicts quota exhaustion and rotates proactively
 */
export class PredictiveLimitManager {
  private usageDb: Database.Database | null = null;
  private config: PredictiveLimitConfig;
  private dbPath: string;
  private usageInitialized = false;

  constructor(config: PredictiveLimitConfig) {
    this.config = config;
    this.dbPath = '.automatosx/usage/usage-tracker.db';  // Default path

    logger.debug('PredictiveLimitManager created', {
      enabled: config.enabled,
      trackingWindow: config.trackingWindow,
      rotationThreshold: config.rotationThreshold
    });
  }

  /**
   * Initialize usage tracking database
   */
  async initializeUsageTracking(): Promise<void> {
    if (this.usageInitialized) {
      return;
    }

    // v6.2.2: Bug fix #20 - Wrap in try-catch to prevent memory leaks on error
    // If initialization fails partway through, close any open connection to prevent leaks
    try {
      // Ensure directory exists
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Open database
      this.usageDb = new Database(this.dbPath);
      this.usageDb.pragma('journal_mode = WAL');

      // Create schema
      this.usageDb.exec(`
        CREATE TABLE IF NOT EXISTS usage_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          provider TEXT NOT NULL,
          tokens_used INTEGER NOT NULL,
          requests_count INTEGER NOT NULL DEFAULT 1,
          window_start INTEGER NOT NULL,
          UNIQUE(provider, window_start)
        );

        -- v6.2.2: Bug fix #18 - Drop unused idx_usage_timestamp (queries now filter by window_start)
        -- After Bug #17 fix, all queries use window_start not timestamp, making this index unused
        -- The UNIQUE(provider, window_start) constraint already provides an implicit index for queries
        DROP INDEX IF EXISTS idx_usage_timestamp;
      `);

      this.usageInitialized = true;

      // Bug #12: Register shutdown handler to close database
      import('../utils/process-manager.js').then(({ processManager }) => {
        processManager.onShutdown(async () => {
          await this.closeUsageDb();
        });
      }).catch(() => {
        logger.debug('PredictiveLimitManager: process-manager not available for shutdown handler');
      });

      logger.info('PredictiveLimitManager usage tracking initialized', {
        dbPath: this.dbPath
      });
    } catch (error) {
      // Clean up database connection on error to prevent memory leaks
      if (this.usageDb) {
        try {
          this.usageDb.close();
        } catch (closeError) {
          // Ignore close errors, we're already handling an error
        }
        this.usageDb = null;
      }
      this.usageInitialized = false;

      logger.error('Failed to initialize usage tracking', {
        error: error instanceof Error ? error.message : String(error),
        dbPath: this.dbPath
      });

      throw error;
    }
  }

  /**
   * Record usage for a request
   */
  async recordUsage(provider: string, tokens: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // v6.2.2: Bug fix #19 - Input validation to prevent data corruption
    if (!provider || provider.trim().length === 0) {
      throw new Error('Provider name cannot be empty');
    }
    if (!Number.isFinite(tokens)) {
      throw new Error(`Invalid tokens value: ${tokens}. Must be a finite number.`);
    }
    if (tokens < 0) {
      throw new Error(`Invalid tokens value: ${tokens}. Cannot be negative.`);
    }

    if (!this.usageInitialized) {
      await this.initializeUsageTracking();
    }

    // Capture timestamp once at the beginning to ensure consistency
    const now = Date.now();
    const windowStart = this.getHourlyWindowStart(now);

    // Use INSERT OR REPLACE to handle race conditions atomically
    // This ensures only one entry per (provider, window_start) without race conditions
    this.usageDb!.prepare(`
      INSERT INTO usage_entries (
        timestamp, provider, tokens_used, requests_count, window_start
      ) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(provider, window_start) DO UPDATE SET
        tokens_used = tokens_used + excluded.tokens_used,
        requests_count = requests_count + 1,
        timestamp = excluded.timestamp
    `).run(now, provider, tokens, windowStart);

    logger.debug('Usage recorded', {
      provider,
      tokens,
      windowStart: new Date(windowStart).toISOString()
    });
  }

  /**
   * Get usage trends for a provider
   */
  async getUsageTrends(provider: string, windowHours: number = 24): Promise<UsageTrends> {
    if (!this.usageInitialized) {
      await this.initializeUsageTracking();
    }

    const now = Date.now();
    const startTime = now - (windowHours * 3600000);  // windowHours ago

    // Get all entries in the window
    // v6.2.2: Bug fix #17 - Filter by window_start (data period) not timestamp (last update)
    // This ensures we get all usage data for the tracking window, regardless of when
    // records were last updated. Prevents data loss in rate calculations.
    const entries = this.usageDb!.prepare(`
      SELECT
        tokens_used as tokensUsed,
        requests_count as requestsCount,
        window_start as windowStart
      FROM usage_entries
      WHERE provider = ? AND window_start >= ?
      ORDER BY window_start ASC
    `).all(provider, startTime) as UsageEntry[];

    if (entries.length === 0) {
      return {
        provider,
        window: windowHours,
        requests: 0,
        tokens: 0,
        avgRequestsPerHour: 0,
        avgTokensPerHour: 0,
        trend: 'stable'
      };
    }

    // Calculate totals
    const totalRequests = entries.reduce((sum, e) => sum + e.requestsCount, 0);
    const totalTokens = entries.reduce((sum, e) => sum + e.tokensUsed, 0);

    // Calculate time span using window boundaries for hourly-aggregated data
    // v6.2.2: Bug fix #16 - Account for gaps in data by using first to last window span
    // Data at 10:00 and 12:00 spans 3 hours (10:00-11:00, 11:00-12:00, 12:00-13:00)
    // even if 11:00 has no data. This prevents massive overestimation with sparse usage.
    const firstWindow = entries[0]!.windowStart;
    const lastWindow = entries[entries.length - 1]!.windowStart;
    const spanHours = (lastWindow - firstWindow) / 3600000;
    const hoursOfData = spanHours + 1; // +1 to include the last window hour

    // Calculate averages based on actual time span (accurate for sparse data)
    const avgRequestsPerHour = totalRequests / hoursOfData;
    const avgTokensPerHour = totalTokens / hoursOfData;

    // Determine trend (compare first half vs second half)
    // v6.2.2: Bug fix #10 - Need at least 2 entries to determine trend
    let trend: UsageTrends['trend'] = 'stable';

    if (entries.length >= 2) {
      const halfwayPoint = Math.floor(entries.length / 2);
      const firstHalf = entries.slice(0, halfwayPoint);
      const secondHalf = entries.slice(halfwayPoint);

      const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.requestsCount, 0) / Math.max(firstHalf.length, 1);
      const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.requestsCount, 0) / Math.max(secondHalf.length, 1);

      if (secondHalfAvg > firstHalfAvg * 1.2) {
        trend = 'increasing';
      } else if (secondHalfAvg < firstHalfAvg * 0.8) {
        trend = 'decreasing';
      }
    }

    return {
      provider,
      window: windowHours,
      requests: totalRequests,
      tokens: totalTokens,
      avgRequestsPerHour,
      avgTokensPerHour,
      trend
    };
  }

  /**
   * Predict time to quota exhaustion
   */
  async predictExhaustion(provider: string): Promise<PredictionResult> {
    const trends = await this.getUsageTrends(provider, this.config.trackingWindow);
    const limits = this.config.knownLimits[provider] || {};

    // Calculate time to exhaustion for each limit type
    const predictions: number[] = [];
    let confidence = 0.5;  // Default medium confidence

    // Check requests per day
    if (limits.requestsPerDay && trends.avgRequestsPerHour > 0) {
      const hoursToExhaust = limits.requestsPerDay / trends.avgRequestsPerHour;
      predictions.push(hoursToExhaust);
      confidence = Math.max(confidence, trends.requests > 100 ? 0.9 : 0.6);
    }

    // Check tokens per day
    if (limits.tokensPerDay && trends.avgTokensPerHour > 0) {
      const hoursToExhaust = limits.tokensPerDay / trends.avgTokensPerHour;
      predictions.push(hoursToExhaust);
      confidence = Math.max(confidence, trends.tokens > 100000 ? 0.9 : 0.6);
    }

    // Check requests per minute
    if (limits.requestsPerMinute && trends.avgRequestsPerHour > 0) {
      const requestsPerMinute = trends.avgRequestsPerHour / 60;
      if (requestsPerMinute > limits.requestsPerMinute * 0.8) {
        predictions.push(0.1);  // Very close to limit
        confidence = 0.95;
      }
    }

    // Check tokens per minute
    if (limits.tokensPerMinute && trends.avgTokensPerHour > 0) {
      const tokensPerMinute = trends.avgTokensPerHour / 60;
      if (tokensPerMinute > limits.tokensPerMinute * 0.8) {
        predictions.push(0.1);  // Very close to limit
        confidence = 0.95;
      }
    }

    // Use minimum prediction (most conservative)
    const timeToExhaustionHours = predictions.length > 0
      ? Math.min(...predictions)
      : Infinity;

    // v6.2.3: Bug fix #22 - Set confidence to 0 when no predictions available
    // Confidence = 0.5 with Infinity is misleading (implies uncertainty, not absence of data)
    if (predictions.length === 0) {
      confidence = 0;
    }

    // Determine status
    let status: PredictionResult['prediction']['status'];
    let shouldRotate: boolean;

    if (timeToExhaustionHours < this.config.rotationThreshold) {
      status = 'critical';
      shouldRotate = true;
    } else if (timeToExhaustionHours < this.config.rotationThreshold * 3) {
      status = 'warning';
      shouldRotate = false;
    } else {
      status = 'healthy';
      shouldRotate = false;
    }

    // Adjust for trend
    if (trends.trend === 'increasing' && status === 'warning') {
      shouldRotate = true;
    }

    return {
      provider,
      currentRate: {
        requestsPerHour: trends.avgRequestsPerHour,
        tokensPerHour: trends.avgTokensPerHour
      },
      knownLimits: limits,
      prediction: {
        timeToExhaustionHours,
        status,
        shouldRotate
      },
      confidence
    };
  }

  /**
   * Check if provider should be rotated (proactive)
   */
  async shouldRotate(provider: string, threshold?: number): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const rotationThreshold = threshold ?? this.config.rotationThreshold;
    const prediction = await this.predictExhaustion(provider);

    // If a custom threshold is provided, re-evaluate the rotation decision
    if (threshold !== undefined) {
      const timeToExhaustion = prediction.prediction.timeToExhaustionHours;
      const trends = await this.getUsageTrends(provider, this.config.trackingWindow);

      // Apply custom threshold
      if (timeToExhaustion < rotationThreshold) {
        return true;
      }
      // Also rotate if usage is increasing and approaching threshold
      if (trends.trend === 'increasing' && timeToExhaustion < rotationThreshold * 3) {
        return true;
      }
      return false;
    }

    // Use the prediction's built-in shouldRotate (based on config threshold)
    return prediction.prediction.shouldRotate;
  }

  /**
   * Get hourly window start timestamp
   */
  private getHourlyWindowStart(timestamp: number): number {
    const date = new Date(timestamp);
    date.setMinutes(0, 0, 0);
    return date.getTime();
  }

  /**
   * Clean old usage data (older than trackingWindow * 2)
   */
  async cleanupOldUsage(): Promise<void> {
    if (!this.usageInitialized) {
      return;
    }

    const cutoffTime = Date.now() - (this.config.trackingWindow * 2 * 3600000);

    // v6.2.2: Bug fix #17 - Filter by window_start (data period) not timestamp
    // Consistent with getUsageTrends query for semantic correctness
    const result = this.usageDb!.prepare(`
      DELETE FROM usage_entries WHERE window_start < ?
    `).run(cutoffTime);

    if (result.changes > 0) {
      logger.debug('Cleaned up old usage data', {
        deletedEntries: result.changes
      });
    }
  }

  /**
   * Close database connection
   */
  async closeUsageDb(): Promise<void> {
    if (this.usageDb) {
      this.usageDb.close();
      this.usageDb = null;
      this.usageInitialized = false;

      logger.debug('PredictiveLimitManager usage database closed');
    }
  }
}

/**
 * Global singleton instance
 */
let globalPredictiveManager: PredictiveLimitManager | null = null;

/**
 * Get or create global predictive limit manager
 */
export function getPredictiveLimitManager(config?: PredictiveLimitConfig): PredictiveLimitManager {
  if (!globalPredictiveManager) {
    if (!config) {
      throw new Error('PredictiveLimitManager not initialized. Call getPredictiveLimitManager(config) first or provide config.');
    }
    globalPredictiveManager = new PredictiveLimitManager(config);
  }
  return globalPredictiveManager;
}

/**
 * Reset global predictive manager (for testing)
 */
export function resetPredictiveLimitManager(): void {
  if (globalPredictiveManager) {
    void globalPredictiveManager.closeUsageDb();
  }
  globalPredictiveManager = null;
}
