/**
 * Team Manager - Load and manage team configurations
 *
 * Teams provide shared configuration for groups of agents:
 * - Provider configuration (which AI providers to use)
 * - Shared abilities (common to all team members)
 * - Orchestration defaults (collaboration settings)
 */

import { readFile, readdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { load } from 'js-yaml';
import type { TeamConfig } from '../types/team.js';
import { TeamValidationError, TeamNotFoundError } from '../types/team.js';
import { logger } from '../shared/logging/logger.js';
import { TTLCache } from './cache/cache.js';

/**
 * Team Manager - Load and validate team configurations
 */
export class TeamManager {
  private teamsDir: string;
  private cache: TTLCache<TeamConfig>;

  constructor(teamsDir: string) {
    this.teamsDir = teamsDir;
    // Use TTLCache with 10 minute TTL for team caching (longer than agents)
    // Teams change less frequently than agent profiles
    this.cache = new TTLCache<TeamConfig>({
      maxEntries: 10,  // We only have 4 teams (core, engineering, business, design)
      ttl: 600000,     // 10 minutes
      cleanupInterval: 120000, // Cleanup every 2 minutes
      debug: false
    });
  }

  /**
   * Load a specific team configuration
   */
  async loadTeam(teamName: string): Promise<TeamConfig> {
    logger.debug('Loading team', { teamName });

    // Check cache first
    const cached = this.cache.get(teamName);
    if (cached) {
      logger.debug('Team loaded from cache', { teamName });
      return cached;
    }

    try {
      // Load team configuration from YAML
      const teamPath = join(this.teamsDir, `${teamName}.yaml`);
      const content = await readFile(teamPath, 'utf-8');
      const team = load(content) as TeamConfig;

      // Validate team configuration
      this.validateTeam(team);

      // Cache and return
      this.cache.set(teamName, team);
      logger.debug('Team loaded', { name: team.name, path: teamPath });

      return team;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new TeamNotFoundError(teamName);
      }
      throw new TeamValidationError(`Failed to load team ${teamName}: ${(error as Error).message}`);
    }
  }

  /**
   * Get all available teams
   */
  async getAllTeams(): Promise<TeamConfig[]> {
    logger.debug('Loading all teams');

    try {
      const files = await readdir(this.teamsDir);
      const teamFiles = files.filter(f => extname(f) === '.yaml' || extname(f) === '.yml');

      const teams: TeamConfig[] = [];
      for (const file of teamFiles) {
        const teamName = basename(file, extname(file));
        try {
          const team = await this.loadTeam(teamName);
          teams.push(team);
        } catch (error) {
          logger.warn('Failed to load team', { file, error: (error as Error).message });
        }
      }

      logger.info('All teams loaded', { count: teams.length });
      return teams;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn('Teams directory not found', { teamsDir: this.teamsDir });
        return [];
      }
      throw error;
    }
  }

  /**
   * List available team names
   */
  async listTeams(): Promise<string[]> {
    try {
      const files = await readdir(this.teamsDir);
      return files
        .filter(f => extname(f) === '.yaml' || extname(f) === '.yml')
        .map(f => basename(f, extname(f)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a team exists
   */
  async teamExists(teamName: string): Promise<boolean> {
    const teams = await this.listTeams();
    return teams.includes(teamName);
  }

  /**
   * Clear cache (useful for testing or after team configuration changes)
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Team cache cleared');
  }

  /**
   * Validate team configuration
   */
  private validateTeam(team: TeamConfig): void {
    // Required fields
    if (!team.name) {
      throw new TeamValidationError('Team name is required');
    }
    if (!team.displayName) {
      throw new TeamValidationError('Team displayName is required');
    }
    if (!team.description) {
      throw new TeamValidationError('Team description is required');
    }

    // Provider configuration is required
    if (!team.provider) {
      throw new TeamValidationError('Team provider configuration is required');
    }
    if (!team.provider.primary) {
      throw new TeamValidationError('Team provider.primary is required');
    }

    // Validate provider names (v5.0.7+: accept both aliases and actual names)
    const validProviders = [
      'claude', 'claude-code',      // Claude aliases
      'gemini', 'gemini-cli',       // Gemini aliases
      'codex', 'openai'             // OpenAI aliases
    ];

    if (!validProviders.includes(team.provider.primary)) {
      throw new TeamValidationError(
        `Invalid primary provider: ${team.provider.primary}. Must be one of: ${validProviders.join(', ')}`
      );
    }

    if (team.provider.fallback && !validProviders.includes(team.provider.fallback)) {
      throw new TeamValidationError(
        `Invalid fallback provider: ${team.provider.fallback}. Must be one of: ${validProviders.join(', ')}`
      );
    }

    if (team.provider.fallbackChain) {
      for (const provider of team.provider.fallbackChain) {
        if (!validProviders.includes(provider)) {
          throw new TeamValidationError(
            `Invalid provider in fallbackChain: ${provider}. Must be one of: ${validProviders.join(', ')}`
          );
        }
      }
    }

    // Validate arrays if provided
    if (team.sharedAbilities && !Array.isArray(team.sharedAbilities)) {
      throw new TeamValidationError('sharedAbilities must be an array');
    }

    // v5.2: Workspace permission validation removed
    // All agents now have equal access to automatosx/PRD and automatosx/tmp

    logger.debug('Team validation passed', { name: team.name });
  }
}
