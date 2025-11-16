/**
 * TeamManager - Load and manage team configurations
 * Restores v7.6.1 team system for v8.x
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';
import { logger } from '../utils/logger.js';
import { resolveFileWithExtensions, listFilesWithExtensions } from '../utils/file-helpers.js';
import type { AgentProfile } from './ProfileLoader.js';
import { AUTOMATOSX_DIRS, AGENT_FILE_EXTENSIONS } from './constants.js';
import { loadAgentMessagesConfig, type AgentMessagesConfig } from '../config/AgentMessagesConfig.js';
import { loadAgentRuntimeConfig, type AgentRuntimeConfig } from '../config/AgentRuntimeConfig.js';

/**
 * Team configuration structure (from v7.6.1 YAML schema)
 */
export interface TeamConfig {
  name: string;
  displayName?: string;
  description: string;

  // Provider Configuration
  provider?: {
    primary: string;
    fallback?: string;
    fallbackChain?: string[];
  };

  // Shared Abilities (all team members inherit these)
  sharedAbilities?: string[];

  // Team Capabilities (for intelligent delegation)
  capabilities?: {
    canDo?: string[];
    shouldDelegate?: string[];
  };

  // Orchestration Defaults
  orchestration?: {
    maxDelegationDepth: number;
    canWriteToShared?: boolean;
    canReadWorkspaces?: string[];
  };

  // Metadata
  metadata?: {
    color?: string;
    icon?: string;
    priority?: number;
  };

  version?: string;
}

/**
 * Loads team configurations from .automatosx/teams/*.yaml files
 */
export class TeamManager {
  // REFACTORING #35: Load configuration from YAML
  private messagesConfig: AgentMessagesConfig;
  private runtimeConfig: AgentRuntimeConfig;

  private projectRoot: string;
  private teamCache: Map<string, TeamConfig> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.messagesConfig = loadAgentMessagesConfig();
    this.runtimeConfig = loadAgentRuntimeConfig();
  }

  /**
   * Load team configuration from YAML file
   */
  async loadTeam(teamName: string): Promise<TeamConfig> {
    // Check cache first
    if (this.teamCache.has(teamName)) {
      return this.teamCache.get(teamName)!;
    }

    const teamPath = this.resolveTeamPath(teamName);

    // BUG FIX #35: Remove TOCTOU race condition by handling file errors in catch block
    try {
      const yamlContent = await readFile(teamPath, 'utf-8');
      const team = YAML.parse(yamlContent) as TeamConfig;

      // Validate required fields
      this.validateTeam(team, teamName);

      // Cache for future use
      this.teamCache.set(teamName, team);

      logger.info(`Loaded team configuration: ${teamName}`, {
        displayName: team.displayName,
        sharedAbilities: team.sharedAbilities?.length || 0
      });

      return team;
    } catch (error) {
      // BUG FIX #35: Provide helpful error message for ENOENT
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`${this.messagesConfig.fileErrors.teamNotFound}: ${teamName} (searched: ${teamPath})`);
      }

      // REFACTORING: Add structured error context for other errors
      const errorContext = {
        teamName,
        teamPath,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      };
      // REFACTORING #35: Use YAML-configured error message
      logger.error(`${this.messagesConfig.fileErrors.failedToLoad} team configuration: ${teamName}`, errorContext);
      throw error;
    }
  }

  /**
   * Merge agent profile with team configuration
   * Team settings provide defaults that agent can override
   */
  async mergeWithTeam(profile: AgentProfile): Promise<AgentProfile> {
    // If no team specified, return profile as-is
    if (!profile.team) {
      return profile;
    }

    try {
      const team = await this.loadTeam(profile.team);

      // Create merged profile (agent overrides team defaults)
      const merged: AgentProfile = {
        ...profile,

        // Merge abilities: team shared abilities + agent abilities (deduplicated)
        abilities: Array.from(new Set([
          ...(team.sharedAbilities || []),
          ...(profile.abilities || [])
        ])),

        // Merge providers: use agent provider if specified, else team provider
        providers: profile.providers || (team.provider ? {
          default: team.provider.primary,
          fallback: team.provider.fallbackChain || (team.provider.fallback ? [team.provider.fallback] : [])
        } : undefined),

        // BUG FIX #13: Correct operator precedence - parentheses around OR condition
        // REFACTORING #35: Use YAML-configured orchestration defaults
        // Merge orchestration: agent overrides team defaults
        orchestration: (profile.orchestration || team.orchestration) ? {
          maxDelegationDepth: profile.orchestration?.maxDelegationDepth
            || team.orchestration?.maxDelegationDepth
            || this.runtimeConfig.team.maxDelegationDepth,
          canWriteToShared: profile.orchestration?.canWriteToShared
            ?? team.orchestration?.canWriteToShared
            ?? this.runtimeConfig.team.canWriteToShared,
          canReadWorkspaces: profile.orchestration?.canReadWorkspaces
            || team.orchestration?.canReadWorkspaces
            || []
        } : undefined
      };

      logger.debug(`Merged agent profile with team: ${profile.name} + ${profile.team}`, {
        totalAbilities: merged.abilities.length,
        provider: merged.providers?.default
      });

      return merged;
    } catch (error) {
      // REFACTORING #35: Use YAML-configured error message
      logger.warn(`${this.messagesConfig.fileErrors.failedToMerge} '${profile.team}', ${this.messagesConfig.fileErrors.usingProfileAsIs}`, { error });
      return profile;
    }
  }

  /**
   * List all available teams in .automatosx/teams/
   */
  async listTeams(): Promise<string[]> {
    const teamsDir = join(this.projectRoot, AUTOMATOSX_DIRS.TEAMS);

    try {
      return await listFilesWithExtensions(teamsDir, AGENT_FILE_EXTENSIONS.YAML);
    } catch (error) {
      // REFACTORING #35: Use YAML-configured error message
      logger.error(`${this.messagesConfig.fileErrors.failedToList} teams`, { error });
      return [];
    }
  }

  /**
   * Get detailed info about a team
   */
  async getTeamInfo(teamName: string): Promise<{
    name: string;
    displayName?: string;
    description: string;
    sharedAbilities: number;
    provider?: string;
  }> {
    const team = await this.loadTeam(teamName);

    return {
      name: team.name,
      displayName: team.displayName,
      description: team.description,
      sharedAbilities: team.sharedAbilities?.length || 0,
      provider: team.provider?.primary
    };
  }

  /**
   * Clear team cache (useful for testing)
   */
  clearCache(): void {
    this.teamCache.clear();
  }

  /**
   * Resolve team configuration file path
   */
  private resolveTeamPath(teamName: string): string {
    const teamsDir = join(this.projectRoot, AUTOMATOSX_DIRS.TEAMS);
    return resolveFileWithExtensions(teamsDir, teamName, AGENT_FILE_EXTENSIONS.YAML);
  }

  /**
   * Validate team has required fields
   */
  private validateTeam(team: unknown, teamName: string): asserts team is TeamConfig {
    if (!team || typeof team !== 'object') {
      // REFACTORING #35: Use YAML-configured error message
      throw new Error(`${this.messagesConfig.fileErrors.invalidTeam}: ${teamName} - not an object`);
    }

    const t = team as Partial<TeamConfig>;

    // REFACTORING: Use loop to reduce duplication
    const requiredFields: Array<keyof TeamConfig> = ['name', 'description'];
    for (const field of requiredFields) {
      if (!t[field]) {
        // REFACTORING #35: Use YAML-configured error message
        throw new Error(`Team configuration ${this.messagesConfig.fileErrors.missingField}: ${field} (team: ${teamName})`);
      }
    }
  }
}
