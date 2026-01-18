/**
 * MCP Ecosystem Domain
 *
 * Provides integration with external MCP servers for tool discovery
 * and invocation.
 *
 * @packageDocumentation
 */

// Types and interfaces
export type {
  MCPClientPort,
  MCPClientFactory,
  MCPContentBlock,
  MCPToolInfo,
  MCPResourceInfo,
  MCPToolResult,
  MCPResourceContent,
  ServerRegistryPort,
  ToolRegistryPort,
  ResourceRegistryPort,
  MCPEcosystemManager,
  MCPEcosystemManagerOptions,
} from './types.js';

// Stub implementations for testing
export {
  StubMCPClient,
  StubMCPClientFactory,
  InMemoryServerRegistry,
  InMemoryToolRegistry,
  InMemoryResourceRegistry,
} from './types.js';

// Server registry
export {
  createServerRegistryService,
  ServerRegistryError,
  type ServerRegistryService,
  type ServerRegistryServiceOptions,
} from './server-registry.js';

// Tool discovery
export {
  createToolDiscoveryService,
  type ToolDiscoveryService,
  type ToolDiscoveryServiceOptions,
  type ServerDiscoveryResult,
} from './tool-discovery.js';

// Tool router
export {
  createToolRouterService,
  ToolRouterError,
  type ToolRouterService,
  type ToolRouterServiceOptions,
} from './tool-router.js';

// Ecosystem manager
export {
  createMCPEcosystemManager,
  MCPEcosystemError,
} from './ecosystem-manager.js';
