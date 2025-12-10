/**
 * Router Ability Manager (v13.2.0)
 *
 * Manages ability-to-provider routing for intelligent provider selection
 * based on task type/ability. Uses configuration from RoutingConfigurator.
 *
 * Ability types represent categories of tasks:
 * - code-generation: Writing new code
 * - code-review: Reviewing and analyzing code
 * - security-audit: Security analysis and vulnerability detection
 * - documentation: Writing docs, comments, READMEs
 * - data-analysis: Analyzing data, generating reports
 * - architecture: System design, architectural decisions
 * - testing: Test generation and execution
 * - devops: Infrastructure, CI/CD, deployment
 * - research: Information gathering, exploration
 * - creative: Creative writing, brainstorming
 *
 * @module core/router/ability-manager
 */

import { logger } from '../../shared/logging/logger.js';
import type { AbilityRoutingConfig, RoutingConfig } from '../../types/config.js';

/**
 * Known ability types for provider routing
 */
export const ABILITY_TYPES = [
  'code-generation',
  'code-review',
  'security-audit',
  'documentation',
  'data-analysis',
  'architecture',
  'testing',
  'devops',
  'research',
  'creative',
] as const;

export type AbilityType = typeof ABILITY_TYPES[number];

/**
 * Ability routing lookup result
 */
export interface AbilityLookupResult {
  /** Whether ability routing is configured */
  hasRouting: boolean;
  /** Preferred providers for this ability, in order */
  preferredProviders: string[];
  /** Source of the routing ('config' | 'default') */
  source: 'config' | 'default';
}

/**
 * Options for ability-based provider reordering
 */
export interface AbilityReorderOptions {
  /** Ability type to get routing for */
  abilityType: AbilityType | string;
  /** Available provider names (already filtered by availability) */
  availableProviders: string[];
}

/**
 * Default ability-to-provider mappings
 * Used when no configuration is present
 */
const DEFAULT_ABILITY_ROUTING: Record<string, string[]> = {
  'code-generation': ['claude-code', 'codex', 'qwen', 'gemini-cli'],
  'code-review': ['gemini-cli', 'claude-code', 'grok', 'codex'],
  'security-audit': ['claude-code', 'grok', 'codex'],
  'documentation': ['gemini-cli', 'claude-code', 'grok'],
  'data-analysis': ['gemini-cli', 'claude-code', 'grok', 'qwen'],
  'architecture': ['claude-code', 'gemini-cli', 'grok'],
  'testing': ['gemini-cli', 'claude-code', 'codex'],
  'devops': ['codex', 'claude-code', 'gemini-cli'],
  'research': ['grok', 'gemini-cli', 'claude-code'],
  'creative': ['grok', 'gemini-cli', 'claude-code'],
};

/**
 * Router Ability Manager
 *
 * Provides ability-to-provider routing lookups from configuration.
 * Used by Router to reorder providers based on task type.
 */
export class RouterAbilityManager {
  private routingConfig: RoutingConfig | undefined;
  private abilityRouting: Record<string, AbilityRoutingConfig>;

  constructor(routingConfig?: RoutingConfig) {
    this.routingConfig = routingConfig;
    this.abilityRouting = routingConfig?.abilityRouting ?? {};

    logger.debug('RouterAbilityManager initialized', {
      hasConfig: !!routingConfig,
      abilityCount: Object.keys(this.abilityRouting).length,
      autoConfigured: routingConfig?.autoConfigured,
    });
  }

  /**
   * Update routing configuration at runtime
   */
  updateConfig(routingConfig: RoutingConfig): void {
    this.routingConfig = routingConfig;
    this.abilityRouting = routingConfig.abilityRouting ?? {};

    logger.debug('RouterAbilityManager config updated', {
      abilityCount: Object.keys(this.abilityRouting).length,
      strategy: routingConfig.strategy,
    });
  }

