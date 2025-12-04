/**
 * Provider Limit Manager (v5.7.0)
 *
 * Manages provider usage limits with automatic detection, rotation, and recovery.
 *
 * Features:
 * - Tracks daily/weekly limit hits per provider
 * - Persists state across sessions
 * - Automatic reset based on provider-specific schedules
 * - Manual override support
 * - < 1ms overhead for limit checks (O(1) map lookup)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../shared/logging/logger.js';
import { EventEmitter } from 'events';
import { detectProjectRoot } from '../shared/validation/path-resolver.js';
import type { ProviderLimitTrackingConfig } from '../types/config.js';
import { Mutex } from 'async-mutex';

/**
 * Provider limit state
 */
export interface ProviderLimitState {
  status: 'limited' | 'healthy' | 'manual';
  window: 'daily' | 'weekly' | 'custom';
  detectedAtMs: number;
  resetAtMs: number;
  reason?: string;
  rawMessage?: string;
  retryAfterSeconds?: number;
  manualHold: boolean;
}

/**
 * Manual override configuration
 */
export interface ManualOverride {
  provider: string;
  setAtMs: number;
  expiresAtMs?: number;  // undefined = never expires
}

/**
 * Persisted state schema
 */
interface PersistedState {
  schemaVersion: number;
  providers: Record<string, ProviderLimitState>;
  manualOverride?: ManualOverride;
}

/**
 * Event types emitted by ProviderLimitManager
 */
export interface ProviderLimitEvents {
  'limit-hit': {
    providerName: string;
    limitWindow: 'daily' | 'weekly' | 'custom';
    resetAtMs: number;
    reason?: string;
  };
  'limit-cleared': {
    providerName: string;
    reason: 'expired' | 'manual';
  };
  'override-set': {
    provider: string;
    expiresAtMs?: number;
  };
  'override-cleared': {
    provider: string;
  };
}

/**
 * Provider limit check result
 */
export interface LimitCheckResult {
  isLimited: boolean;
  remainingMs?: number;
  resetAtMs?: number;
  reason?: string;
}

/**
 * Provider Limit Manager
 *
 * Singleton responsible for tracking and managing provider usage limits.
 */
export class ProviderLimitManager extends EventEmitter {
  private static instance: ProviderLimitManager | null = null;

  private stateFilePath: string;
  private providerStates: Map<string, ProviderLimitState>;
  private manualOverride?: ManualOverride;
  private providerConfigs: Map<string, ProviderLimitTrackingConfig>;
  private initialized: boolean = false;
  private saveMutex: Mutex = new Mutex(); // v6.3.2: Prevent concurrent save race conditions

  // Performance tracking
  private metrics = {
    checksPerformed: 0,
    limitsRecorded: 0,
    limitsCleared: 0,
    cacheHits: 0
  };

  private constructor(stateDirectory: string) {
    super();
    this.stateFilePath = path.join(stateDirectory, 'provider-limits.json');
    this.providerStates = new Map();
    this.providerConfigs = new Map();
  }

  /**
   * Get singleton instance
   */
  static getInstance(stateDirectory: string = '.automatosx/state'): ProviderLimitManager {
    if (!ProviderLimitManager.instance) {
      ProviderLimitManager.instance = new ProviderLimitManager(stateDirectory);
    }
    return ProviderLimitManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ProviderLimitManager.instance = null;
  }

  /**
   * Initialize manager: load state from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadState();
      this.initialized = true;
      logger.debug('ProviderLimitManager initialized', {
        stateFile: this.stateFilePath,
        trackedProviders: this.providerStates.size
      });
    } catch (error) {
      logger.warn('Failed to initialize ProviderLimitManager', {
        error: (error as Error).message
      });
      // Continue with empty state - non-fatal
      this.initialized = true;
    }
  }

  /**
   * Register provider limit tracking configuration
   */
  registerProvider(providerName: string, config: ProviderLimitTrackingConfig): void {
    this.providerConfigs.set(providerName, config);
    logger.debug('Provider limit tracking registered', {
      provider: providerName,
      window: config.window,
      enabled: config.enabled
    });
  }

