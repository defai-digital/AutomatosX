/**
 * Provider Selector
 *
 * Selects the best provider for agent execution with fallback support.
 * Implements graceful degradation when preferred providers are unavailable.
 *
 * Invariants:
 * - INV-PROV-SEL-001: Selection is deterministic (same input = same output)
 * - INV-PROV-SEL-002: Cascade strategy tries preferred, then any available
 * - INV-PROV-SEL-003: Strict strategy fails if no preferred provider available
 * - INV-PROV-SEL-004: Excluded providers are never selected
 * - INV-PROV-SEL-005: TaskOverrides take precedence over preferred list
 */

import type { ProviderAffinity, FallbackStrategy } from '@defai.digital/contracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of provider selection
 */
export interface ProviderSelectionResult {
  /** Selected provider ID */
  selected: string;
  /** Fallback chain in priority order (excludes selected) */
  fallbackChain: string[];
  /** Human-readable reason for selection */
  reason: string;
  /** Strategy used for selection */
  strategy: FallbackStrategy;
}

/**
 * Error thrown when no provider is available
 */
export class NoProviderAvailableError extends Error {
  public readonly code = 'NO_PROVIDER_AVAILABLE';

  constructor(
    public readonly attempted: string[],
    public readonly available: string[],
    public readonly excluded: string[]
  ) {
    const suggestions = NoProviderAvailableError.getSuggestions(attempted, available);
    super(
      `No provider available for this task.\n` +
        `  Attempted: ${attempted.length ? attempted.join(', ') : '(none specified)'}\n` +
        `  Available: ${available.length ? available.join(', ') : 'none'}\n` +
        `  Excluded: ${excluded.length ? excluded.join(', ') : 'none'}\n\n` +
        `Suggestions:\n${suggestions.map((s) => `  • ${s}`).join('\n')}`
    );
    this.name = 'NoProviderAvailableError';
  }

  private static getSuggestions(attempted: string[], available: string[]): string[] {
    if (available.length === 0) {
      return [
        "Run 'ax doctor' to check provider status",
        "Run 'ax setup' to configure providers",
        'Install a provider CLI: claude, gemini, codex, or grok',
      ];
    }
    if (attempted.length && !attempted.some((a) => available.includes(a))) {
      return [
        `Install a preferred provider: ${attempted.join(' or ')}`,
        `Or update agent config to use available providers: ${available.join(', ')}`,
      ];
    }
    return ["Check provider health with 'ax doctor'"];
  }
}

// ============================================================================
// Provider Selector Interface
// ============================================================================

/**
 * Provider selector interface
 */
export interface ProviderSelector {
  /**
   * Select the best provider based on affinity and availability
   *
   * @param affinity - Agent's provider affinity configuration
   * @param availableProviders - List of currently available providers
   * @param taskType - Optional task type for task-specific overrides
   * @returns Selection result with provider and fallback chain
   * @throws NoProviderAvailableError if no suitable provider found
   */
  selectProvider(
    affinity: ProviderAffinity | undefined,
    availableProviders: string[],
    taskType?: string
  ): ProviderSelectionResult;
}

// ============================================================================
// Default Provider Selector Implementation
// ============================================================================

/**
 * Configuration for the default provider selector
 */
export interface DefaultProviderSelectorConfig {
  /** Default provider when no affinity specified */
  defaultProvider: string;
  /** Global provider priority order for fallback */
  globalPriority: string[];
}

/**
 * Default provider selector with cascading fallback support
 */
export class DefaultProviderSelector implements ProviderSelector {
  private readonly config: DefaultProviderSelectorConfig;

  constructor(config: Partial<DefaultProviderSelectorConfig> = {}) {
    this.config = {
      defaultProvider: config.defaultProvider ?? 'claude',
      globalPriority: config.globalPriority ?? ['claude', 'grok', 'gemini', 'codex', 'opencode'],
    };
  }

