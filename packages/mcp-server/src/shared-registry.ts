/**
 * Shared Agent Registry
 *
 * Single source of truth for agent registry across all MCP components.
 * Provides unified access to agents with auto-loading of example agents.
 *
 * Now includes ability integration (INV-AGT-ABL-001, INV-AGT-ABL-002, INV-AGT-ABL-003)
 *
 * ARCHITECTURE NOTE: This file imports from tools/index.js to get TOOL_HANDLERS.
 * To avoid circular dependencies, accessor functions are in registry-accessor.ts.
 * Tool files should import from registry-accessor.ts, NOT from this file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  createPersistentAgentRegistry,
  createEnhancedAgentExecutor,
  createProviderPromptExecutor,
  createAgentLoader,
  type AgentRegistry,
  type EnhancedAgentDomainConfig,
  type ToolExecutor,
  DEFAULT_AGENT_DOMAIN_CONFIG,
} from '@defai.digital/agent-domain';
import {
  type ToolExecutionResult,
  createToolExecutionSuccess,
  createToolExecutionFailure,
  ToolExecutorErrorCodes,
  DATA_DIR_NAME,
  AGENTS_FILENAME,
  TIMEOUT_AGENT_STEP_DEFAULT,
  LIMIT_ABILITY_TOKENS_AGENT,
  PROVIDER_DEFAULT,
} from '@defai.digital/contracts';
import {
  createAbilityRegistry,
  createAbilityLoader,
  createAbilityManager,
  DEFAULT_ABILITY_DOMAIN_CONFIG,
  type AbilityRegistry,
} from '@defai.digital/ability-domain';
// Provider registry from bootstrap (composition root)
import { createProviderRegistry, type ProviderRegistry } from './bootstrap.js';
import { TOOL_HANDLERS } from './tools/index.js';
import type { ToolHandler, MCPToolResult } from './types.js';
import {
  setInitializer,
  setSingletons,
  resetSharedRegistry as resetAccessor,
} from './registry-accessor.js';

// Re-export accessor functions for backwards compatibility
// Tools should import directly from registry-accessor.ts
export {
  getSharedRegistry,
  getSharedExecutor,
  getSharedAbilityRegistry,
  getSharedAbilityManager,
  getSharedToolExecutor,
  isInitialized,
  registerAgent,
  getAgent,
  listAgents,
  removeAgent,
  executeAgent,
} from './registry-accessor.js';

// Get the directory of this module (for finding bundled examples)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage path for persistent agents - use HOME directory for global storage
// This ensures agents persist across projects and are accessible regardless of cwd
const AGENT_STORAGE_PATH = path.join(os.homedir(), DATA_DIR_NAME, AGENTS_FILENAME);

// Path to example agents - check multiple locations:
// 1. Bundled agents in npm package (for npm install)
// 2. Package's examples directory (for development/source)
// 3. Monorepo root (for pnpm workspace development)
function getExampleAgentsDir(): string {
  // Try bundled agents first (when installed via npm)
  // __dirname is 'dist/', bundled is at '../bundled/agents'
  const bundledPath = path.join(__dirname, '..', 'bundled', 'agents');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Try development path (when running from source repo)
  const devPath = path.join(__dirname, '..', '..', '..', 'examples', 'agents');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Try monorepo root (for pnpm workspace)
  const monorepoPath = path.join(__dirname, '..', '..', '..', '..', 'examples', 'agents');
  if (fs.existsSync(monorepoPath)) {
    return monorepoPath;
  }

  // Try relative to cwd as fallback (for backward compatibility)
  const cwdPath = path.join(process.cwd(), 'examples', 'agents');
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  // Return bundled path as default (most common case for npm install)
  return bundledPath;
}

// Path to example abilities - similar logic
function getExampleAbilitiesDir(): string {
  const defaultDir = DEFAULT_ABILITY_DOMAIN_CONFIG.abilitiesDir;

  // Try development path first
  const devPath = path.join(__dirname, '..', '..', '..', defaultDir);
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Try monorepo root
  const monorepoPath = path.join(__dirname, '..', '..', '..', '..', defaultDir);
  if (fs.existsSync(monorepoPath)) {
    return monorepoPath;
  }

  // Try relative to cwd as fallback
  const cwdPath = path.join(process.cwd(), defaultDir);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  return monorepoPath;
}

const EXAMPLE_AGENTS_DIR = getExampleAgentsDir();
const EXAMPLE_ABILITIES_DIR = getExampleAbilitiesDir();

// Local state for provider registry (not in accessor since it's provider-adapter specific)
let _providerRegistry: ProviderRegistry | null = null;

/**
 * Creates a tool executor bridge that connects to MCP tool handlers
 *
 * INV-TOOL-001: Validates inputs via TOOL_HANDLERS (which use wrapHandlersWithInputValidation)
 * INV-TOOL-002: Freezes outputs via createToolExecutionSuccess/Failure
 * INV-TOOL-003: Returns errors gracefully for unknown tools
 */
