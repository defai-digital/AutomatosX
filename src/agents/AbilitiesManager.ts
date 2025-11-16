/**
 * AbilitiesManager - Load and manage agent abilities (markdown files)
 * Restores v7.6.1 abilities system for v8.x
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { listFilesWithExtensions } from '../utils/file-helpers.js';
import type { AgentProfile } from './ProfileLoader.js';
import { AUTOMATOSX_DIRS, AGENT_FILE_EXTENSIONS } from './constants.js';
import { loadAgentMessagesConfig, type AgentMessagesConfig } from '../config/AgentMessagesConfig.js';

/**
 * Manages loading and selection of ability markdown files
 */
export class AbilitiesManager {
  // REFACTORING #32: Load ability formatting from YAML configuration
  private messagesConfig: AgentMessagesConfig;

  private projectRoot: string;
  private abilityCache: Map<string, string> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.messagesConfig = loadAgentMessagesConfig();
  }

  /**
   * Load core abilities for an agent profile
   */
  async loadCoreAbilities(profile: AgentProfile): Promise<string[]> {
    // BUG FIX #10: Load abilities in parallel for better performance
    let abilityNames: string[] = [];

    // Collect ability names to load
    if (profile.abilitySelection?.core) {
      abilityNames = profile.abilitySelection.core;
    } else if (profile.abilities) {
      abilityNames = profile.abilities;
    }

    // Load all abilities in parallel
    const abilityPromises = abilityNames.map(name => this.loadAbility(name));
    const results = await Promise.all(abilityPromises);

    // Filter out null results
    const abilities = results.filter((content): content is string => content !== null);

    logger.info(`Loaded ${abilities.length} core abilities`);
    return abilities;
  }

  /**
   * Select task-specific abilities based on keywords
   */
  async loadTaskAbilities(
    task: string,
    profile: AgentProfile
  ): Promise<string[]> {
    if (!profile.abilitySelection?.taskBased) {
      return [];
    }

    const taskLower = task.toLowerCase();
    const selectedNames = new Set<string>();

    // Match keywords in task to ability groups
    for (const [keyword, abilityNames] of Object.entries(profile.abilitySelection.taskBased)) {
      if (taskLower.includes(keyword.toLowerCase())) {
        for (const abilityName of abilityNames) {
          selectedNames.add(abilityName);
        }
      }
    }

    // BUG FIX #10: Load the selected abilities in parallel
    const abilityNamesArray = Array.from(selectedNames);
    const abilityPromises = abilityNamesArray.map(name => this.loadAbility(name));
    const results = await Promise.all(abilityPromises);

    // Filter out null results
    const abilities = results.filter((content): content is string => content !== null);

    if (abilities.length > 0) {
      logger.info(`Loaded ${abilities.length} task-specific abilities for keywords: ${abilityNamesArray.join(', ')}`);
    }

    return abilities;
  }

  /**
   * Load all abilities for an agent (core + task-based)
   */
  async loadAllAbilities(
    task: string,
    profile: AgentProfile
  ): Promise<string[]> {
    const coreAbilities = await this.loadCoreAbilities(profile);
    const taskAbilities = await this.loadTaskAbilities(task, profile);

    // Combine and deduplicate
    const allAbilities = [...coreAbilities, ...taskAbilities];

    // Remove duplicates using Set
    const uniqueAbilities = Array.from(new Set(allAbilities));

    logger.debug(`Loaded abilities: ${uniqueAbilities.length} unique (${allAbilities.length - uniqueAbilities.length} duplicates removed)`);

    return uniqueAbilities;
  }

  /**
   * Load a single ability markdown file
   */
  async loadAbility(abilityName: string): Promise<string | null> {
    // Check cache first
    if (this.abilityCache.has(abilityName)) {
      return this.abilityCache.get(abilityName)!;
    }

    const abilityPath = join(
      this.projectRoot,
      AUTOMATOSX_DIRS.ABILITIES,
      `${abilityName}.md`
    );

    // BUG FIX #35: Remove TOCTOU race condition by handling file errors in catch block
    try {
      const content = await readFile(abilityPath, 'utf-8');

      // Cache for future use
      this.abilityCache.set(abilityName, content);

      return content;
    } catch (error) {
      // BUG FIX #35: Provide helpful warning for ENOENT
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        logger.warn(`${this.messagesConfig.fileErrors.abilityNotFound}: ${abilityName}`);
        return null;
      }

      // REFACTORING #35: Use YAML-configured error message for other errors
      logger.error(`${this.messagesConfig.fileErrors.failedToLoad} ability: ${abilityName}`, { error });
      return null;
    }
  }

  /**
   * List all available abilities
   */
  async listAbilities(): Promise<string[]> {
    const abilitiesDir = join(this.projectRoot, AUTOMATOSX_DIRS.ABILITIES);

    try {
      return await listFilesWithExtensions(abilitiesDir, AGENT_FILE_EXTENSIONS.MARKDOWN);
    } catch (error) {
      // REFACTORING #35: Use YAML-configured error message
      logger.error(`${this.messagesConfig.fileErrors.failedToList} abilities`, { error });
      return [];
    }
  }

  /**
   * Format abilities for injection into system prompt
   */
  formatAbilitiesForPrompt(abilities: string[]): string {
    if (abilities.length === 0) {
      return '';
    }

    // REFACTORING #32: Use YAML-configured ability formatting
    return `

${this.messagesConfig.abilities.header}

${this.messagesConfig.abilities.intro}

${abilities.join(this.messagesConfig.abilities.separator)}

${this.messagesConfig.abilities.footer}
`;
  }

  /**
   * Clear ability cache (useful for testing)
   */
  clearCache(): void {
    this.abilityCache.clear();
  }
}
