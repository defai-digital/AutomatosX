/**
 * MCP Ecosystem Types
 *
 * Port interfaces and type definitions for external MCP server integration.
 *
 * Invariants:
 * - INV-MCP-ECO-001: Tool discovery is idempotent
 * - INV-MCP-ECO-002: Failed servers don't block others
 * - INV-MCP-ECO-003: Tool namespacing prevents collisions
 */

import type {
  MCPServerConfig,
  MCPServerState,
  MCPToolMetadata,
  MCPResourceMetadata,
  MCPDiscoveryRequest,
  MCPDiscoveryResponse,
  MCPToolInvokeRequest,
  MCPToolInvokeResponse,
  MCPServerRegisterRequest,
  MCPServerRegisterResponse,
  MCPServerListRequest,
  MCPServerListResponse,
} from '@defai.digital/contracts';

// ============================================================================
// MCP Client Port (external dependency)
// ============================================================================

/**
 * MCP content block from tool response
 */
export interface MCPContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * Port interface for MCP client operations
 * Implementations wrap actual MCP SDK client
 */
export interface MCPClientPort {
  /**
   * Connect to an MCP server
   */
  connect(config: MCPServerConfig): Promise<void>;

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * List available tools from the server
   */
  listTools(): Promise<MCPToolInfo[]>;

  /**
   * List available resources from the server
   */
  listResources(): Promise<MCPResourceInfo[]>;

  /**
   * Call a tool on the server
   */
  callTool(name: string, args?: Record<string, unknown>): Promise<MCPToolResult>;

  /**
   * Read a resource from the server
   */
  readResource(uri: string): Promise<MCPResourceContent>;
}

/**
 * Tool info from MCP server
 */
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Resource info from MCP server
 */
export interface MCPResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Tool call result
 */
export interface MCPToolResult {
  content: MCPContentBlock[];
  isError?: boolean;
}

/**
 * Resource content
 */
export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: Uint8Array;
}

// ============================================================================
// Server Registry Port
// ============================================================================

/**
 * Port interface for server registry storage
 */
export interface ServerRegistryPort {
  /**
   * Register or update a server
   */
  set(serverId: string, state: MCPServerState): Promise<void>;

  /**
   * Get server state by ID
   */
  get(serverId: string): Promise<MCPServerState | null>;

  /**
   * Check if server exists
   */
  exists(serverId: string): Promise<boolean>;

  /**
   * Delete server registration
   */
  delete(serverId: string): Promise<boolean>;

  /**
   * List all servers
   */
  list(request: MCPServerListRequest): Promise<MCPServerListResponse>;

  /**
   * Get all server IDs
   */
  getAllIds(): Promise<string[]>;

  /**
   * Clear all registrations
   */
  clear(): Promise<number>;
}

// ============================================================================
// Tool Registry Port
// ============================================================================

/**
 * Port interface for tool registry storage
 */
export interface ToolRegistryPort {
  /**
   * Register tools for a server
   */
  setTools(serverId: string, tools: MCPToolMetadata[]): Promise<void>;

  /**
   * Get tools for a server
   */
  getTools(serverId: string): Promise<MCPToolMetadata[]>;

  /**
   * Get all tools
   */
  getAllTools(): Promise<MCPToolMetadata[]>;

  /**
   * Find tool by name (may return multiple if ambiguous)
   */
  findTool(toolName: string): Promise<MCPToolMetadata[]>;

  /**
   * Get tool by full name (serverId.toolName)
   */
  getToolByFullName(fullName: string): Promise<MCPToolMetadata | null>;

  /**
   * Clear tools for a server
   */
  clearTools(serverId: string): Promise<void>;

  /**
   * Clear all tools
   */
  clearAllTools(): Promise<void>;
}

// ============================================================================
// Resource Registry Port
// ============================================================================

/**
 * Port interface for resource registry storage
 */
export interface ResourceRegistryPort {
  /**
   * Register resources for a server
   */
  setResources(serverId: string, resources: MCPResourceMetadata[]): Promise<void>;

  /**
   * Get resources for a server
   */
  getResources(serverId: string): Promise<MCPResourceMetadata[]>;

