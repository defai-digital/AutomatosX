/**
 * Ability Registry
 *
 * In-memory storage for abilities with filtering support.
 */

import type { Ability } from '@automatosx/contracts';
import type { AbilityRegistry, AbilityFilter } from './types.js';

/**
 * In-memory ability registry implementation
 */
export class InMemoryAbilityRegistry implements AbilityRegistry {
  private abilities = new Map<string, Ability>();

  async register(ability: Ability): Promise<void> {
    this.abilities.set(ability.abilityId, ability);
  }

  async get(abilityId: string): Promise<Ability | undefined> {
    return this.abilities.get(abilityId);
  }

  async list(filter?: AbilityFilter): Promise<Ability[]> {
    let results = Array.from(this.abilities.values());

    if (filter) {
      if (filter.category !== undefined) {
        results = results.filter((a) => a.category === filter.category);
      }

      if (filter.tags !== undefined && filter.tags.length > 0) {
        results = results.filter((a) =>
          filter.tags!.some((tag) => a.tags?.includes(tag))
        );
      }

      if (filter.enabled !== undefined) {
        results = results.filter((a) => a.enabled === filter.enabled);
      }

      if (filter.applicableTo !== undefined) {
        results = results.filter((a) => {
          // Check if excluded
          if (a.excludeFrom?.includes(filter.applicableTo!)) {
            return false;
          }
          // Check if applicable (empty means all)
          if (!a.applicableTo || a.applicableTo.length === 0) {
            return true;
          }
          return (
            a.applicableTo.includes('*') ||
            a.applicableTo.includes(filter.applicableTo!)
          );
        });
      }
    }

    // Sort by priority (higher first)
    results.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

    return results;
  }

  async remove(abilityId: string): Promise<void> {
    this.abilities.delete(abilityId);
  }

  async exists(abilityId: string): Promise<boolean> {
    return this.abilities.has(abilityId);
  }

  async clear(): Promise<void> {
    this.abilities.clear();
  }
}

/**
 * Creates an in-memory ability registry
 */
export function createAbilityRegistry(): AbilityRegistry {
  return new InMemoryAbilityRegistry();
}
