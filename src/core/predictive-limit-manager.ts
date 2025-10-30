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
        window_start INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_usage_provider_window
        ON usage_entries(provider, window_start);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp
        ON usage_entries(timestamp);
    `);

    this.usageInitialized = true;

    logger.info('PredictiveLimitManager usage tracking initialized', {
      dbPath: this.dbPath
    });
  }

  /**
   * Record usage for a request
   */
  async recordUsage(provider: string, tokens: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (!this.usageInitialized) {
      await this.initializeUsageTracking();
    }

    const now = Date.now();
    const windowStart = this.getHourlyWindowStart(now);

    // Check if entry exists for this provider and window
    const existing = this.usageDb!.prepare(`
      SELECT id, tokens_used, requests_count
      FROM usage_entries
      WHERE provider = ? AND window_start = ?
    `).get(provider, windowStart) as UsageEntry | undefined;

    if (existing) {
      // Update existing entry
      this.usageDb!.prepare(`
        UPDATE usage_entries
        SET tokens_used = tokens_used + ?,
            requests_count = requests_count + 1,
            timestamp = ?
        WHERE id = ?
      `).run(tokens, now, existing.id);
    } else {
      // Insert new entry
      this.usageDb!.prepare(`
        INSERT INTO usage_entries (
          timestamp, provider, tokens_used, requests_count, window_start
        ) VALUES (?, ?, ?, 1, ?)
      `).run(now, provider, tokens, windowStart);
    }

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
    const entries = this.usageDb!.prepare(`
      SELECT
        tokens_used as tokensUsed,
        requests_count as requestsCount,
        window_start as windowStart
      FROM usage_entries
      WHERE provider = ? AND timestamp >= ?
      ORDER BY timestamp ASC
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

    // Calculate time span of actual data (use actual time range, not full window)
    const firstTimestamp = entries[0]!.windowStart;
    const lastTimestamp = entries[entries.length - 1]!.windowStart;
    const actualSpanMs = lastTimestamp - firstTimestamp;
    const actualSpanHours = Math.max(1, actualSpanMs / 3600000);  // Minimum 1 hour to avoid division by zero

    // Calculate averages based on actual time span (more accurate for bursty traffic)
    const avgRequestsPerHour = totalRequests / actualSpanHours;
    const avgTokensPerHour = totalTokens / actualSpanHours;

    // Determine trend (compare first half vs second half)
    const halfwayPoint = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, halfwayPoint);
    const secondHalf = entries.slice(halfwayPoint);

    const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.requestsCount, 0) / Math.max(firstHalf.length, 1);
    const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.requestsCount, 0) / Math.max(secondHalf.length, 1);

    let trend: UsageTrends['trend'] = 'stable';
    if (secondHalfAvg > firstHalfAvg * 1.2) {
      trend = 'increasing';
    } else if (secondHalfAvg < firstHalfAvg * 0.8) {
      trend = 'decreasing';
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

    const rotationThreshold = threshold || this.config.rotationThreshold;
    const prediction = await this.predictExhaustion(provider);

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

    const result = this.usageDb!.prepare(`
      DELETE FROM usage_entries WHERE timestamp < ?
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
  if (!globalPredictiveManager && config) {
    globalPredictiveManager = new PredictiveLimitManager(config);
  }
  return globalPredictiveManager!;
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
