/**
 * Cache Warming Strategies
 *
 * NOTE: Current implementation only discovers and counts files.
 * Actual cache preloading is planned for v4.1.
 *
 * This module can be used for warming discovery but does not
 * currently load profiles/abilities into their respective caches.
 *
 * @module core/cache-warmer
 * @status Partial Implementation - Discovery only
 */

import { readdir } from 'fs/promises';
import { logger } from '../../shared/logging/logger.js';

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  /** Paths to warm */
  paths?: {
    agents?: string;
    abilities?: string;
  };
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum parallel warmup operations */
  concurrency?: number;
}

/**
 * Cache Warmer
 *
 * Preloads frequently accessed data into caches to reduce
 * cold start latency.
 */
export class CacheWarmer {
  private config: Required<CacheWarmingConfig>;
  private warmupStats = {
    agents: 0,
    abilities: 0,
    duration: 0
  };

  constructor(config?: CacheWarmingConfig) {
    this.config = {
      paths: config?.paths ?? {},
      debug: config?.debug ?? false,
      concurrency: config?.concurrency ?? 5
    };
  }

  /**
   * Warm all caches
   *
   * @returns Warming statistics
   */
  async warmAll(): Promise<{
    agents: number;
    abilities: number;
    duration: number;
  }> {
    const start = performance.now();

    if (this.config.debug) {
      logger.debug('Cache warming started', this.config.paths);
    }

    const tasks: Promise<void>[] = [];

    // Warm agent profiles
    if (this.config.paths.agents) {
      tasks.push(this.warmAgents(this.config.paths.agents));
    }

    // Warm abilities
    if (this.config.paths.abilities) {
      tasks.push(this.warmAbilities(this.config.paths.abilities));
    }

    // Execute all warming tasks in parallel
    await Promise.all(tasks);

    const duration = performance.now() - start;
    this.warmupStats.duration = duration;

    if (this.config.debug) {
      logger.debug('Cache warming complete', {
        agents: this.warmupStats.agents,
        abilities: this.warmupStats.abilities,
        duration: `${duration.toFixed(2)}ms`
      });
    }

    return this.warmupStats;
  }

  /**
   * Warm agent profile cache
   *
   * NOTE: Current implementation only counts YAML files.
   * Actual cache loading will be implemented in v4.1.
   */
  private async warmAgents(agentPath: string): Promise<void> {
    try {
      const files = await readdir(agentPath);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      this.warmupStats.agents = yamlFiles.length;

      if (this.config.debug) {
        logger.debug('Warming agent cache', {
          path: agentPath,
          count: yamlFiles.length
        });
      }
    } catch (error) {
      if (this.config.debug) {
        logger.debug('Agent cache warming skipped', {
          path: agentPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Warm abilities cache
   *
   * NOTE: Current implementation only counts Markdown files.
   * Actual cache loading will be implemented in v4.1.
   */
  private async warmAbilities(abilitiesPath: string): Promise<void> {
    try {
      const files = await readdir(abilitiesPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      this.warmupStats.abilities = mdFiles.length;

      if (this.config.debug) {
        logger.debug('Warming abilities cache', {
          path: abilitiesPath,
          count: mdFiles.length
        });
      }
    } catch (error) {
      if (this.config.debug) {
        logger.debug('Abilities cache warming skipped', {
          path: abilitiesPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return { ...this.warmupStats };
  }
}
