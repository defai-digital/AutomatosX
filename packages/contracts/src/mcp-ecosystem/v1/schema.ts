/**
 * MCP Ecosystem Contracts v1
 *
 * Schemas for tool discovery and dynamic loading for external MCP servers.
 * Enables leveraging the broader MCP ecosystem of tools and servers.
 *
 * Invariants:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */

import { z } from 'zod';
import {
  LIMIT_DEFAULT,
  LIMIT_MAX,
} from '../../constants.js';

// ============================================================================
// MCP Server Configuration
// ============================================================================

/**
 * Server ID pattern: lowercase alphanumeric with hyphens
 */
const SERVER_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * MCP server configuration
 *
 * Invariants:
 * - INV-MCP-ECO-003: serverId must be unique for namespacing
 */
export const MCPServerConfigSchema = z.object({
  /**
   * Unique server identifier (used for tool namespacing)
   * INV-MCP-ECO-003: Prevents tool name collisions
   */
  serverId: z.string().min(1).max(50).regex(SERVER_ID_PATTERN, {
    message: 'Server ID must start with a letter and contain only lowercase letters, numbers, and hyphens',
  }),

  /**
   * Human-readable server name
   */
  name: z.string().min(1).max(100),

  /**
   * Description of what this server provides
   */
  description: z.string().max(500).optional(),

  /**
   * Command to start the MCP server
   */
  command: z.string().min(1).max(1000),

  /**
   * Arguments for the command
   */
  args: z.array(z.string().max(500)).max(20).optional(),

  /**
   * Environment variables for the server process
   */
  env: z.record(z.string(), z.string()).optional(),

  /**
   * Working directory for the server
   */
  cwd: z.string().max(500).optional(),

  /**
   * Whether this server is enabled
   */
  enabled: z.boolean().default(true),

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeoutMs: z.number().int().min(1000).max(60000).default(10000),

  /**
   * Request timeout in milliseconds
   */
  requestTimeoutMs: z.number().int().min(1000).max(300000).default(60000),

  /**
   * Maximum retries for failed connections
   */
  maxRetries: z.number().int().min(0).max(10).default(3),

  /**
   * Tags for categorization
   */
  tags: z.array(z.string().max(50)).max(10).optional(),

  /**
   * Server capabilities (discovered or configured)
   */
  capabilities: z.array(z.string().max(100)).optional(),

  /**
   * Version of the server (if known)
   */
  version: z.string().max(50).optional(),
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

// ============================================================================
// MCP Server Status
// ============================================================================

/**
 * Server connection status
 */
export const MCPServerStatusSchema = z.enum([
  'connected',
  'disconnected',
  'connecting',
  'error',
  'disabled',
]);

export type MCPServerStatus = z.infer<typeof MCPServerStatusSchema>;

/**
 * Full server state including runtime info
 */
export const MCPServerStateSchema = z.object({
  /**
   * Server configuration
   */
  config: MCPServerConfigSchema,

  /**
   * Current connection status
   */
  status: MCPServerStatusSchema,

  /**
   * Last error message if status is 'error'
   */
  lastError: z.string().optional(),

  /**
   * Last successful connection timestamp
   */
  lastConnectedAt: z.string().datetime().optional(),

  /**
   * Number of discovered tools
   */
  toolCount: z.number().int().min(0).default(0),

  /**
   * Number of discovered resources
   */
  resourceCount: z.number().int().min(0).default(0),

  /**
   * Timestamp when tools were last discovered
   */
  lastDiscoveredAt: z.string().datetime().optional(),
});

export type MCPServerState = z.infer<typeof MCPServerStateSchema>;

// ============================================================================
// MCP Tool Metadata
// ============================================================================

/**
 * Metadata for a discovered MCP tool
 *
 * Invariants:
 * - INV-MCP-ECO-003: fullName includes serverId prefix for namespacing
 */
export const MCPToolMetadataSchema = z.object({
  /**
   * Tool name as provided by the server
   */
  toolName: z.string().min(1).max(100),

  /**
   * Full namespaced name (serverId.toolName)
   * INV-MCP-ECO-003: Prevents collisions
   */
  fullName: z.string().min(1).max(200),

  /**
   * Server that provides this tool
   */
  serverId: z.string().min(1).max(50),

  /**
   * Tool description
   */
  description: z.string().max(1000),

  /**
   * Input schema for the tool (JSON Schema format)
   */
  inputSchema: z.record(z.string(), z.unknown()),

  /**
   * Whether the tool is available
   */
  available: z.boolean().default(true),

  /**
   * Category for organization
   */
  category: z.string().max(50).optional(),

  /**
   * Tags for filtering
   */
  tags: z.array(z.string().max(50)).max(10).optional(),

  /**
   * When this tool was discovered
   */
  discoveredAt: z.string().datetime().optional(),
});

export type MCPToolMetadata = z.infer<typeof MCPToolMetadataSchema>;

// ============================================================================
// MCP Resource Metadata
// ============================================================================

/**
 * Metadata for a discovered MCP resource
 */
export const MCPResourceMetadataSchema = z.object({
  /**
   * Resource URI
   */
  uri: z.string().min(1).max(2000),

  /**
   * Full namespaced URI (serverId://...)
   * INV-MCP-ECO-003: Prevents collisions
   */
  fullUri: z.string().min(1).max(2100),

  /**
   * Server that provides this resource
   */
  serverId: z.string().min(1).max(50),

  /**
   * Resource name
   */
  name: z.string().min(1).max(200),

  /**
   * Resource description
   */
  description: z.string().max(1000).optional(),

  /**
   * MIME type of the resource
   */
  mimeType: z.string().max(100).optional(),

  /**
   * When this resource was discovered
   */
  discoveredAt: z.string().datetime().optional(),
});

export type MCPResourceMetadata = z.infer<typeof MCPResourceMetadataSchema>;

// ============================================================================
// Discovery Request/Response
// ============================================================================

/**
 * Request to discover tools/resources from servers
 *
 * Invariants:
 * - INV-MCP-ECO-001: Discovery is idempotent
 */
export const MCPDiscoveryRequestSchema = z.object({
  /**
   * Specific server IDs to discover from (optional, all enabled if not specified)
   */
  serverIds: z.array(z.string().max(50)).max(20).optional(),

  /**
   * Whether to force refresh even if recently discovered
   */
  forceRefresh: z.boolean().default(false),

  /**
   * Filter by capability
   */
  filterCapability: z.string().max(100).optional(),

  /**
   * Filter by category
   */
  filterCategory: z.string().max(50).optional(),

  /**
   * Include disabled servers
   */
  includeDisabled: z.boolean().default(false),
});

export type MCPDiscoveryRequest = z.infer<typeof MCPDiscoveryRequestSchema>;

/**
 * Response from tool/resource discovery
 *
 * Invariants:
 * - INV-MCP-ECO-002: Reports per-server status (failures don't block others)
 */
export const MCPDiscoveryResponseSchema = z.object({
  /**
   * Discovered tools
   */
  tools: z.array(MCPToolMetadataSchema),

  /**
   * Discovered resources
   */
  resources: z.array(MCPResourceMetadataSchema),

  /**
   * Per-server discovery results
   * INV-MCP-ECO-002: Each server reports independently
   */
  serverResults: z.array(
    z.object({
      serverId: z.string(),
      status: z.enum(['success', 'error', 'skipped']),
      toolCount: z.number().int().min(0),
      resourceCount: z.number().int().min(0),
      error: z.string().optional(),
      durationMs: z.number().int().min(0),
    })
  ),

  /**
   * Total discovery duration
   */
  totalDurationMs: z.number().int().min(0),

  /**
   * When discovery was performed
   */
  discoveredAt: z.string().datetime(),
});

export type MCPDiscoveryResponse = z.infer<typeof MCPDiscoveryResponseSchema>;

// ============================================================================
// Tool Invocation
// ============================================================================

/**
 * Request to invoke an MCP tool
 */
export const MCPToolInvokeRequestSchema = z.object({
  /**
   * Full tool name (serverId.toolName) or just toolName if unique
   */
  toolName: z.string().min(1).max(200),

  /**
   * Server ID (optional if toolName is fully qualified)
   */
  serverId: z.string().max(50).optional(),

  /**
   * Arguments for the tool
   */
  arguments: z.record(z.string(), z.unknown()).optional(),

  /**
   * Request timeout override
   */
  timeoutMs: z.number().int().min(1000).max(300000).optional(),
});

export type MCPToolInvokeRequest = z.infer<typeof MCPToolInvokeRequestSchema>;

/**
 * Response from tool invocation
 */
export const MCPToolInvokeResponseSchema = z.object({
  /**
   * Whether invocation succeeded
   */
  success: z.boolean(),

  /**
   * Tool that was invoked
   */
  toolName: z.string(),

  /**
   * Server that handled the invocation
   */
  serverId: z.string(),

  /**
   * Result content (MCP content blocks)
   */
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
      data: z.string().optional(),
      mimeType: z.string().optional(),
    })
  ),

  /**
   * Whether the result indicates an error
   */
  isError: z.boolean().default(false),

  /**
   * Error message if failed
   */
  error: z.string().optional(),

  /**
   * Invocation duration
   */
  durationMs: z.number().int().min(0),
});