function createToolExecutorBridge(handlers: Record<string, ToolHandler>): ToolExecutor {
  const handlerMap = new Map(Object.entries(handlers));

  return {
    async execute(toolName: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const startTime = Date.now();

      const handler = handlerMap.get(toolName);
      if (!handler) {
        // INV-TOOL-003: Unknown tools return error, not throw
        return createToolExecutionFailure(
          `Tool not found: ${toolName}`,
          ToolExecutorErrorCodes.TOOL_NOT_FOUND,
          false,
          Date.now() - startTime
        );
      }

      try {
        // Execute the handler (already validated by wrapHandlersWithInputValidation)
        const result = await handler(args);

        // Parse the MCPToolResult
        const output = parseToolResultContent(result);

        if (result.isError) {
          return createToolExecutionFailure(
            typeof output === 'string' ? output : JSON.stringify(output),
            ToolExecutorErrorCodes.TOOL_EXECUTION_ERROR,
            true, // Most tool errors are retryable
            Date.now() - startTime
          );
        }

        // INV-TOOL-002: createToolExecutionSuccess freezes the result
        return createToolExecutionSuccess(output, Date.now() - startTime);
      } catch (error) {
        return createToolExecutionFailure(
          error instanceof Error ? error.message : 'Unknown tool execution error',
          ToolExecutorErrorCodes.TOOL_EXECUTION_ERROR,
          true,
          Date.now() - startTime
        );
      }
    },

    isToolAvailable(toolName: string): boolean {
      return handlerMap.has(toolName);
    },

    getAvailableTools(): string[] {
      return [...handlerMap.keys()];
    },
  };
}

/**
 * Parse MCPToolResult content into a usable value
 */
function parseToolResultContent(result: MCPToolResult): unknown {
  if (!result.content || result.content.length === 0) {
    return undefined;
  }

  // Get the first text content
  const textContent = result.content.find((c) => c.type === 'text');
  if (textContent?.text === undefined) {
    return undefined;
  }

  // Try to parse as JSON
  try {
    return JSON.parse(textContent.text);
  } catch {
    // Return as string if not JSON
    return textContent.text;
  }
}

/**
 * Initialize shared registry with example agents and abilities
 */
async function initializeRegistry(): Promise<void> {
  // Create provider registry
  _providerRegistry = createProviderRegistry();

  // Create prompt executor
  const promptExecutor = createProviderPromptExecutor(_providerRegistry, {
    defaultProvider: PROVIDER_DEFAULT,
    defaultTimeout: TIMEOUT_AGENT_STEP_DEFAULT,
  });

  // Create tool executor bridge (INV-TOOL-001, INV-TOOL-002, INV-TOOL-003)
  const toolExecutor = createToolExecutorBridge(TOOL_HANDLERS);

  // Create ability registry and manager (INV-AGT-ABL-001)
  const abilityRegistry = createAbilityRegistry();
  const abilityManager = createAbilityManager(abilityRegistry);

  // Load example abilities
  await loadExampleAbilities(abilityRegistry);

  // Create persistent agent registry
  const registry = createPersistentAgentRegistry({
    storagePath: AGENT_STORAGE_PATH,
    createDir: true,
    loadOnInit: true,
  });

  // Create enhanced executor with full features including ability and tool injection
  const config: EnhancedAgentDomainConfig = {
    ...DEFAULT_AGENT_DOMAIN_CONFIG,
    promptExecutor,
    // INV-TOOL-001, INV-TOOL-002, INV-TOOL-003: Tool executor for MCP tool calls
    toolExecutor,
    // INV-AGT-ABL-001: Ability manager for prompt injection
    abilityManager,
    enableAbilityInjection: true,
    maxAbilityTokens: LIMIT_ABILITY_TOKENS_AGENT,
    checkpointConfig: {
      enabled: true,
      intervalSteps: 1,
      retentionHours: 24,
    },
    parallelConfig: {
      enabled: true,
      maxConcurrency: 5,
      failureStrategy: 'failFast',
    },
  };

  const executor = createEnhancedAgentExecutor(registry, config);

  // Load example agents if directory exists
  await loadExampleAgents(registry);

  // Set singletons in accessor module
  setSingletons({
    registry,
    executor,
    abilityRegistry,
    abilityManager,
    toolExecutor,
  });
}

