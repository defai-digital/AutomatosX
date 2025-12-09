/**
 * Codex CLI Integration - MCP Manager
 *
 * Manages the Codex CLI MCP (Model Context Protocol) server.
 *
 * @module integrations/openai-codex/mcp-manager
 */

import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../../shared/logging/logger.js';
import { sleep } from '../../shared/utils/safe-timers.js';
import type {
  CodexMCPConfig,
  MCPServerStatus,
  MCPServerProcess,
} from './types.js';
import { CodexError, CodexErrorType } from './types.js';

/**
 * Codex CLI MCP Manager
 *
 * Manages the lifecycle of the codex MCP server process.
 * The server uses stdio transport for communication.
 */
export class CodexMCPManager {
  private serverProcess: MCPServerProcess | null = null;

  constructor(private config: CodexMCPConfig) {}

  /**
   * Start MCP server
   *
   * Spawns `codex mcp-server` process with stdio transport.
   *
   * @returns Server status
   */
  async startServer(): Promise<MCPServerStatus> {
    if (this.serverProcess?.running) {
      logger.warn('CodexMCPManager: Server already running');
      return this.getStatus();
    }

    try {
      logger.info('CodexMCPManager: Starting MCP server', {
        command: this.config.command,
      });

      const args = this.buildServerArgs();
      const process = spawn(this.config.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      this.serverProcess = {
        process,
        startTime: new Date(),
        running: true,
      };

      // Setup process event handlers
      this.setupProcessHandlers(process);

      logger.info('CodexMCPManager: MCP server started', {
        pid: process.pid,
      });

      return this.getStatus();
    } catch (error) {
      const err = new CodexError(
        CodexErrorType.MCP_ERROR,
        `Failed to start MCP server: ${(error as Error).message}`,
        { error }
      );

      if (this.serverProcess) {
        this.serverProcess.error = err;
        this.serverProcess.running = false;
      }

      throw err;
    }
  }

  /**
   * Stop MCP server
   *
   * Gracefully terminates the server process.
   */
  async stopServer(): Promise<void> {
    if (!this.serverProcess || !this.serverProcess.running) {
      logger.debug('CodexMCPManager: No server to stop');
      return;
    }

    logger.info('CodexMCPManager: Stopping MCP server', {
      pid: this.serverProcess.process.pid,
    });

    // BUG FIX: Store process reference before cleanup to remove event listeners
    const processToClean = this.serverProcess.process;

    try {
      // Send SIGTERM for graceful shutdown
      this.serverProcess.process.kill('SIGTERM');

      // Wait for process to exit (with timeout)
      await this.waitForExit(this.serverProcess.process, 5000);

      logger.info('CodexMCPManager: MCP server stopped gracefully');
    } catch (error) {
      // Force kill if graceful shutdown fails
      logger.warn('CodexMCPManager: Forcing server termination');
      this.serverProcess.process.kill('SIGKILL');
    } finally {
      // BUG FIX: Remove all event listeners to prevent memory leaks
      // Event handlers were attached in setupProcessHandlers() but never removed
      processToClean.removeAllListeners('error');
      processToClean.removeAllListeners('exit');
      if (processToClean.stderr) {
        processToClean.stderr.removeAllListeners('data');
      }
      if (processToClean.stdout) {
        processToClean.stdout.removeAllListeners('data');
      }

      this.serverProcess.running = false;
      this.serverProcess = null;
    }
  }

  /**
   * Restart MCP server
   *
   * @returns Server status
   */
  async restartServer(): Promise<MCPServerStatus> {
    await this.stopServer();
    await sleep(1000); // Brief delay
    return this.startServer();
  }

  /**
   * Get server status
   *
   * @returns Current server status
   */
  getStatus(): MCPServerStatus {
    if (!this.serverProcess) {
      return { running: false };
    }

    return {
      running: this.serverProcess.running,
      pid: this.serverProcess.process.pid,
      startTime: this.serverProcess.startTime,
      error: this.serverProcess.error,
    };
  }

  /**
   * Check if server is healthy
   *
   * @returns True if server is running and responding
   */
  async isHealthy(): Promise<boolean> {
    if (!this.serverProcess?.running) {
      return false;
    }

    try {
      // Check if process is still alive
      const isAlive = !this.serverProcess.process.killed;

      // Could add additional health checks here (e.g., ping server)

      return isAlive;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.debug('CodexMCPManager.cleanup');

    if (this.serverProcess?.running) {
      await this.stopServer();
    }
  }

  /**
   * Build server CLI arguments
   */
  private buildServerArgs(): string[] {
    const args: string[] = ['mcp-server'];

    // Add config overrides
    if (this.config.configOverrides) {
      for (const [key, value] of Object.entries(this.config.configOverrides)) {
        args.push('-c', `${key}=${JSON.stringify(value)}`);
      }
    }

    return args;
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(process: ChildProcess): void {
    process.on('error', (error: Error) => {
      logger.error('CodexMCPManager: Process error', { error: error.message });

      if (this.serverProcess) {
        this.serverProcess.error = error;
        this.serverProcess.running = false;
      }
    });

    process.on('exit', (code: number | null, signal: string | null) => {
      logger.info('CodexMCPManager: Process exited', { code, signal });

      if (this.serverProcess) {
        this.serverProcess.running = false;

        if (code !== 0 && code !== null) {
          this.serverProcess.error = new CodexError(
            CodexErrorType.MCP_ERROR,
            `MCP server exited with code ${code}`,
            { code, signal }
          );
        }
      }
    });

    // Log stderr for debugging
    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        logger.debug('CodexMCPManager stderr:', { data: data.toString().trim() });
      });
    }
  }

  /**
   * Wait for process to exit
   *
   * BUG FIX: Previously had a memory leak where the 'exit' event listener was
   * never removed if the timeout fired first. Now properly cleans up both the
   * timeout and event listener in all cases.
   */
  private async waitForExit(process: ChildProcess, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        process.off('exit', onExit);
      };

      const onExit = () => {
        cleanup();
        resolve();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Process did not exit within ${timeoutMs}ms`));
      }, timeoutMs);

      process.on('exit', onExit);
    });
  }
}

/**
 * Default MCP manager instance
 */
let defaultManager: CodexMCPManager | null = null;

/**
 * Get default MCP manager instance
 *
 * BUG FIX: Previously, passing config when a manager already existed would
 * silently replace the existing manager (potentially orphaning an active
 * server process). Now behaves consistently with other MCP managers by
 * warning and ignoring the config. Use resetDefaultMCPManager() to recreate.
 *
 * @param config - Configuration (optional, only used on first call)
 * @returns Default manager instance
 */
export function getDefaultMCPManager(config?: CodexMCPConfig): CodexMCPManager {
  if (!defaultManager) {
    defaultManager = new CodexMCPManager(
      config || {
        enabled: true,
        command: 'codex',
        transport: 'stdio',
      }
    );
  } else if (config) {
    // BUG FIX: Warn when config is provided but instance already exists
    logger.warn('CodexMCPManager already initialized, ignoring new config', {
      hint: 'Use resetDefaultMCPManager() to recreate with new config'
    });
  }
  return defaultManager;
}

/**
 * Reset the default MCP manager
 *
 * Cleans up the existing manager and allows recreation with new config.
 */
export async function resetDefaultMCPManager(): Promise<void> {
  if (defaultManager) {
    await defaultManager.cleanup();
    defaultManager = null;
  }
}
