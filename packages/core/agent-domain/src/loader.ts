/**
 * Agent Profile Loader
 *
 * Loads agent profiles from YAML/JSON files.
 *
 * Invariants:
 * - INV-AGT-LDR-001: All loaded profiles must pass schema validation
 * - INV-AGT-LDR-002: File extensions must match configured extensions
 * - INV-AGT-LDR-003: Agent IDs must be unique across all loaded profiles
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateAgentProfile, type AgentProfile } from '@defai.digital/contracts';
import type { AgentLoader, AgentLoaderConfig } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EXTENSIONS = ['.yaml', '.yml', '.json'];

// ============================================================================
// File System Agent Loader
// ============================================================================

/**
 * Loads agent profiles from the file system
 */
export class FileSystemAgentLoader implements AgentLoader {
  private readonly config: Required<AgentLoaderConfig>;
  private cache = new Map<string, AgentProfile>();
  private loaded = false;

  constructor(config: AgentLoaderConfig) {
    this.config = {
      agentsDir: config.agentsDir,
      extensions: config.extensions ?? DEFAULT_EXTENSIONS,
      watch: config.watch ?? false,
    };
  }

  /**
   * Load an agent profile by ID
   */
  async load(agentId: string): Promise<AgentProfile | undefined> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.get(agentId);
  }

  /**
   * Load all agent profiles from the directory
   */
  async loadAll(): Promise<AgentProfile[]> {
    this.cache.clear();

    const dirPath = this.config.agentsDir;

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      this.loaded = true;
      return [];
    }

    const files = fs.readdirSync(dirPath);
    const profiles: AgentProfile[] = [];

    // Filter files with valid extensions
    const validFiles = files
      .filter((file) => this.config.extensions.includes(path.extname(file).toLowerCase()))
      .map((file) => ({ file, filePath: path.join(dirPath, file) }));

    // Load all files in parallel for better performance
    const loadResults = await Promise.all(
      validFiles.map(async ({ file, filePath }) => {
        const profile = await this.loadFile(filePath);
        return { file, profile };
      })
    );

    // Process results sequentially to handle duplicates consistently
    for (const { file, profile } of loadResults) {
      if (profile) {
        // INV-AGT-LDR-003: Check for duplicate agent IDs
        if (this.cache.has(profile.agentId)) {
          console.warn(
            `Duplicate agent ID "${profile.agentId}" found in ${file}, skipping`
          );
          continue;
        }

        this.cache.set(profile.agentId, profile);
        profiles.push(profile);
      }
    }

    this.loaded = true;
    return profiles;
  }

  /**
   * Check if an agent exists
   */
  async exists(agentId: string): Promise<boolean> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.has(agentId);
  }

  /**
   * Reload all agent profiles
   */
  async reload(): Promise<void> {
    this.loaded = false;
    await this.loadAll();
  }

  /**
   * Load a single agent profile from a file
   */
  private async loadFile(filePath: string): Promise<AgentProfile | undefined> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let data: unknown;
      if (ext === '.json') {
        data = JSON.parse(content);
      } else {
        data = parseYaml(content);
      }

      // Transform YAML fields to match schema
      const transformed = this.transformYamlToProfile(data);

      // INV-AGT-LDR-001: Validate against schema
      const profile = validateAgentProfile(transformed);
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to load agent from ${filePath}: ${message}`);
      return undefined;
    }
  }

  /**
   * Transform YAML format to AgentProfile format
   */
  private transformYamlToProfile(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const yaml = data as Record<string, unknown>;

    // Map YAML 'name' to 'agentId'
    const profile: Record<string, unknown> = {
      ...yaml,
      agentId: yaml.name ?? yaml.agentId,
    };

    // Map 'abilities' array to 'abilities.core' if it's an array
    if (Array.isArray(yaml.abilities)) {
      profile.abilities = {
        core: yaml.abilities,
        taskBased: (yaml.abilitySelection as Record<string, unknown>)?.taskBased,
      };
    }

    // Map 'role' to description if description is missing
    if (!yaml.description && yaml.role) {
      profile.description = yaml.role as string;
    }

    // Remove YAML-specific fields
    delete profile.name;
    delete profile.abilitySelection;
    delete profile.cognitiveFramework;

    return profile;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a file system agent loader
 */
export function createAgentLoader(config: AgentLoaderConfig): AgentLoader {
  return new FileSystemAgentLoader(config);
}
