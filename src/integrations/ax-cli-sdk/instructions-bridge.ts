/**
 * InstructionsBridge - Bridges AutomatosX agent profiles with ax-cli custom instructions (v10.4.0)
 *
 * Unifies instruction management between:
 * - AutomatosX agent profiles (.automatosx/agents/*.ax.yaml)
 * - ax-cli custom instructions (.ax-cli/CUSTOM.md)
 * - ax-cli project memory
 *
 * Benefits:
 * - Unified instruction management
 * - Project-specific customization
 * - Automatic context injection
 * - Consistent agent behavior
 *
 * @module integrations/ax-cli-sdk/instructions-bridge
 */

import { logger } from '../../shared/logging/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * AutomatosX agent profile structure
 */
export interface AgentProfile {
  name: string;
  display_name: string;
  specialization: string;
  personality?: string;
  expertise?: string[];
  instructions: string;
}

/**
 * Combined instructions from all sources
 */
export interface CombinedInstructions {
  /** Base instructions from agent profile */
  baseInstructions: string;

  /** Custom instructions from ax-cli */
  customInstructions: string;

  /** Project memory context */
  projectContext: string;

  /** Combined system prompt */
  systemPrompt: string;

  /** Sources used */
  sources: {
    agentProfile: boolean;
    axCliCustom: boolean;
    projectMemory: boolean;
  };
}

/**
 * Instructions bridge options
 */
export interface InstructionsBridgeOptions {
  /** Directory for AutomatosX agent profiles */
  agentsDir?: string;

  /** Path to ax-cli custom instructions */
  axCliCustomPath?: string;

  /** Include project memory in instructions */
  includeProjectMemory?: boolean;

  /** Maximum context length (chars) */
  maxContextLength?: number;
}

/**
 * InstructionsBridge - Unifies instruction sources for agents
 *
 * Features:
 * - Load and merge agent profiles with ax-cli instructions
 * - Build optimized system prompts
 * - Automatic project context injection
 * - Cache management for performance
 *
 * @example
 * ```typescript
 * const bridge = new InstructionsBridge();
 *
 * // Get combined instructions for an agent
 * const instructions = await bridge.getInstructions('backend');
 *
 * // Use in agent execution
 * const agent = await createAgent({
 *   systemPrompt: instructions.systemPrompt
 * });
 * ```
 */
export class InstructionsBridge {
  private readonly options: Required<InstructionsBridgeOptions>;
  private sdkAvailable: boolean | null = null;
  private cache: Map<string, { instructions: CombinedInstructions; timestamp: number; signature: string }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(options: InstructionsBridgeOptions = {}) {
    this.options = {
      agentsDir: options.agentsDir ?? '.automatosx/agents',
      axCliCustomPath: options.axCliCustomPath ?? '.ax-cli/CUSTOM.md',
      includeProjectMemory: options.includeProjectMemory ?? true,
      maxContextLength: options.maxContextLength ?? 32000
    };

    logger.debug('InstructionsBridge initialized', { options: this.options });
  }

  /**
   * Get combined instructions for an agent
   *
   * @param agentName - Agent name (e.g., 'backend', 'security')
   * @param additionalContext - Optional additional context to include
   * @returns Combined instructions from all sources
   */
  async getInstructions(agentName: string, additionalContext?: string): Promise<CombinedInstructions> {
    const cacheSignature = await this.buildCacheSignature(agentName);

    // Check cache first
    const cached = this.cache.get(agentName);
    if (
      cached &&
      cached.signature === cacheSignature &&
      Date.now() - cached.timestamp < this.CACHE_TTL
    ) {
      logger.debug('Using cached instructions', { agentName });

      // Add additional context if provided
      if (additionalContext) {
        return {
          ...cached.instructions,
          systemPrompt: this.buildSystemPrompt(
            cached.instructions.baseInstructions,
            cached.instructions.customInstructions,
            cached.instructions.projectContext,
            additionalContext
          )
        };
      }

      return cached.instructions;
    }

    // Load from all sources
    const [agentProfile, customInstructions, projectContext] = await Promise.all([
      this.loadAgentProfile(agentName),
      this.loadAxCliCustomInstructions(),
      this.options.includeProjectMemory ? this.loadProjectMemory() : Promise.resolve('')
    ]);

    const baseInstructions = agentProfile?.instructions ?? '';

    // Build combined system prompt
    const systemPrompt = this.buildSystemPrompt(
      baseInstructions,
      customInstructions,
      projectContext,
      additionalContext
    );

    const combined: CombinedInstructions = {
      baseInstructions,
      customInstructions,
      projectContext,
      systemPrompt,
      sources: {
        agentProfile: !!agentProfile,
        axCliCustom: !!customInstructions,
        projectMemory: !!projectContext
      }
    };

    // Cache result
    this.cache.set(agentName, {
      instructions: combined,
      timestamp: Date.now(),
      signature: cacheSignature
    });

    logger.info('Instructions combined', {
      agentName,
      sources: combined.sources,
      promptLength: systemPrompt.length
    });

    return combined;
  }

