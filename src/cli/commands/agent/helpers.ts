/**
 * Agent Command Helpers
 * Shared utilities for agent commands
 */

import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { ProfileLoader } from '../../../agents/profile-loader.js';
import { TeamManager } from '../../../core/team-manager.js';
import { logger } from '../../../shared/logging/logger.js';
import { getPackageRoot } from '../../../shared/helpers/package-root.js';

/**
 * Template information
 */
export interface TemplateInfo {
  name: string;
  path: string;
  description?: string;
  team?: string;
}

/**
 * Template metadata with team assignment
 */
export interface TemplateMetadata {
  name: string;
  team: string;
  description: string;
}

/**
 * Built-in template descriptions - Single source of truth
 * Used by both helpers.ts and templates.ts
 */
export const BUILTIN_TEMPLATE_METADATA: Record<string, TemplateMetadata> = {
  'basic-agent': {
    name: 'basic-agent',
    team: 'core',
    description: 'Basic agent with minimal configuration'
  },
  'developer': {
    name: 'developer',
    team: 'engineering',
    description: 'Software developer (code generation, review, testing)'
  },
  'analyst': {
    name: 'analyst',
    team: 'business',
    description: 'Business analyst (requirements, user stories, strategy)'
  },
  'designer': {
    name: 'designer',
    team: 'design',
    description: 'UI/UX designer (interface design, user experience)'
  },
  'qa-specialist': {
    name: 'qa-specialist',
    team: 'core',
    description: 'QA specialist (test planning, automation, quality)'
  }
};

/**
 * Team information
 */
export interface TeamInfo {
  name: string;
  displayName: string;
  description?: string;
}

/**
 * List available templates (project + built-in)
 *
 * @param baseDir - Base directory for project templates (defaults to process.cwd())
 */