/**
 * Load example abilities from examples/abilities directory
 */
async function loadExampleAbilities(abilityRegistry: AbilityRegistry): Promise<void> {
  if (!fs.existsSync(EXAMPLE_ABILITIES_DIR)) {
    return;
  }

  try {
    const loader = createAbilityLoader({
      abilitiesDir: EXAMPLE_ABILITIES_DIR,
    });

    const abilities = await loader.loadAll();

    for (const ability of abilities) {
      try {
        await abilityRegistry.register(ability);
      } catch (error) {
        // Log duplicate registration but don't fail
        const isDuplicate = error instanceof Error && error.message.includes('already');
        if (!isDuplicate) {
          console.warn(`Failed to register ability ${ability.abilityId}:`, error instanceof Error ? error.message : error);
        }
      }
    }
  } catch (error) {
    // Log but don't fail - example abilities are optional
    console.warn('Failed to load example abilities:', error instanceof Error ? error.message : error);
  }
}

/**
 * Load example agents from examples/agents directory
 *
 * BUG FIX: Previously, if an agent existed in persistent storage (from an older version
 * without workflow), the newer example version with workflow would never be loaded.
 * Now we check if the stored agent is missing critical fields (workflow, systemPrompt)
 * that the example version has, and update the stored version accordingly.
 */
async function loadExampleAgents(registry: AgentRegistry): Promise<void> {
  if (!fs.existsSync(EXAMPLE_AGENTS_DIR)) {
    return;
  }

  try {
    const loader = createAgentLoader({
      agentsDir: EXAMPLE_AGENTS_DIR,
      extensions: ['.json', '.yaml', '.yml'],
    });

    const exampleAgents = await loader.loadAll();

    for (const agent of exampleAgents) {
      const existingAgent = await registry.get(agent.agentId);

      if (existingAgent === undefined) {
        // Agent doesn't exist - register it
        try {
          await registry.register(agent);
        } catch (error) {
          const isDuplicate = error instanceof Error && error.message.includes('already');
          if (!isDuplicate) {
            console.warn(`Failed to register agent ${agent.agentId}:`, error instanceof Error ? error.message : error);
          }
        }
      } else {
        // Agent exists - check if example has workflow/systemPrompt that stored version is missing
        const needsUpdate =
          (agent.workflow !== undefined && agent.workflow.length > 0 &&
            (existingAgent.workflow === undefined || existingAgent.workflow.length === 0)) ||
          (agent.systemPrompt !== undefined && agent.systemPrompt.length > 0 &&
            (existingAgent.systemPrompt === undefined || existingAgent.systemPrompt.length === 0));

        if (needsUpdate) {
          try {
            // Update with the missing fields from example
            const updates: Partial<typeof agent> = {};
            if (agent.workflow !== undefined && agent.workflow.length > 0 &&
                (existingAgent.workflow === undefined || existingAgent.workflow.length === 0)) {
              updates.workflow = agent.workflow;
            }
            if (agent.systemPrompt !== undefined && agent.systemPrompt.length > 0 &&
                (existingAgent.systemPrompt === undefined || existingAgent.systemPrompt.length === 0)) {
              updates.systemPrompt = agent.systemPrompt;
            }
            // Also update other potentially missing fields
            if (agent.abilities !== undefined && existingAgent.abilities === undefined) {
              updates.abilities = agent.abilities;
            }
            if (agent.personality !== undefined && existingAgent.personality === undefined) {
              updates.personality = agent.personality;
            }
            if (agent.selectionMetadata !== undefined && existingAgent.selectionMetadata === undefined) {
              updates.selectionMetadata = agent.selectionMetadata;
            }

            await registry.update(agent.agentId, updates);
          } catch (error) {
            console.warn(`Failed to update agent ${agent.agentId}:`, error instanceof Error ? error.message : error);
          }
        }
      }
    }
  } catch (error) {
    // Log but don't fail - example agents are optional
    console.warn('Failed to load example agents:', error instanceof Error ? error.message : error);
  }
}

/**
 * Get the shared provider registry
 */
export async function getSharedProviderRegistry(): Promise<ProviderRegistry> {
  // Ensure initialization is complete by calling any accessor
  const { getSharedRegistry } = await import('./registry-accessor.js');
  await getSharedRegistry();
  if (_providerRegistry === null) {
    throw new Error('Provider registry not initialized - initialization may have failed');
  }
  return _providerRegistry;
}

/**
 * Reset shared registry (for testing)
 */
export function resetSharedRegistry(): void {
  resetAccessor();
  _providerRegistry = null;
}

// Register the initializer with the accessor module
setInitializer(initializeRegistry);