export type MCPToolInvokeResponse = z.infer<typeof MCPToolInvokeResponseSchema>;

// ============================================================================
// Server Registration
// ============================================================================

/**
 * Request to register an MCP server
 */
export const MCPServerRegisterRequestSchema = MCPServerConfigSchema.extend({
  /**
   * Whether to connect immediately after registration
   */
  connectNow: z.boolean().default(true),

  /**
   * Whether to discover tools immediately after connection
   */
  discoverNow: z.boolean().default(true),
});

export type MCPServerRegisterRequest = z.infer<typeof MCPServerRegisterRequestSchema>;

/**
 * Response from server registration
 */
export const MCPServerRegisterResponseSchema = z.object({
  /**
   * Whether registration succeeded
   */
  success: z.boolean(),

  /**
   * Registered server state
   */
  server: MCPServerStateSchema.optional(),

  /**
   * Whether a new server was created (vs updated existing)
   */
  created: z.boolean(),

  /**
   * Discovered tools (if discoverNow was true)
   */
  tools: z.array(MCPToolMetadataSchema).optional(),

  /**
   * Error message if failed
   */
  error: z.string().optional(),
});

export type MCPServerRegisterResponse = z.infer<typeof MCPServerRegisterResponseSchema>;

// ============================================================================
// Server List
// ============================================================================

