/**
 * OpenAI Codex Integration - Bridge
 *
 * Main integration bridge between AutomatosX and OpenAI Codex CLI.
 *
 * @module integrations/openai-codex/bridge
 */

import { logger } from '../../utils/logger.js';
import { CodexCLI, getDefaultCLI } from './cli-wrapper.js';
import { CodexMCPManager, getDefaultMCPManager } from './mcp-manager.js';
import type {
  CodexConfig,
  CodexMCPConfig,
  IntegrationStatus,
  CodexExecutionOptions,
  CodexExecutionResult,
  MCPServerStatus,
} from './types.js';
import { CodexError, CodexErrorType } from './types.js';

/**
 * OpenAI Codex Integration Bridge
 *
 * Provides a unified interface for interacting with OpenAI Codex CLI
 * and MCP server functionality.
 */
export class CodexBridge {
  private cli: CodexCLI;
  private mcpManager: CodexMCPManager | null = null;
  private initialized: boolean = false;

  constructor(
    private config: CodexConfig,
    private mcpConfig?: CodexMCPConfig
  ) {
    this.cli = getDefaultCLI(config);

    if (mcpConfig?.enabled) {
      this.mcpManager = getDefaultMCPManager(mcpConfig);
    }
  }

  /**
   * Initialize the integration
   *
   * Verifies CLI availability and optionally starts MCP server.
   *
   * @returns Integration status
   */
  async initialize(): Promise<IntegrationStatus> {
    if (this.initialized) {
      logger.debug('CodexBridge: Already initialized');
      return this.getStatus();
    }

    try {
      logger.info('CodexBridge: Initializing integration');

      // Check CLI availability
      const available = await this.cli.isAvailable();
      if (!available) {
        throw new CodexError(
          CodexErrorType.CLI_NOT_FOUND,
          'Codex CLI not found. Install with: npm i -g @openai/codex'
        );
      }

      // Get version
      const version = await this.cli.getVersion();
      logger.info('CodexBridge: Codex CLI available', { version });

      // Start MCP server if enabled
      if (this.mcpManager) {
        logger.info('CodexBridge: Starting MCP server');
        await this.mcpManager.startServer();
      }

      this.initialized = true;

      return this.getStatus();
    } catch (error) {
      logger.error('CodexBridge: Initialization failed', {
        error: (error as Error).message,
      });

      throw new CodexError(
        CodexErrorType.CONFIG_ERROR,
        `Failed to initialize Codex integration: ${(error as Error).message}`,
        { error }
      );
    }
  }

  /**
   * Execute a prompt using Codex CLI
   *
   * @param options - Execution options
   * @returns Execution result
   */
  async execute(options: CodexExecutionOptions): Promise<CodexExecutionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.debug('CodexBridge.execute', {
      promptLength: options.prompt.length,
      model: options.model,
    });

    return this.cli.execute(options);
  }

  /**
   * Get integration status
   *
   * @returns Current status
   */
  async getStatus(): Promise<IntegrationStatus> {
    let cliAvailable = false;
    let version: string | undefined;
    let mcpServer: MCPServerStatus | undefined;

    try {
      cliAvailable = await this.cli.isAvailable();
      if (cliAvailable) {
        version = await this.cli.getVersion();
      }
    } catch (error) {
      logger.warn('CodexBridge: Failed to check CLI availability', {
        error: (error as Error).message,
      });
    }

    if (this.mcpManager) {
      mcpServer = this.mcpManager.getStatus();
    }

    return {
      cliAvailable,
      version,
      mcpServer,
      configValid: cliAvailable,
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Start MCP server
   *
   * @returns Server status
   */
  async startMCPServer(): Promise<MCPServerStatus> {
    if (!this.mcpManager) {
      throw new CodexError(
        CodexErrorType.MCP_ERROR,
        'MCP server not configured'
      );
    }

    return this.mcpManager.startServer();
  }

  /**
   * Stop MCP server
   */
  async stopMCPServer(): Promise<void> {
    if (!this.mcpManager) {
      return;
    }

    await this.mcpManager.stopServer();
  }

  /**
   * Restart MCP server
   *
   * @returns Server status
   */
  async restartMCPServer(): Promise<MCPServerStatus> {
    if (!this.mcpManager) {
      throw new CodexError(
        CodexErrorType.MCP_ERROR,
        'MCP server not configured'
      );
    }

    return this.mcpManager.restartServer();
  }

  /**
   * Check if MCP server is healthy
   *
   * @returns True if healthy
   */
  async isMCPServerHealthy(): Promise<boolean> {
    if (!this.mcpManager) {
      return false;
    }

    return this.mcpManager.isHealthy();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('CodexBridge: Cleanup');

    await this.cli.cleanup();

    if (this.mcpManager) {
      await this.mcpManager.cleanup();
    }

    this.initialized = false;
  }
}

/**
 * Default bridge instance
 */
let defaultBridge: CodexBridge | null = null;

/**
 * Get default bridge instance
 *
 * @param config - CLI configuration (optional)
 * @param mcpConfig - MCP configuration (optional)
 * @returns Default bridge instance
 */
export function getDefaultBridge(
  config?: CodexConfig,
  mcpConfig?: CodexMCPConfig
): CodexBridge {
  if (!defaultBridge || config || mcpConfig) {
    defaultBridge = new CodexBridge(
      config || {
        command: 'codex',
        sandboxMode: 'workspace-write',
        timeout: 60000,
      },
      mcpConfig
    );
  }
  return defaultBridge;
}
