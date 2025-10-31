/**
 * Provider Session Manager
 *
 * Manages session-level provider overrides that persist across CLI commands
 * but are temporary (not committed to config files).
 *
 * Use case: `ax providers switch gemini-cli` - force all requests to Gemini
 *           `ax providers reset` - return to normal routing
 *
 * @module core/provider-session
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger.js';

/**
 * Provider session configuration stored in .automatosx/session/provider-override.json
 */
export interface ProviderSessionConfig {
  provider: string;     // Provider name to force
  createdAt: number;    // When override was created
  expiresAt?: number;   // Optional expiration time
  reason?: string;      // Why override was set (for logging)
}

/**
 * Provider Session Manager
 *
 * Manages temporary provider overrides that persist across commands.
 */
export class ProviderSessionManager {
  private sessionDir: string;
  private sessionFile: string;
  private cache: ProviderSessionConfig | null = null;

  constructor(workspacePath: string = process.cwd()) {
    this.sessionDir = join(workspacePath, '.automatosx', 'session');
    this.sessionFile = join(this.sessionDir, 'provider-override.json');

    // Ensure session directory exists
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * Load provider override configuration
   */
  private load(): ProviderSessionConfig | null {
    if (this.cache) {
      return this.cache;
    }

    if (!existsSync(this.sessionFile)) {
      return null;
    }

    try {
      const data = readFileSync(this.sessionFile, 'utf-8');
      const config: ProviderSessionConfig = JSON.parse(data);

      // Check if session expired
      if (config.expiresAt && config.expiresAt < Date.now()) {
        logger.info('Provider override expired, clearing');
        this.clear();
        return null;
      }

      this.cache = config;
      return config;
    } catch (error) {
      logger.error('Failed to load provider override', {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Save provider override configuration
   */
  private save(config: ProviderSessionConfig): void {
    try {
      const data = JSON.stringify(config, null, 2);
      writeFileSync(this.sessionFile, data, 'utf-8');
      this.cache = config;
      logger.debug('Provider override saved', { config });
    } catch (error) {
      logger.error('Failed to save provider override', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Set provider override
   */
  setProvider(provider: string, options?: {
    expiresInMs?: number;
    reason?: string;
  }): void {
    const config: ProviderSessionConfig = {
      provider,
      createdAt: Date.now(),
      reason: options?.reason
    };

    if (options?.expiresInMs) {
      config.expiresAt = Date.now() + options.expiresInMs;
    }

    this.save(config);
    logger.info('Provider override set', {
      provider,
      expiresAt: config.expiresAt ? new Date(config.expiresAt) : 'never',
      reason: config.reason
    });
  }

  /**
   * Get provider override (if set)
   */
  getProvider(): string | null {
    const config = this.load();
    return config?.provider || null;
  }

  /**
   * Check if provider override is active
   */
  hasOverride(): boolean {
    return this.getProvider() !== null;
  }

  /**
   * Get full override configuration
   */
  getOverride(): ProviderSessionConfig | null {
    return this.load();
  }

  /**
   * Clear provider override
   */
  clear(): void {
    try {
      if (existsSync(this.sessionFile)) {
        unlinkSync(this.sessionFile);
        logger.info('Provider override cleared');
      }
      this.cache = null;
    } catch (error) {
      logger.error('Failed to clear provider override', {
        error: (error as Error).message
      });
    }
  }
}

// Global instances per workspace
const providerSessionInstances = new Map<string, ProviderSessionManager>();

/**
 * Get or create provider session manager instance
 */
export function getProviderSession(workspacePath?: string): ProviderSessionManager {
  const path = workspacePath || process.cwd();

  if (!providerSessionInstances.has(path)) {
    providerSessionInstances.set(path, new ProviderSessionManager(path));
  }

  return providerSessionInstances.get(path)!;
}
