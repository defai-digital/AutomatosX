/**
 * Server Registry
 *
 * Manages MCP server registrations and state.
 *
 * Invariants:
 * - INV-MCP-ECO-003: Server IDs must be unique
 * - INV-MCP-ECO-200: Server state consistency
 * - INV-MCP-ECO-201: Disabled servers not connected
 */

import type {
  MCPServerConfig,
  MCPServerState,
  MCPServerStatus,
  MCPServerRegisterRequest,
  MCPServerRegisterResponse,
  MCPServerListRequest,
  MCPServerListResponse,
} from '@defai.digital/contracts';
import {
  MCPEcosystemErrorCodes,
  createInitialServerState,
  LIMIT_DEFAULT,
} from '@defai.digital/contracts';
import type { ServerRegistryPort, MCPClientPort, MCPClientFactory } from './types.js';

/**
 * Error thrown by server registry operations
 */
export class ServerRegistryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServerRegistryError';
  }

  static serverNotFound(serverId: string): ServerRegistryError {
    return new ServerRegistryError(
      MCPEcosystemErrorCodes.SERVER_NOT_FOUND,
      `Server not found: ${serverId}`,
      { serverId }
    );
  }

  static serverExists(serverId: string): ServerRegistryError {
    return new ServerRegistryError(
      MCPEcosystemErrorCodes.SERVER_EXISTS,
      `Server already exists: ${serverId}`,
      { serverId }
    );
  }

  static connectionFailed(serverId: string, message: string): ServerRegistryError {
    return new ServerRegistryError(
      MCPEcosystemErrorCodes.CONNECTION_FAILED,
      `Connection failed for ${serverId}: ${message}`,
      { serverId }
    );
  }

  static invalidConfig(message: string): ServerRegistryError {
    return new ServerRegistryError(
      MCPEcosystemErrorCodes.INVALID_CONFIG,
      `Invalid server configuration: ${message}`
    );
  }
}

/**
 * Options for server registry service
 */
export interface ServerRegistryServiceOptions {
  /**
   * Storage port for server state
   */
  storage: ServerRegistryPort;

  /**
   * Factory for creating MCP clients
   */
  clientFactory: MCPClientFactory;

  /**
   * Default connection timeout in ms
   */
  defaultConnectionTimeoutMs?: number;
}

/**
 * Server registry service
 *
 * Manages server registrations and connections.
 */
export interface ServerRegistryService {
  /**
   * Register a new server
   * INV-MCP-ECO-003: Validates unique server ID
   */
  register(request: MCPServerRegisterRequest): Promise<MCPServerRegisterResponse>;

  /**
   * Unregister a server
   */
  unregister(serverId: string): Promise<boolean>;

  /**
   * Update server configuration
   */
  update(serverId: string, config: Partial<MCPServerConfig>): Promise<MCPServerState>;

  /**
   * Get server state
   */
  get(serverId: string): Promise<MCPServerState | null>;

  /**
   * List servers
   */
  list(request?: MCPServerListRequest): Promise<MCPServerListResponse>;

  /**
   * Connect to a server
   * INV-MCP-ECO-201: Validates server is enabled
   */
  connect(serverId: string): Promise<MCPClientPort>;

  /**
   * Disconnect from a server
   */
  disconnect(serverId: string): Promise<void>;

  /**
   * Update server status
   * INV-MCP-ECO-200: State consistency
   */
  updateStatus(
    serverId: string,
    status: MCPServerStatus,
    error?: string
  ): Promise<void>;

  /**
   * Get active client for server
   */
  getClient(serverId: string): MCPClientPort | null;

  /**
   * Get all enabled server IDs
   */
  getEnabledServerIds(): Promise<string[]>;
}

/**
 * Creates a server registry service
 */
