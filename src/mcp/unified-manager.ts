/**
 * Unified MCP Manager
 *
 * Shared MCP manager implementation that works for ALL providers:
 * - Claude Code
 * - Gemini CLI
 * - OpenAI Codex
 * - Grok
 *
 * This eliminates code duplication and provides consistent MCP experience.
 *
 * @module mcp/unified-manager
 */

import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../utils/logger.js';
import type {
  UniversalMCPConfig,
  MCPServerConfig,
  MCPServerStatus,
  MCPServerProcess,
  MCPToolInfo,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPHealthCheckResult,
  MCPDiscoveryResult,
  MCPRegistryEntry,
  IMCPManager,
  KNOWN_MCP_SERVERS,
} from './types-common.js';

/**
 * Unified MCP Manager
 *
 * Provides complete MCP server lifecycle management for all providers.
 */
export class UnifiedMCPManager implements IMCPManager {
  private servers: Map<string, MCPServerProcess> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private config: UniversalMCPConfig) {}

  /**
   * Initialize MCP manager
   *
   * Sets up health checking and discovers servers if configured.
   */
  async initialize(): Promise<void> {
    logger.info('UnifiedMCPManager: Initializing', {
      serverCount: this.config.servers.length,
      discoveryEnabled: this.config.discovery?.enabled,
    });

    // Auto-discover servers if enabled
    if (this.config.discovery?.enabled) {
      await this.discoverAndAddServers();
    }

    // Start health checking if configured
    if (this.config.healthCheck?.enabled) {
      this.startHealthChecking();
    }

    logger.info('UnifiedMCPManager: Initialized successfully');
  }

  /**
   * Start all configured MCP servers
   *
   * @returns Status of all started servers
   */
  async startServers(): Promise<MCPServerStatus[]> {
    logger.info('UnifiedMCPManager: Starting servers', {
      count: this.config.servers.length,
    });

    const statuses: MCPServerStatus[] = [];

    for (const serverConfig of this.config.servers) {
      // Skip if disabled
      if (serverConfig.enabled === false) {
        logger.debug('UnifiedMCPManager: Skipping disabled server', {
          name: serverConfig.name,
        });
        continue;
      }

      try {
        const status = await this.startServer(serverConfig);
        statuses.push(status);
      } catch (error) {
        logger.error('UnifiedMCPManager: Failed to start server', {
          name: serverConfig.name,
          error: (error as Error).message,
        });

        statuses.push({
          name: serverConfig.name,
          running: false,
          error: error as Error,
        });
      }
    }

    logger.info('UnifiedMCPManager: Started servers', {
      total: statuses.length,
      running: statuses.filter(s => s.running).length,
      failed: statuses.filter(s => !s.running).length,
    });

    return statuses;
  }

  /**
   * Start a specific MCP server
   *
   * @param config - Server configuration
   * @returns Server status
   */
  private async startServer(config: MCPServerConfig): Promise<MCPServerStatus> {
    // Check if already running
    if (this.servers.has(config.name)) {
      const existing = this.servers.get(config.name)!;
      if (existing.running) {
        logger.warn('UnifiedMCPManager: Server already running', {
          name: config.name,
        });
        return this.serverProcessToStatus(existing);
      }
    }

    logger.info('UnifiedMCPManager: Starting server', {
      name: config.name,
      command: config.command,
    });

    try {
      // Apply security restrictions if configured
      const safeConfig = this.applySecurityRestrictions(config);

      // Spawn process
      const childProcess = spawn(safeConfig.command, safeConfig.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        cwd: safeConfig.cwd,
        env: {
          ...process.env,
          ...safeConfig.env,
        },
      });

      const serverProcess: MCPServerProcess = {
        config: safeConfig,
        process: childProcess,
        startTime: new Date(),
        running: true,
      };

      // Setup process event handlers
      this.setupProcessHandlers(config.name, childProcess, serverProcess);

      // Store server
      this.servers.set(config.name, serverProcess);

      // Wait briefly to ensure process started successfully
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if process is still running
      if (childProcess.killed || childProcess.exitCode !== null) {
        throw new Error(
          `Server process exited immediately with code ${childProcess.exitCode}`
        );
      }

      logger.info('UnifiedMCPManager: Server started successfully', {
        name: config.name,
        pid: childProcess.pid,
      });

      return this.serverProcessToStatus(serverProcess);
    } catch (error) {
      logger.error('UnifiedMCPManager: Failed to start server', {
        name: config.name,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Stop all running MCP servers
   */
  async stopServers(): Promise<void> {
    logger.info('UnifiedMCPManager: Stopping all servers', {
      count: this.servers.size,
    });

    const stopPromises = Array.from(this.servers.keys()).map(name =>
      this.stopServer(name)
    );

    await Promise.allSettled(stopPromises);

    logger.info('UnifiedMCPManager: All servers stopped');
  }

  /**
   * Stop a specific server
   *
   * @param serverName - Name of server to stop
   */
  async stopServer(serverName: string): Promise<void> {
    const serverProcess = this.servers.get(serverName);

    if (!serverProcess || !serverProcess.running) {
      logger.debug('UnifiedMCPManager: Server not running', {
        name: serverName,
      });
      return;
    }

    logger.info('UnifiedMCPManager: Stopping server', {
      name: serverName,
      pid: serverProcess.process.pid,
    });

    try {
      // Send SIGTERM for graceful shutdown
      serverProcess.process.kill('SIGTERM');

      // Wait for process to exit (with timeout)
      await this.waitForExit(serverProcess.process, 5000);

      logger.info('UnifiedMCPManager: Server stopped gracefully', {
        name: serverName,
      });
    } catch (error) {
      // Force kill if graceful shutdown fails
      logger.warn('UnifiedMCPManager: Forcing server termination', {
        name: serverName,
      });
      serverProcess.process.kill('SIGKILL');
    } finally {
      serverProcess.running = false;
      this.servers.delete(serverName);
    }
  }

  /**
   * Restart a specific server
   *
   * @param serverName - Name of server to restart
   * @returns Server status after restart
   */
  async restartServer(serverName: string): Promise<MCPServerStatus> {
    logger.info('UnifiedMCPManager: Restarting server', { name: serverName });

    // Stop server
    await this.stopServer(serverName);

    // Brief delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find server config
    const serverConfig = this.config.servers.find(s => s.name === serverName);
    if (!serverConfig) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }

    // Start server
    return this.startServer(serverConfig);
  }

  /**
   * Get status of all servers
   *
   * @returns Array of server statuses
   */
  async getStatus(): Promise<MCPServerStatus[]> {
    return Array.from(this.servers.values()).map(sp =>
      this.serverProcessToStatus(sp)
    );
  }

  /**
   * Get status of specific server
   *
   * @param serverName - Server name
   * @returns Server status or undefined if not found
   */
  async getServerStatus(serverName: string): Promise<MCPServerStatus | undefined> {
    const serverProcess = this.servers.get(serverName);
    return serverProcess ? this.serverProcessToStatus(serverProcess) : undefined;
  }

  /**
   * Discover available tools from all servers
   *
   * @returns Array of tool information
   */
  async discoverTools(): Promise<MCPToolInfo[]> {
    logger.debug('UnifiedMCPManager: Discovering tools');

    const tools: MCPToolInfo[] = [];

    for (const [serverName, serverProcess] of this.servers) {
      if (!serverProcess.running) {
        continue;
      }

      // TODO: Implement actual tool discovery via JSON-RPC
      // For now, return cached tools if available
      if (serverProcess.tools) {
        tools.push(...serverProcess.tools);
      }
    }

    logger.debug('UnifiedMCPManager: Discovered tools', {
      count: tools.length,
    });

    return tools;
  }

  /**
   * Call an MCP tool
   *
   * @param request - Tool call request
   * @returns Tool call response
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const startTime = Date.now();

    logger.debug('UnifiedMCPManager: Calling tool', {
      server: request.serverName,
      tool: request.toolName,
    });

    const serverProcess = this.servers.get(request.serverName);

    if (!serverProcess || !serverProcess.running) {
      return {
        success: false,
        error: `Server not running: ${request.serverName}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // TODO: Implement actual JSON-RPC tool call
      // This is a placeholder implementation
      throw new Error('Tool calling not yet implemented');
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run health check on all servers
   *
   * @returns Array of health check results
   */
  async healthCheck(): Promise<MCPHealthCheckResult[]> {
    logger.debug('UnifiedMCPManager: Running health checks');

    const results: MCPHealthCheckResult[] = [];

    for (const [serverName, serverProcess] of this.servers) {
      const result = await this.healthCheckServer(serverName, serverProcess);
      results.push(result);
    }

    return results;
  }

  /**
   * Cleanup resources
   *
   * Stops all servers and clears intervals.
   */
  async cleanup(): Promise<void> {
    logger.info('UnifiedMCPManager: Cleaning up');

    // Stop health checking
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Stop all servers
    await this.stopServers();

    logger.info('UnifiedMCPManager: Cleanup complete');
  }

  // ========== Private Helper Methods ==========

  /**
   * Apply security restrictions to server configuration
   */
  private applySecurityRestrictions(config: MCPServerConfig): MCPServerConfig {
    const safeConfig = { ...config };

    // Apply filesystem restrictions
    if (this.config.security?.filesystem) {
      const { allowedPaths, deniedPaths } = this.config.security.filesystem;

      // Add environment variables for security policies
      safeConfig.env = {
        ...safeConfig.env,
        ...(allowedPaths && { MCP_ALLOWED_PATHS: allowedPaths.join(':') }),
        ...(deniedPaths && { MCP_DENIED_PATHS: deniedPaths.join(':') }),
      };
    }

    // Apply network restrictions
    if (this.config.security?.network) {
      const { allowedDomains, deniedDomains } = this.config.security.network;

      safeConfig.env = {
        ...safeConfig.env,
        ...(allowedDomains && { MCP_ALLOWED_DOMAINS: allowedDomains.join(',') }),
        ...(deniedDomains && { MCP_DENIED_DOMAINS: deniedDomains.join(',') }),
      };
    }

    return safeConfig;
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(
    serverName: string,
    process: ChildProcess,
    serverProcess: MCPServerProcess
  ): void {
    process.on('error', (error: Error) => {
      logger.error('UnifiedMCPManager: Process error', {
        server: serverName,
        error: error.message,
      });

      serverProcess.error = error;
      serverProcess.running = false;
    });

    process.on('exit', (code: number | null, signal: string | null) => {
      logger.info('UnifiedMCPManager: Process exited', {
        server: serverName,
        code,
        signal,
      });

      serverProcess.running = false;

      if (code !== 0 && code !== null) {
        serverProcess.error = new Error(`Process exited with code ${code}`);
      }

      // Auto-restart if configured
      if (this.config.healthCheck?.restartOnFailure && code !== 0) {
        logger.info('UnifiedMCPManager: Auto-restarting failed server', {
          server: serverName,
        });

        setTimeout(() => {
          this.restartServer(serverName).catch(err =>
            logger.error('UnifiedMCPManager: Auto-restart failed', {
              server: serverName,
              error: err.message,
            })
          );
        }, 2000);
      }
    });

    // Log server output if configured
    if (this.config.logging?.logServerOutput) {
      if (process.stdout) {
        process.stdout.on('data', (data: Buffer) => {
          logger.debug(`MCP[${serverName}] stdout:`, {
            data: data.toString().trim(),
          });
        });
      }

      if (process.stderr) {
        process.stderr.on('data', (data: Buffer) => {
          logger.debug(`MCP[${serverName}] stderr:`, {
            data: data.toString().trim(),
          });
        });
      }
    }
  }

  /**
   * Wait for process to exit
   */
  private async waitForExit(process: ChildProcess, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Process did not exit within ${timeoutMs}ms`));
      }, timeoutMs);

      process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Convert server process to status
   */
  private serverProcessToStatus(serverProcess: MCPServerProcess): MCPServerStatus {
    return {
      name: serverProcess.config.name,
      running: serverProcess.running,
      pid: serverProcess.process.pid,
      startTime: serverProcess.startTime,
      error: serverProcess.error,
      tools: serverProcess.tools,
    };
  }

  /**
   * Health check for a specific server
   */
  private async healthCheckServer(
    serverName: string,
    serverProcess: MCPServerProcess
  ): Promise<MCPHealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check if process is still running
      const isAlive = serverProcess.running && !serverProcess.process.killed;

      if (!isAlive) {
        return {
          serverName,
          healthy: false,
          timestamp: new Date(),
          error: 'Process not running',
        };
      }

      // TODO: Implement actual health check ping
      // For now, just check process status

      return {
        serverName,
        healthy: true,
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        serverName,
        healthy: false,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking(): void {
    const intervalMs =
      this.config.healthCheck?.intervalMs || 60000; // Default 1 minute

    logger.info('UnifiedMCPManager: Starting health checks', {
      intervalMs,
    });

    this.healthCheckInterval = setInterval(async () => {
      const results = await this.healthCheck();

      const unhealthy = results.filter(r => !r.healthy);
      if (unhealthy.length > 0) {
        logger.warn('UnifiedMCPManager: Unhealthy servers detected', {
          count: unhealthy.length,
          servers: unhealthy.map(r => r.serverName),
        });
      }
    }, intervalMs);
  }

  /**
   * Discover and add servers from registry
   */
  private async discoverAndAddServers(): Promise<void> {
    logger.info('UnifiedMCPManager: Discovering servers');

    // TODO: Implement actual discovery
    // For now, this is a placeholder

    logger.info('UnifiedMCPManager: Discovery complete');
  }
}

/**
 * Create a UnifiedMCPManager instance
 *
 * @param config - MCP configuration
 * @returns UnifiedMCPManager instance
 */
export function createUnifiedMCPManager(
  config: UniversalMCPConfig
): UnifiedMCPManager {
  return new UnifiedMCPManager(config);
}