export async function listAvailableTemplates(baseDir?: string): Promise<TemplateInfo[]> {
  const templates: TemplateInfo[] = [];

  // 1. Check project templates (.automatosx/templates/)
  const projectDir = baseDir || process.cwd();
  const projectTemplatesDir = join(projectDir, '.automatosx', 'templates');
  if (existsSync(projectTemplatesDir)) {
    try {
      const files = await readdir(projectTemplatesDir);
      for (const file of files) {
        if (extname(file) === '.yaml' || extname(file) === '.yml') {
          const name = file.replace(/\.(yaml|yml)$/, '');
          templates.push({
            name,
            path: join(projectTemplatesDir, file),
            description: 'Custom template'
          });
        }
      }
    } catch (error) {
      logger.debug('Failed to read project templates', { error });
    }
  }

  // 2. Check built-in templates (examples/workflows/)
  // Use getPackageRoot() to reliably find examples in both dev and bundled mode
  const packageRoot = getPackageRoot();
  const builtinTemplatesDir = join(packageRoot, 'examples/workflows');
  if (existsSync(builtinTemplatesDir)) {
    try {
      const files = await readdir(builtinTemplatesDir);
      for (const file of files) {
        if (extname(file) === '.yaml' || extname(file) === '.yml') {
          const name = file.replace(/\.(yaml|yml)$/, '');

          // Skip if already added from project templates
          if (templates.find(t => t.name === name)) {
            continue;
          }

          // Use shared template metadata
          const metadata = BUILTIN_TEMPLATE_METADATA[name];

          templates.push({
            name,
            path: join(builtinTemplatesDir, file),
            description: metadata?.description || 'Built-in template',
            team: metadata?.team
          });
        }
      }
    } catch (error) {
      logger.debug('Failed to read built-in templates', { error });
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List available teams
 *
 * @param baseDir - Base directory for project teams (defaults to process.cwd())
 */
export async function listAvailableTeams(baseDir?: string): Promise<TeamInfo[]> {
  const projectDir = baseDir || process.cwd();
  const teamsDir = join(projectDir, '.automatosx', 'teams');

  const teamManager = new TeamManager(teamsDir);

  try {
    const teamNames = await teamManager.listTeams();
    const teams: TeamInfo[] = [];

    for (const name of teamNames) {
      try {
        const teamConfig = await teamManager.loadTeam(name);
        teams.push({
          name: teamConfig.name,
          displayName: teamConfig.displayName || teamConfig.name,
          description: teamConfig.description
        });
      } catch (error) {
        // If team fails to load, add basic info
        teams.push({
          name,
          displayName: name,
          description: undefined
        });
      }
    }

    return teams.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logger.warn('Failed to list teams, using defaults', { error });

    // Return default teams if listing fails
    return [
      { name: 'core', displayName: 'Core Team', description: 'Quality assurance, core functions' },
      { name: 'engineering', displayName: 'Engineering Team', description: 'Software development' },
      { name: 'business', displayName: 'Business Team', description: 'Business analysis, product' },
      { name: 'design', displayName: 'Design Team', description: 'UI/UX design' }
    ];
  }
}

/**
 * Validate agent name format
 * Rules:
 * - Only lowercase letters, numbers, and hyphens
 * - Must start with a letter
 * - No consecutive hyphens
 * - Length: 2-50 characters
 */
export function isValidAgentName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Agent name is required' };
  }

  if (name.length < 2) {
    return { valid: false, error: 'Agent name must be at least 2 characters' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Agent name must be at most 50 characters' };
  }

  if (!/^[a-z]/.test(name)) {
    return { valid: false, error: 'Agent name must start with a lowercase letter' };
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return {
      valid: false,
      error: 'Agent name must contain only lowercase letters, numbers, and hyphens'
    };
  }

  if (/--/.test(name)) {
    return { valid: false, error: 'Agent name cannot contain consecutive hyphens' };
  }

  if (name.endsWith('-')) {
    return { valid: false, error: 'Agent name cannot end with a hyphen' };
  }

  return { valid: true };
}

/**
 * Check if displayName conflicts with existing agents
 * Returns the conflicting agent name if found, undefined otherwise
 *
 * @param displayName - Display name to check for conflicts
 * @param excludeAgentName - Agent name to exclude from check (for updates)
 * @param baseDir - Base directory for project agents (defaults to process.cwd())
 */
export async function checkDisplayNameConflict(
  displayName: string,
  excludeAgentName?: string,
  baseDir?: string
): Promise<string | undefined> {
  if (!displayName) {
    return undefined;
  }

  const projectDir = baseDir || process.cwd();
  const agentsDir = join(projectDir, '.automatosx', 'agents');
  const profileLoader = new ProfileLoader(agentsDir);

  try {
    // Build displayName map
    const allProfiles = await profileLoader.listProfiles();

    for (const profileName of allProfiles) {
      // Skip the agent we're updating (if provided)
      if (excludeAgentName && profileName === excludeAgentName) {
        continue;
      }

      try {
        const profile = await profileLoader.loadProfile(profileName);

        // Check if displayName matches (case-insensitive)
        if (profile.displayName?.toLowerCase() === displayName.toLowerCase()) {
          return profileName;
        }
      } catch (error) {
        // Skip profiles that fail to load
        logger.debug('Failed to load profile for displayName check', {
          profile: profileName,
          error
        });
      }
    }

    return undefined;
  } catch (error) {
    logger.warn('Failed to check displayName conflicts', { error });
    return undefined;
  }
}

/**
 * Suggest valid agent name from invalid input
 */
export function suggestValidAgentName(input: string): string {
  let suggestion = input.toLowerCase();

  // Replace invalid characters with hyphens
  suggestion = suggestion.replace(/[^a-z0-9-]/g, '-');

  // Remove consecutive hyphens
  suggestion = suggestion.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  suggestion = suggestion.replace(/^-+|-+$/g, '');

  // Minimum length check before adding prefix
  if (suggestion.length < 2) {
    return 'agent';
  }

  // Ensure it starts with a letter
  if (!/^[a-z]/.test(suggestion)) {
    suggestion = 'agent-' + suggestion;
  }

  // Limit length
  if (suggestion.length > 50) {
    suggestion = suggestion.substring(0, 50).replace(/-+$/, '');
  }

  return suggestion;
}