export function createServerRegistryService(
  options: ServerRegistryServiceOptions
): ServerRegistryService {
  const {
    storage,
    clientFactory,
    defaultConnectionTimeoutMs = 10000,
  } = options;

  // Active clients by server ID
  const clients = new Map<string, MCPClientPort>();

  return {
    async register(request): Promise<MCPServerRegisterResponse> {
      const { connectNow, discoverNow: _discoverNow, ...config } = request;

      try {
        // Atomic get-or-create pattern to avoid TOCTOU race condition
        const existingState = await storage.get(config.serverId);
        if (existingState) {
          // Update existing server
          const updatedState: MCPServerState = {
            ...existingState,
            config: { ...existingState.config, ...config },
          };
          await storage.set(config.serverId, updatedState);

          return {
            success: true,
            server: updatedState,
            created: false,
          };
        }

        // Create new server state
        const serverState = createInitialServerState(config);
        await storage.set(config.serverId, serverState);

        // Optionally connect
        if (connectNow && config.enabled !== false) {
          try {
            await this.connect(config.serverId);
            // Update state after connection
            const updatedState = await storage.get(config.serverId);
            return {
              success: true,
              server: updatedState ?? serverState,
              created: true,
            };
          } catch (error) {
            // Connection failed, but registration succeeded
            const updatedState = await storage.get(config.serverId);
            return {
              success: true,
              server: updatedState ?? serverState,
              created: true,
              error: error instanceof Error ? error.message : 'Connection failed',
            };
          }
        }

        return {
          success: true,
          server: serverState,
          created: true,
        };
      } catch (error) {
        return {
          success: false,
          created: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    async unregister(serverId): Promise<boolean> {
      // Disconnect if connected
      if (clients.has(serverId)) {
        await this.disconnect(serverId);
      }

      return storage.delete(serverId);
    },

    async update(serverId, config): Promise<MCPServerState> {
      const state = await storage.get(serverId);
      if (!state) {
        throw ServerRegistryError.serverNotFound(serverId);
      }

      const updatedConfig = { ...state.config, ...config };
      const updatedState: MCPServerState = {
        ...state,
        config: updatedConfig,
      };

      // Handle enable/disable
      if (config.enabled === false && state.status !== 'disabled') {
        await this.disconnect(serverId);
        updatedState.status = 'disabled';
      } else if (config.enabled === true && state.status === 'disabled') {
        updatedState.status = 'disconnected';
      }

      await storage.set(serverId, updatedState);
      return updatedState;
    },

    async get(serverId): Promise<MCPServerState | null> {
      return storage.get(serverId);
    },

    async list(request: Partial<MCPServerListRequest> = {}): Promise<MCPServerListResponse> {
      const fullRequest: MCPServerListRequest = {
        limit: request.limit ?? LIMIT_DEFAULT,
        offset: request.offset ?? 0,
        status: request.status,
        enabled: request.enabled,
        capability: request.capability,
      };
      return storage.list(fullRequest);
    },

    async connect(serverId): Promise<MCPClientPort> {
      const state = await storage.get(serverId);
      if (!state) {
        throw ServerRegistryError.serverNotFound(serverId);
      }

      // INV-MCP-ECO-201: Don't connect disabled servers
      if (!state.config.enabled) {
        throw ServerRegistryError.connectionFailed(
          serverId,
          'Server is disabled'
        );
      }

      // Check if already connected
      const existing = clients.get(serverId);
      if (existing?.isConnected()) {
        return existing;
      }

      // Update status to connecting
      await this.updateStatus(serverId, 'connecting');

      // Create new client
      const client = clientFactory.createClient();

      try {
        // Connect with timeout
        const timeout = state.config.connectionTimeoutMs ?? defaultConnectionTimeoutMs;
        await Promise.race([
          client.connect(state.config),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), timeout)
          ),
        ]);

        // Store client and update status
        clients.set(serverId, client);
        await this.updateStatus(serverId, 'connected');

        // Update lastConnectedAt
        const updatedState = await storage.get(serverId);
        if (updatedState) {
          await storage.set(serverId, {
            ...updatedState,
            lastConnectedAt: new Date().toISOString(),
          });
        }

        return client;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await this.updateStatus(serverId, 'error', message);
        throw ServerRegistryError.connectionFailed(serverId, message);
      }
    },

    async disconnect(serverId): Promise<void> {
      const client = clients.get(serverId);
      if (client) {
        try {
          await client.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        clients.delete(serverId);
      }

      // Update status
      const state = await storage.get(serverId);
      if (state && state.config.enabled) {
        await this.updateStatus(serverId, 'disconnected');
      }
    },

    async updateStatus(
      serverId,
      status,
      error
    ): Promise<void> {
      const state = await storage.get(serverId);
      if (!state) return;

      const updatedState: MCPServerState = {
        ...state,
        status,
        lastError: error,
      };

      // Clear error on successful states
      if (status === 'connected' || status === 'disconnected') {
        delete updatedState.lastError;
      }

      await storage.set(serverId, updatedState);
    },

    getClient(serverId): MCPClientPort | null {
      const client = clients.get(serverId);
      return client?.isConnected() ? client : null;
    },

    async getEnabledServerIds(): Promise<string[]> {
      const { servers } = await storage.list({ enabled: true, limit: 1000, offset: 0 });
      return servers.map((s) => s.config.serverId);
    },
  };
}
