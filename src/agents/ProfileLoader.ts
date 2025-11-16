/**
 * ProfileLoader - Load and validate YAML agent profiles
 * Restores v7.6.1 agent system for v8.x
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';
import { logger } from '../utils/logger.js';
import { resolveFileWithExtensions, listFilesWithExtensions } from '../utils/file-helpers.js';
import { AUTOMATOSX_DIRS, AGENT_FILE_EXTENSIONS } from './constants.js';
import { loadAgentMessagesConfig, type AgentMessagesConfig } from '../config/AgentMessagesConfig.js';

/**
 * Agent profile structure (from v7.6.1 YAML schema)
 */
export interface AgentProfile {
  name: string;
  displayName?: string;
  team?: string;
  role: string;
  description: string;

  // Abilities
  abilities: string[];
  abilitySelection?: {
    core: string[];
    taskBased: Record<string, string[]>;
  };

  // Providers
  providers?: {
    default: string;
    fallback?: string[];
  };

  // Orchestration
  orchestration?: {
    maxDelegationDepth: number;
    canReadWorkspaces?: string[];
    canWriteToShared?: boolean;
  };

  // Prompts
  systemPrompt: string;

  // Optional overrides
  temperature?: number;
  maxTokens?: number;
}

/**
 * Loads agent profiles from .automatosx/agents/*.yaml files
 */
export class ProfileLoader {
  // REFACTORING #34: Load file error messages from YAML
  private messagesConfig: AgentMessagesConfig;

  private projectRoot: string;
  private profileCache: Map<string, AgentProfile> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.messagesConfig = loadAgentMessagesConfig();
  }

  /**
   * Load agent profile from YAML file
   */
  async loadProfile(agentName: string): Promise<AgentProfile> {
    // Check cache first
    if (this.profileCache.has(agentName)) {
      return this.profileCache.get(agentName)!;
    }

    const profilePath = this.resolveProfilePath(agentName);

    // BUG FIX #35: Remove TOCTOU race condition by handling file errors in catch block
    // instead of checking existence first
    try {
      const yamlContent = await readFile(profilePath, 'utf-8');
      const profile = YAML.parse(yamlContent) as AgentProfile;

      // Validate required fields
      this.validateProfile(profile, agentName);

      // Cache for future use
      this.profileCache.set(agentName, profile);

      logger.info(`Loaded agent profile: ${agentName}`, {
        role: profile.role,
        team: profile.team,
        abilities: profile.abilities?.length || 0
      });

      return profile;
    } catch (error) {
      // BUG FIX #35: Provide helpful error message for ENOENT
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`${this.messagesConfig.fileErrors.profileNotFound}: ${agentName} (searched: ${profilePath})`);
      }

      // REFACTORING: Add structured error context for other errors
      const errorContext = {
        agentName,
        profilePath,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      };
      // REFACTORING #34: Use YAML-configured error message
      logger.error(`${this.messagesConfig.fileErrors.failedToLoad} agent profile: ${agentName}`, errorContext);
      throw error;
    }
  }

  /**
   * List all available agents in .automatosx/agents/
   */
  async listAgents(): Promise<string[]> {
    const agentsDir = join(this.projectRoot, AUTOMATOSX_DIRS.AGENTS);

    try {
      return await listFilesWithExtensions(agentsDir, AGENT_FILE_EXTENSIONS.YAML);
    } catch (error) {
      // REFACTORING #34: Use YAML-configured error message
      logger.error(`${this.messagesConfig.fileErrors.failedToList} agents`, { error });
      return [];
    }
  }

  /**
   * Get detailed info about an agent
   */
  async getAgentInfo(agentName: string): Promise<{
    name: string;
    displayName?: string;
    role: string;
    description: string;
    team?: string;
    abilities: number;
  }> {
    const profile = await this.loadProfile(agentName);

    return {
      name: profile.name,
      displayName: profile.displayName,
      role: profile.role,
      description: profile.description,
      team: profile.team,
      abilities: profile.abilities?.length || 0
    };
  }

  /**
   * Clear profile cache (useful for testing)
   */
  clearCache(): void {
    this.profileCache.clear();
  }

  /**
   * Resolve agent profile file path
   */
  private resolveProfilePath(agentName: string): string {
    const agentsDir = join(this.projectRoot, AUTOMATOSX_DIRS.AGENTS);
    return resolveFileWithExtensions(agentsDir, agentName, AGENT_FILE_EXTENSIONS.YAML);
  }

  /**
   * Validate profile has required fields
   */
  private validateProfile(profile: unknown, agentName: string): asserts profile is AgentProfile {
    if (!profile || typeof profile !== 'object') {
      // REFACTORING #34: Use YAML-configured error message
      throw new Error(`${this.messagesConfig.fileErrors.invalidProfile}: ${agentName} - not an object`);
    }

    const p = profile as Partial<AgentProfile>;

    // REFACTORING: Use helper function to reduce duplication
    const requiredFields: Array<keyof AgentProfile> = ['name', 'role', 'description', 'systemPrompt'];
    for (const field of requiredFields) {
      if (!p[field]) {
        // REFACTORING #34: Use YAML-configured error message
        throw new Error(`Agent profile ${this.messagesConfig.fileErrors.missingField}: ${field} (agent: ${agentName})`);
      }
    }

    // Abilities is optional but should be an array if present
    if (p.abilities && !Array.isArray(p.abilities)) {
      // REFACTORING #34: Use YAML-configured error message
      throw new Error(`Agent profile field 'abilities' ${this.messagesConfig.fileErrors.invalidFieldType} (agent: ${agentName})`);
    }

    // BUG FIX: Initialize empty abilities array if missing to prevent runtime errors
    if (!p.abilities) {
      p.abilities = [];
    }
  }
}
