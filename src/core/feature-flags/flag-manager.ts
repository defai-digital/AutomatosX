/**
 * Feature Flag Manager
 *
 * Enables safe, gradual rollout of features with instant kill switch.
 * Supports percentage-based rollout, user targeting, and metrics validation.
 *
 * @module core/feature-flags/flag-manager
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from '@/utils/logger.js';

export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  killSwitch?: {
    enabled: boolean;
    reason: string;
    timestamp: number;
    by: string;
  };
  lastUpdated?: number;
  metadata?: {
    owner: string;
    jiraTicket?: string;
    expectedImpact?: string;
  };
}

export interface FlagContext {
  userId?: string;
  sessionId?: string;
  provider?: string;
  operation?: string;
  [key: string]: any;
}

export interface FlagMetrics {
  errorRate: number;
  latencyIncrease: number;
  costChange: number;
  requestCount: number;
}

/**
 * Feature Flag Manager
 *
 * Central system for managing feature flags with gradual rollout support.
 */
export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private storagePath: string;

  constructor(workspacePath: string = process.cwd()) {
    const flagsDir = join(workspacePath, '.automatosx');
    mkdirSync(flagsDir, { recursive: true });

    this.storagePath = join(flagsDir, 'feature-flags.json');
    this.loadFlags();
  }

  /**
   * Load flags from storage
   */
  private loadFlags(): void {
    try {
      if (existsSync(this.storagePath)) {
        const data = readFileSync(this.storagePath, 'utf-8');
        const flags: FeatureFlag[] = JSON.parse(data);
        for (const flag of flags) {
          this.flags.set(flag.name, flag);
        }
        logger.info('Feature flags loaded', {
          count: flags.length,
          path: this.storagePath
        });
      } else {
        logger.info('No feature flags file found, starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load feature flags', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Save flags to storage
   */
  private saveFlags(): void {
    try {
      const flagsArray = Array.from(this.flags.values());
      const data = JSON.stringify(flagsArray, null, 2);
      writeFileSync(this.storagePath, data, 'utf-8');
    } catch (error) {
      logger.error('Failed to save feature flags', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Define a feature flag
   */
  defineFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
    this.saveFlags();
    logger.info('Feature flag defined', { name: flag.name });
  }

  /**
   * Check if flag is enabled
   */
  isEnabled(flagName: string, context?: FlagContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // Kill switch check (highest priority)
    if (flag.killSwitch?.enabled) {
      logger.warn(`Feature flag ${flagName} killed`, {
        reason: flag.killSwitch.reason,
        timestamp: flag.killSwitch.timestamp
      });
      return false;
    }

    // Environment variable override (for emergency disable)
    const envOverride = process.env[`FEATURE_${flagName.toUpperCase()}`];
    if (envOverride === 'false' || envOverride === '0') {
      logger.warn(`Feature flag ${flagName} disabled by env var`);
      return false;
    }

    // Percentage-based rollout
    if (flag.rolloutPercentage !== undefined) {
      const hash = this.hashContext(context);
      const bucket = hash % 100;
      const enabled = bucket < flag.rolloutPercentage;

      return enabled;
    }

    // Default: fully enabled or disabled
    return flag.enabled;
  }

  /**
   * Gradually increase rollout percentage
   */
  async increaseRollout(
    flagName: string,
    newPercentage: number,
    options?: {
      validationRequired?: boolean;
      minimumDuration?: number;
    }
  ): Promise<void> {
    const flag = this.flags.get(flagName);
    if (!flag) throw new Error(`Flag ${flagName} not found`);

    // Validate increase is gradual
    const currentPercentage = flag.rolloutPercentage || 0;
    if (newPercentage > currentPercentage * 5 && newPercentage !== 100 && currentPercentage > 0) {
      throw new Error(
        `Rollout increase too aggressive: ${currentPercentage}% → ${newPercentage}%\n` +
        `Maximum safe increase: ${currentPercentage * 5}%`
      );
    }

    // Check minimum duration at current percentage
    if (options?.minimumDuration && flag.lastUpdated) {
      const timeSinceLastChange = Date.now() - flag.lastUpdated;
      if (timeSinceLastChange < options.minimumDuration) {
        throw new Error(
          `Must wait ${options.minimumDuration}ms before increasing rollout\n` +
          `Time since last change: ${timeSinceLastChange}ms`
        );
      }
    }

    // Update flag
    flag.rolloutPercentage = newPercentage;
    flag.lastUpdated = Date.now();
    this.flags.set(flagName, flag);
    this.saveFlags();

    logger.info(`Feature flag ${flagName} rollout increased`, {
      from: currentPercentage,
      to: newPercentage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emergency kill switch
   */
  async killSwitch(flagName: string, reason: string): Promise<void> {
    const flag = this.flags.get(flagName);
    if (!flag) throw new Error(`Flag ${flagName} not found`);

    flag.killSwitch = {
      enabled: true,
      reason,
      timestamp: Date.now(),
      by: process.env.USER || 'unknown'
    };

    this.flags.set(flagName, flag);
    this.saveFlags();

    logger.error(`🚨 KILL SWITCH ACTIVATED: ${flagName}`, {
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get a specific flag
   */
  getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  /**
   * Hash context for deterministic bucketing
   */
  private hashContext(context?: FlagContext): number {
    const str = JSON.stringify(context || {});
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
