/**
 * Codex Prompt Injector
 *
 * Automatically prepends AGENTS.md content to Codex prompts for better context.
 *
 * Features:
 * - Caches AGENTS.md content to avoid repeated reads
 * - Handles missing AGENTS.md gracefully
 * - Optional via env var or config flag
 * - Clear separator between injected context and user prompt
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../shared/logging/logger.js';

// ========== Types ==========

export interface PromptInjectorOptions {
  /** Enable AGENTS.md injection (default: true) */
  enabled?: boolean;
  /** Project root directory */
  projectRoot?: string;
  /** Cache TTL in milliseconds (default: 60000 - 1 minute) */
  cacheTTL?: number;
}

interface CacheEntry {
  content: string;
  timestamp: number;
}

// ========== Injector ==========

export class PromptInjector {
  private cache: CacheEntry | null = null;
  private enabled: boolean;
  private projectRoot: string;
  private cacheTTL: number;

  constructor(options: PromptInjectorOptions = {}) {
    this.enabled = options.enabled ?? this.isEnabledByDefault();
    this.projectRoot = options.projectRoot || process.cwd();
    this.cacheTTL = options.cacheTTL ?? 60000; // 1 minute default
  }

  /**
   * Inject AGENTS.md content into prompt
   *
   * @param userPrompt - Original user prompt
   * @returns Enhanced prompt with AGENTS.md prepended
   */
  async inject(userPrompt: string): Promise<string> {
    // Skip if disabled
    if (!this.enabled) {
      return userPrompt;
    }

    try {
      const agentsMdContent = await this.getAgentsMdContent();

      if (!agentsMdContent) {
        // No AGENTS.md found - return original prompt
        return userPrompt;
      }

      // Prepend AGENTS.md with clear separator
      return this.formatInjectedPrompt(agentsMdContent, userPrompt);
    } catch (error) {
      logger.warn('Failed to inject AGENTS.md', { error });
      // Return original prompt on error
      return userPrompt;
    }
  }

  /**
   * Clear cached AGENTS.md content
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Enable/disable injection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if injection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get AGENTS.md content (with caching)
   */
  private async getAgentsMdContent(): Promise<string | null> {
    // Check cache
    if (this.cache) {
      const age = Date.now() - this.cache.timestamp;
      if (age < this.cacheTTL) {
        logger.debug('Using cached AGENTS.md', { age });
        return this.cache.content;
      }
    }

    // Read fresh content
    const agentsPath = join(this.projectRoot, 'AGENTS.md');

    try {
      // Check if file exists
      await access(agentsPath);

      // Read content
      const content = await readFile(agentsPath, 'utf-8');

      // Update cache
      this.cache = {
        content,
        timestamp: Date.now()
      };

      logger.debug('Loaded AGENTS.md', {
        path: agentsPath,
        size: content.length
      });

      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('AGENTS.md not found', { path: agentsPath });
      } else {
        logger.warn('Failed to read AGENTS.md', { error });
      }
      return null;
    }
  }

  /**
   * Format injected prompt with clear separator
   */
  private formatInjectedPrompt(agentsMdContent: string, userPrompt: string): string {
    return `# Project Context (AGENTS.md)

${agentsMdContent}

---

# User Request

${userPrompt}`;
  }

  /**
   * Check if injection should be enabled by default
   */
  private isEnabledByDefault(): boolean {
    // Check env var
    const envVar = process.env.AUTOMATOSX_INJECT_AGENTS_MD;
    if (envVar !== undefined) {
      return envVar === 'true' || envVar === '1';
    }

    // Enabled by default
    return true;
  }
}

// ========== Singleton Instance ==========

let defaultInjector: PromptInjector | null = null;

/**
 * Get default prompt injector instance
 *
 * @param options - Configuration options (optional)
 * @returns Default injector instance
 */
export function getDefaultInjector(options?: PromptInjectorOptions): PromptInjector {
  if (!defaultInjector || options) {
    defaultInjector = new PromptInjector(options);
  }
  return defaultInjector;
}