  /**
   * Select the best provider based on affinity and availability
   *
   * INV-PROV-SEL-001: Selection is deterministic
   * INV-PROV-SEL-005: TaskOverrides take precedence
   */
  selectProvider(
    affinity: ProviderAffinity | undefined,
    availableProviders: string[],
    taskType?: string
  ): ProviderSelectionResult {
    const strategy: FallbackStrategy = affinity?.fallbackStrategy ?? 'cascade';
    const excluded = affinity?.excluded ?? [];

    // INV-PROV-SEL-004: Filter out excluded providers
    const candidates = availableProviders.filter((p) => !excluded.includes(p));

    if (candidates.length === 0) {
      throw new NoProviderAvailableError(
        affinity?.preferred ?? [],
        availableProviders,
        excluded
      );
    }

    // INV-PROV-SEL-005: Check task-specific override first
    if (taskType && affinity?.taskOverrides?.[taskType]) {
      const taskProvider = affinity.taskOverrides[taskType];
      if (candidates.includes(taskProvider)) {
        const fallbackChain = this.buildFallbackChain(
          taskProvider,
          candidates,
          affinity,
          strategy
        );
        return {
          selected: taskProvider,
          fallbackChain,
          reason: `Selected from taskOverride for '${taskType}'`,
          strategy,
        };
      }
      // Task override not available, continue to preferred list
    }

    // Build preference list
    const preferenceList = affinity?.preferred ?? [];

    // Try preferred providers in order
    for (const provider of preferenceList) {
      if (candidates.includes(provider)) {
        const fallbackChain = this.buildFallbackChain(
          provider,
          candidates,
          affinity,
          strategy
        );
        return {
          selected: provider,
          fallbackChain,
          reason: `Selected from preferred list`,
          strategy,
        };
      }
    }

    // INV-PROV-SEL-003: Strict strategy fails if no preferred available
    if (strategy === 'strict') {
      throw new NoProviderAvailableError(preferenceList, availableProviders, excluded);
    }

    // INV-PROV-SEL-002: Cascade/any-available falls back to any provider
    // Use global priority order for determinism
    const globalOrder = this.config.globalPriority;
    for (const provider of globalOrder) {
      if (candidates.includes(provider)) {
        const fallbackChain = this.buildFallbackChain(
          provider,
          candidates,
          affinity,
          strategy
        );
        return {
          selected: provider,
          fallbackChain,
          reason:
            strategy === 'any-available'
              ? `Selected first available provider`
              : `Fallback to available provider (preferred not available)`,
          strategy,
        };
      }
    }

    // Use first candidate if not in global priority
    const selected = candidates[0]!;
    const fallbackChain = candidates.slice(1);
    return {
      selected,
      fallbackChain,
      reason: `Fallback to first available provider`,
      strategy,
    };
  }

  /**
   * Build fallback chain based on strategy
   */
  private buildFallbackChain(
    selected: string,
    candidates: string[],
    affinity: ProviderAffinity | undefined,
    strategy: FallbackStrategy
  ): string[] {
    // Strict strategy has no fallback
    if (strategy === 'strict') {
      // Only include other preferred providers
      const preferred = affinity?.preferred ?? [];
      return preferred.filter((p) => p !== selected && candidates.includes(p));
    }

    // For cascade and any-available, include all available providers
    const remaining = candidates.filter((p) => p !== selected);

    // Sort by global priority for determinism
    const globalOrder = this.config.globalPriority;
    return remaining.sort((a, b) => {
      const aIndex = globalOrder.indexOf(a);
      const bIndex = globalOrder.indexOf(b);
      // Providers not in global list go last
      const aScore = aIndex === -1 ? 999 : aIndex;
      const bScore = bIndex === -1 ? 999 : bIndex;
      return aScore - bScore;
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a default provider selector
 */
export function createProviderSelector(
  config?: Partial<DefaultProviderSelectorConfig>
): ProviderSelector {
  return new DefaultProviderSelector(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get recommended provider affinity for an agent type
 */
export function getRecommendedAffinity(
  agentCategory: 'orchestrator' | 'implementer' | 'reviewer' | 'specialist' | 'generalist'
): ProviderAffinity {
  switch (agentCategory) {
    case 'orchestrator':
      // Orchestrators need strong reasoning - prefer Claude, fallback gracefully
      return {
        preferred: ['claude', 'grok', 'gemini'],
        fallbackStrategy: 'cascade',
        defaultSynthesizer: 'claude',
      };

    case 'implementer':
      // Implementers need coding strength - prefer Claude/Codex
      return {
        preferred: ['claude', 'codex', 'grok'],
        taskOverrides: {
          implementation: 'claude',
          debugging: 'claude',
          refactoring: 'claude',
        },
        fallbackStrategy: 'cascade',
      };

    case 'reviewer':
      // Reviewers need strong analysis - prefer Claude
      return {
        preferred: ['claude', 'gemini'],
        fallbackStrategy: 'cascade',
      };

    case 'specialist':
      // Specialists may need specific capabilities - prefer Claude but allow fallback
      return {
        preferred: ['claude'],
        fallbackStrategy: 'cascade',
      };

    case 'generalist':
    default:
      // Generalists are flexible - use any available
      return {
        preferred: ['claude', 'grok', 'gemini', 'codex'],
        fallbackStrategy: 'any-available',
      };
  }
}