  /**
   * Record a limit hit for a provider
   */
  async recordLimitHit(
    providerName: string,
    limitWindow: 'daily' | 'weekly' | 'custom',
    resetAtMs: number,
    metadata?: {
      reason?: string;
      rawMessage?: string;
      retryAfterSeconds?: number;
    }
  ): Promise<void> {
    this.metrics.limitsRecorded++;

    const state: ProviderLimitState = {
      status: 'limited',
      window: limitWindow,
      detectedAtMs: Date.now(),
      resetAtMs,
      reason: metadata?.reason,
      rawMessage: metadata?.rawMessage,
      retryAfterSeconds: metadata?.retryAfterSeconds,
      manualHold: false
    };

    this.providerStates.set(providerName, state);

    // Persist immediately
    await this.saveState();

    // Emit event
    this.emit('limit-hit', {
      providerName,
      limitWindow,
      resetAtMs,
      reason: metadata?.reason
    });

    logger.warn('Provider limit hit recorded', {
      provider: providerName,
      window: limitWindow,
      resetAt: new Date(resetAtMs).toISOString(),
      reason: metadata?.reason
    });
  }

  /**
   * Check if a provider is currently limited (O(1) operation)
   */
  isProviderLimited(providerName: string, now: number = Date.now()): LimitCheckResult {
    this.metrics.checksPerformed++;

    // Check manual override first
    if (this.manualOverride && this.manualOverride.provider === providerName) {
      // Override active - provider is not limited
      return { isLimited: false };
    }

    const state = this.providerStates.get(providerName);

    if (!state || state.status !== 'limited') {
      this.metrics.cacheHits++;
      return { isLimited: false };
    }

    // Check if limit has expired
    if (now >= state.resetAtMs) {
      // Limit expired - clear it asynchronously (don't block)
      void this.clearLimit(providerName, 'expired');
      return { isLimited: false };
    }

    // Provider is still limited
    const remainingMs = state.resetAtMs - now;
    return {
      isLimited: true,
      remainingMs,
      resetAtMs: state.resetAtMs,
      reason: state.reason
    };
  }

  /**
   * Clear limit for a provider
   */
  async clearLimit(providerName: string, reason: 'expired' | 'manual' = 'manual'): Promise<void> {
    const state = this.providerStates.get(providerName);

    if (!state || state.status !== 'limited') {
      return;  // Nothing to clear
    }

    this.metrics.limitsCleared++;
    this.providerStates.delete(providerName);

    // Persist
    await this.saveState();

    // Emit event
    this.emit('limit-cleared', {
      providerName,
      reason
    });

    logger.info('Provider limit cleared', {
      provider: providerName,
      reason
    });
  }

  /**
   * Refresh expired limits (background task)
   */
  async refreshExpired(): Promise<string[]> {
    const now = Date.now();
    const expiredProviders: string[] = [];

    for (const [providerName, state] of this.providerStates.entries()) {
      if (state.status === 'limited' && now >= state.resetAtMs) {
        expiredProviders.push(providerName);
        await this.clearLimit(providerName, 'expired');
      }
    }

    if (expiredProviders.length > 0) {
      logger.debug('Expired provider limits refreshed', {
        providers: expiredProviders,
        count: expiredProviders.length
      });
    }

    return expiredProviders;
  }

  /**
   * Set manual override for a specific provider
   */
  async setManualOverride(provider: string, expiresAtMs?: number): Promise<void> {
    this.manualOverride = {
      provider,
      setAtMs: Date.now(),
      expiresAtMs
    };

    await this.saveState();

    this.emit('override-set', {
      provider,
      expiresAtMs
    });

    logger.info('Manual provider override set', {
      provider,
      expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : 'never'
    });
  }

  /**
   * Clear manual override
   */
  async clearManualOverride(): Promise<void> {
    if (!this.manualOverride) {
      return;
    }

    const provider = this.manualOverride.provider;
    this.manualOverride = undefined;

    await this.saveState();

    this.emit('override-cleared', { provider });

    logger.info('Manual provider override cleared', { provider });
  }

  /**
   * Get current manual override
   */
  getManualOverride(): ManualOverride | undefined {
    // Check if override has expired
    if (this.manualOverride && this.manualOverride.expiresAtMs) {
      if (Date.now() >= this.manualOverride.expiresAtMs) {
        // Expired - clear it asynchronously
        void this.clearManualOverride();
        return undefined;
      }
    }

    return this.manualOverride;
  }

  /**
   * Get all provider states (for status commands)
   */
  getAllStates(): Map<string, ProviderLimitState> {
    return new Map(this.providerStates);
  }

