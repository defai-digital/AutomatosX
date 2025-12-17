/**
 * Ability Domain Types
 */

import type { Ability, AbilityInjectionResult } from '@automatosx/contracts';

/**
 * Ability registry interface
 */
export interface AbilityRegistry {
  /**
   * Register an ability
   */
  register(ability: Ability): Promise<void>;

  /**
   * Get an ability by ID
   */
  get(abilityId: string): Promise<Ability | undefined>;

  /**
   * List all abilities
   */
  list(filter?: AbilityFilter): Promise<Ability[]>;

  /**
   * Remove an ability
   */
  remove(abilityId: string): Promise<void>;

  /**
   * Check if ability exists
   */
  exists(abilityId: string): Promise<boolean>;

  /**
   * Clear all abilities
   */
  clear(): Promise<void>;
}

/**
 * Filter for listing abilities
 */
export interface AbilityFilter {
  category?: string;
  tags?: string[];
  enabled?: boolean;
  applicableTo?: string;
}

/**
 * Ability loader interface
 */
export interface AbilityLoader {
  /**
   * Load an ability by ID
   */
  load(abilityId: string): Promise<Ability | undefined>;

  /**
   * Load all abilities from the source
   */
  loadAll(): Promise<Ability[]>;

  /**
   * Check if ability exists
   */
  exists(abilityId: string): Promise<boolean>;

  /**
   * Reload abilities from source
   */
  reload(): Promise<void>;
}

/**
 * Ability loader configuration
 */
export interface AbilityLoaderConfig {
  /** Directory to load abilities from */
  abilitiesDir: string;
  /** File extensions to load */
  extensions?: string[];
}

/**
 * Ability manager interface - coordinates loading and injection
 */
export interface AbilityManager {
  /**
   * Get abilities for an agent based on task
   */
  getAbilitiesForTask(
    agentId: string,
    task: string,
    coreAbilities?: string[],
    maxAbilities?: number
  ): Promise<Ability[]>;

  /**
   * Inject abilities into agent context
   */
  injectAbilities(
    agentId: string,
    task: string,
    coreAbilities?: string[],
    options?: AbilityInjectionOptions
  ): Promise<AbilityInjectionResult>;

  /**
   * Get all abilities applicable to an agent
   */
  getApplicableAbilities(agentId: string): Promise<Ability[]>;
}

/**
 * Options for ability injection
 */
export interface AbilityInjectionOptions {
  maxAbilities?: number;
  maxTokens?: number;
  includeMetadata?: boolean;
}

/**
 * Ability domain configuration
 */
export interface AbilityDomainConfig {
  abilitiesDir: string;
  maxAbilitiesPerAgent: number;
  maxTokensPerInjection: number;
  cacheEnabled: boolean;
}

/**
 * Default ability domain configuration
 */
export const DEFAULT_ABILITY_DOMAIN_CONFIG: AbilityDomainConfig = {
  abilitiesDir: 'examples/abilities',
  maxAbilitiesPerAgent: 10,
  maxTokensPerInjection: 50000,
  cacheEnabled: true,
};
