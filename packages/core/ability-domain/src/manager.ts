/**
 * Ability Manager
 *
 * Coordinates ability loading and injection into agent contexts.
 */

import type { Ability, AbilityInjectionResult } from '@automatosx/contracts';
import type {
  AbilityRegistry,
  AbilityManager,
  AbilityInjectionOptions,
  AbilityDomainConfig,
} from './types.js';
import { DEFAULT_ABILITY_DOMAIN_CONFIG } from './types.js';

/**
 * Default ability manager implementation
 */
export class DefaultAbilityManager implements AbilityManager {
  constructor(
    private readonly registry: AbilityRegistry,
    private readonly config: AbilityDomainConfig = DEFAULT_ABILITY_DOMAIN_CONFIG
  ) {}

  /**
   * Get abilities for an agent based on task keywords
   */
  async getAbilitiesForTask(
    agentId: string,
    task: string,
    coreAbilities?: string[],
    maxAbilities?: number
  ): Promise<Ability[]> {
    const max = maxAbilities ?? this.config.maxAbilitiesPerAgent;
    const taskLower = task.toLowerCase();
    const taskWords = this.extractKeywords(taskLower);

    // Get all applicable abilities
    const applicable = await this.getApplicableAbilities(agentId);

    // Score abilities by relevance to task
    const scored = applicable.map((ability) => ({
      ability,
      score: this.scoreAbility(ability, taskWords, coreAbilities ?? []),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top N abilities
    return scored.slice(0, max).map((s) => s.ability);
  }

  /**
   * Inject abilities into agent context
   */
  async injectAbilities(
    agentId: string,
    task: string,
    coreAbilities?: string[],
    options?: AbilityInjectionOptions
  ): Promise<AbilityInjectionResult> {
    const maxAbilities = options?.maxAbilities ?? this.config.maxAbilitiesPerAgent;
    const maxTokens = options?.maxTokens ?? this.config.maxTokensPerInjection;

    // Get relevant abilities
    const abilities = await this.getAbilitiesForTask(
      agentId,
      task,
      coreAbilities,
      maxAbilities
    );

    // Build combined content
    const injectedAbilities: string[] = [];
    const contentParts: string[] = [];
    let currentTokens = 0;
    let truncated = false;

    for (const ability of abilities) {
      const abilityTokens = this.estimateTokens(ability.content);

      if (currentTokens + abilityTokens > maxTokens) {
        truncated = true;
        break;
      }

      const header = options?.includeMetadata
        ? `## ${ability.displayName ?? ability.abilityId}\n\n`
        : '';

      contentParts.push(header + ability.content);
      injectedAbilities.push(ability.abilityId);
      currentTokens += abilityTokens;
    }

    return {
      agentId,
      injectedAbilities,
      combinedContent: contentParts.join('\n\n---\n\n'),
      tokenCount: currentTokens,
      truncated,
    };
  }

  /**
   * Get all abilities applicable to an agent
   */
  async getApplicableAbilities(agentId: string): Promise<Ability[]> {
    return this.registry.list({
      enabled: true,
      applicableTo: agentId,
    });
  }

  /**
   * Score an ability's relevance to a task
   */
  private scoreAbility(
    ability: Ability,
    taskWords: string[],
    coreAbilities: string[]
  ): number {
    let score = 0;

    // Core ability bonus
    if (coreAbilities.includes(ability.abilityId)) {
      score += 100;
    }

    // Tag matches
    for (const tag of ability.tags ?? []) {
      if (taskWords.includes(tag.toLowerCase())) {
        score += 10;
      }
    }

    // Category match
    if (ability.category && taskWords.includes(ability.category.toLowerCase())) {
      score += 15;
    }

    // Content keyword matches (limited)
    const contentWords = this.extractKeywords(ability.content.toLowerCase());
    const contentMatches = taskWords.filter((w) => contentWords.includes(w)).length;
    score += Math.min(contentMatches * 2, 20);

    // Priority bonus
    score += (ability.priority ?? 50) / 10;

    return score;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return text
      .split(/[\s\-_,./]+/)
      .filter((w) => w.length > 2)
      .map((w) => w.toLowerCase());
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Creates an ability manager
 */
export function createAbilityManager(
  registry: AbilityRegistry,
  config?: Partial<AbilityDomainConfig>
): AbilityManager {
  return new DefaultAbilityManager(registry, {
    ...DEFAULT_ABILITY_DOMAIN_CONFIG,
    ...config,
  });
}
