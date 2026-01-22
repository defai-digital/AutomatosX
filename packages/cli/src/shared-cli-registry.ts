/**
 * Shared CLI Agent Registry
 *
 * Provides a singleton agent registry shared across all CLI components.
 * This prevents the "Agent already exists" errors that occur when multiple
 * registry instances try to load the same agents from disk.
 *
 * INV-CLI-REG-001: Single registry instance per CLI process
 * INV-CLI-REG-002: Example agents loaded exactly once
 *
 * @see https://github.com/defai-digital/AutomatosX/issues/46
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPersistentAgentRegistry,
  createAgentLoader,
  type AgentRegistry,
} from '@defai.digital/agent-domain';
import { DATA_DIR_NAME, AGENTS_FILENAME, getErrorMessage } from '@defai.digital/contracts';

// Get the directory of this module for finding bundled examples
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage path for persistent agents (uses home directory - matches MCP server)
const AGENT_STORAGE_PATH = path.join(os.homedir(), DATA_DIR_NAME, AGENTS_FILENAME);

/**
 * Get path to global agent storage file
 */
export function getGlobalAgentStoragePath(): string {
  return AGENT_STORAGE_PATH;
}

/**
 * Get path to example agents directory.
 * Checks multiple locations to support both development and npm install scenarios.
 */
function getExampleAgentsDir(): string {
  // Try bundled agents first (when installed via npm)
  // __dirname is 'dist/', bundled is at '../bundled/agents'
  const bundledPath = path.join(__dirname, '..', 'bundled', 'agents');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Try from commands directory (for backward compatibility)
  const commandsBundledPath = path.join(__dirname, '..', '..', 'bundled', 'agents');
  if (fs.existsSync(commandsBundledPath)) {
    return commandsBundledPath;
  }

  // Try development path (when running from source repo)
  const devPath = path.join(__dirname, '..', '..', '..', 'examples', 'agents');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Fallback to bundled path even if it doesn't exist (will be handled gracefully)
  return bundledPath;
}

// Singleton registry - shared across all CLI components
let _cliRegistry: AgentRegistry | null = null;
let _cliRegistryPromise: Promise<AgentRegistry> | null = null;
let _exampleAgentsLoaded = false;

/**
 * Compare two semver version strings
 */
function isNewerVersion(newVersion: string | undefined, oldVersion: string | undefined): boolean {
  if (!newVersion) return false;
  if (!oldVersion) return true;

  const parseVersion = (v: string): number[] => {
    // Handle pre-release by stripping it for now (simple comparison)
    const cleanVersion = v.split('-')[0] ?? v;
    return cleanVersion.split('.').map(part => parseInt(part, 10) || 0);
  };

  const newParts = parseVersion(newVersion);
  const oldParts = parseVersion(oldVersion);

  for (let i = 0; i < Math.max(newParts.length, oldParts.length); i++) {
    const newPart = newParts[i] || 0;
    const oldPart = oldParts[i] || 0;
    if (newPart > oldPart) return true;
    if (newPart < oldPart) return false;
  }

  return false;
}

/**
 * Initialize the registry and load example agents
 */
async function initializeCLIRegistry(): Promise<AgentRegistry> {
  // Create persistent registry
  const registry = createPersistentAgentRegistry({
    storagePath: AGENT_STORAGE_PATH,
    createDir: true,
    loadOnInit: true,
  });

  // Load example agents only once
  if (!_exampleAgentsLoaded) {
    _exampleAgentsLoaded = true;
    const exampleAgentsDir = getExampleAgentsDir();

    if (fs.existsSync(exampleAgentsDir)) {
      try {
        const loader = createAgentLoader({
          agentsDir: exampleAgentsDir,
          extensions: ['.json', '.yaml', '.yml'],
        });

        const exampleAgents = await loader.loadAll();

        for (const agent of exampleAgents) {
          try {
            const existing = await registry.get(agent.agentId);
            if (!existing) {
              // Agent doesn't exist - register it
              await registry.register(agent);
            } else if (isNewerVersion(agent.version, existing.version)) {
              // Example agent has newer version - update the persisted agent
              await registry.update(agent.agentId, agent);
            }
            // If agent exists with same or newer version, silently skip
          } catch (error) {
            // Only log non-duplicate errors
            const message = getErrorMessage(error);
            if (!message.toLowerCase().includes('already exists')) {
              console.warn(`Failed to register agent ${agent.agentId}:`, message);
            }
            // Silently ignore "already exists" - expected during normal operation
          }
        }
      } catch (error) {
        // Log but don't fail - example agents are optional
        console.warn('Failed to load example agents:', getErrorMessage(error));
      }
    }
  }

  return registry;
}

/**
 * Get the shared CLI agent registry
 *
 * Returns the same registry instance across all CLI components.
 * Loads example agents on first access.
 *
 * INV-CLI-REG-001: Uses atomic promise assignment to prevent race conditions
 */
export async function getCLIAgentRegistry(): Promise<AgentRegistry> {
  if (_cliRegistry !== null) {
    return _cliRegistry;
  }

  if (_cliRegistryPromise === null) {
    // Assign promise immediately before any async work to prevent race condition
    _cliRegistryPromise = initializeCLIRegistry().then(registry => {
      _cliRegistry = registry;
      // Clear promise after resolution to save memory
      _cliRegistryPromise = null;
      return registry;
    });
  }

  return _cliRegistryPromise;
}

/**
 * Reset the shared registry (for testing purposes only)
 * @internal
 */
export function _resetCLIRegistry(): void {
  _cliRegistry = null;
  _cliRegistryPromise = null;
  _exampleAgentsLoaded = false;
}
