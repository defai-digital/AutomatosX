/**
 * Persistent Agent Registry
 *
 * Wraps the in-memory registry with file-based persistence.
 * Agents are saved to a JSON file and loaded on startup.
 *
 * Invariants:
 * - INV-AGT-PERSIST-001: All changes are persisted to disk
 * - INV-AGT-PERSIST-002: Registry loads existing agents on initialization
 * - INV-AGT-PERSIST-003: File operations are atomic (write to temp, then rename)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateAgentProfile,
  getErrorMessage,
  type AgentProfile,
  DATA_DIR_NAME,
  AGENTS_FILENAME,
  DEFAULT_SCHEMA_VERSION,
  AgentErrorCode,
} from '@defai.digital/contracts';
import { InMemoryAgentRegistry, AgentRegistryError } from './registry.js';
import type { AgentRegistry, AgentFilter } from './types.js';

/**
 * Configuration for persistent registry
 */
export interface PersistentRegistryConfig {
  /**
   * Path to the JSON file for storing agents
   */
  storagePath: string;

  /**
   * Whether to create the directory if it doesn't exist
   */
  createDir?: boolean;

  /**
   * Whether to load existing agents on initialization
   */
  loadOnInit?: boolean;
}

/**
 * Persistent agent registry that saves to JSON file
 */
export class PersistentAgentRegistry implements AgentRegistry {
  private readonly inMemory: InMemoryAgentRegistry;
  private readonly config: Required<PersistentRegistryConfig>;
  private initialized = false;

  constructor(config: PersistentRegistryConfig) {
    this.inMemory = new InMemoryAgentRegistry();
    this.config = {
      storagePath: config.storagePath,
      createDir: config.createDir ?? true,
      loadOnInit: config.loadOnInit ?? true,
    };
  }

  /**
   * Initialize the registry (load from disk if configured)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.config.loadOnInit) {
      await this.loadFromDisk();
    }

    this.initialized = true;
  }

  /**
   * Register a new agent profile
   * INV-AGT-PERSIST-001: Persists to disk after registration
   */
  async register(profile: AgentProfile): Promise<void> {
    await this.ensureInitialized();
    await this.inMemory.register(profile);
    await this.saveToDisk();
  }

  /**
   * Get an agent by ID
   */
  async get(agentId: string): Promise<AgentProfile | undefined> {
    await this.ensureInitialized();
    return this.inMemory.get(agentId);
  }

  /**
   * List all registered agents with optional filtering
   */
  async list(filter?: AgentFilter): Promise<AgentProfile[]> {
    await this.ensureInitialized();
    return this.inMemory.list(filter);
  }

  /**
   * Update an agent profile
   * INV-AGT-PERSIST-001: Persists to disk after update
   */
  async update(agentId: string, updates: Partial<AgentProfile>): Promise<void> {
    await this.ensureInitialized();
    await this.inMemory.update(agentId, updates);
    await this.saveToDisk();
  }

  /**
   * Remove an agent
   * INV-AGT-PERSIST-001: Persists to disk after removal
   */
  async remove(agentId: string): Promise<void> {
    await this.ensureInitialized();
    await this.inMemory.remove(agentId);
    await this.saveToDisk();
  }

  /**
   * Check if an agent exists
   */
  async exists(agentId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.inMemory.exists(agentId);
  }

  /**
   * Load agents from disk
   * INV-AGT-PERSIST-002: Called on initialization
   */
  private async loadFromDisk(): Promise<void> {
    const filePath = this.config.storagePath;

    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!Array.isArray(data.agents)) {
        console.warn(`Invalid agents file format at ${filePath}`);
        return;
      }

      for (const agentData of data.agents) {
        try {
          const profile = validateAgentProfile(agentData);
          // Use internal method to avoid triggering save
          await this.inMemory.register(profile);
        } catch (error) {
          // Silently skip "already exists" errors - these occur during normal operation
          // when the file has agents that were loaded through other means
          // Use error code check instead of fragile string matching
          const isAlreadyExists =
            error instanceof AgentRegistryError &&
            error.code === AgentErrorCode.AGENT_VALIDATION_ERROR &&
            error.message.includes(agentData.agentId);
          if (!isAlreadyExists) {
            const message = getErrorMessage(error);
            console.warn(`Failed to load agent "${agentData.agentId}": ${message}`);
          }
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn(`Failed to load agents from ${filePath}: ${message}`);
    }
  }

  /**
   * Save agents to disk
   * INV-AGT-PERSIST-003: Atomic write using temp file + rename
   */
  private async saveToDisk(): Promise<void> {
    const filePath = this.config.storagePath;
    const dirPath = path.dirname(filePath);

    // Create directory if needed
    if (this.config.createDir && !fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Get all agents
    const agents = await this.inMemory.list();

    // Create data structure
    const data = {
      version: DEFAULT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      agents,
    };

    // INV-AGT-PERSIST-003: Write to temp file first, then rename
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Get the number of registered agents (synchronous).
   *
   * WARNING: This may return 0 if called before any async method
   * (like get, list, register) has been called, because initialization
   * is lazy and async. Use getSize() for accurate results.
   *
   * @deprecated Use getSize() instead for accurate count after initialization
   */
  get size(): number {
    return this.inMemory.size;
  }

  /**
   * Get the number of registered agents (async, ensures initialization)
   */
  async getSize(): Promise<number> {
    await this.ensureInitialized();
    return this.inMemory.size;
  }

  /**
   * Force reload from disk
   */
  async reload(): Promise<void> {
    this.inMemory.clear();
    this.initialized = false;
    await this.ensureInitialized();
  }
}

/**
 * Creates a persistent agent registry
 *
 * @example
 * ```typescript
 * const registry = createPersistentAgentRegistry({
 *   storagePath: getDefaultAgentStoragePath(),
 * });
 * ```
 */
export function createPersistentAgentRegistry(
  config: PersistentRegistryConfig
): AgentRegistry {
  return new PersistentAgentRegistry(config);
}

/**
 * Gets the default storage path for agents
 * Uses DATA_DIR_NAME/AGENTS_FILENAME in current working directory
 */
export function getDefaultAgentStoragePath(): string {
  return path.join(process.cwd(), DATA_DIR_NAME, AGENTS_FILENAME);
}
