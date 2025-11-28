/**
 * Agent Loader - Load agent profiles from YAML files
 *
 * Loads and validates agent profiles from the .automatosx/agents directory.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Loader Constants
// =============================================================================

/** Agent profiles directory name */
const AGENTS_DIR = 'agents';

/** Supported file extensions */
const AGENT_FILE_EXTENSIONS = ['.yaml', '.yml'];

/** Agent file pattern */
const AGENT_FILE_PATTERN = /^[a-z][a-z0-9-]*\.(yaml|yml)$/;

// =============================================================================
// Imports
// =============================================================================

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  type AgentProfile,
  AgentProfileSchema,
  validateAgentProfile,
} from '@ax/schemas';

// =============================================================================
// Types
// =============================================================================

export interface AgentLoaderOptions {
  /** Base path to .automatosx directory */
  basePath: string;
  /** Watch for file changes */
  watchForChanges?: boolean;
}

export interface LoadedAgent {
  /** Agent profile data */
  profile: AgentProfile;
  /** File path where agent was loaded from */
  filePath: string;
  /** Load timestamp */
  loadedAt: Date;
}

export interface AgentLoadError {
  /** Agent ID (from filename) */
  agentId: string;
  /** File path */
  filePath: string;
  /** Error message */
  error: string;
}

// =============================================================================
// Agent Loader Class
// =============================================================================

export class AgentLoader {
  private readonly basePath: string;
  private readonly agentsPath: string;
  private readonly loadedAgents: Map<string, LoadedAgent> = new Map();
  private readonly loadErrors: AgentLoadError[] = [];

  constructor(options: AgentLoaderOptions) {
    this.basePath = options.basePath;
    this.agentsPath = join(options.basePath, AGENTS_DIR);
  }

  // =============================================================================
  // Public Methods
  // =============================================================================

  /**
   * Load all agent profiles from the agents directory
   */
  async loadAll(): Promise<{
    agents: LoadedAgent[];
    errors: AgentLoadError[];
  }> {
    this.loadedAgents.clear();
    this.loadErrors.length = 0;

    try {
      const files = await readdir(this.agentsPath);
      const agentFiles = files.filter(f =>
        AGENT_FILE_EXTENSIONS.includes(extname(f).toLowerCase())
      );

      if (agentFiles.length === 0) {
        console.warn(
          `[ax/loader] No agent files found in ${this.agentsPath}. ` +
          `Supported extensions: ${AGENT_FILE_EXTENSIONS.join(', ')}`
        );
      }

      for (const file of agentFiles) {
        await this.loadAgentFile(file);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Agents directory doesn't exist - that's ok, will use defaults
    }

    return {
      agents: Array.from(this.loadedAgents.values()),
      errors: [...this.loadErrors],
    };
  }

  /**
   * Load a specific agent by ID
   */
  async loadAgent(agentId: string): Promise<LoadedAgent | null> {
    for (const ext of AGENT_FILE_EXTENSIONS) {
      const filePath = join(this.agentsPath, `${agentId}${ext}`);
      try {
        const stats = await stat(filePath);
        if (stats.isFile()) {
          return this.loadAgentFromPath(filePath);
        }
      } catch {
        // File doesn't exist, try next extension
      }
    }
    return null;
  }

  /**
   * Load agent from a specific file path
   */
  async loadAgentFromPath(filePath: string): Promise<LoadedAgent | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const profile = validateAgentProfile(parsed);

      const loaded: LoadedAgent = {
        profile,
        filePath,
        loadedAt: new Date(),
      };

      this.loadedAgents.set(profile.name, loaded);
      return loaded;
    } catch (error) {
      const agentId = basename(filePath, extname(filePath));
      this.loadErrors.push({
        agentId,
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get a loaded agent by ID
   */
  get(agentId: string): LoadedAgent | undefined {
    return this.loadedAgents.get(agentId);
  }

  /**
   * Get all loaded agents
   */
  getAll(): LoadedAgent[] {
    return Array.from(this.loadedAgents.values());
  }

  /**
   * Get all agent IDs
   */
  getIds(): string[] {
    return Array.from(this.loadedAgents.keys());
  }

  /**
   * Check if an agent exists
   */
  has(agentId: string): boolean {
    return this.loadedAgents.has(agentId);
  }

  /**
   * Get load errors
   */
  getErrors(): AgentLoadError[] {
    return [...this.loadErrors];
  }

  /**
   * Reload all agents
   */
  async reload(): Promise<{
    agents: LoadedAgent[];
    errors: AgentLoadError[];
  }> {
    return this.loadAll();
  }

  /**
   * Reload a specific agent
   */
  async reloadAgent(agentId: string): Promise<LoadedAgent | null> {
    return this.loadAgent(agentId);
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Load an agent from a file in the agents directory
   */
  private async loadAgentFile(fileName: string): Promise<void> {
    const filePath = join(this.agentsPath, fileName);
    await this.loadAgentFromPath(filePath);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new agent loader instance
 */
export function createAgentLoader(options: AgentLoaderOptions): AgentLoader {
  return new AgentLoader(options);
}
