/**
 * Gemini CLI Integration - MCP Manager
 *
 * Manages the Gemini CLI MCP (Model Context Protocol) servers using the
 * unified MCP manager for consistent behavior across all providers.
 *
 * @module integrations/gemini-cli/mcp-manager
 */

import { UnifiedMCPManager, createUnifiedMCPManager } from '../../mcp/unified-manager.js';
import type { UniversalMCPConfig, MCPServerStatus, MCPToolInfo } from '../../mcp/types-common.js';
import { logger } from '../../shared/logging/logger.js';
import type { GeminiConfig } from './types.js';

/**
 * Gemini MCP Manager
 *
 * Wraps the UnifiedMCPManager with Gemini-specific configuration loading.
 */
export class GeminiMCPManager {
  private unifiedManager?: UnifiedMCPManager;
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = config;
  }

  /**
   * Initialize MCP manager
   *
   * Converts Gemini config to universal MCP config and initializes the unified manager.
   */
  async initialize(): Promise<void> {
    logger.info('GeminiMCPManager: Initializing');

    // Check if MCP is configured in Gemini config
    if (!this.config.mcp || !this.hasValidMCPConfig()) {
      logger.info('GeminiMCPManager: MCP not configured, skipping initialization');
      return;
    }

    try {
      // Convert Gemini config to universal MCP config
      const mcpConfig = this.convertToUniversalConfig();

      // Create unified manager
      this.unifiedManager = createUnifiedMCPManager(mcpConfig);

      // Initialize it
      await this.unifiedManager.initialize();

      logger.info('GeminiMCPManager: Initialized successfully');
    } catch (error) {
      logger.error('GeminiMCPManager: Initialization failed', {
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
      logger.warn('GeminiMCPManager: Not initialized, cannot start servers');
      return [];
    }

    logger.info('GeminiMCPManager: Starting MCP servers');
    return this.unifiedManager.startServers();
  }

  /**
   * Stop all MCP servers
   */
  async stopServers(): Promise<void> {
    if (!this.unifiedManager) {
      logger.debug('GeminiMCPManager: Not initialized, nothing to stop');
      return;
    }

    logger.info('GeminiMCPManager: Stopping MCP servers');
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
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (!this.unifiedManager) {
      return;
    }

    logger.info('GeminiMCPManager: Cleaning up');
    await this.unifiedManager.cleanup();
  }

  /**
   * Check if Gemini config has valid MCP configuration
   */
  private hasValidMCPConfig(): boolean {
    if (!this.config.mcp) {
      return false;
    }

    // Check for discovery settings
    if (this.config.mcp.discovery) {
      return true;
    }

    // Check for explicit server configurations (future extension)
    // For now, discovery is the only supported method
    return false;
  }

  /**
   * Convert Gemini config to universal MCP config
   */
  private convertToUniversalConfig(): UniversalMCPConfig {
    const geminiMcp = this.config.mcp!;

    // Base universal config
    const universalConfig: UniversalMCPConfig = {
      enabled: true,
      servers: [],
      logging: {
        logServerOutput: true,
        logLevel: 'info',
      },
    };

    // Add discovery settings if configured
    if (geminiMcp.discovery) {
      universalConfig.discovery = {
        enabled: true,
        ...geminiMcp.discovery,
      };
    }

    // Add default MCP servers if discovery is not configured
    // or if explicit servers are defined in the future
    if (!universalConfig.discovery || !universalConfig.discovery.enabled) {
      // For now, use empty servers array
      // In the future, this could load from geminiMcp.servers if we extend the config
      universalConfig.servers = [];
    }

    return universalConfig;
  }
}

/**
 * Default Gemini MCP manager instance
 */
let defaultManager: GeminiMCPManager | null = null;

/**
 * Get default Gemini MCP manager instance
 *
 * BUG FIX: Previously, passing config when a manager already existed would
 * silently replace the existing manager (potentially orphaning active servers).
 * Now behaves consistently with other MCP managers by warning and ignoring
 * the config. Use resetDefaultGeminiMCPManager() to recreate.
 *
 * @param config - Gemini configuration (optional, only used on first call)
 * @returns Default manager instance
 */
export function getDefaultGeminiMCPManager(
  config?: GeminiConfig
): GeminiMCPManager {
  if (!defaultManager) {
    defaultManager = new GeminiMCPManager(
      config || {
        // Default empty config
        mcp: {
          discovery: {
            enabled: false,
          },
        },
      } as GeminiConfig
    );
  } else if (config) {
    // BUG FIX: Warn when config is provided but instance already exists
    logger.warn('GeminiMCPManager already initialized, ignoring new config', {
      hint: 'Use resetDefaultGeminiMCPManager() to recreate with new config'
    });
  }
  return defaultManager;
}

/**
 * Reset the default Gemini MCP manager
 *
 * Cleans up the existing manager and allows recreation with new config.
 */
export async function resetDefaultGeminiMCPManager(): Promise<void> {
  if (defaultManager) {
    await defaultManager.cleanup();
    defaultManager = null;
  }
}
