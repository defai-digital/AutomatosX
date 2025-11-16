/**
 * Shared constants for agent system
 */

/**
 * AutomatosX directory paths
 */
export const AUTOMATOSX_DIRS = {
  ROOT: '.automatosx',
  AGENTS: '.automatosx/agents',
  ABILITIES: '.automatosx/abilities',
  TEAMS: '.automatosx/teams',
  TEMPLATES: '.automatosx/templates',
  SESSIONS: '.automatosx/sessions',
  MEMORY: '.automatosx/memory',
  LOGS: '.automatosx/logs'
} as const;

/**
 * File extensions for agent resources
 */
export const AGENT_FILE_EXTENSIONS = {
  YAML: ['yaml', 'yml'] as string[],
  MARKDOWN: ['md'] as string[],
  JSON: ['json'] as string[]
};

/**
 * Date fields for JSON parsing
 */
export const SESSION_DATE_FIELDS = ['createdAt', 'updatedAt', 'timestamp'] as const;