  /**
   * Get next reset time across all providers
   */
  getNextReset(): { providerName: string; resetAtMs: number } | null {
    let soonest: { providerName: string; resetAtMs: number } | null = null;

    for (const [providerName, state] of this.providerStates.entries()) {
      if (state.status === 'limited') {
        if (!soonest || state.resetAtMs < soonest.resetAtMs) {
          soonest = { providerName, resetAtMs: state.resetAtMs };
        }
      }
    }

    return soonest;
  }

  /**
   * Calculate reset time for a provider based on its configuration
   */
  calculateResetTime(
    providerName: string,
    limitWindow: 'daily' | 'weekly' | 'custom',
    retryAfterSeconds?: number
  ): number {
    const config = this.providerConfigs.get(providerName);
    const now = Date.now();

    // If retry-after is provided by provider API, use it
    if (retryAfterSeconds) {
      return now + (retryAfterSeconds * 1000);
    }

    // Use configuration or defaults
    const resetHourUtc = config?.resetHourUtc ?? 0;

    if (limitWindow === 'daily') {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(resetHourUtc, 0, 0, 0);
      return tomorrow.getTime();
    }

    if (limitWindow === 'weekly') {
      const nextWeek = new Date();
      nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
      nextWeek.setUTCHours(resetHourUtc, 0, 0, 0);
      return nextWeek.getTime();
    }

    if (limitWindow === 'custom' && config?.customResetMs) {
      return now + config.customResetMs;
    }

    // Default: 24 hours from now
    return now + (24 * 60 * 60 * 1000);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Serialize state for JSON export
   */
  serialize(): PersistedState {
    const providers: Record<string, ProviderLimitState> = {};

    for (const [name, state] of this.providerStates.entries()) {
      providers[name] = state;
    }

    return {
      schemaVersion: 1,
      providers,
      manualOverride: this.manualOverride
    };
  }

  // ========================================
  // Private Methods: Persistence
  // ========================================

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFilePath, 'utf-8');
      const parsed: PersistedState = JSON.parse(data);

      // Validate schema version
      if (parsed.schemaVersion !== 1) {
        logger.warn('Unsupported state schema version', {
          version: parsed.schemaVersion
        });
        return;
      }

      // Load provider states
      for (const [name, state] of Object.entries(parsed.providers)) {
        this.providerStates.set(name, state);
      }

      // Load manual override
      if (parsed.manualOverride) {
        this.manualOverride = parsed.manualOverride;
      }

      logger.debug('Provider limit state loaded', {
        providers: this.providerStates.size,
        hasOverride: !!this.manualOverride
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - that's okay, start with empty state
        logger.debug('No existing provider limit state found (new installation)');
      } else {
        throw error;
      }
    }
  }

  /**
   * Save state to disk (atomic write)
   * v6.3.2: Protected by mutex to prevent concurrent save race conditions
   */
  private async saveState(): Promise<void> {
    // Acquire mutex to prevent concurrent saves
    return this.saveMutex.runExclusive(async () => {
      try {
        // Ensure directory exists
        const dir = path.dirname(this.stateFilePath);
        await fs.mkdir(dir, { recursive: true });

        // Serialize state
        const state = this.serialize();
        const json = JSON.stringify(state, null, 2);

        // Atomic write: write to temp file then rename
        const tempPath = `${this.stateFilePath}.tmp`;
        await fs.writeFile(tempPath, json, 'utf-8');
        await fs.rename(tempPath, this.stateFilePath);

        logger.debug('Provider limit state saved', {
          file: this.stateFilePath,
          providers: this.providerStates.size
        });
      } catch (error) {
        logger.error('Failed to save provider limit state', {
          error: (error as Error).message,
          file: this.stateFilePath
        });
        // Don't throw - saving state is non-critical
      }
    });
  }
}

/**
 * Get global singleton instance
 *
 * Automatically resolves project root to ensure state files are created in
 * .automatosx/state/ relative to project root, not current working directory.
 */
export async function getProviderLimitManager(stateDirectory?: string): Promise<ProviderLimitManager> {
  if (!stateDirectory) {
    // In test mode, use a simple relative path to avoid async I/O issues
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      stateDirectory = '.automatosx/state';
    } else {
      // Resolve project root to avoid creating state files in CWD
      const projectRoot = await detectProjectRoot();
      stateDirectory = path.join(projectRoot, '.automatosx', 'state');
    }
  }
  return ProviderLimitManager.getInstance(stateDirectory);
}
