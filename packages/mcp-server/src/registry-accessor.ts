/**
 * Registry Accessor
 *
 * Provides access to shared singleton instances without creating circular dependencies.
 * This file does NOT import from tools/ - it only provides accessor functions.
 *
 * The actual initialization happens in shared-registry.ts which imports this module
 * and sets the singletons after initialization.
 */

import type {
  AgentRegistry,
  AgentExecutor,
  ToolExecutor,
} from '@automatosx/agent-domain';
import type {
  AbilityRegistry,
  AbilityManager,
} from '@automatosx/ability-domain';
import type { AgentProfile } from '@automatosx/contracts';

// Singleton state - set by shared-registry.ts during initialization
let _registry: AgentRegistry | null = null;
let _executor: AgentExecutor | null = null;
let _abilityRegistry: AbilityRegistry | null = null;
let _abilityManager: AbilityManager | null = null;
let _toolExecutor: ToolExecutor | null = null;
let _initialized = false;
let _initPromise: Promise<void> | null = null;

// Initialization function - set by shared-registry.ts
let _initializeFn: (() => Promise<void>) | null = null;

/**
 * Set the initialization function (called by shared-registry.ts)
 */
export function setInitializer(fn: () => Promise<void>): void {
  _initializeFn = fn;
}

/**
 * Set singleton instances (called by shared-registry.ts after initialization)
 */
export function setSingletons(singletons: {
  registry: AgentRegistry;
  executor: AgentExecutor;
  abilityRegistry: AbilityRegistry;
  abilityManager: AbilityManager;
  toolExecutor: ToolExecutor;
}): void {
  _registry = singletons.registry;
  _executor = singletons.executor;
  _abilityRegistry = singletons.abilityRegistry;
  _abilityManager = singletons.abilityManager;
  _toolExecutor = singletons.toolExecutor;
  _initialized = true;
}

/**
 * Ensure initialization is complete
 */
async function ensureInitialized(): Promise<void> {
  if (_initialized) return;

  if (_initPromise) {
    await _initPromise;
    return;
  }

  if (!_initializeFn) {
    throw new Error(
      'Registry not configured. Import shared-registry.ts to configure initialization.'
    );
  }

  _initPromise = _initializeFn();
  await _initPromise;
}

/**
 * Get the shared registry instance
 */
export async function getSharedRegistry(): Promise<AgentRegistry> {
  await ensureInitialized();
  return _registry!;
}

/**
 * Get the shared executor instance
 */
export async function getSharedExecutor(): Promise<AgentExecutor> {
  await ensureInitialized();
  return _executor!;
}

/**
 * Get the shared ability registry
 */
export async function getSharedAbilityRegistry(): Promise<AbilityRegistry> {
  await ensureInitialized();
  return _abilityRegistry!;
}

/**
 * Get the shared ability manager
 */
export async function getSharedAbilityManager(): Promise<AbilityManager> {
  await ensureInitialized();
  return _abilityManager!;
}

/**
 * Get the shared tool executor
 */
export async function getSharedToolExecutor(): Promise<ToolExecutor> {
  await ensureInitialized();
  return _toolExecutor!;
}

/**
 * Check if shared registry is initialized
 */
export function isInitialized(): boolean {
  return _initialized;
}

/**
 * Register an agent in the shared registry
 */
export async function registerAgent(profile: AgentProfile): Promise<void> {
  const registry = await getSharedRegistry();
  await registry.register(profile);
}

/**
 * Get agent from shared registry
 */
export async function getAgent(agentId: string): Promise<AgentProfile | undefined> {
  const registry = await getSharedRegistry();
  return registry.get(agentId);
}

/**
 * List agents from shared registry
 */
export async function listAgents(filter?: { team?: string; enabled?: boolean }): Promise<AgentProfile[]> {
  const registry = await getSharedRegistry();
  return registry.list(filter);
}

/**
 * Remove agent from shared registry
 */
export async function removeAgent(agentId: string): Promise<void> {
  const registry = await getSharedRegistry();
  await registry.remove(agentId);
}

/**
 * Execute an agent using the shared executor
 */
export async function executeAgent(
  agentId: string,
  input: unknown,
  options?: {
    sessionId?: string;
    provider?: string;
    model?: string;
    parallel?: boolean;
  }
): Promise<Awaited<ReturnType<AgentExecutor['execute']>>> {
  const executor = await getSharedExecutor();
  return executor.execute(agentId, input, options);
}

/**
 * Reset shared registry (for testing)
 */
export function resetSharedRegistry(): void {
  _registry = null;
  _executor = null;
  _abilityRegistry = null;
  _abilityManager = null;
  _toolExecutor = null;
  _initialized = false;
  _initPromise = null;
}
