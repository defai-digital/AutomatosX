/**
 * Project Context Loader
 *
 * Loads and parses project context files (ax-cli compatible):
 * - ax.index.json (project root) - Shared project index
 * - .automatosx/CUSTOM.md - Custom AI instructions
 *
 * The ax.index.json is the primary source of project understanding.
 * It's shared across all AI CLIs (ax-cli, ax-glm, ax-grok, automatosx).
 *
 * @since v7.1.0
 * @updated v12.9.0 - Simplified to ax-cli style (ax.index.json at root)
 */

import { readFile, stat, realpath, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'path';
import { logger } from '../shared/logging/logger.js';

// Maximum context size: 100KB (security limit)
const MAX_CONTEXT_SIZE = 100 * 1024;

// Default cache TTL: 5 minutes
const DEFAULT_CACHE_TTL = 300_000;

// 24 hours in milliseconds (for staleness check)
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * ax.index.json structure (ax-cli compatible)
 */
export interface AxIndex {
  // Core metadata
  projectName: string;
  version: string;
  projectType: string;
  language: string;

  // Stack info
  framework?: string;
  buildTool?: string;
  testFramework?: string;
  packageManager: string;
  hasTypeScript: boolean;
  isMonorepo: boolean;

  // Structure
  entryPoint?: string;
  sourceDirectory?: string;
  testDirectory?: string;

  // Module map
  modules: Array<{
    path: string;
    purpose: string;
    patterns?: string[];
    exports?: string[];
  }>;

  // Key abstractions
  abstractions: Array<{
    name: string;
    type: 'interface' | 'class' | 'function' | 'type' | 'pattern';
    location: string;
    description?: string;
  }>;

  // Commands
  commands: Record<string, {
    script: string;
    description: string;
    category: 'development' | 'testing' | 'building' | 'quality' | 'deployment' | 'other';
  }>;

  // Dependencies summary
  dependencies: {
    production: string[];
    development: string[];
    total: number;
  };

  // Repository
  repository?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Analysis tier (ax-cli compatible)
  analysisTier: number;
}

/**
 * Complete project context
 */
export interface ProjectContext {
  // ax.index.json content (primary source)
  index?: AxIndex;

  // Custom instructions from CUSTOM.md
  customInstructions?: string;

  // Extracted guardrails from CUSTOM.md
  guardrails?: string[];

  // Commands from index
  commands?: Record<string, string>;

  // Formatted prompt for agent injection
  contextPrompt?: string;

  // Staleness info
  isStale?: boolean;
  lastUpdated?: Date;
}

/**
 * Project Context Loader
 *
 * Loads project context from ax.index.json (ax-cli compatible)
 * Provides caching and staleness detection
 */
export class ProjectContextLoader {
  private cache?: ProjectContext;
  private cacheExpiry?: number;
  private cacheTTL: number;

  constructor(
    private projectRoot: string,
    options?: {
      cacheTTL?: number;
    }
  ) {
    this.cacheTTL = options?.cacheTTL ?? DEFAULT_CACHE_TTL;
  }

  /**
   * Load project context with caching
   */
  async load(): Promise<ProjectContext> {
    // Check cache
    if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      logger.debug('Using cached project context', {
        cacheExpiry: new Date(this.cacheExpiry).toISOString()
      });
      return this.cache;
    }

    logger.info('Loading project context', {
      projectRoot: this.projectRoot
    });

    const context: ProjectContext = {};

    // Load ax.index.json (primary source)
    try {
      const indexPath = path.join(this.projectRoot, 'ax.index.json');
      const resolvedPath = await realpath(indexPath).catch(() => null);

      if (resolvedPath) {
        const rel = path.relative(this.projectRoot, resolvedPath);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
          const stats = await stat(resolvedPath);

          // Security: Check file size
          if (stats.size > MAX_CONTEXT_SIZE) {
            logger.warn('ax.index.json too large, ignoring', {
              size: stats.size,
              limit: MAX_CONTEXT_SIZE
            });
          } else {
            const indexContent = await readFile(resolvedPath, 'utf-8');
            context.index = JSON.parse(indexContent) as AxIndex;
            context.lastUpdated = stats.mtime;

            // Check staleness
            const age = Date.now() - stats.mtime.getTime();
            context.isStale = age > STALE_THRESHOLD_MS;

            logger.info('Loaded ax.index.json', {
              projectName: context.index.projectName,
              projectType: context.index.projectType,
              isStale: context.isStale,
              ageHours: Math.floor(age / (1000 * 60 * 60))
            });

            // Extract commands for easy access
            if (context.index.commands) {
              context.commands = {};
              for (const [name, cmd] of Object.entries(context.index.commands)) {
                context.commands[name] = cmd.script;
              }
            }
          }
        }
      }
    } catch (error) {
      // ax.index.json is optional
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading ax.index.json', { error });
      }
    }

    // Load .automatosx/CUSTOM.md
    try {
      const customMdPath = path.join(this.projectRoot, '.automatosx', 'CUSTOM.md');
      const resolvedPath = await realpath(customMdPath).catch(() => null);

      if (resolvedPath) {
        const rel = path.relative(this.projectRoot, resolvedPath);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
          const stats = await stat(resolvedPath);

          if (stats.size > MAX_CONTEXT_SIZE) {
            logger.warn('CUSTOM.md too large, ignoring', {
              size: stats.size,
              limit: MAX_CONTEXT_SIZE
            });
          } else {
            context.customInstructions = await readFile(resolvedPath, 'utf-8');
            logger.info('Loaded CUSTOM.md', {
              size: stats.size,
              lines: context.customInstructions.split('\n').length
            });

            // Parse guardrails from CUSTOM.md
            context.guardrails = this.parseGuardrails(context.customInstructions);
          }
        }
      }
    } catch (error) {
      // CUSTOM.md is optional
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading CUSTOM.md', { error });
      }
    }

    // Build context prompt for agent injection
    context.contextPrompt = this.buildContextPrompt(context);

    // Cache result
    this.cache = context;
    this.cacheExpiry = Date.now() + this.cacheTTL;

    logger.info('Project context loaded', {
      hasIndex: !!context.index,
      hasCustomInstructions: !!context.customInstructions,
      guardrails: context.guardrails?.length ?? 0,
      commands: Object.keys(context.commands ?? {}).length,
      isStale: context.isStale
    });

    return context;
  }

  /**
   * Clear cache (useful for testing or file watching)
   */
  clearCache(): void {
    this.cache = undefined;
    this.cacheExpiry = undefined;
    logger.debug('Project context cache cleared');
  }

  /**
   * Check if context exists (without loading)
   */
  async exists(): Promise<boolean> {
    const indexPath = path.join(this.projectRoot, 'ax.index.json');
    const customMdPath = path.join(this.projectRoot, '.automatosx', 'CUSTOM.md');

    const checkExists = async (filePath: string): Promise<boolean> => {
      try {
        await access(filePath, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    };

    const [indexExists, customMdExists] = await Promise.all([
      checkExists(indexPath),
      checkExists(customMdPath)
    ]);

    return indexExists || customMdExists;
  }

  /**
   * Check if ax.index.json is stale (older than 24 hours)
   */
  async isStale(): Promise<boolean> {
    try {
      const indexPath = path.join(this.projectRoot, 'ax.index.json');
      const stats = await stat(indexPath);
      const age = Date.now() - stats.mtime.getTime();
      return age > STALE_THRESHOLD_MS;
    } catch {
      return true; // File doesn't exist, consider it stale
    }
  }

  /**
   * Parse guardrails from CUSTOM.md
   *
   * Looks for DO/DON'T sections in ax-cli format
   */
  private parseGuardrails(markdown: string): string[] {
    const guardrails: string[] = [];

    // Find DON'T section (critical prohibitions)
    const dontRegex = /###\s+DON'T[^\n]*\n([\s\S]*?)(?=\n###|$)/i;
    const dontMatch = markdown.match(dontRegex);

    if (dontMatch && dontMatch[1]) {
      const section = dontMatch[1];
      const bulletRegex = /^[-*]\s+(.+?)$/gm;
      let bulletMatch;

      while ((bulletMatch = bulletRegex.exec(section)) !== null) {
        const rule = bulletMatch[1]?.trim();
        if (rule) {
          guardrails.push(rule);
        }
      }
    }

    // Also check for Critical Rules or Guardrails sections
    const criticalRegex = /##\s+(Critical\s+Guardrails|Critical\s+Rules|Never)[^\n]*\n([\s\S]*?)(?=\n##|$)/gi;
    let match;

    while ((match = criticalRegex.exec(markdown)) !== null) {
      const section = match[2];
      if (!section) continue;

      const bulletRegex = /^[-*]\s+(.+?)$/gm;
      let bulletMatch;

      while ((bulletMatch = bulletRegex.exec(section)) !== null) {
        let rule = bulletMatch[1]?.trim() ?? '';
        // Remove emoji if present
        rule = rule.replace(/^[⚠️❌✅✓⚡🔒]+\s*/, '');
        // Remove markdown formatting
        rule = rule.replace(/\*\*(.+?)\*\*/g, '$1');
        rule = rule.replace(/`(.+?)`/g, '$1');

        if (rule.length > 0 && !guardrails.includes(rule)) {
          guardrails.push(rule);
        }
      }
    }

    return guardrails;
  }

  /**
   * Build formatted context prompt for agent injection
   */
  private buildContextPrompt(context: ProjectContext): string {
    if (!context.index && !context.customInstructions) {
      return '';
    }

    let prompt = '\n# PROJECT CONTEXT\n\n';

    // Add project info from index
    if (context.index) {
      prompt += `**Project:** ${context.index.projectName} v${context.index.version}\n`;
      prompt += `**Type:** ${context.index.projectType}\n`;
      prompt += `**Language:** ${context.index.language}`;
      if (context.index.framework) {
        prompt += ` + ${context.index.framework}`;
      }
      prompt += '\n\n';

      // Add modules
      if (context.index.modules.length > 0) {
        prompt += '## Project Structure:\n\n';
        for (const mod of context.index.modules.slice(0, 10)) {
          prompt += `- \`${mod.path}/\` - ${mod.purpose}\n`;
        }
        prompt += '\n';
      }

      // Add available commands
      if (context.commands && Object.keys(context.commands).length > 0) {
        prompt += '## Available Commands:\n\n';
        for (const [name, script] of Object.entries(context.commands).slice(0, 10)) {
          prompt += `- ${name}: \`${script}\`\n`;
        }
        prompt += '\n';
      }
    }

    // Add guardrails
    if (context.guardrails && context.guardrails.length > 0) {
      prompt += '## CRITICAL RULES (NEVER VIOLATE):\n\n';
      for (const rule of context.guardrails) {
        prompt += `- ${rule}\n`;
      }
      prompt += '\n';
    }

    // Add staleness warning
    if (context.isStale) {
      prompt += '⚠️ **Note:** Project index is stale (>24h old). Run `ax init` to update.\n\n';
    }

    return prompt;
  }
}

// Re-export types for backwards compatibility
export type { AxIndex as ProjectIndex };
