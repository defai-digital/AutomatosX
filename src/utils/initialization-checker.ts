/**
 * Initialization Checker
 *
 * Detects if AutomatosX is initialized and if initialization is stale.
 * Used by auto-initialization middleware to ensure seamless UX.
 */

import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger.js';

export interface SetupTimestamp {
  version: string;
  setupTime: string;
  setupType: 'manual' | 'auto';
  components: string[];
}

export interface InitializationStatus {
  isInitialized: boolean;
  isStale: boolean;
  lastSetupTime: Date | null;
  missingComponents: string[];
  needsSetup: boolean;
  setupVersion: string | null;
  age: number | null;  // Age in milliseconds
}

const REQUIRED_COMPONENTS = [
  'agents',
  'memory',
  'sessions',
  'logs',
  'templates'
];

const DEFAULT_STALENESS_THRESHOLD = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

/**
 * Initialization Checker
 *
 * Provides utilities to check if AutomatosX is properly initialized
 * and if initialization is stale.
 */
export class InitializationChecker {
  private projectDir: string;
  private stalenessThreshold: number;

  constructor(projectDir: string, stalenessThreshold: number = DEFAULT_STALENESS_THRESHOLD) {
    this.projectDir = projectDir;
    this.stalenessThreshold = stalenessThreshold;
  }

  /**
   * Check comprehensive initialization status
   */
  async checkStatus(): Promise<InitializationStatus> {
    const automatosxDir = join(this.projectDir, '.automatosx');

    // Check if .automatosx directory exists
    if (!existsSync(automatosxDir)) {
      return {
        isInitialized: false,
        isStale: false,
        lastSetupTime: null,
        missingComponents: REQUIRED_COMPONENTS,
        needsSetup: true,
        setupVersion: null,
        age: null
      };
    }

    // Check for missing components
    const missingComponents = await this.checkComponents(automatosxDir);

    // Read setup timestamp
    const timestamp = await this.readSetupTimestamp(automatosxDir);

    // Calculate age
    const age = timestamp ? Date.now() - new Date(timestamp.setupTime).getTime() : null;
    const isStale = age !== null && age > this.stalenessThreshold;

    // Determine if setup is needed
    const needsSetup = missingComponents.length > 0 || isStale;

    return {
      isInitialized: missingComponents.length === 0,
      isStale,
      lastSetupTime: timestamp ? new Date(timestamp.setupTime) : null,
      missingComponents,
      needsSetup,
      setupVersion: timestamp?.version || null,
      age
    };
  }

  /**
   * Check for missing required components
   */
  private async checkComponents(automatosxDir: string): Promise<string[]> {
    const missing: string[] = [];

    for (const component of REQUIRED_COMPONENTS) {
      const componentPath = join(automatosxDir, component);
      if (!existsSync(componentPath)) {
        missing.push(component);
      }
    }

    return missing;
  }

  /**
   * Read setup timestamp file
   */
  private async readSetupTimestamp(automatosxDir: string): Promise<SetupTimestamp | null> {
    const timestampPath = join(automatosxDir, '.setup-timestamp');

    try {
      if (!existsSync(timestampPath)) {
        // Fallback: use directory modification time
        const stats = await stat(automatosxDir);
        return {
          version: 'unknown',
          setupTime: stats.mtime.toISOString(),
          setupType: 'manual',
          components: REQUIRED_COMPONENTS
        };
      }

      const content = await readFile(timestampPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.debug('Failed to read setup timestamp', { error });
      return null;
    }
  }

  /**
   * Format age for user display
   */
  static formatAge(age: number | null): string {
    if (age === null) return 'unknown';

    const hours = Math.floor(age / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'less than an hour ago';
    }
  }

  /**
   * Quick check if initialization is needed
   * (Optimized for performance - minimal filesystem operations)
   */
  async needsInitialization(): Promise<boolean> {
    const automatosxDir = join(this.projectDir, '.automatosx');

    // Fast check: directory exists?
    if (!existsSync(automatosxDir)) {
      return true;
    }

    // Fast check: timestamp file exists?
    const timestampPath = join(automatosxDir, '.setup-timestamp');
    if (!existsSync(timestampPath)) {
      // Assume initialized if directory exists but no timestamp
      // (backward compatibility)
      return false;
    }

    // Check staleness
    try {
      const content = await readFile(timestampPath, 'utf-8');
      const timestamp: SetupTimestamp = JSON.parse(content);
      const age = Date.now() - new Date(timestamp.setupTime).getTime();
      return age > this.stalenessThreshold;
    } catch {
      return false;  // On error, assume initialized to avoid breaking existing setups
    }
  }
}

/**
 * Get staleness threshold from environment or config
 */
export function getStalenessThreshold(): number {
  const envHours = process.env.AX_INIT_STALENESS_HOURS;
  if (envHours) {
    const hours = parseInt(envHours, 10);
    if (!isNaN(hours) && hours > 0) {
      return hours * 60 * 60 * 1000;
    }
  }
  return DEFAULT_STALENESS_THRESHOLD;
}

/**
 * Check if auto-initialization is disabled
 */
export function isAutoInitDisabled(): boolean {
  // Check environment variable
  if (process.env.AX_SKIP_AUTO_INIT === 'true') {
    return true;
  }

  // Check if running in CI environment
  const ciEnvVars = ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLECI'];
  if (ciEnvVars.some(envVar => process.env[envVar] === 'true')) {
    // In CI, disable auto-init unless explicitly enabled
    return process.env.AX_ENABLE_AUTO_INIT !== 'true';
  }

  return false;
}
