/**
 * Unified MCP Manager
 *
 * Shared MCP manager implementation that works for ALL providers:
 * - Claude Code
 * - Gemini CLI
 * - Codex CLI
 * - Grok
 *
 * This eliminates code duplication and provides consistent MCP experience.
 *
 * @module mcp/unified-manager
 */

import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../shared/logging/logger.js';
import type {
  UniversalMCPConfig,
  MCPServerConfig,
  MCPServerStatus,
  MCPServerProcess,
  MCPToolInfo,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPHealthCheckResult,
  IMCPManager,
} from './types-common.js';
import { LifecycleLogger, getLifecycleLogger } from './lifecycle-logger.js';
import { MetricsCollector, getMetricsCollector } from './metrics-collector.js';
import { ResourceEnforcer, createResourceEnforcer } from './resource-enforcer.js';
import { TIMEOUTS } from '../core/validation-limits.js';
import { sleep } from '../shared/utils/safe-timers.js';

/**
 * Unified MCP Manager
 *
 * Provides complete MCP server lifecycle management for all providers.
 * Now includes Phase 4 enhancements:
 * - Lifecycle event logging
 * - Performance metrics collection
 * - Resource limit enforcement
 */
export class UnifiedMCPManager implements IMCPManager {
  private servers: Map<string, MCPServerProcess> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private pendingRestarts: Map<string, NodeJS.Timeout> = new Map();

  // Phase 4 components
  private lifecycleLogger: LifecycleLogger;
  private metricsCollector: MetricsCollector;
  private resourceEnforcer?: ResourceEnforcer;

  constructor(private config: UniversalMCPConfig) {
    // Initialize Phase 4 components
    this.lifecycleLogger = getLifecycleLogger();
    this.metricsCollector = getMetricsCollector();
    this.resourceEnforcer = createResourceEnforcer(config) || undefined;
  }