/**
 * Request to list MCP servers
 */
export const MCPServerListRequestSchema = z.object({
  /**
   * Filter by status
   */
  status: MCPServerStatusSchema.optional(),

  /**
   * Filter by enabled state
   */
  enabled: z.boolean().optional(),

  /**
   * Filter by capability
   */
  capability: z.string().max(100).optional(),

  /**
   * Maximum servers to return
   */
  limit: z.number().int().min(1).max(LIMIT_MAX).default(LIMIT_DEFAULT),

  /**
   * Offset for pagination
   */
  offset: z.number().int().min(0).default(0),
});

export type MCPServerListRequest = z.infer<typeof MCPServerListRequestSchema>;

/**
 * Response from server list
 */
export const MCPServerListResponseSchema = z.object({
  /**
   * Servers matching the filter
   */
  servers: z.array(MCPServerStateSchema),

  /**
   * Total count
   */
  total: z.number().int().min(0),

  /**
   * Whether more servers exist
   */
  hasMore: z.boolean(),
});

export type MCPServerListResponse = z.infer<typeof MCPServerListResponseSchema>;

// ============================================================================
// Server Unregister
// ============================================================================

/**
 * Request to unregister an MCP server
 */
export const MCPServerUnregisterRequestSchema = z.object({
  /**
   * Server ID to unregister
   */
  serverId: z.string().min(1).max(100),
});

export type MCPServerUnregisterRequest = z.infer<typeof MCPServerUnregisterRequestSchema>;

/**
 * Response from server unregistration
 */
export const MCPServerUnregisterResponseSchema = z.object({
  /**
   * Whether unregistration succeeded
   */
  success: z.boolean(),

  /**
   * Server ID that was unregistered
   */
  serverId: z.string(),

  /**
   * Whether the server existed
   */
  existed: z.boolean(),
});

