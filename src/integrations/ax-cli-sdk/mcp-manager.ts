/**
 * ax-cli SDK MCP Manager
 *
 * Provides integration with ax-cli's MCP (Model Context Protocol) system,
 * exposing 13 predefined server templates and management utilities.
 *
 * New in v10.4.1:
 * - Full MCP template support (figma, github, vercel, etc.)
 * - Template search and filtering
 * - Config generation from templates
 * - MCPManagerV2 integration (type-safe Result types)
 *
 * Updated for SDK v1.3.0:
 * - MCPServerStatus type alignment
 * - Server health check integration
 * - Enhanced lifecycle management
 *
 * @module integrations/ax-cli-sdk/mcp-manager
 */

import { logger } from '../../shared/logging/logger.js';
import type { MCPServerStatus as SDKMCPServerStatus } from './sdk-types.js';

/**
 * Error message for SDK not available (used in multiple methods)
 */
const SDK_NOT_AVAILABLE_ERROR = 'ax-cli SDK not available';

/**
 * MCP Server template definition
 */
export interface MCPTemplate {
  name: string;
  description: string;
  category: 'design' | 'version-control' | 'deployment' | 'testing' | 'monitoring' | 'backend';
  official: boolean;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  requiredEnv?: string[];
  setupGuide?: string;
  examples?: string[];
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

/**
 * Result type for type-safe error handling (mirrors ax-cli's Result)
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * MCP Manager options
 */
export interface MCPManagerOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * ax-cli MCP Manager
 *
 * Integrates with ax-cli's MCP system for server template management.
 */
export class AxCliMCPManager {
  private sdkAvailable: boolean | null = null;
  private mcpModule: any = null;
  private readonly debug: boolean;

  constructor(options: MCPManagerOptions = {}) {
    this.debug = options.debug ?? false;
  }

  /**
   * Check if ax-cli SDK MCP module is available
   */
  async isAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      // Try to import MCP module from ax-cli
      this.mcpModule = await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = true;

      if (this.debug) {
        logger.debug('ax-cli MCP module available');
      }