  /**
   * Get routing configuration for a specific ability type
   *
   * @param abilityType - Type of ability (e.g., 'code-generation')
   * @returns AbilityLookupResult with preferred providers
   */
  getAbilityRouting(abilityType: AbilityType | string): AbilityLookupResult {
    // Check for configured routing
    const routing = this.abilityRouting[abilityType];

    if (routing) {
      return {
        hasRouting: true,
        preferredProviders: routing.preferredProviders,
        source: 'config',
      };
    }

    // Check default routing
    const defaultRouting = DEFAULT_ABILITY_ROUTING[abilityType];
    if (defaultRouting) {
      return {
        hasRouting: true,
        preferredProviders: defaultRouting,
        source: 'default',
      };
    }

    // No routing configured for this ability
    return {
      hasRouting: false,
      preferredProviders: [],
      source: 'default',
    };
  }

  /**
   * Reorder providers based on ability routing
   *
   * If an ability has configured routing, reorders the available providers
   * to prioritize those best suited for the ability type.
   *
   * @param options - Ability type and available providers
   * @returns Reordered provider names, or original order if no routing
   */
  reorderByAbility(options: AbilityReorderOptions): string[] {
    const { abilityType, availableProviders } = options;

    if (availableProviders.length <= 1) {
      return availableProviders;
    }

    const routing = this.getAbilityRouting(abilityType);

    if (!routing.hasRouting || routing.preferredProviders.length === 0) {
      logger.debug('No ability routing configured, using default order', {
        abilityType,
        source: routing.source,
      });
      return availableProviders;
    }

    // Build reordered list:
    // 1. Preferred providers (in order, filtered by availability)
    // 2. Remaining available providers not in ability routing
    const reordered: string[] = [];
    const used = new Set<string>();

    // Add preferred providers in order
    for (const provider of routing.preferredProviders) {
      if (availableProviders.includes(provider) && !used.has(provider)) {
        reordered.push(provider);
        used.add(provider);
      }
    }

    // Add remaining providers not in routing config
    for (const provider of availableProviders) {
      if (!used.has(provider)) {
        reordered.push(provider);
        used.add(provider);
      }
    }

    logger.debug('Providers reordered by ability', {
      abilityType,
      original: availableProviders,
      reordered,
      preferredProviders: routing.preferredProviders,
    });

    return reordered;
  }

  /**
   * Check if ability-based routing is enabled
   */
  isEnabled(): boolean {
    return (
      !!this.routingConfig?.autoConfigured &&
      Object.keys(this.abilityRouting).length > 0
    );
  }

  /**
   * Get all configured ability routings
   */
  getAllRoutings(): Record<string, AbilityRoutingConfig> {
    return { ...this.abilityRouting };
  }

  /**
   * Get ability routing statistics for observability
   */
  getStats(): {
    enabled: boolean;
    abilityCount: number;
    strategy: string | undefined;
    lastConfiguredAt: string | undefined;
    configuredAbilities: string[];
  } {
    return {
      enabled: this.isEnabled(),
      abilityCount: Object.keys(this.abilityRouting).length,
      strategy: this.routingConfig?.strategy,
      lastConfiguredAt: this.routingConfig?.lastConfiguredAt,
      configuredAbilities: Object.keys(this.abilityRouting),
    };
  }

  /**
   * Check if an ability type is valid/known
   */
  isKnownAbility(abilityType: string): abilityType is AbilityType {
    return ABILITY_TYPES.includes(abilityType as AbilityType);
  }

  /**
   * Get all known ability types
   */
  getKnownAbilities(): readonly string[] {
    return ABILITY_TYPES;
  }
}

/**
 * Singleton instance for global access
 */
let globalAbilityManager: RouterAbilityManager | null = null;

/**
 * Get the global RouterAbilityManager instance
 *
 * @param routingConfig - Optional routing config to initialize with
 */
export function getRouterAbilityManager(routingConfig?: RoutingConfig): RouterAbilityManager {
  if (!globalAbilityManager) {
    globalAbilityManager = new RouterAbilityManager(routingConfig);
  } else if (routingConfig) {
    globalAbilityManager.updateConfig(routingConfig);
  }
  return globalAbilityManager;
}

/**
 * Reset the global RouterAbilityManager (for testing)
 */
export function resetRouterAbilityManager(): void {
  globalAbilityManager = null;
}
