/**
 * MCP Context
 *
 * Shared context for MCP tools, providing access to core services.
 *
 * @module @ax/mcp/tools/context
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  loadConfig,
  MemoryManager,
  ProviderRouter,
  SessionManager,
  AgentLoader,
  AgentRegistry,
  AgentExecutor,
  type Config,
  DIR_AUTOMATOSX,
  DIR_MEMORY,
  FILE_MEMORY_DB,
} from '@ax/core';

// =============================================================================
// Types
// =============================================================================

export interface CLIContext {
  config: Config;
  configPath: string | null;
  basePath: string;
  memoryManager: MemoryManager;
  sessionManager: SessionManager;
  providerRouter: ProviderRouter;
  agentRegistry: AgentRegistry;
  agentExecutor: AgentExecutor;
}

// =============================================================================
// Context Management
// =============================================================================

let cachedContext: CLIContext | null = null;

/**
 * Get the AutomatosX base directory
 *
 * Priority:
 * 1. AUTOMATOSX_BASE_PATH environment variable
 * 2. Current working directory + .automatosx
 * 3. Home directory + .automatosx (fallback)
 */
export function getBasePath(): string {
  // Check environment variable first (set by ax-cli)
  const envBasePath = process.env['AUTOMATOSX_BASE_PATH'];
  if (envBasePath) {
    return envBasePath;
  }

  // Default to current working directory
  const cwdPath = join(process.cwd(), DIR_AUTOMATOSX);
  return cwdPath;
}

/**
 * Initialize and get MCP context
 */
export async function getContext(): Promise<CLIContext> {
  if (cachedContext) {
    return cachedContext;
  }

  const { config, configPath } = await loadConfig();
  const basePath = getBasePath();

  // Initialize memory manager
  const memoryPath = join(basePath, DIR_MEMORY, FILE_MEMORY_DB);
  const memoryManager = new MemoryManager({
    databasePath: memoryPath,
    maxEntries: config.memory.maxEntries,
    cleanupConfig: {
      enabled: config.memory.autoCleanup,
      strategy: config.memory.cleanupStrategy,
      retentionDays: config.memory.retentionDays,
    },
  });

  // Initialize session manager
  const sessionManager = new SessionManager({
    storagePath: basePath,
    autoPersist: true,
  });
  await sessionManager.initialize();

  // Initialize provider router
  const providerRouter = new ProviderRouter({
    config,
    autoHealthCheck: true,
    healthCheckInterval: config.router.healthCheckInterval,
  });

  // Initialize agent loader and registry
  const agentLoader = new AgentLoader({ basePath });
  const agentRegistry = new AgentRegistry({ loader: agentLoader });
  await agentRegistry.initialize();

  // Initialize agent executor
  const agentExecutor = new AgentExecutor({
    router: providerRouter,
    sessionManager,
    agentRegistry,
    memoryManager,
    defaultTimeout: config.execution.timeout,
  });

  cachedContext = {
    config,
    configPath,
    basePath,
    memoryManager,
    sessionManager,
    providerRouter,
    agentRegistry,
    agentExecutor,
  };

  return cachedContext;
}

/**
 * Cleanup context resources
 */
export async function cleanupContext(): Promise<void> {
  if (cachedContext) {
    await cachedContext.providerRouter.cleanup();
    await cachedContext.sessionManager.cleanup();
    cachedContext.memoryManager.close();
    cachedContext = null;
  }
}
