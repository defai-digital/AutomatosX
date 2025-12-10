/**
 * Project Context Loader
 *
 * Loads and parses project context files (ax-cli compatible):
 * - ax.summary.json (project root) - Compact summary (~500 tokens) for fast prompt injection
 * - ax.index.json (project root) - Full detailed project analysis (on-demand)
 * - .automatosx/CUSTOM.md - Custom AI instructions
 *
 * Token-saving strategy:
 * 1. ax.summary.json is injected into system prompt (small, fast)
 * 2. ax.index.json is available for AI to read when more detail is needed
 * 3. This approach saves 60-80% tokens vs injecting full index
 *
 * @since v7.1.0
 * @updated v12.9.0 - Simplified to ax-cli style (ax.index.json at root)
 * @updated v12.10.0 - Added ax.summary.json for token optimization
 */

import { readFile, stat, realpath, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'path';
import { logger } from '../shared/logging/logger.js';

// Maximum context size: 100KB (security limit)
const MAX_CONTEXT_SIZE = 100 * 1024;

// Summary file max size: 10KB (should be ~500 tokens)
const MAX_SUMMARY_SIZE = 10 * 1024;

// Default cache TTL: 60 seconds (reduced from 5 min for faster CUSTOM.md updates)
const DEFAULT_CACHE_TTL = 60_000;

// 24 hours in milliseconds (for staleness check)
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * ax.summary.json structure (ax-cli compatible)
 *
 * A compact summary (~500 tokens) designed for fast prompt injection.
 * Contains essential project metadata without the full analysis.
 *
 * @since v12.10.0
 */
export interface AxSummary {
  // Schema version for future compatibility
  schemaVersion: string;

  // Generation timestamp
  generatedAt: string;

  // Core project info
  project: {
    name: string;
    type: string;
    language: string;
    version?: string;
  };

  // Key directories
  directories: Record<string, string>;

  // Essential commands
  commands: Record<string, string>;

  // Tech stack (compact list)
  techStack: string[];

  // Critical gotchas/rules (max 5)
  gotchas: string[];

  // Reference to full index
  indexFile: string;
}

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
/**
 * Detected conflict between guardrails
 * @since v12.7.1
 */
export interface GuardrailConflict {
  rule1: string;
  rule2: string;
  type: 'contradiction' | 'ambiguity';
  description: string;
}

export interface ProjectContext {
  // ax.summary.json content (fast path, ~500 tokens)
  summary?: AxSummary;

  // ax.index.json content (full analysis, on-demand)
  index?: AxIndex;

  // Custom instructions from CUSTOM.md
  customInstructions?: string;

  // Extracted guardrails from CUSTOM.md
  guardrails?: string[];

  // Detected conflicts between guardrails (v12.7.1)
  guardrailConflicts?: GuardrailConflict[];

  // Commands from index (extracted for easy access)
  commands?: Record<string, string>;

  // Formatted prompt for agent injection (built from summary, not full index)
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
   *
   * Token-saving strategy:
   * 1. First try ax.summary.json (fast path, ~500 tokens)
   * 2. Fall back to generating summary from ax.index.json if missing
   * 3. Context prompt tells AI to read ax.index.json for full details
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

    // 1. Try loading ax.summary.json first (fast path)
    const summaryLoaded = await this.loadSummary(context);

    // 2. Load ax.index.json (for staleness check and fallback summary generation)
    await this.loadIndex(context);

    // 3. If no summary was loaded but we have index, generate dynamic summary
    if (!summaryLoaded && context.index) {
      context.summary = this.generateDynamicSummary(context.index);
      logger.info('Generated dynamic summary from ax.index.json');
    }

    // 4. Load .automatosx/CUSTOM.md
    await this.loadCustomInstructions(context);

    // 5. Build context prompt for agent injection (uses summary, not full index)
    context.contextPrompt = this.buildContextPrompt(context);

    // Cache result
    this.cache = context;
    this.cacheExpiry = Date.now() + this.cacheTTL;

    logger.info('Project context loaded', {
      hasSummary: !!context.summary,
      hasIndex: !!context.index,
      hasCustomInstructions: !!context.customInstructions,
      guardrails: context.guardrails?.length ?? 0,
      guardrailConflicts: context.guardrailConflicts?.length ?? 0,
      commands: Object.keys(context.commands ?? {}).length,
      isStale: context.isStale
    });

    return context;
  }

  /**
   * Load ax.summary.json (fast path)
   * Returns true if summary was loaded successfully
   */
  private async loadSummary(context: ProjectContext): Promise<boolean> {
    try {
      const summaryPath = path.join(this.projectRoot, 'ax.summary.json');
      const resolvedPath = await realpath(summaryPath).catch(() => null);

      if (!resolvedPath) return false;

      const rel = path.relative(this.projectRoot, resolvedPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return false;

      const stats = await stat(resolvedPath);

      // Security: Check file size
      if (stats.size > MAX_SUMMARY_SIZE) {
        logger.warn('ax.summary.json too large, ignoring', {
          size: stats.size,
          limit: MAX_SUMMARY_SIZE
        });
        return false;
      }

      const summaryContent = await readFile(resolvedPath, 'utf-8');
      context.summary = JSON.parse(summaryContent) as AxSummary;

      // Extract commands from summary for easy access
      if (context.summary.commands) {
        context.commands = { ...context.summary.commands };
      }

      logger.info('Loaded ax.summary.json (fast path)', {
        projectName: context.summary.project.name,
        projectType: context.summary.project.type,
        techStack: context.summary.techStack.length
      });

      return true;
    } catch (error) {
      // ax.summary.json is optional
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading ax.summary.json', { error });
      }
      return false;
    }
  }

  /**
   * Load ax.index.json (full analysis)
   * Used for staleness check and fallback summary generation
   */
  private async loadIndex(context: ProjectContext): Promise<void> {
    try {
      const indexPath = path.join(this.projectRoot, 'ax.index.json');
      const resolvedPath = await realpath(indexPath).catch(() => null);

      if (!resolvedPath) return;

      const rel = path.relative(this.projectRoot, resolvedPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return;

      const stats = await stat(resolvedPath);

      // Security: Check file size
      if (stats.size > MAX_CONTEXT_SIZE) {
        logger.warn('ax.index.json too large, ignoring', {
          size: stats.size,
          limit: MAX_CONTEXT_SIZE
        });
        return;
      }

      const indexContent = await readFile(resolvedPath, 'utf-8');
      context.index = JSON.parse(indexContent) as AxIndex;
      context.lastUpdated = stats.mtime;

      // Check staleness
      const age = Date.now() - stats.mtime.getTime();
      context.isStale = age > STALE_THRESHOLD_MS;

      logger.debug('Loaded ax.index.json', {
        projectName: context.index.projectName,
        projectType: context.index.projectType,
        isStale: context.isStale,
        ageHours: Math.floor(age / (1000 * 60 * 60))
      });

      // Extract commands if not already set from summary
      if (!context.commands && context.index.commands) {
        context.commands = {};
        for (const [name, cmd] of Object.entries(context.index.commands)) {
          context.commands[name] = cmd.script;
        }
      }
    } catch (error) {
      // ax.index.json is optional
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading ax.index.json', { error });
      }
    }
  }

  /**
   * Load .automatosx/CUSTOM.md
   */
  private async loadCustomInstructions(context: ProjectContext): Promise<void> {
    try {
      const customMdPath = path.join(this.projectRoot, '.automatosx', 'CUSTOM.md');
      const resolvedPath = await realpath(customMdPath).catch(() => null);

      if (!resolvedPath) return;

      const rel = path.relative(this.projectRoot, resolvedPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return;

      const stats = await stat(resolvedPath);

      if (stats.size > MAX_CONTEXT_SIZE) {
        logger.warn('CUSTOM.md too large, ignoring', {
          size: stats.size,
          limit: MAX_CONTEXT_SIZE
        });
        return;
      }

      context.customInstructions = await readFile(resolvedPath, 'utf-8');
      logger.info('Loaded CUSTOM.md', {
        size: stats.size,
        lines: context.customInstructions.split('\n').length
      });

      // Parse guardrails from CUSTOM.md
      context.guardrails = this.parseGuardrails(context.customInstructions);

      // Detect conflicts between guardrails (v12.7.1)
      if (context.guardrails && context.guardrails.length > 1) {
        context.guardrailConflicts = this.detectGuardrailConflicts(context.guardrails);
        if (context.guardrailConflicts.length > 0) {
          logger.warn('Guardrail conflicts detected', {
            count: context.guardrailConflicts.length,
            conflicts: context.guardrailConflicts.map(c => c.description)
          });
        }
      }
    } catch (error) {
      // CUSTOM.md is optional
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading CUSTOM.md', { error });
      }
    }
  }

  /**
   * Generate a dynamic summary from ax.index.json
   * Used when ax.summary.json is missing
   */
  private generateDynamicSummary(index: AxIndex): AxSummary {
    // Build tech stack from index
    const techStack: string[] = [];
    if (index.language) techStack.push(index.language);
    if (index.framework) techStack.push(index.framework);
    if (index.buildTool) techStack.push(index.buildTool);
    if (index.testFramework) techStack.push(index.testFramework);
    if (index.packageManager) techStack.push(index.packageManager);

    // Build directories from modules
    const directories: Record<string, string> = {};
    for (const mod of index.modules.slice(0, 5)) {
      directories[mod.path] = mod.purpose;
    }

    // Build commands
    const commands: Record<string, string> = {};
    const cmdEntries = Object.entries(index.commands).slice(0, 5);
    for (const [name, cmd] of cmdEntries) {
      commands[name] = cmd.script;
    }

    // Build gotchas (extract from conventions if available)
    const gotchas: string[] = [];
    if (index.hasTypeScript) {
      gotchas.push('TypeScript strict mode is enabled');
    }
    if (index.isMonorepo) {
      gotchas.push('Monorepo structure - run commands from package directory');
    }
    if (index.packageManager === 'pnpm') {
      gotchas.push('Uses pnpm - ensure dependencies are installed with pnpm');
    }

    return {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      project: {
        name: index.projectName,
        type: index.projectType,
        language: index.language,
        version: index.version
      },
      directories,
      commands,
      techStack,
      gotchas: gotchas.slice(0, 5),
      indexFile: 'ax.index.json'
    };
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
   * Detect semantic conflicts between guardrails
   *
   * Uses keyword-based heuristics to identify potential contradictions:
   * - "never X" vs "always X"
   * - "do X" vs "don't X"
   * - Conflicting action verbs on same subject
   *
   * @param guardrails - List of guardrail rules
   * @returns Detected conflicts
   *
   * @since v12.7.1
   */
  private detectGuardrailConflicts(guardrails: string[]): GuardrailConflict[] {
    const conflicts: GuardrailConflict[] = [];

    // Contradiction patterns: [positive, negative] pairs
    const contradictionPairs: Array<[RegExp, RegExp, string]> = [
      [/\balways\b/i, /\bnever\b/i, 'always/never'],
      [/\bmust\b/i, /\bmust\s+not\b/i, 'must/must not'],
      [/\bshould\b/i, /\bshould\s+not\b/i, 'should/should not'],
      [/\bdo\b/i, /\bdon'?t\b/i, 'do/don\'t'],
      [/\buse\b/i, /\bnever\s+use\b/i, 'use/never use'],
      [/\brequire[ds]?\b/i, /\bforbidden\b/i, 'required/forbidden'],
      [/\ballow(ed)?\b/i, /\bprohibit(ed)?\b/i, 'allowed/prohibited'],
      [/\benable[ds]?\b/i, /\bdisable[ds]?\b/i, 'enable/disable'],
    ];

    // Extract subjects from rules (nouns/noun phrases after verbs)
    const extractSubject = (rule: string): string[] => {
      const subjects: string[] = [];

      // Extract words after common verbs
      const patterns = [
        /(?:use|run|execute|call|import|require|include|add|create|edit|modify|delete|remove)\s+[`"']?(\w+(?:[._-]\w+)*)[`"']?/gi,
        /(?:never|always|must|should|do|don't)\s+(?:\w+\s+)?[`"']?(\w+(?:[._-]\w+)*)[`"']?/gi,
        /[`"'](\w+(?:[._-]\w+)*)[`"']/g,  // Backtick/quoted terms
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(rule)) !== null) {
          if (match[1] && match[1].length > 2) {
            subjects.push(match[1].toLowerCase());
          }
        }
      }

      return [...new Set(subjects)];
    };

    // Compare each pair of guardrails
    for (let i = 0; i < guardrails.length; i++) {
      for (let j = i + 1; j < guardrails.length; j++) {
        const rule1 = guardrails[i];
        const rule2 = guardrails[j];

        // Skip if undefined
        if (!rule1 || !rule2) continue;

        const subjects1 = extractSubject(rule1);
        const subjects2 = extractSubject(rule2);

        // Check for shared subjects
        const sharedSubjects = subjects1.filter(s => subjects2.includes(s));

        if (sharedSubjects.length === 0) {
          continue;  // No shared subjects, no conflict possible
        }

        // Check for contradiction patterns
        for (const [positivePattern, negativePattern, patternName] of contradictionPairs) {
          const rule1Positive = positivePattern.test(rule1);
          const rule1Negative = negativePattern.test(rule1);
          const rule2Positive = positivePattern.test(rule2);
          const rule2Negative = negativePattern.test(rule2);

          // Contradiction: one rule is positive, other is negative
          if ((rule1Positive && rule2Negative) || (rule1Negative && rule2Positive)) {
            conflicts.push({
              rule1,
              rule2,
              type: 'contradiction',
              description: `Potential ${patternName} conflict on subject: ${sharedSubjects.join(', ')}`
            });
            break;  // Only report one conflict per pair
          }
        }

        // Check for ambiguity: same subject with different actions
        if (sharedSubjects.length > 0 && conflicts.every(c => c.rule1 !== rule1 || c.rule2 !== rule2)) {
          // Extract action verbs
          const actionVerbs = /\b(use|run|edit|create|delete|modify|add|remove|enable|disable|require|allow|block)\b/gi;
          const verbs1 = rule1.match(actionVerbs)?.map(v => v.toLowerCase()) || [];
          const verbs2 = rule2.match(actionVerbs)?.map(v => v.toLowerCase()) || [];

          // Different actions on same subject = potential ambiguity
          const conflictingVerbs = verbs1.filter(v =>
            verbs2.some(v2 => {
              const conflicts: Record<string, string[]> = {
                'create': ['delete', 'remove'],
                'add': ['remove', 'delete'],
                'enable': ['disable', 'block'],
                'allow': ['block', 'disable'],
                'use': ['remove', 'delete'],
              };
              return conflicts[v]?.includes(v2) || conflicts[v2]?.includes(v);
            })
          );

          if (conflictingVerbs.length > 0) {
            conflicts.push({
              rule1,
              rule2,
              type: 'ambiguity',
              description: `Ambiguous actions (${conflictingVerbs.join(', ')}) on subject: ${sharedSubjects.join(', ')}`
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Build formatted context prompt for agent injection
   *
   * Uses ax.summary.json (compact ~500 tokens) for fast prompt injection.
   * Tells AI to read ax.index.json for full project analysis if needed.
   *
   * @since v12.10.0 - Now uses summary instead of full index
   */
  private buildContextPrompt(context: ProjectContext): string {
    if (!context.summary && !context.index && !context.customInstructions) {
      return '';
    }

    let prompt = '\n# PROJECT CONTEXT\n\n';

    // Use summary (fast path, ~500 tokens) instead of full index
    if (context.summary) {
      const summary = context.summary;

      prompt += `**Project:** ${summary.project.name}`;
      if (summary.project.version) {
        prompt += ` v${summary.project.version}`;
      }
      prompt += '\n';
      prompt += `**Type:** ${summary.project.type}\n`;
      prompt += `**Language:** ${summary.project.language}\n`;

      // Tech stack (compact)
      if (summary.techStack.length > 0) {
        prompt += `**Tech:** ${summary.techStack.join(', ')}\n`;
      }
      prompt += '\n';

      // Key directories
      const dirEntries = Object.entries(summary.directories);
      if (dirEntries.length > 0) {
        prompt += '## Directories:\n';
        for (const [dir, purpose] of dirEntries) {
          prompt += `- \`${dir}/\` - ${purpose}\n`;
        }
        prompt += '\n';
      }

      // Essential commands
      const cmdEntries = Object.entries(summary.commands);
      if (cmdEntries.length > 0) {
        prompt += '## Commands:\n';
        for (const [name, script] of cmdEntries) {
          prompt += `- ${name}: \`${script}\`\n`;
        }
        prompt += '\n';
      }

      // Critical gotchas
      if (summary.gotchas.length > 0) {
        prompt += '## Gotchas:\n';
        for (const gotcha of summary.gotchas) {
          prompt += `- ${gotcha}\n`;
        }
        prompt += '\n';
      }

      // Point to full index for more details
      prompt += `**For full project analysis, read:** \`${summary.indexFile}\`\n\n`;

    } else if (context.index) {
      // Fallback: generate from index if no summary
      prompt += `**Project:** ${context.index.projectName} v${context.index.version}\n`;
      prompt += `**Type:** ${context.index.projectType}\n`;
      prompt += `**Language:** ${context.index.language}`;
      if (context.index.framework) {
        prompt += ` + ${context.index.framework}`;
      }
      prompt += '\n\n';

      // Add modules (limited to 5 for token savings)
      if (context.index.modules.length > 0) {
        prompt += '## Directories:\n';
        for (const mod of context.index.modules.slice(0, 5)) {
          prompt += `- \`${mod.path}/\` - ${mod.purpose}\n`;
        }
        prompt += '\n';
      }

      // Add commands (limited to 5)
      if (context.commands && Object.keys(context.commands).length > 0) {
        prompt += '## Commands:\n';
        for (const [name, script] of Object.entries(context.commands).slice(0, 5)) {
          prompt += `- ${name}: \`${script}\`\n`;
        }
        prompt += '\n';
      }

      // Point to full index
      prompt += '**For full project analysis, read:** `ax.index.json`\n\n';
    }

    // Add guardrails from CUSTOM.md
    if (context.guardrails && context.guardrails.length > 0) {
      prompt += '## CRITICAL RULES (NEVER VIOLATE):\n';
      for (const rule of context.guardrails) {
        prompt += `- ${rule}\n`;
      }
      prompt += '\n';

      // Add conflict warnings if detected (v12.7.1)
      if (context.guardrailConflicts && context.guardrailConflicts.length > 0) {
        prompt += '### Guardrail Conflicts Detected:\n';
        prompt += 'The following rules may conflict. Use your best judgment:\n';
        for (const conflict of context.guardrailConflicts) {
          prompt += `- **${conflict.type}**: ${conflict.description}\n`;
          prompt += `  - Rule 1: "${conflict.rule1}"\n`;
          prompt += `  - Rule 2: "${conflict.rule2}"\n`;
        }
        prompt += '\n';
      }
    }

    // Add staleness warning
    if (context.isStale) {
      prompt += '**Note:** Project index is stale (>24h old). Run `ax init` to update.\n\n';
    }

    return prompt;
  }
}

// Re-export types for backwards compatibility
export type { AxSummary as ProjectSummary };

// Re-export types for backwards compatibility
export type { AxIndex as ProjectIndex };
