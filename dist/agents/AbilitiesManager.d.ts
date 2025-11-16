/**
 * AbilitiesManager - Load and manage agent abilities (markdown files)
 * Restores v7.6.1 abilities system for v8.x
 */
import type { AgentProfile } from './ProfileLoader.js';
/**
 * Manages loading and selection of ability markdown files
 */
export declare class AbilitiesManager {
    private messagesConfig;
    private projectRoot;
    private abilityCache;
    constructor(projectRoot?: string);
    /**
     * Load core abilities for an agent profile
     */
    loadCoreAbilities(profile: AgentProfile): Promise<string[]>;
    /**
     * Select task-specific abilities based on keywords
     */
    loadTaskAbilities(task: string, profile: AgentProfile): Promise<string[]>;
    /**
     * Load all abilities for an agent (core + task-based)
     */
    loadAllAbilities(task: string, profile: AgentProfile): Promise<string[]>;
    /**
     * Load a single ability markdown file
     */
    loadAbility(abilityName: string): Promise<string | null>;
    /**
     * List all available abilities
     */
    listAbilities(): Promise<string[]>;
    /**
     * Format abilities for injection into system prompt
     */
    formatAbilitiesForPrompt(abilities: string[]): string;
    /**
     * Clear ability cache (useful for testing)
     */
    clearCache(): void;
}
//# sourceMappingURL=AbilitiesManager.d.ts.map