  /**
   * Initialize MCP manager
   *
   * Sets up health checking and discovers servers if configured.
   * Phase 4: Also initializes lifecycle logging, metrics, and resource enforcement.
   */
  async initialize(): Promise<void> {
    logger.info('UnifiedMCPManager: Initializing', {
      serverCount: this.config.servers.length,
      discoveryEnabled: this.config.discovery?.enabled,
      phase4Enabled: true,
    });

    // Phase 4: Initialize lifecycle logger
    await this.lifecycleLogger.initialize();

    // Phase 4: Start metrics collection
    this.metricsCollector.start();

    // Phase 4: Start resource enforcement
    if (this.resourceEnforcer) {
      this.resourceEnforcer.start();
      logger.info('UnifiedMCPManager: Resource enforcement enabled');
    }

    // Auto-discover servers if enabled
    if (this.config.discovery?.enabled) {
      await this.discoverAndAddServers();
    }

    // Start health checking if configured
    if (this.config.healthCheck?.enabled) {
      this.startHealthChecking();
    }

    logger.info('UnifiedMCPManager: Initialized successfully (Phase 4 enabled)');
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

    const runningCount = statuses.filter(s => s.running).length;
    logger.info('UnifiedMCPManager: Started servers', {
      total: statuses.length,
      running: runningCount,
      failed: statuses.length - runningCount,
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

      // Wait briefly for process to initialize (MCP handshake handles actual readiness)
      await sleep(100);

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

      // Phase 4: Log lifecycle event
      if (childProcess.pid) {
        await this.lifecycleLogger.logServerStart(config.name, childProcess.pid);

        // Phase 4: Register with resource enforcer
        if (this.resourceEnforcer) {
          this.resourceEnforcer.registerServer(config.name, serverProcess);
        }

        // Phase 4: Record metrics
        this.metricsCollector.recordServerStart(config.name);
      }

      return this.serverProcessToStatus(serverProcess);
    } catch (error) {
      logger.error('UnifiedMCPManager: Failed to start server', {
        name: config.name,
        error: (error as Error).message,
      });

      // Clean up: kill the child process if it was spawned and remove from tracking
      const serverProcess = this.servers.get(config.name);
      if (serverProcess?.process && !serverProcess.process.killed) {
        try {
          serverProcess.process.kill('SIGTERM');
        } catch {
          // Ignore kill errors - process may have already exited
        }
      }
      this.servers.delete(config.name);

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

    // Stop health check interval to prevent it from running against empty map
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.debug('UnifiedMCPManager: Health check interval stopped');
    }

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
   * Phase 4: Enhanced with lifecycle logging and cleanup
   */
  async stopServer(serverName: string): Promise<void> {
    const serverProcess = this.servers.get(serverName);

    if (!serverProcess || !serverProcess.running) {
      logger.debug('UnifiedMCPManager: Server not running', {
        name: serverName,
      });
      return;
    }

    const startTime = Date.now();

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

      // Phase 4: Log lifecycle event
      const duration = Date.now() - startTime;
      await this.lifecycleLogger.logServerStop(
        serverName,
        duration,
        'graceful_shutdown'
      );
    } catch (error) {
      // Force kill if graceful shutdown fails
      logger.warn('UnifiedMCPManager: Forcing server termination', {
        name: serverName,
      });
      serverProcess.process.kill('SIGKILL');

      // Phase 4: Log forced termination
      const duration = Date.now() - startTime;
      await this.lifecycleLogger.logServerStop(
        serverName,
        duration,
        'forced_kill'
      );
    } finally {
      serverProcess.running = false;
      this.servers.delete(serverName);

      // Phase 4: Unregister from resource enforcer
      if (this.resourceEnforcer) {
        this.resourceEnforcer.unregisterServer(serverName);
      }
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
    await sleep(1000);

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

    // Check if this tool is available on the server
    const availableTools = serverProcess.tools || [];
    const toolExists = availableTools.some(t => t.name === request.toolName);

    if (!toolExists) {
      return {
        success: false,
        error: `Tool not found: ${request.toolName} on server ${request.serverName}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // TODO: Implement actual JSON-RPC tool call via stdio transport
    // For now, return a clear "not implemented" status without throwing
    // This allows callers to handle gracefully instead of catching exceptions
    logger.warn('UnifiedMCPManager: Tool calling via JSON-RPC not yet implemented', {
      server: request.serverName,
      tool: request.toolName,
    });

    return {
      success: false,
      error: `Tool calling not yet implemented for server: ${request.serverName}. Use provider-specific MCP integration instead.`,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Run health check on all servers
   * v12.5.3: Parallelized health checks for better performance
   *
   * @returns Array of health check results
   */
  async healthCheck(): Promise<MCPHealthCheckResult[]> {
    logger.debug('UnifiedMCPManager: Running health checks');

    const serverEntries = Array.from(this.servers.entries());
    const results = await Promise.all(
      serverEntries.map(([serverName, serverProcess]) =>
        this.healthCheckServer(serverName, serverProcess)
      )
    );

    return results;
  }

  /**
   * Get metrics for all servers (Phase 4D)
   * v12.5.3: Parallelized metrics collection for better performance
   *
   * @returns Array of server metrics
   */
  async getMetrics(): Promise<any[]> {
    const runningServers = Array.from(this.servers.entries())
      .filter(([, serverProcess]) => serverProcess.running && serverProcess.process.pid);

    const metrics = await Promise.all(
      runningServers.map(([serverName, serverProcess]) =>
        this.metricsCollector.collectServerMetrics(
          serverName,
          serverProcess.process.pid
        )
      )
    );

    return metrics;
  }

  /**
   * Get metrics summary (Phase 4D)
   *
   * @returns Aggregated metrics summary
   */
  async getMetricsSummary(): Promise<any> {
    const metrics = await this.getMetrics();
    return this.metricsCollector.getMetricsSummary(metrics);
  }

  /**
   * Get lifecycle event history (Phase 4A)
   *
   * @param serverName - Optional server name filter
   * @param limit - Maximum number of events
   * @returns Array of lifecycle events
   */
  async getLifecycleHistory(serverName?: string, limit: number = 100): Promise<any[]> {
    return this.lifecycleLogger.getEventHistory(serverName, limit);
  }

  /**
   * Get resource limits for server (Phase 4E)
   *
   * @param serverName - Server name
   * @returns Resource limits
   */
  getResourceLimits(serverName: string): any {
    return this.resourceEnforcer?.getLimits(serverName);
  }

  /**
   * Set resource limits for server (Phase 4E)
   *
   * @param serverName - Server name
   * @param limits - New resource limits
   */
  setResourceLimits(serverName: string, limits: any): void {
    this.resourceEnforcer?.setLimits(serverName, limits);
  }

  /**
   * Cleanup resources
   *
   * Stops all servers and clears intervals.
   * Phase 4: Also stops metrics, resource enforcement, and lifecycle logging.
   */
  async cleanup(): Promise<void> {
    logger.info('UnifiedMCPManager: Cleaning up');

    // Stop health checking
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Clear all pending restart timers to prevent leaks
    for (const timer of this.pendingRestarts.values()) {
      clearTimeout(timer);
    }
    this.pendingRestarts.clear();

    // Phase 4: Stop metrics collection
    this.metricsCollector.stop();

    // Phase 4: Stop resource enforcement
    if (this.resourceEnforcer) {
      this.resourceEnforcer.stop();
    }

    // Stop all servers
    await this.stopServers();

    logger.info('UnifiedMCPManager: Cleanup complete (Phase 4)');
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
    // Use .once() to prevent listener accumulation on restarts
    process.once('error', (error: Error) => {
      logger.error('UnifiedMCPManager: Process error', {
        server: serverName,
        error: error.message,
      });

      serverProcess.error = error;
      serverProcess.running = false;
    });

    // Use .once() for exit handler - process can only exit once
    process.once('exit', (code: number | null, signal: string | null) => {
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

        // Cancel any existing restart timer for this server
        const existingTimer = this.pendingRestarts.get(serverName);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Track the restart timer to prevent leaks
        const restartTimer = setTimeout(() => {
          this.pendingRestarts.delete(serverName);
          this.restartServer(serverName).catch(err => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error('UnifiedMCPManager: Auto-restart failed', {
              server: serverName,
              error: errorMessage,
            });
          });
        }, 2000);
        this.pendingRestarts.set(serverName, restartTimer);
      }
    });

    // Always consume stdout/stderr to prevent pipe buffer from filling and blocking the child process
    // Note: Using process streams here (correctly - 'process' is the ChildProcess parameter)
    // These listeners are cleaned up when the ChildProcess exits (streams close automatically)
    const shouldLog = this.config.logging?.logServerOutput;

    if (process.stdout) {
      // Stream 'data' events continue until stream closes, which is fine
      // The stream closes when the process exits
      process.stdout.on('data', (data: Buffer) => {
        if (shouldLog) {
          logger.debug(`MCP[${serverName}] stdout:`, {
            data: data.toString().trim(),
          });
        }
        // Data is consumed even when not logging to prevent pipe buffer blocking
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        if (shouldLog) {
          logger.debug(`MCP[${serverName}] stderr:`, {
            data: data.toString().trim(),
          });
        }
        // Data is consumed even when not logging to prevent pipe buffer blocking
      });
    }
  }

  /**
   * Wait for process to exit
   */
  private async waitForExit(process: ChildProcess, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const exitListener = () => {
        clearTimeout(timeout);
        resolve();
      };

      const timeout = setTimeout(() => {
        // FIXED: Remove event listener to prevent memory leak
        process.removeListener('exit', exitListener);
        reject(new Error(`Process did not exit within ${timeoutMs}ms`));
      }, timeoutMs);

      process.once('exit', exitListener);
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
   * v12.5.3: Use centralized TIMEOUTS.CONFIG_CACHE_TTL for default
   */
  private startHealthChecking(): void {
    const intervalMs =
      this.config.healthCheck?.intervalMs || TIMEOUTS.CONFIG_CACHE_TTL; // Default 1 minute

    logger.info('UnifiedMCPManager: Starting health checks', {
      intervalMs,
    });

    this.healthCheckInterval = setInterval(async () => {
      try {
        const results = await this.healthCheck();

        const unhealthy = results.filter(r => !r.healthy);
        if (unhealthy.length > 0) {
          logger.warn('UnifiedMCPManager: Unhealthy servers detected', {
            count: unhealthy.length,
            servers: unhealthy.map(r => r.serverName),
          });
        }
      } catch (error) {
        logger.error('UnifiedMCPManager: Health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);
    // v12.5.3: Prevent blocking process exit
    if (this.healthCheckInterval.unref) this.healthCheckInterval.unref();
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
