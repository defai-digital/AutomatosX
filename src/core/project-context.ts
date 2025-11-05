/**
 * Project Context Loader
 *
 * Loads and parses ax.md project context files
 * Provides project-specific instructions for AutomatosX CLI
 *
 * @since v7.1.0
 */

import { readFile, stat, realpath, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'path';
import yaml from 'yaml';
import { logger } from '../utils/logger.js';

// Maximum context size: 100KB (security limit)
const MAX_CONTEXT_SIZE = 100 * 1024;

// Cache TTL: 5 minutes
const DEFAULT_CACHE_TTL = 300_000;

/**
 * Agent delegation rule parsed from ax.md
 */
export interface AgentRule {
  taskType: string;          // e.g., "backend", "frontend"
  patterns: string[];        // File patterns like ["api/*", "*.go"]
  defaultAgent: string;      // Agent name like "@backend"
  autoReview?: boolean;      // Auto-trigger review agent
  requireApproval?: boolean; // Require user approval
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  name?: string;
  version?: string;
  lastUpdated?: string;
  description?: string;
}

/**
 * Project context configuration from ax.config.yml
 */
export interface ProjectConfig {
  agents?: Record<string, {
    patterns?: string[];
    default_for?: string[];
    auto_review?: boolean;
  }>;
  rules?: Array<{
    name: string;
    pattern: string;
    require_approval?: boolean;
    agent?: string;
  }>;
  commands?: Record<string, string>;
  persistent_context?: string[];
  project?: ProjectMetadata;
}

/**
 * Complete project context
 */
export interface ProjectContext {
  markdown?: string;           // Raw ax.md content
  config?: ProjectConfig;      // Parsed ax.config.yml
  agentRules?: AgentRule[];    // Extracted agent rules
  guardrails?: string[];       // Critical prohibitions
  commands?: Record<string, string>;  // Canonical commands
  metadata?: ProjectMetadata;  // Project metadata
  contextPrompt?: string;      // Formatted prompt for injection
}

/**
 * Project Context Loader
 *
 * Loads ax.md and ax.config.yml from project root
 * Provides caching and parsing
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

    // Load ax.md (Markdown)
    try {
      const mdPath = path.join(this.projectRoot, 'ax.md');
      const resolvedPath = await realpath(mdPath).catch(() => null);

      // BUG #34 FIX: Security - Use relative() for proper boundary check (prevents /repo vs /repo-archive)
      if (resolvedPath) {
        const rel = path.relative(this.projectRoot, resolvedPath);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        const stats = await stat(resolvedPath);

        // Security: Check file size
        if (stats.size > MAX_CONTEXT_SIZE) {
          logger.warn('ax.md too large, ignoring', {
            size: stats.size,
            limit: MAX_CONTEXT_SIZE
          });
        } else {
          context.markdown = await readFile(resolvedPath, 'utf-8');
          logger.info('Loaded ax.md', {
            size: stats.size,
            lines: context.markdown.split('\n').length
          });

          // Parse markdown sections
          context.agentRules = this.parseAgentRules(context.markdown);
          context.guardrails = this.parseGuardrails(context.markdown);
          context.commands = this.parseCommands(context.markdown);
          context.metadata = this.parseMetadata(context.markdown);
        }
        }  // BUG #34 FIX: Close the boundary check if-statement
      }
    } catch (error) {
      // ax.md is optional, ignore if not found
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading ax.md', { error });
      }
    }

    // Load ax.config.yml (YAML) - optional, advanced users
    try {
      const ymlPath = path.join(this.projectRoot, 'ax.config.yml');
      const resolvedPath = await realpath(ymlPath).catch(() => null);

      // Security: Ensure file is in project root
      if (resolvedPath && resolvedPath.startsWith(this.projectRoot)) {
        const stats = await stat(resolvedPath);

        // Security: Check file size
        if (stats.size > MAX_CONTEXT_SIZE) {
          logger.warn('ax.config.yml too large, ignoring', {
            size: stats.size,
            limit: MAX_CONTEXT_SIZE
          });
        } else {
          const ymlContent = await readFile(resolvedPath, 'utf-8');
          context.config = yaml.parse(ymlContent) as ProjectConfig;
          logger.info('Loaded ax.config.yml', {
            size: stats.size
          });

          // Merge config into context
          if (context.config.commands) {
            context.commands = { ...context.commands, ...context.config.commands };
          }
          if (context.config.project) {
            context.metadata = { ...context.metadata, ...context.config.project };
          }
        }
      }
    } catch (error) {
      // ax.config.yml is optional, ignore if not found
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        logger.warn('Error loading ax.config.yml', { error });
      }
    }

    // Build context prompt for agent injection
    context.contextPrompt = this.buildContextPrompt(context);

    // Cache result
    this.cache = context;
    this.cacheExpiry = Date.now() + this.cacheTTL;

    logger.info('Project context loaded', {
      hasMarkdown: !!context.markdown,
      hasConfig: !!context.config,
      agentRules: context.agentRules?.length ?? 0,
      guardrails: context.guardrails?.length ?? 0,
      commands: Object.keys(context.commands ?? {}).length
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
    const mdPath = path.join(this.projectRoot, 'ax.md');
    const ymlPath = path.join(this.projectRoot, 'ax.config.yml');

    const checkExists = async (filePath: string): Promise<boolean> => {
      try {
        await access(filePath, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    };

    const [mdExists, ymlExists] = await Promise.all([
      checkExists(mdPath),
      checkExists(ymlPath)
    ]);

    return mdExists || ymlExists;
  }

  /**
   * Parse agent delegation rules from markdown
   *
   * Looks for patterns like:
   * - Backend changes → @backend
   * - API endpoints → @backend, @security
   */
  private parseAgentRules(markdown: string): AgentRule[] {
    const rules: AgentRule[] = [];

    // Find "## Agent Delegation Rules" section
    const sectionRegex = /##\s+Agent\s+Delegation\s+Rules[^\n]*\n([\s\S]*?)(?=\n##|$)/i;
    const match = markdown.match(sectionRegex);

    if (!match || !match[1]) {
      return rules;
    }

    const section = match[1];

    // Parse lines like: "- Backend changes → @backend" or "- Backend changes (*.ts, api/*) → @backend"
    const lineRegex = /^[-*]\s+(.+?)\s+(→|->)+\s+(.+?)$/gm;
    let lineMatch;

    while ((lineMatch = lineRegex.exec(section)) !== null) {
      const taskTypeRaw = lineMatch[1]?.trim() ?? '';
      const agentsText = lineMatch[3]?.trim() ?? ''; // Group 3 (group 2 is the arrow)

      // Extract file patterns from parentheses: "Backend changes (*.ts, api/*)"
      const patternMatch = taskTypeRaw.match(/^(.+?)\s*\(([^)]+)\)$/);
      const taskType = patternMatch ? patternMatch[1]?.trim() : taskTypeRaw;
      const patterns = patternMatch
        ? patternMatch[2]?.split(',').map(p => p.trim()).filter(Boolean) || []
        : [];

      // Split multiple agents: "@backend, @security"
      const agents = agentsText.split(',').map(a => a.trim()).filter(Boolean);
      const defaultAgent = agents[0];

      if (defaultAgent) {
        rules.push({
          taskType,
          patterns,
          defaultAgent,
          autoReview: agents.length > 1
        });
      }
    }

    return rules;
  }

  /**
   * Parse guardrails/prohibitions from markdown
   *
   * Looks for "## Critical Guardrails" or "## Critical Rules" section
   * Extracts items marked with ⚠️ or under NEVER headings
   */
  private parseGuardrails(markdown: string): string[] {
    const guardrails: string[] = [];

    // Find critical sections
    const sectionRegex = /##\s+(Critical\s+Guardrails|Critical\s+Rules|Never)[^\n]*\n([\s\S]*?)(?=\n##|$)/gi;
    let match;

    while ((match = sectionRegex.exec(markdown)) !== null) {
      const section = match[2];
      if (!section) continue;

      // Extract bullet points
      const bulletRegex = /^[-*]\s+(.+?)$/gm;
      let bulletMatch;

      while ((bulletMatch = bulletRegex.exec(section)) !== null) {
        let rule = bulletMatch[1]?.trim() ?? '';

        // Remove emoji if present
        rule = rule.replace(/^[⚠️❌✅✓⚡🔒]+\s*/, '');

        // Remove markdown formatting
        rule = rule.replace(/\*\*(.+?)\*\*/g, '$1');  // **bold**
        rule = rule.replace(/`(.+?)`/g, '$1');        // `code`

        if (rule.length > 0) {
          guardrails.push(rule);
        }
      }
    }

    return guardrails;
  }

  /**
   * Parse commands from markdown code blocks
   *
   * Looks for "## Commands" or "## Canonical Commands" section
   */
  private parseCommands(markdown: string): Record<string, string> {
    const commands: Record<string, string> = {};

    // Find commands section
    const sectionRegex = /##\s+(Canonical\s+)?Commands[^\n]*\n([\s\S]*?)(?=\n##|$)/i;
    const match = markdown.match(sectionRegex);

    if (!match) {
      return commands;
    }

    const section = match[2];
    if (!section) {
      return commands;
    }

    // Extract from code block (```bash ... ```)
    const codeBlockRegex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/;
    const codeMatch = section.match(codeBlockRegex);

    if (codeMatch && codeMatch[1]) {
      const lines = codeMatch[1].split('\n');

      for (const line of lines) {
        // Parse: "npm test        # Run tests"
        const cmdMatch = line.match(/^([^\s#]+(?:\s+[^\s#]+)*)\s*#?\s*(.*)$/);
        if (cmdMatch && cmdMatch[1]) {
          const cmd = cmdMatch[1].trim();
          const desc = cmdMatch[2]?.trim() ?? '';

          // Use command as key if no description, otherwise use description
          const key = desc || cmd;
          commands[key] = cmd;
        }
      }
    }

    return commands;
  }

  /**
   * Parse project metadata from markdown frontmatter or first section
   */
  private parseMetadata(markdown: string): ProjectMetadata {
    const metadata: ProjectMetadata = {};

    // Try to find "Last updated:" line
    const lastUpdatedMatch = markdown.match(/>\s*Last\s+updated:\s*(.+?)$/im);
    if (lastUpdatedMatch && lastUpdatedMatch[1]) {
      metadata.lastUpdated = lastUpdatedMatch[1].trim();
    }

    // Try to find "Project:" line
    const projectMatch = markdown.match(/>\s*Project:\s*(.+?)$/im);
    if (projectMatch && projectMatch[1]) {
      // Parse "my-app v1.0.0"
      const parts = projectMatch[1].trim().split(/\s+v/);
      metadata.name = parts[0];
      if (parts[1]) {
        metadata.version = parts[1];
      }
    }

    // Try to extract from first H1
    const h1Match = markdown.match(/^#\s+(.+?)$/m);
    if (h1Match && h1Match[1] && !metadata.name) {
      metadata.name = h1Match[1].replace(/Project Context for AutomatosX/i, '').trim();
    }

    return metadata;
  }

  /**
   * Build formatted context prompt for agent injection
   */
  private buildContextPrompt(context: ProjectContext): string {
    if (!context.markdown && !context.config) {
      return '';
    }

    let prompt = '\n# PROJECT CONTEXT\n\n';

    // Add guardrails first (highest priority)
    if (context.guardrails && context.guardrails.length > 0) {
      prompt += '## CRITICAL RULES (NEVER VIOLATE):\n\n';
      context.guardrails.forEach(rule => {
        prompt += `- ${rule}\n`;
      });
      prompt += '\n';
    }

    // Add agent delegation rules
    if (context.agentRules && context.agentRules.length > 0) {
      prompt += '## Agent Delegation Rules:\n\n';
      context.agentRules.forEach(rule => {
        prompt += `- ${rule.taskType} → ${rule.defaultAgent}\n`;
      });
      prompt += '\n';
    }

    // Add canonical commands
    if (context.commands && Object.keys(context.commands).length > 0) {
      prompt += '## Available Commands:\n\n';
      Object.entries(context.commands).forEach(([desc, cmd]) => {
        prompt += `- ${desc}: \`${cmd}\`\n`;
      });
      prompt += '\n';
    }

    // Add full markdown context (truncated if too large)
    if (context.markdown) {
      const MAX_PROMPT_LENGTH = 10_000; // ~2500 tokens
      const contextToAdd = context.markdown.length > MAX_PROMPT_LENGTH
        ? context.markdown.substring(0, MAX_PROMPT_LENGTH) + '\n\n[... context truncated for length ...]'
        : context.markdown;

      prompt += '## Full Project Context:\n\n';
      prompt += contextToAdd;
      prompt += '\n';
    }

    return prompt;
  }
}