  /**
   * Build optimized system prompt from multiple sources
   */
  buildSystemPrompt(
    baseInstructions: string,
    customInstructions: string,
    projectContext: string,
    additionalContext?: string
  ): string {
    const parts: string[] = [];

    // Base agent instructions (highest priority)
    if (baseInstructions) {
      parts.push('## Agent Instructions\n\n' + baseInstructions);
    }

    // Project-specific custom instructions
    if (customInstructions) {
      parts.push('## Project Custom Instructions\n\n' + customInstructions);
    }

    // Project memory/context
    if (projectContext) {
      parts.push('## Project Context\n\n' + projectContext);
    }

    // Additional runtime context
    if (additionalContext) {
      parts.push('## Additional Context\n\n' + additionalContext);
    }

    const combined = parts.join('\n\n---\n\n');

    // Truncate if too long
    if (combined.length > this.options.maxContextLength) {
      // BUG FIX: Use already-computed combined.length instead of recalculating
      // parts.join() a second time (wasteful redundant computation)
      logger.warn('Instructions truncated', {
        originalLength: combined.length,
        truncatedTo: this.options.maxContextLength
      });

      return combined.substring(0, this.options.maxContextLength - 100) +
        '\n\n[Context truncated due to length limit]';
    }

    return combined;
  }

