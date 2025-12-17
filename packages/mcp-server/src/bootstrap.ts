/**
 * MCP Server Composition Root (Bootstrap Module)
 *
 * This is the ONLY place in MCP Server that imports adapter implementations.
 * All other MCP Server code depends on port interfaces from contracts or core.
 *
 * Following Ports & Adapters (Hexagonal Architecture) pattern.
 */

// ============================================================================
// Adapter Imports - ONLY allowed in this file
// ============================================================================

import { createProviderRegistry as createRegistry } from '@automatosx/provider-adapters';

// ============================================================================
// Types - re-exported for use in MCP Server code
// ============================================================================

export type ProviderRegistry = ReturnType<typeof createRegistry>;

// ============================================================================
// Dependency Container
// ============================================================================

interface MCPDependencies {
  providerRegistry: ProviderRegistry;
}

let _dependencies: MCPDependencies | null = null;
let _initialized = false;

// ============================================================================
// Bootstrap Function
// ============================================================================

/**
 * Initialize all MCP Server dependencies
 *
 * Called once at server startup. Wires adapters to ports.
 * This is the composition root - the only place that knows about concrete implementations.
 */
export function bootstrap(): MCPDependencies {
  if (_initialized && _dependencies) {
    return _dependencies;
  }

  // Create provider registry
  const providerRegistry = createRegistry();

  // Build dependency container
  _dependencies = {
    providerRegistry,
  };

  _initialized = true;
  return _dependencies;
}

/**
 * Get initialized dependencies
 * Auto-bootstraps if not already initialized
 */
export function getDependencies(): MCPDependencies {
  if (!_dependencies) {
    return bootstrap();
  }
  return _dependencies;
}

/**
 * Check if bootstrap has been called
 */
export function isBootstrapped(): boolean {
  return _initialized;
}

/**
 * Get provider registry
 */
export function getProviderRegistry(): ProviderRegistry {
  return getDependencies().providerRegistry;
}

/**
 * Create a new provider registry instance
 * Use this when you need a fresh registry (e.g., for testing)
 */
export function createProviderRegistry(): ProviderRegistry {
  return createRegistry();
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset all dependencies (for testing)
 */
export function resetBootstrap(): void {
  _dependencies = null;
  _initialized = false;
}
