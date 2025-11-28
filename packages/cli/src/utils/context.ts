/**
 * CLI Context
 *
 * Shared context and initialization for CLI commands.
 * Provides lazy-loaded access to core services.
 *
 * @module @ax/cli/utils/context
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
 */
export function getBasePath(): string {
  // Check current directory first
  const cwdPath = join(process.cwd(), DIR_AUTOMATOSX);

  // Fall back to home directory - unused for now but kept for future
  // const homePath = join(homedir(), DIR_AUTOMATOSX);

  // Use cwd if it exists or seems like a project directory
  return cwdPath;
}

/**
 * Initialize and get CLI context
 */
export async function getContext(): Promise<CLIContext> {
  if (cachedContext) {
    return cachedContext;
  }

  // Load configuration
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
 * Get context with minimal initialization (for quick commands)
 */
export async function getMinimalContext(): Promise<{
  config: Config;
  configPath: string | null;
  basePath: string;
}> {
  const { config, configPath } = await loadConfig();
  const basePath = getBasePath();

  return { config, configPath, basePath };
}

/**
 * Cleanup context resources
 */
export async function cleanupContext(): Promise<void> {
  if (cachedContext) {
    await cachedContext.providerRouter.cleanup();
    await cachedContext.sessionManager.cleanup();
    // Wrap close in try-catch to prevent cleanup failures from blocking context cleanup
    try {
      cachedContext.memoryManager.close();
    } catch (error) {
      // Log but don't throw - cleanup should be best-effort
      console.warn(
        `[ax/cli] Failed to close memory manager: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    cachedContext = null;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dirPath, { recursive: true });
}