  /**
   * Get all resources
   */
  getAllResources(): Promise<MCPResourceMetadata[]>;

  /**
   * Get resource by URI
   */
  getResourceByUri(serverId: string, uri: string): Promise<MCPResourceMetadata | null>;

  /**
   * Clear resources for a server
   */
  clearResources(serverId: string): Promise<void>;

  /**
   * Clear all resources
   */
  clearAllResources(): Promise<void>;
}

// ============================================================================
// MCP Ecosystem Manager
// ============================================================================

/**
 * High-level manager for MCP ecosystem operations
 */
export interface MCPEcosystemManager {
  /**
   * Register an MCP server
   */
  registerServer(request: MCPServerRegisterRequest): Promise<MCPServerRegisterResponse>;

  /**
   * Unregister a server
   */
  unregisterServer(serverId: string): Promise<boolean>;

  /**
   * Get server state
   */
  getServer(serverId: string): Promise<MCPServerState | null>;

  /**
   * List servers
   */
  listServers(request?: MCPServerListRequest): Promise<MCPServerListResponse>;

  /**
   * Connect to a server
   */
  connectServer(serverId: string): Promise<boolean>;

  /**
   * Disconnect from a server
   */
  disconnectServer(serverId: string): Promise<boolean>;

  /**
   * Discover tools and resources
   * INV-MCP-ECO-001: Idempotent
   * INV-MCP-ECO-002: Failed servers don't block others
   */
  discover(request?: MCPDiscoveryRequest): Promise<MCPDiscoveryResponse>;

  /**
   * Invoke a tool
   */
  invokeTool(request: MCPToolInvokeRequest): Promise<MCPToolInvokeResponse>;

  /**
   * Get discovered tools
   */
  getTools(serverId?: string): Promise<MCPToolMetadata[]>;

  /**
   * Get discovered resources
   */
  getResources(serverId?: string): Promise<MCPResourceMetadata[]>;

  /**
   * Find tool by name
   * INV-MCP-ECO-003: Returns AMBIGUOUS_TOOL if multiple matches
   */
  findTool(toolName: string): Promise<MCPToolMetadata | null>;
}

// ============================================================================
// Manager Options
// ============================================================================

/**
 * Options for creating MCP ecosystem manager
 */
export interface MCPEcosystemManagerOptions {
  /**
   * Server registry storage
   */
  serverRegistry: ServerRegistryPort;

  /**
   * Tool registry storage
   */
  toolRegistry: ToolRegistryPort;

  /**
   * Resource registry storage
   */
  resourceRegistry: ResourceRegistryPort;

  /**
   * Factory for creating MCP clients
   */
  clientFactory: MCPClientFactory;

  /**
   * Default connection timeout
   */
  defaultConnectionTimeoutMs?: number;

  /**
   * Default request timeout
   */
  defaultRequestTimeoutMs?: number;
}

/**
 * Factory for creating MCP client instances
 */
export interface MCPClientFactory {
  /**
   * Create a new MCP client instance
   */
  createClient(): MCPClientPort;
}

// ============================================================================
// Stub Implementations
// ============================================================================

/**
 * Stub MCP client for testing
 */
export class StubMCPClient implements MCPClientPort {
  private connected = false;
  private tools: MCPToolInfo[] = [];
  private resources: MCPResourceInfo[] = [];

  setTools(tools: MCPToolInfo[]): void {
    this.tools = tools;
  }

  setResources(resources: MCPResourceInfo[]): void {
    this.resources = resources;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    return this.tools;
  }

  async listResources(): Promise<MCPResourceInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    return this.resources;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.connected) throw new Error('Not connected');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tool: name, args }),
        },
      ],
    };
  }

  async readResource(uri: string): Promise<MCPResourceContent> {
    if (!this.connected) throw new Error('Not connected');
    return {
      uri,
      text: `Content of ${uri}`,
    };
  }
}

/**
 * In-memory server registry for testing
 */
export class InMemoryServerRegistry implements ServerRegistryPort {
  private servers = new Map<string, MCPServerState>();