export type MCPServerUnregisterResponse = z.infer<typeof MCPServerUnregisterResponseSchema>;

// ============================================================================
// Tools List
// ============================================================================

/**
 * Request to list discovered tools
 */
export const MCPToolsListRequestSchema = z.object({
  /**
   * Filter by server ID
   */
  serverId: z.string().max(100).optional(),

  /**
   * Filter by category
   */
  category: z.string().max(100).optional(),
});

export type MCPToolsListRequest = z.infer<typeof MCPToolsListRequestSchema>;

/**
 * Response from tools list
 */
export const MCPToolsListResponseSchema = z.object({
  /**
   * Discovered tools
   */
  tools: z.array(MCPToolMetadataSchema),

  /**
   * Total count
   */
  total: z.number().int().min(0),
});

export type MCPToolsListResponse = z.infer<typeof MCPToolsListResponseSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const MCPEcosystemErrorCodes = {
  /** Server not found */
  SERVER_NOT_FOUND: 'MCP_ECO_SERVER_NOT_FOUND',
  /** Tool not found */
  TOOL_NOT_FOUND: 'MCP_ECO_TOOL_NOT_FOUND',
  /** Connection failed */
  CONNECTION_FAILED: 'MCP_ECO_CONNECTION_FAILED',
  /** Connection timeout */
  CONNECTION_TIMEOUT: 'MCP_ECO_CONNECTION_TIMEOUT',
  /** Invocation failed */
  INVOCATION_FAILED: 'MCP_ECO_INVOCATION_FAILED',
  /** Discovery failed */
  DISCOVERY_FAILED: 'MCP_ECO_DISCOVERY_FAILED',
  /** Invalid server configuration */
  INVALID_CONFIG: 'MCP_ECO_INVALID_CONFIG',
  /** Server already exists */
  SERVER_EXISTS: 'MCP_ECO_SERVER_EXISTS',
  /** Ambiguous tool name */
  AMBIGUOUS_TOOL: 'MCP_ECO_AMBIGUOUS_TOOL',
} as const;

export type MCPEcosystemErrorCode =
  (typeof MCPEcosystemErrorCodes)[keyof typeof MCPEcosystemErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates MCP server configuration
 */
export function validateMCPServerConfig(data: unknown): MCPServerConfig {
  return MCPServerConfigSchema.parse(data);
}

/**
 * Validates MCP tool invoke request
 */
export function validateMCPToolInvokeRequest(data: unknown): MCPToolInvokeRequest {
  return MCPToolInvokeRequestSchema.parse(data);
}

/**
 * Safely validates server configuration
 */
export function safeValidateMCPServerConfig(
  data: unknown
): { success: true; data: MCPServerConfig } | { success: false; error: z.ZodError } {
  const result = MCPServerConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates MCP server config with defaults
 */
export function createMCPServerConfig(
  serverId: string,
  command: string,
  options?: Partial<Omit<MCPServerConfig, 'serverId' | 'command'>>
): MCPServerConfig {
  return MCPServerConfigSchema.parse({
    serverId,
    name: options?.name ?? serverId,
    command,
    ...options,
  });
}

/**
 * Creates tool full name with server prefix
 * INV-MCP-ECO-003: Namespacing
 */
export function createToolFullName(serverId: string, toolName: string): string {
  return `${serverId}.${toolName}`;
}

/**
 * Parses a tool full name into serverId and toolName
 */
export function parseToolFullName(fullName: string): { serverId: string; toolName: string } | null {
  const dotIndex = fullName.indexOf('.');
  if (dotIndex === -1) return null;

  return {
    serverId: fullName.substring(0, dotIndex),
    toolName: fullName.substring(dotIndex + 1),
  };
}

/**
 * Creates resource full URI with server prefix
 * INV-MCP-ECO-003: Namespacing
 */
export function createResourceFullUri(serverId: string, uri: string): string {
  return `${serverId}://${uri.replace(/^[a-z]+:\/\//, '')}`;
}

/**
 * Creates initial server state
 */
export function createInitialServerState(config: MCPServerConfig): MCPServerState {
  return {
    config,
    status: config.enabled ? 'disconnected' : 'disabled',
    toolCount: 0,
    resourceCount: 0,
  };
}
