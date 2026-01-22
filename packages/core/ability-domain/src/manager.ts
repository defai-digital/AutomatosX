/**
 * Ability Manager
 *
 * Coordinates ability loading and injection into agent contexts.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Ability, AbilityInjectionResult } from '@defai.digital/contracts';
import type {
  AbilityRegistry,
  AbilityManager,
  AbilityInjectionOptions,
  AbilityDomainConfig,
} from './types.js';
import { DEFAULT_ABILITY_DOMAIN_CONFIG } from './types.js';

/**
 * Load project rules from .automatosx/rules.md if it exists
 */
function loadProjectRules(workingDir?: string): string | undefined {
  const baseDir = workingDir ?? process.cwd();
  const rulesPath = path.join(baseDir, '.automatosx', 'rules.md');

  try {
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf-8').trim();
      if (content.length > 0) {
        return content;
      }
    }
  } catch {
    // Silently ignore errors reading rules file
  }

  return undefined;
}

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
   * Also auto-injects .automatosx/rules.md if present in the project
   *
   * INV-ABL-001: Core abilities are injected first (before project rules)
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

    // INV-ABL-001: Separate core abilities from others to inject them first
    const coreAbilitySet = new Set(coreAbilities ?? []);
    const coreAbilitiesList = abilities.filter(a => coreAbilitySet.has(a.abilityId));
    const otherAbilities = abilities.filter(a => !coreAbilitySet.has(a.abilityId));

    // Helper function to inject an ability
    const injectAbility = (ability: typeof abilities[0]): boolean => {
      const abilityTokens = this.estimateTokens(ability.content);

      if (currentTokens + abilityTokens > maxTokens) {
        return false; // Would exceed token limit
      }

      const header = options?.includeMetadata
        ? `## ${ability.displayName ?? ability.abilityId}\n\n`
        : '';

      contentParts.push(header + ability.content);
      injectedAbilities.push(ability.abilityId);
      currentTokens += abilityTokens;
      return true;
    };

    // INV-ABL-001: First inject core abilities (in order of relevance score)
    for (const ability of coreAbilitiesList) {
      if (!injectAbility(ability)) {
        truncated = true;
        break;
      }
    }

    // Then inject project rules if present (.automatosx/rules.md)
    if (!truncated) {
      const projectRules = loadProjectRules();
      if (projectRules) {
        const rulesHeader = '## Project Rules\n\nThe following rules MUST be followed for all code in this project:\n\n';
        const rulesContent = rulesHeader + projectRules;
        const rulesTokens = this.estimateTokens(rulesContent);

        if (currentTokens + rulesTokens <= maxTokens) {
          contentParts.push(rulesContent);
          injectedAbilities.push('_project-rules');
          currentTokens += rulesTokens;
        }
      }
    }

    // Finally inject remaining abilities
    if (!truncated) {
      for (const ability of otherAbilities) {
        if (!injectAbility(ability)) {
          truncated = true;
          break;
        }
      }
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