      return true;
    } catch (error) {
      this.sdkAvailable = false;
      logger.warn('ax-cli MCP module not available', {
        error: error instanceof Error ? error.message : String(error),
        hint: 'Ensure @defai.digital/ax-cli is installed'
      });
      return false;
    }
  }

  /**
   * Get all available MCP template names
   */
  async getTemplateNames(): Promise<Result<string[]>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      // ax-cli SDK exports getTemplateNames from MCP module
      const { MCPManager } = this.mcpModule;
      if (MCPManager?.getTemplateNames) {
        const names = MCPManager.getTemplateNames();
        return { ok: true, value: names };
      }

      // Fallback: return known templates
      return {
        ok: true,
        value: [
          'figma', 'github', 'vercel', 'netlify', 'puppeteer',
          'storybook', 'chromatic', 'sentry', 'supabase',
          'firebase', 'postgres', 'sqlite'
        ]
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get a specific MCP template by name
   */
  async getTemplate(name: string): Promise<Result<MCPTemplate>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.getTemplate) {
        const template = MCPManager.getTemplate(name);
        if (template) {
          return { ok: true, value: template };
        }
        return { ok: false, error: new Error(`Template not found: ${name}`) };
      }

      return { ok: false, error: new Error('getTemplate not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: MCPTemplate['category']
  ): Promise<Result<MCPTemplate[]>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.getTemplatesByCategory) {
        const templates = MCPManager.getTemplatesByCategory(category);
        return { ok: true, value: templates };
      }

      return { ok: false, error: new Error('getTemplatesByCategory not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Search templates by keyword
   */
  async searchTemplates(keyword: string): Promise<Result<MCPTemplate[]>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.searchTemplates) {
        const templates = MCPManager.searchTemplates(keyword);
        return { ok: true, value: templates };
      }

      return { ok: false, error: new Error('searchTemplates not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Generate MCP server config from template
   */
  async generateConfigFromTemplate(
    templateName: string,
    env?: Record<string, string>
  ): Promise<Result<MCPServerConfig>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.generateConfigFromTemplate) {
        const config = MCPManager.generateConfigFromTemplate(templateName, env);
        return { ok: true, value: config };
      }

      return { ok: false, error: new Error('generateConfigFromTemplate not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Load MCP configuration from ax-cli settings
   */
  async loadConfig(): Promise<Result<Record<string, MCPServerConfig>>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.loadMCPConfig) {
        const config = await MCPManager.loadMCPConfig();

        // BUG FIX: Validate that config is a non-null object before returning
        // SDK may return null/undefined or non-object, which would cause Object.keys() to throw
        if (config === null || config === undefined) {
          return { ok: false, error: new Error('loadMCPConfig returned null/undefined') };
        }
        if (typeof config !== 'object' || Array.isArray(config)) {
          return { ok: false, error: new Error(`loadMCPConfig returned invalid type: ${typeof config}`) };
        }

        return { ok: true, value: config as Record<string, MCPServerConfig> };
      }

      return { ok: false, error: new Error('loadMCPConfig not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Add an MCP server to ax-cli configuration
   */
  async addServer(name: string, config: MCPServerConfig): Promise<Result<void>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.addMCPServer) {
        await MCPManager.addMCPServer(name, config);
        logger.info('MCP server added via ax-cli', { name });
        return { ok: true, value: undefined };
      }

      return { ok: false, error: new Error('addMCPServer not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Remove an MCP server from ax-cli configuration
   */
  async removeServer(name: string): Promise<Result<void>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.removeMCPServer) {
        await MCPManager.removeMCPServer(name);
        logger.info('MCP server removed via ax-cli', { name });
        return { ok: true, value: undefined };
      }

      return { ok: false, error: new Error('removeMCPServer not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get predefined MCP servers from ax-cli
   */
  async getPredefinedServers(): Promise<Result<Record<string, MCPServerConfig>>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManager } = this.mcpModule;
      if (MCPManager?.PREDEFINED_SERVERS) {
        return { ok: true, value: MCPManager.PREDEFINED_SERVERS };
      }

      return { ok: false, error: new Error('PREDEFINED_SERVERS not available in SDK') };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Quick setup: Add MCP server from template
   *
   * @example
   * ```typescript
   * const manager = new AxCliMCPManager();
   * const result = await manager.addFromTemplate('github', {
   *   GITHUB_TOKEN: 'ghp_xxx'
   * });
   * ```
   */
  async addFromTemplate(
    templateName: string,
    env?: Record<string, string>
  ): Promise<Result<void>> {
    // Generate config from template
    const configResult = await this.generateConfigFromTemplate(templateName, env);
    if (!configResult.ok) {
      // Type-safe error propagation: extract error from failed Result
      return { ok: false, error: configResult.error };
    }

    // Add the server
    return this.addServer(templateName, configResult.value);
  }

  /**
   * List all configured MCP servers
   */
  async listServers(): Promise<Result<string[]>> {
    const configResult = await this.loadConfig();
    if (!configResult.ok) {
      // Type-safe error propagation: extract error from failed Result
      return { ok: false, error: configResult.error };
    }

    return { ok: true, value: Object.keys(configResult.value) };
  }

  // ============================================
  // MCPManagerV2 Compatibility (SDK v1.3.0)
  // ============================================

  private serverStatuses: Map<string, SDKMCPServerStatus> = new Map();

  /**
   * Get status of a specific MCP server (SDK v1.3.0)
   */
  async getServerStatus(name: string): Promise<Result<SDKMCPServerStatus>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      // Check if MCPManagerV2 is available
      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.getServerStatus) {
        const status = MCPManagerV2.getServerStatus(name);
        if (status) {
          this.serverStatuses.set(name, status);
          return { ok: true, value: status };
        }
        return { ok: false, error: new Error(`Server not found: ${name}`) };
      }

      // Fallback: check cached status or return unknown
      const cached = this.serverStatuses.get(name);
      if (cached) {
        return { ok: true, value: cached };
      }

      // Create default status
      const defaultStatus: SDKMCPServerStatus = {
        name,
        status: 'stopped',
        lastHealthCheck: new Date()
      };
      return { ok: true, value: defaultStatus };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get all server statuses (SDK v1.3.0)
   */
  async getAllServerStatuses(): Promise<Result<SDKMCPServerStatus[]>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.getAllServerStatuses) {
        const statuses = MCPManagerV2.getAllServerStatuses();
        // BUG FIX (v11.3.4): Check for null/undefined before iterating
        // SDK may return null if no servers are configured
        if (statuses && Array.isArray(statuses)) {
          // Update cache
          for (const status of statuses) {
            this.serverStatuses.set(status.name, status);
          }
          return { ok: true, value: statuses };
        }
        // SDK returned null/undefined, return empty array
        return { ok: true, value: [] };
      }

      // Fallback: return cached statuses
      return { ok: true, value: Array.from(this.serverStatuses.values()) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Perform health check on all servers (SDK v1.3.0)
   */
  async healthCheck(): Promise<Result<Map<string, boolean>>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.healthCheck) {
        const results = await MCPManagerV2.healthCheck();
        logger.debug('MCP health check completed', {
          serverCount: results.size,
          healthyCount: Array.from(results.values()).filter(v => v).length
        });
        return { ok: true, value: results };
      }

      // Fallback: return empty map
      return { ok: true, value: new Map() };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Start a specific MCP server (SDK v1.3.0)
   */
  async startServer(name: string): Promise<Result<void>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.startServer) {
        await MCPManagerV2.startServer(name);
        this.serverStatuses.set(name, {
          name,
          status: 'running',
          lastHealthCheck: new Date()
        });
        logger.info('MCP server started', { name });
        return { ok: true, value: undefined };
      }

      return { ok: false, error: new Error('startServer not available in SDK') };
    } catch (error) {
      // BUG FIX: Update local cache with error status to avoid stale data
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.serverStatuses.set(name, {
        name,
        status: 'error',
        lastHealthCheck: new Date(),
        error: errorMessage
      });
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
    }
  }

  /**
   * Stop a specific MCP server (SDK v1.3.0)
   */
  async stopServer(name: string): Promise<Result<void>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.stopServer) {
        await MCPManagerV2.stopServer(name);
        this.serverStatuses.set(name, {
          name,
          status: 'stopped',
          lastHealthCheck: new Date()
        });
        logger.info('MCP server stopped', { name });
        return { ok: true, value: undefined };
      }

      return { ok: false, error: new Error('stopServer not available in SDK') };
    } catch (error) {
      // BUG FIX: Update local cache with error status to avoid stale data
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.serverStatuses.set(name, {
        name,
        status: 'error',
        lastHealthCheck: new Date(),
        error: errorMessage
      });
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
    }
  }

  /**
   * Restart a specific MCP server (SDK v1.3.0)
   */
  async restartServer(name: string): Promise<Result<void>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.restartServer) {
        await MCPManagerV2.restartServer(name);
        this.serverStatuses.set(name, {
          name,
          status: 'running',
          lastHealthCheck: new Date()
        });
        logger.info('MCP server restarted', { name });
        return { ok: true, value: undefined };
      }

      // Fallback: stop then start
      const stopResult = await this.stopServer(name);
      if (!stopResult.ok) {
        return stopResult;
      }
      return this.startServer(name);
    } catch (error) {
      // BUG FIX: Update local cache with error status to avoid stale data
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.serverStatuses.set(name, {
        name,
        status: 'error',
        lastHealthCheck: new Date(),
        error: errorMessage
      });
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
    }
  }

  /**
   * Shutdown all MCP servers (SDK v1.3.0)
   */
  async shutdown(): Promise<Result<void>> {
    try {
      if (!(await this.isAvailable())) {
        return { ok: false, error: new Error(SDK_NOT_AVAILABLE_ERROR) };
      }

      const { MCPManagerV2 } = this.mcpModule;
      if (MCPManagerV2?.shutdown) {
        await MCPManagerV2.shutdown();
        // Clear all statuses
        for (const [name] of this.serverStatuses) {
          this.serverStatuses.set(name, {
            name,
            status: 'stopped',
            lastHealthCheck: new Date()
          });
        }
        logger.info('All MCP servers shutdown');
        return { ok: true, value: undefined };
      }

      // Fallback: stop each server individually
      // BUG FIX (v11.3.3): Collect errors from individual server stops and report
      // them to the caller. Previously errors were silently ignored, so callers
      // thought shutdown succeeded even when some servers failed to stop.
      const serversResult = await this.listServers();
      // BUG FIX (v11.3.3): If listServers fails, propagate the error instead of
      // silently returning success. This prevents false positives where callers
      // think shutdown succeeded when we couldn't even enumerate the servers.
      if (!serversResult.ok) {
        logger.warn('Cannot enumerate servers for shutdown', {
          error: serversResult.error.message
        });
        // Type-safe error propagation: extract error from failed Result
        return { ok: false, error: serversResult.error };
      }

      const errors: Array<{ name: string; error: string }> = [];
      for (const name of serversResult.value) {
        const stopResult = await this.stopServer(name);
        if (!stopResult.ok) {
          errors.push({
            name,
            error: stopResult.error.message
          });
        }
      }
      // If any servers failed to stop, return an aggregated error
      if (errors.length > 0) {
        const errorMessage = `Failed to stop ${errors.length} server(s): ${errors.map(e => `${e.name} (${e.error})`).join(', ')}`;
        logger.warn('Partial MCP shutdown failure', { errors });
        return { ok: false, error: new Error(errorMessage) };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

// Singleton instance for convenience
let defaultManager: AxCliMCPManager | null = null;

/**
 * Get the default MCP manager instance
 *
 * BUG FIX: Log warning when options are provided but instance already exists,
 * as the options will be ignored. Use resetAxCliMCPManager() to recreate with new options.
 */
export function getAxCliMCPManager(options?: MCPManagerOptions): AxCliMCPManager {
  if (!defaultManager) {
    defaultManager = new AxCliMCPManager(options);
  } else if (options) {
    // BUG FIX: Warn when options are provided but instance already exists
    logger.warn('AxCliMCPManager already initialized, ignoring new options', {
      hint: 'Use resetAxCliMCPManager() to recreate with new options'
    });
  }
  return defaultManager;
}

/**
 * Reset the default manager (for testing)
 */
export function resetAxCliMCPManager(): void {
  defaultManager = null;
}
