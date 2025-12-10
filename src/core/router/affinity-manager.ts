/**
 * Router Affinity Manager (v13.1.0)
 *
 * Manages agent-provider affinity lookups for intelligent provider selection.
 * Uses configuration from RoutingConfigurator to match agents with optimal providers.
 *
 * @module core/router/affinity-manager
 */

import { logger } from '../../shared/logging/logger.js';
import type { AgentAffinityConfig, RoutingConfig } from '../../types/config.js';

/**
 * Agent affinity lookup result
 */
export interface AffinityLookupResult {
  /** Whether an affinity was found for the agent */
  hasAffinity: boolean;
  /** Primary provider for this agent (if found) */
  primary: string | null;
  /** Fallback providers in order of preference */
  fallback: string[];
  /** Source of the affinity ('config' | 'default') */
  source: 'config' | 'default';
}

/**
 * Options for affinity-based provider reordering
 */
export interface AffinityReorderOptions {
  /** Agent name to get affinity for */
  agentName: string;
  /** Available provider names (already filtered by availability) */
  availableProviders: string[];
}

/**
 * Router Affinity Manager
 *
 * Provides agent-provider affinity lookups from configuration.
 * Used by Router to reorder providers based on agent-specific preferences.
 */
export class RouterAffinityManager {
  private routingConfig: RoutingConfig | undefined;
  private agentAffinities: Record<string, AgentAffinityConfig>;

  constructor(routingConfig?: RoutingConfig) {
    this.routingConfig = routingConfig;
    this.agentAffinities = routingConfig?.agentAffinities ?? {};

    logger.debug('RouterAffinityManager initialized', {
      hasConfig: !!routingConfig,
      agentCount: Object.keys(this.agentAffinities).length,
      autoConfigured: routingConfig?.autoConfigured,
    });
  }

  /**
   * Update routing configuration at runtime
   */
  updateConfig(routingConfig: RoutingConfig): void {
    this.routingConfig = routingConfig;
    this.agentAffinities = routingConfig.agentAffinities ?? {};

    logger.debug('RouterAffinityManager config updated', {
      agentCount: Object.keys(this.agentAffinities).length,
      strategy: routingConfig.strategy,
    });
  }

  /**
   * Get affinity configuration for a specific agent
   *
   * @param agentName - Name of the agent
   * @returns AffinityLookupResult with primary provider and fallback chain
   */
  getAgentAffinity(agentName: string): AffinityLookupResult {
    // Check for configured affinity
    const affinity = this.agentAffinities[agentName];

    if (affinity) {
      return {
        hasAffinity: true,
        primary: affinity.primary,
        fallback: affinity.fallback,
        source: 'config',
      };
    }

    // No affinity configured for this agent
    return {
      hasAffinity: false,
      primary: null,
      fallback: [],
      source: 'default',
    };
  }

  /**
   * Reorder providers based on agent affinity
   *
   * If an agent has configured affinities, reorders the available providers
   * to prioritize the primary provider and fallback chain.
   *
   * @param options - Agent name and available providers
   * @returns Reordered provider names, or original order if no affinity
   */
  reorderByAffinity(options: AffinityReorderOptions): string[] {
    const { agentName, availableProviders } = options;

    if (availableProviders.length <= 1) {
      return availableProviders;
    }

    const affinity = this.getAgentAffinity(agentName);

    if (!affinity.hasAffinity || !affinity.primary) {
      logger.debug('No affinity configured, using default order', {
        agentName,
        source: affinity.source,
      });
      return availableProviders;
    }

    // Build reordered list:
    // 1. Primary (if available)
    // 2. Fallback chain (in order, filtered by availability)
    // 3. Remaining available providers not in affinity config
    const reordered: string[] = [];
    const used = new Set<string>();

    // Add primary if available
    if (affinity.primary && availableProviders.includes(affinity.primary)) {
      reordered.push(affinity.primary);
      used.add(affinity.primary);
    }

    // Add fallback chain in order
    for (const fallback of affinity.fallback) {
      if (availableProviders.includes(fallback) && !used.has(fallback)) {
        reordered.push(fallback);
        used.add(fallback);
      }
    }

    // Add remaining providers not in affinity config
    for (const provider of availableProviders) {
      if (!used.has(provider)) {
        reordered.push(provider);
        used.add(provider);
      }
    }

    logger.debug('Providers reordered by affinity', {
      agentName,
      original: availableProviders,
      reordered,
      primary: affinity.primary,
      fallbackChain: affinity.fallback,
    });

    return reordered;
  }

  /**
   * Check if affinity-based routing is enabled
   */
  isEnabled(): boolean {
    return (
      !!this.routingConfig?.autoConfigured &&
      Object.keys(this.agentAffinities).length > 0
    );
  }

  /**
   * Get all configured agent affinities
   */
  getAllAffinities(): Record<string, AgentAffinityConfig> {
    return { ...this.agentAffinities };
  }

  /**
   * Get affinity statistics for observability
   */
  getStats(): {
    enabled: boolean;
    agentCount: number;
    strategy: string | undefined;
    lastConfiguredAt: string | undefined;
  } {
    return {
      enabled: this.isEnabled(),
      agentCount: Object.keys(this.agentAffinities).length,
      strategy: this.routingConfig?.strategy,
      lastConfiguredAt: this.routingConfig?.lastConfiguredAt,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalAffinityManager: RouterAffinityManager | null = null;

/**
 * Get the global RouterAffinityManager instance
 *
 * @param routingConfig - Optional routing config to initialize with
 */
export function getRouterAffinityManager(routingConfig?: RoutingConfig): RouterAffinityManager {
  if (!globalAffinityManager) {
    globalAffinityManager = new RouterAffinityManager(routingConfig);
  } else if (routingConfig) {
    globalAffinityManager.updateConfig(routingConfig);
  }
  return globalAffinityManager;
}

/**
 * Reset the global RouterAffinityManager (for testing)
 */
export function resetRouterAffinityManager(): void {
  globalAffinityManager = null;
}