  async set(serverId: string, state: MCPServerState): Promise<void> {
    this.servers.set(serverId, state);
  }

  async get(serverId: string): Promise<MCPServerState | null> {
    return this.servers.get(serverId) ?? null;
  }

  async exists(serverId: string): Promise<boolean> {
    return this.servers.has(serverId);
  }

  async delete(serverId: string): Promise<boolean> {
    return this.servers.delete(serverId);
  }

  async list(request: MCPServerListRequest): Promise<MCPServerListResponse> {
    let servers = Array.from(this.servers.values());

    // Apply filters
    if (request.status) {
      servers = servers.filter((s) => s.status === request.status);
    }
    if (request.enabled !== undefined) {
      servers = servers.filter((s) => s.config.enabled === request.enabled);
    }
    if (request.capability) {
      servers = servers.filter((s) =>
        s.config.capabilities?.includes(request.capability!)
      );
    }

    const total = servers.length;
    const offset = request.offset ?? 0;
    const limit = request.limit ?? 10;
    const paged = servers.slice(offset, offset + limit);

    return {
      servers: paged,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getAllIds(): Promise<string[]> {
    return Array.from(this.servers.keys());
  }

  async clear(): Promise<number> {
    const count = this.servers.size;
    this.servers.clear();
    return count;
  }
}

/**
 * In-memory tool registry for testing
 */
export class InMemoryToolRegistry implements ToolRegistryPort {
  private tools = new Map<string, MCPToolMetadata[]>();

  async setTools(serverId: string, tools: MCPToolMetadata[]): Promise<void> {
    this.tools.set(serverId, tools);
  }

  async getTools(serverId: string): Promise<MCPToolMetadata[]> {
    return this.tools.get(serverId) ?? [];
  }

  async getAllTools(): Promise<MCPToolMetadata[]> {
    const all: MCPToolMetadata[] = [];
    for (const tools of this.tools.values()) {
      all.push(...tools);
    }
    return all;
  }

  async findTool(toolName: string): Promise<MCPToolMetadata[]> {
    const all = await this.getAllTools();

    // First check for exact full name match
    const exactMatch = all.filter((t) => t.fullName === toolName);
    if (exactMatch.length > 0) return exactMatch;

    // Then check for tool name match
    return all.filter((t) => t.toolName === toolName);
  }

  async getToolByFullName(fullName: string): Promise<MCPToolMetadata | null> {
    const all = await this.getAllTools();
    return all.find((t) => t.fullName === fullName) ?? null;
  }

  async clearTools(serverId: string): Promise<void> {
    this.tools.delete(serverId);
  }

  async clearAllTools(): Promise<void> {
    this.tools.clear();
  }
}

/**
 * In-memory resource registry for testing
 */
export class InMemoryResourceRegistry implements ResourceRegistryPort {
  private resources = new Map<string, MCPResourceMetadata[]>();

  async setResources(serverId: string, resources: MCPResourceMetadata[]): Promise<void> {
    this.resources.set(serverId, resources);
  }

  async getResources(serverId: string): Promise<MCPResourceMetadata[]> {
    return this.resources.get(serverId) ?? [];
  }

  async getAllResources(): Promise<MCPResourceMetadata[]> {
    const all: MCPResourceMetadata[] = [];
    for (const resources of this.resources.values()) {
      all.push(...resources);
    }
    return all;
  }

  async getResourceByUri(
    serverId: string,
    uri: string
  ): Promise<MCPResourceMetadata | null> {
    const resources = await this.getResources(serverId);
    return resources.find((r) => r.uri === uri) ?? null;
  }

  async clearResources(serverId: string): Promise<void> {
    this.resources.delete(serverId);
  }

  async clearAllResources(): Promise<void> {
    this.resources.clear();
  }
}

/**
 * Stub client factory for testing
 */
export class StubMCPClientFactory implements MCPClientFactory {
  private client: StubMCPClient;

  constructor() {
    this.client = new StubMCPClient();
  }

  getClient(): StubMCPClient {
    return this.client;
  }

  createClient(): MCPClientPort {
    return this.client;
  }
}
