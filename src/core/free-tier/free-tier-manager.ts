/**
 * Free Tier Manager
 *
 * Tracks and manages free tier quota for providers that offer free tiers.
 * Enables cost optimization by prioritizing free tier usage before paid tier.
 *
 * Supported Providers:
 * - Gemini 2.0 Flash: 1,500 requests/day, 1M tokens/day
 *
 * @module core/free-tier/free-tier-manager
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '@/utils/logger.js';

/**
 * Free tier limits for providers
 */
export interface FreeTierLimits {
  requestsPerDay: number;
  tokensPerDay: number;
  resetTimeUTC: string; // HH:MM format (e.g., "00:00" for midnight)
}

/**
 * Free tier usage for a specific day
 */
export interface FreeTierUsage {
  provider: string;
  date: string; // YYYY-MM-DD
  requestsUsed: number;
  tokensUsed: number;
  lastReset: number; // timestamp
}

/**
 * Free tier quota status
 */
export interface FreeTierQuota {
  provider: string;
  available: boolean;
  requestsRemaining: number;
  tokensRemaining: number;
  requestsLimit: number;
  tokensLimit: number;
  percentUsed: number;
  resetsAt: Date;
}

/**
 * Provider free tier configurations
 */
const FREE_TIER_LIMITS: Record<string, FreeTierLimits> = {
  'gemini-cli': {
    requestsPerDay: 1500,
    tokensPerDay: 1000000,
    resetTimeUTC: '00:00' // Midnight UTC
  },
  'gemini-sdk': {
    requestsPerDay: 1500,
    tokensPerDay: 1000000,
    resetTimeUTC: '00:00'
  }
};

/**
 * Free Tier Manager
 *
 * Tracks free tier usage across providers and manages quota allocation.
 */
export class FreeTierManager {
  private db: Database.Database;
  private workspacePath: string;

  constructor(workspacePath: string = process.cwd()) {
    this.workspacePath = workspacePath;

    // Ensure free-tier directory exists
    const freeTierDir = join(workspacePath, '.automatosx', 'free-tier');
    if (!existsSync(freeTierDir)) {
      mkdirSync(freeTierDir, { recursive: true });
    }

    // Initialize database
    const dbPath = join(freeTierDir, 'quota-tracker.db');
    this.db = new Database(dbPath);

    this.initializeDatabase();

    // Bug #12: Register shutdown handler to close database
    // Use dynamic import to avoid circular dependency
    import('../../utils/process-manager.js').then(({ processManager }) => {
      processManager.onShutdown(async () => {
        this.close();
      });
    }).catch(() => {
      // If process-manager not available, continue without shutdown handler
      logger.debug('FreeTierManager: process-manager not available for shutdown handler');
    });
    this.checkAndResetQuotas();
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS free_tier_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        date TEXT NOT NULL,
        requests_used INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        last_reset INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(provider, date)
      );

