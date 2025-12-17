/**
 * Multi-Level Config Resolver
 *
 * Resolves configuration from multiple levels:
 * 1. Built-in defaults
 * 2. User config (~/.automatosx/config.json)
 * 3. Project config (.automatosx/config.json) - highest priority
 *
 * Merge semantics:
 * - Objects: deep merge
 * - Arrays: replace (not concatenate)
 * - Primitives: override
 *
 * Invariants:
 * - INV-CFG-RES-001: Project config overrides user config
 * - INV-CFG-RES-002: User config overrides defaults
 * - INV-CFG-RES-003: Undefined values do not override
 */

import type { AutomatosXConfig } from '@automatosx/contracts';
import { createConfigStore, CONFIG_PATHS, DATA_PATHS } from './store.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Config resolution result
 */
export interface ConfigResolutionResult {
  config: AutomatosXConfig;
  sources: {
    defaults: boolean;
    user: boolean;
    project: boolean;
  };
  paths: {
    user: string;
    project: string;
  };
}

/**
 * Config resolver interface
 */
export interface IConfigResolver {
  /**
   * Resolve configuration from all levels
   */
  resolve(): Promise<ConfigResolutionResult>;

  /**
   * Get just the resolved config
   */
  getConfig(): Promise<AutomatosXConfig>;

  /**
   * Check if user config exists
   */
  hasUserConfig(): Promise<boolean>;

  /**
   * Check if project config exists
   */
  hasProjectConfig(): Promise<boolean>;
}

// ============================================================================
// Config Resolver Implementation
// ============================================================================

/**
 * Multi-level config resolver
 */
export class ConfigResolver implements IConfigResolver {
  private store = createConfigStore();

  /**
   * Resolve configuration from all levels
   */
  async resolve(): Promise<ConfigResolutionResult> {
    const hasUser = await this.store.exists('global');
    const hasProject = await this.store.exists('local');
    const config = await this.store.readMerged();

    return {
      config,
      sources: {
        defaults: true, // Always includes defaults
        user: hasUser,
        project: hasProject,
      },
      paths: {
        user: CONFIG_PATHS.global,
        project: CONFIG_PATHS.local,
      },
    };
  }

  /**
   * Get just the resolved config
   */
  async getConfig(): Promise<AutomatosXConfig> {
    return this.store.readMerged();
  }

  /**
   * Check if user config exists
   */
  async hasUserConfig(): Promise<boolean> {
    return this.store.exists('global');
  }

  /**
   * Check if project config exists
   */
  async hasProjectConfig(): Promise<boolean> {
    return this.store.exists('local');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a config resolver
 */
export function createConfigResolver(): IConfigResolver {
  return new ConfigResolver();
}

/**
 * Quick resolve - returns just the config
 */
export async function resolveConfig(): Promise<AutomatosXConfig> {
  const resolver = new ConfigResolver();
  return resolver.getConfig();
}

/**
 * Full resolve - returns config with metadata
 */
export async function resolveConfigFull(): Promise<ConfigResolutionResult> {
  const resolver = new ConfigResolver();
  return resolver.resolve();
}

// ============================================================================
// Path Constants (re-export for convenience)
// ============================================================================

export { CONFIG_PATHS, DATA_PATHS };
