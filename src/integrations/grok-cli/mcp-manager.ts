/**
 * Grok CLI Integration - MCP Manager
 *
 * Manages the Grok CLI MCP (Model Context Protocol) servers using the
 * unified MCP manager for consistent behavior across all providers.
 *
 * Supports loading MCP configurations from YAML provider files.
 *
 * @module integrations/grok-cli/mcp-manager
 */

import { UnifiedMCPManager, createUnifiedMCPManager } from '../../mcp/unified-manager.js';
import type {
  UniversalMCPConfig,
  MCPServerConfig,
  MCPServerStatus,
  MCPToolInfo,
} from '../../mcp/types-common.js';
import { logger } from '../../utils/logger.js';
import type { YamlProviderConfig } from '../../core/config-loaders/yaml-config-loader.js';

/**
 * Grok MCP Configuration (from YAML)
 */
export interface GrokMCPConfig {
  enabled: boolean;
  servers?: Array<{
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
  }>;
}

/**
 * Grok MCP Manager
 *
 * Wraps the UnifiedMCPManager with Grok-specific YAML configuration loading.
 */
export class GrokMCPManager {
  private unifiedManager?: UnifiedMCPManager;
  private mcpConfig?: GrokMCPConfig;

  constructor(providerConfig?: YamlProviderConfig) {
    // Extract MCP config from provider YAML if available
    if (providerConfig && 'mcp' in providerConfig) {
      this.mcpConfig = providerConfig.mcp as GrokMCPConfig;
    }
  }

  /**
   * Initialize MCP manager
   *
   * Converts Grok YAML config to universal MCP config and initializes the unified manager.
   */
  async initialize(): Promise<void> {
    logger.info('GrokMCPManager: Initializing');

    // Check if MCP is configured
    if (!this.mcpConfig || !this.mcpConfig.enabled) {
      logger.info('GrokMCPManager: MCP not enabled, skipping initialization');
      return;
    }

    // Check if servers are configured
    if (!this.mcpConfig.servers || this.mcpConfig.servers.length === 0) {
      logger.warn('GrokMCPManager: MCP enabled but no servers configured');
      return;
    }

    try {
      // Convert Grok YAML config to universal MCP config
      const universalConfig = this.convertToUniversalConfig();

      // Create unified manager
      this.unifiedManager = createUnifiedMCPManager(universalConfig);

      // Initialize it
      await this.unifiedManager.initialize();

      logger.info('GrokMCPManager: Initialized successfully', {
        serverCount: this.mcpConfig.servers.length,
      });
    } catch (error) {
      logger.error('GrokMCPManager: Initialization failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Start all MCP servers
   *
   * @returns Status of all started servers
   */
  async startServers(): Promise<MCPServerStatus[]> {
    if (!this.unifiedManager) {
      logger.warn('GrokMCPManager: Not initialized, cannot start servers');
      return [];
    }

    logger.info('GrokMCPManager: Starting MCP servers');
    return this.unifiedManager.startServers();
  }

  /**
   * Stop all MCP servers
   */
  async stopServers(): Promise<void> {
    if (!this.unifiedManager) {
      logger.debug('GrokMCPManager: Not initialized, nothing to stop');
      return;
    }

    logger.info('GrokMCPManager: Stopping MCP servers');
    await this.unifiedManager.stopServers();
  }

  /**
   * Get status of all servers
   *
   * @returns Array of server statuses
   */
  async getStatus(): Promise<MCPServerStatus[]> {
    if (!this.unifiedManager) {
      return [];
    }

    return this.unifiedManager.getStatus();
  }

  /**
   * Discover available tools
   *
   * @returns Array of tool information
   */
  async discoverTools(): Promise<MCPToolInfo[]> {
    if (!this.unifiedManager) {
      return [];
    }

    return this.unifiedManager.discoverTools();
  }

  /**
   * Restart a specific server
   *
   * @param serverName - Name of server to restart
   * @returns Server status after restart
   */
  async restartServer(serverName: string): Promise<MCPServerStatus | undefined> {
    if (!this.unifiedManager) {
      logger.warn('GrokMCPManager: Not initialized, cannot restart server');
      return undefined;
    }

    logger.info('GrokMCPManager: Restarting server', { name: serverName });
    return this.unifiedManager.restartServer(serverName);
  }

  /**
   * Get server status
   *
   * @param serverName - Server name
   * @returns Server status or undefined if not found
   */
  async getServerStatus(serverName: string): Promise<MCPServerStatus | undefined> {
    if (!this.unifiedManager) {
      return undefined;
    }

    return this.unifiedManager.getServerStatus(serverName);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (!this.unifiedManager) {
      return;
    }

    logger.info('GrokMCPManager: Cleaning up');
    await this.unifiedManager.cleanup();
  }

  /**
   * Load MCP configuration from YAML provider config
   *
   * @param providerConfig - YAML provider configuration
   */
  loadFromYAML(providerConfig: YamlProviderConfig): void {
    if ('mcp' in providerConfig) {
      this.mcpConfig = providerConfig.mcp as GrokMCPConfig;
      logger.info('GrokMCPManager: Loaded MCP config from YAML', {
        enabled: this.mcpConfig.enabled,
        serverCount: this.mcpConfig.servers?.length || 0,
      });
    }
  }

  /**
   * Convert Grok YAML config to universal MCP config
   */
  private convertToUniversalConfig(): UniversalMCPConfig {
    if (!this.mcpConfig || !this.mcpConfig.servers) {
      throw new Error('GrokMCPManager: No MCP configuration available');
    }

    // Convert servers
    const servers: MCPServerConfig[] = this.mcpConfig.servers.map(server => ({
      name: server.name,
      command: server.command,
      args: server.args,
      env: server.env,
      cwd: server.cwd,
      enabled: true,
      transport: 'stdio',
    }));

    // Create universal config
    const universalConfig: UniversalMCPConfig = {
      enabled: true,
      servers,
      healthCheck: {
        enabled: true,
        intervalMs: 60000, // 1 minute
        restartOnFailure: true,
      },
      logging: {
        logServerOutput: true,
        logLevel: 'info',
      },
    };

    return universalConfig;
  }

  /**
   * Check if MCP is enabled
   *
   * @returns True if MCP is enabled and has servers configured
   */
  isEnabled(): boolean {
    return !!(
      this.mcpConfig &&
      this.mcpConfig.enabled &&
      this.mcpConfig.servers &&
      this.mcpConfig.servers.length > 0
    );
  }
}

/**
 * Default Grok MCP manager instance
 */
let defaultManager: GrokMCPManager | null = null;

/**
 * Get default Grok MCP manager instance
 *
 * @param providerConfig - YAML provider configuration (optional)
 * @returns Default manager instance
 */
export function getDefaultGrokMCPManager(
  providerConfig?: YamlProviderConfig
): GrokMCPManager {
  if (!defaultManager || providerConfig) {
    defaultManager = new GrokMCPManager(providerConfig);
  }
  return defaultManager;
}