      CREATE INDEX IF NOT EXISTS idx_provider_date ON free_tier_usage(provider, date);
    `);

    logger.debug('Free tier database initialized');
  }

  /**
   * Check if quotas need reset (daily at midnight UTC)
   */
  private checkAndResetQuotas(): void {
    const now = new Date();
    const today = this.getDateString(now);

    for (const provider of Object.keys(FREE_TIER_LIMITS)) {
      const usage = this.getUsageForDate(provider, today);

      if (!usage) {
        // No usage record for today, create one
        this.resetQuota(provider, today);
      } else if (usage.lastReset) {
        // Check if we've crossed midnight UTC since last reset
        const lastReset = new Date(usage.lastReset);
        const lastResetDate = this.getDateString(lastReset);

        if (lastResetDate !== today) {
          // New day, reset quota
          this.resetQuota(provider, today);
          logger.info(`Free tier quota reset for ${provider}`, { date: today });
        }
      }
    }
  }

  /**
   * Reset quota for a provider
   */
  private resetQuota(provider: string, date: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO free_tier_usage (provider, date, requests_used, tokens_used, last_reset)
      VALUES (?, ?, 0, 0, ?)
      ON CONFLICT(provider, date)
      DO UPDATE SET
        requests_used = 0,
        tokens_used = 0,
        last_reset = excluded.last_reset
    `);

    stmt.run(provider, date, Date.now());
  }

  /**
   * Get usage for specific date
   */
  private getUsageForDate(provider: string, date: string): FreeTierUsage | null {
    const stmt = this.db.prepare(`
      SELECT provider, date, requests_used as requestsUsed, tokens_used as tokensUsed, last_reset as lastReset
      FROM free_tier_usage
      WHERE provider = ? AND date = ?
    `);

    return stmt.get(provider, date) as FreeTierUsage | null;
  }

  /**
   * Get date string in YYYY-MM-DD format (UTC)
   */
  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Calculate next reset time
   */
  private getNextResetTime(resetTimeUTC: string): Date {
    const now = new Date();
    const parts = resetTimeUTC.split(':');

    if (parts.length !== 2) {
      logger.warn('Invalid reset time format, defaulting to midnight UTC', {
        resetTimeUTC
      });
      return new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0
      ));
    }

    const hours = parseInt(parts[0]!, 10);
    const minutes = parseInt(parts[1]!, 10);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      logger.warn('Invalid reset time values, defaulting to midnight UTC', {
        resetTimeUTC,
        parsedHours: hours,
        parsedMinutes: minutes
      });
      return new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0
      ));
    }

    const nextReset = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hours,
      minutes,
      0,
      0
    ));

    // If reset time has already passed today, set to tomorrow
    if (nextReset <= now) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    }

    return nextReset;
  }

  /**
   * Check if provider has free tier
   */
  hasFreeTier(provider: string): boolean {
    return provider in FREE_TIER_LIMITS;
  }

  /**
   * Get free tier quota status
   */
  getQuota(provider: string): FreeTierQuota {
    if (!this.hasFreeTier(provider)) {
      // Provider doesn't have free tier
      return {
        provider,
        available: false,
        requestsRemaining: 0,
        tokensRemaining: 0,
        requestsLimit: 0,
        tokensLimit: 0,
        percentUsed: 100,
        resetsAt: new Date()
      };
    }

    this.checkAndResetQuotas(); // Ensure quotas are current

    const limits = FREE_TIER_LIMITS[provider];
    if (!limits) {
      // Shouldn't happen since we check hasFreeTier above, but satisfy TypeScript
      return {
        provider,
        available: false,
        requestsRemaining: 0,
        tokensRemaining: 0,
        requestsLimit: 0,
        tokensLimit: 0,
        percentUsed: 100,
        resetsAt: new Date()
      };
    }

    const today = this.getDateString(new Date());
    const usage = this.getUsageForDate(provider, today);

    const requestsUsed = usage?.requestsUsed || 0;
    const tokensUsed = usage?.tokensUsed || 0;

    const requestsRemaining = Math.max(0, limits.requestsPerDay - requestsUsed);
    const tokensRemaining = Math.max(0, limits.tokensPerDay - tokensUsed);

    // Available if both requests and tokens have quota remaining
    const available = requestsRemaining > 0 && tokensRemaining > 0;

    // Percent used (based on requests, since that's usually the limiting factor)
    const percentUsed = (requestsUsed / limits.requestsPerDay) * 100;

    const resetsAt = this.getNextResetTime(limits.resetTimeUTC);

    return {
      provider,
      available,
      requestsRemaining,
      tokensRemaining,
      requestsLimit: limits.requestsPerDay,
      tokensLimit: limits.tokensPerDay,
      percentUsed: Math.min(100, percentUsed),
      resetsAt
    };
  }

  /**
   * Track free tier usage
   *
   * FIXED (Bug #10): Added input validation to prevent data corruption
   */
  trackUsage(provider: string, requests: number, tokens: number): void {
    if (!this.hasFreeTier(provider)) {
      return; // No free tier to track
    }

    // FIXED (Bug #10): Validate requests and tokens are non-negative finite numbers
    // Prevents corruption from negative values, NaN, or Infinity
    if (!Number.isFinite(requests) || requests < 0) {
      throw new Error(`Invalid requests value: ${requests}. Must be a non-negative finite number.`);
    }
    if (!Number.isFinite(tokens) || tokens < 0) {
      throw new Error(`Invalid tokens value: ${tokens}. Must be a non-negative finite number.`);
    }

    const today = this.getDateString(new Date());

    const stmt = this.db.prepare(`
      INSERT INTO free_tier_usage (provider, date, requests_used, tokens_used, last_reset)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider, date)
      DO UPDATE SET
        requests_used = requests_used + excluded.requests_used,
        tokens_used = tokens_used + excluded.tokens_used
    `);

    stmt.run(provider, today, requests, tokens, Date.now());

    logger.debug(`Free tier usage tracked for ${provider}`, {
      requests,
      tokens,
      date: today
    });
  }

  /**
   * Get all providers with free tiers
   */
  getProvidersWithFreeTier(): string[] {
    return Object.keys(FREE_TIER_LIMITS);
  }

  /**
   * Get usage history for provider
   */
  getUsageHistory(provider: string, days: number = 7): FreeTierUsage[] {
    const stmt = this.db.prepare(`
      SELECT provider, date, requests_used as requestsUsed, tokens_used as tokensUsed, last_reset as lastReset
      FROM free_tier_usage
      WHERE provider = ?
      ORDER BY date DESC
      LIMIT ?
    `);

    return stmt.all(provider, days) as FreeTierUsage[];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalProviders: number;
    providersWithQuota: number;
    totalRequestsSaved: number;
    totalTokensSaved: number;
  } {
    const providers = this.getProvidersWithFreeTier();
    const today = this.getDateString(new Date());

    let providersWithQuota = 0;
    let totalRequestsSaved = 0;
    let totalTokensSaved = 0;

    for (const provider of providers) {
      const quota = this.getQuota(provider);
      if (quota.available) {
        providersWithQuota++;
      }

      const usage = this.getUsageForDate(provider, today);
      if (usage) {
        totalRequestsSaved += usage.requestsUsed;
        totalTokensSaved += usage.tokensUsed;
      }
    }

    return {
      totalProviders: providers.length,
      providersWithQuota,
      totalRequestsSaved,
      totalTokensSaved
    };
  }

  /**
   * Close database connection
   *
   * Includes WAL checkpoint for Windows compatibility (reduces file lock contention)
   */
  close(): void {
    try {
      // Checkpoint WAL to reduce lock contention on Windows
      // TRUNCATE mode: checkpoint and delete WAL file
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
      // Non-fatal: log and continue with close
      logger.debug('WAL checkpoint failed (non-fatal)', { error: (err as Error).message });
    }

    this.db.close();
  }
}

// Global instances per workspace
const freeTierManagerInstances = new Map<string, FreeTierManager>();

/**
 * Get or create free tier manager instance
 */
export function getFreeTierManager(workspacePath?: string): FreeTierManager {
  const path = workspacePath || process.cwd();

  if (!freeTierManagerInstances.has(path)) {
    freeTierManagerInstances.set(path, new FreeTierManager(path));
  }

  return freeTierManagerInstances.get(path)!;
}