  /**
   * Load AutomatosX agent profile
   */
  private async loadAgentProfile(agentName: string): Promise<AgentProfile | null> {
    const profilePath = path.join(this.options.agentsDir, `${agentName}.ax.yaml`);

    try {
      const content = await fs.readFile(profilePath, 'utf-8');

      // Parse YAML (simple parser for common fields)
      const profile = this.parseYamlProfile(content);

      logger.debug('Agent profile loaded', { agentName, profilePath });
      return profile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Agent profile not found', { agentName, profilePath });
      } else {
        logger.warn('Failed to load agent profile', {
          agentName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return null;
    }
  }

  /**
   * Load ax-cli custom instructions
   */
  private async loadAxCliCustomInstructions(): Promise<string> {
    // Try SDK first
    if (await this.ensureSDKAvailable()) {
      try {
        const { loadCustomInstructions } = await import('@defai.digital/ax-cli/sdk');
        const instructions = await loadCustomInstructions();

        if (instructions) {
          logger.debug('Custom instructions loaded via SDK');
          return instructions;
        }
      } catch (error) {
        logger.debug('SDK custom instructions not available', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Fallback: Read file directly
    try {
      const content = await fs.readFile(this.options.axCliCustomPath, 'utf-8');
      logger.debug('Custom instructions loaded from file', {
        path: this.options.axCliCustomPath
      });
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to load custom instructions', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return '';
    }
  }

  /**
   * Load project memory/context from ax-cli SDK
   */
  private async loadProjectMemory(): Promise<string> {
    if (!(await this.ensureSDKAvailable())) {
      return '';
    }

    try {
      // Try to get project memory from SDK
      const sdk = await import('@defai.digital/ax-cli/sdk');

      // Check if buildSystemPrompt is available and can provide context
      if (sdk.buildSystemPrompt) {
        // Get just the project context portion
        const fullPrompt = sdk.buildSystemPrompt({
          customInstructions: '',
          includeMemory: true
        });

        // Extract project context section
        const contextMatch = fullPrompt?.match(/## Project Context\n\n([\s\S]*?)(?=\n##|$)/);
        if (contextMatch && contextMatch[1]) {
          logger.debug('Project memory loaded via SDK');
          return contextMatch[1].trim();
        }
      }

      return '';
    } catch (error) {
      logger.debug('Project memory not available from SDK', {
        error: error instanceof Error ? error.message : String(error)
      });
      return '';
    }
  }

  /**
   * Parse YAML profile content (simple parser)
   *
   * BUG FIX (v11.3.3):
   * - Support keys with hyphens/underscores (e.g., display_name, my-key)
   * - Strip quotes from string values
   * - Handle empty values correctly
   */
  /**
   * PRODUCTION FIX (v11.3.4): Enhanced YAML parser with better edge case handling:
   * - Handle values containing colons (e.g., "description: Function: does X")
   * - Strip YAML comments (lines starting with # or inline # comments)
   * - Preserve escaped quotes within values
   * - Handle empty/null values correctly
   */
  private parseYamlProfile(content: string): AgentProfile {
    const lines = content.split('\n');
    const profile: Partial<AgentProfile> = {};
    let currentKey = '';
    let instructionsBuffer: string[] = [];
    let inInstructions = false;
    let blockIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // PRODUCTION FIX: Strip full-line comments (but preserve # in values)
      if (line.trim().startsWith('#')) {
        continue;
      }

      // PRODUCTION FIX: Improved regex to capture key and rest of line after first colon
      // This handles values containing colons like "description: Type: string"
      const match = line.match(/^([\w-]+):\s*(.*)$/);

      if (match) {
        const [, rawKey, rawValue] = match;
        const key = rawKey ?? '';
        let value = rawValue ?? '';

        // PRODUCTION FIX: Strip inline comments (but not # within quotes)
        // Only strip if # is preceded by whitespace and not within quotes
        if (!value.startsWith('"') && !value.startsWith("'")) {
          const commentIndex = value.search(/\s+#/);
          if (commentIndex > 0) {
            value = value.substring(0, commentIndex).trim();
          }
        }

        // Strip surrounding quotes from values (handle escaped quotes)
        if (value && ((value.startsWith('"') && value.endsWith('"')) ||
                      (value.startsWith("'") && value.endsWith("'")))) {
          value = value.slice(1, -1);
          // PRODUCTION FIX: Unescape escaped quotes
          value = value.replace(/\\"/g, '"').replace(/\\'/g, "'");
        }

        // Normalize hyphenated keys to underscored (e.g., display-name → display_name)
        const normalizedKey = key.replace(/-/g, '_');

        if (inInstructions && normalizedKey !== 'instructions') {
          // End of instructions block - new key found at root level
          profile.instructions = instructionsBuffer.join('\n').trim();
          instructionsBuffer = [];
          inInstructions = false;
        }

        if (normalizedKey === 'instructions') {
          inInstructions = true;
          currentKey = normalizedKey;
          // Support both | (literal block) and > (folded scalar) YAML syntax
          if (value && (value.startsWith('|') || value.startsWith('>'))) {
            // Multi-line string starts - record expected indent
            blockIndent = 2; // Standard YAML indent
          } else if (value) {
            profile.instructions = value;
            inInstructions = false;
          }
        } else if (normalizedKey === 'expertise') {
          profile.expertise = [];
          currentKey = normalizedKey;
        } else if (normalizedKey && value !== undefined) {
          // PRODUCTION FIX: Handle 'null' and '~' as YAML null values
          if (value === 'null' || value === '~' || value === '') {
            (profile as Record<string, string>)[normalizedKey] = '';
          } else {
            (profile as Record<string, string>)[normalizedKey] = value;
          }
          currentKey = normalizedKey;
        }
      } else if (inInstructions) {
        // Continuation of instructions - preserve indentation relative to block
        const trimmedLine = line.replace(/^  /, '');
        instructionsBuffer.push(trimmedLine);
      } else if (currentKey === 'expertise' && line.trim().startsWith('- ')) {
        // List item - handle quoted list items
        let listValue = line.trim().substring(2);
        if ((listValue.startsWith('"') && listValue.endsWith('"')) ||
            (listValue.startsWith("'") && listValue.endsWith("'"))) {
          listValue = listValue.slice(1, -1);
        }
        profile.expertise = profile.expertise ?? [];
        profile.expertise.push(listValue);
      }
    }

    // Handle instructions at end of file
    if (inInstructions && instructionsBuffer.length > 0) {
      profile.instructions = instructionsBuffer.join('\n').trim();
    }

    return {
      name: profile.name ?? '',
      display_name: profile.display_name ?? profile.name ?? '',
      specialization: profile.specialization ?? '',
      personality: profile.personality,
      expertise: profile.expertise,
      instructions: profile.instructions ?? ''
    };
  }

  /**
   * Sync AutomatosX agent profile to ax-cli custom instructions
   *
   * Useful for ensuring ax-cli has the latest agent context
   */
  async syncAgentToAxCli(agentName: string): Promise<void> {
    const profile = await this.loadAgentProfile(agentName);

    if (!profile) {
      logger.warn('Cannot sync - agent profile not found', { agentName });
      return;
    }

    // Build custom instructions content
    const customContent = `# ${profile.display_name} (${profile.name})

## Specialization
${profile.specialization}

${profile.personality ? `## Personality\n${profile.personality}\n` : ''}
${profile.expertise ? `## Expertise\n${profile.expertise.map(e => `- ${e}`).join('\n')}\n` : ''}
## Instructions
${profile.instructions}
`;

    // Write to ax-cli custom instructions
    try {
      await fs.mkdir(path.dirname(this.options.axCliCustomPath), { recursive: true });
      await fs.writeFile(this.options.axCliCustomPath, customContent, 'utf-8');

      logger.info('Agent synced to ax-cli custom instructions', {
        agentName,
        path: this.options.axCliCustomPath
      });
    } catch (error) {
      logger.error('Failed to sync agent to ax-cli', {
        agentName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if SDK is available
   */
  private async ensureSDKAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = true;
      return true;
    } catch {
      this.sdkAvailable = false;
      return false;
    }
  }

  /**
   * Clear instructions cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Instructions cache cleared');
  }

  /**
   * Clear cache for specific agent
   */
  clearAgentCache(agentName: string): void {
    this.cache.delete(agentName);
    logger.debug('Agent cache cleared', { agentName });
  }

  /**
   * Build a cache signature from underlying file mtimes to invalidate cache when
   * agent profiles or custom instructions change on disk.
   */
  private async buildCacheSignature(agentName: string): Promise<string> {
    const profilePath = path.join(this.options.agentsDir, `${agentName}.ax.yaml`);
    const [profileSig, customSig] = await Promise.all([
      this.getFileSignature(profilePath),
      this.getFileSignature(this.options.axCliCustomPath)
    ]);

    // Include whether project memory is part of the prompt to avoid mixing cached variants
    return [profileSig, customSig, this.options.includeProjectMemory ? 'mem' : 'nomem'].join('|');
  }

  private async getFileSignature(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      return `${stats.mtimeMs}:${stats.size}`;
    } catch {
      return 'missing';
    }
  }
}

/**
 * Default instructions bridge instance
 */
let defaultBridge: InstructionsBridge | null = null;

/**
 * Get default instructions bridge instance
 *
 * BUG FIX: Log warning when options are provided but instance already exists,
 * as the options will be ignored. Use resetInstructionsBridge() to recreate with new options.
 */
export function getInstructionsBridge(options?: InstructionsBridgeOptions): InstructionsBridge {
  if (!defaultBridge) {
    defaultBridge = new InstructionsBridge(options);
  } else if (options) {
    // BUG FIX: Warn when options are provided but instance already exists
    logger.warn('InstructionsBridge already initialized, ignoring new options', {
      hint: 'Use resetInstructionsBridge() to recreate with new options'
    });
  }
  return defaultBridge;
}

/**
 * Reset the default instructions bridge instance
 * Call this to recreate the bridge with new options
 */
export function resetInstructionsBridge(): void {
  if (defaultBridge) {
    defaultBridge.clearCache();
    defaultBridge = null;
    logger.debug('InstructionsBridge reset');
  }
}
