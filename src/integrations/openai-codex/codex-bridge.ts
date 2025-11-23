/**
 * OpenAI Codex Integration - Bridge
 *
 * Unified bridge interface for OpenAI Codex CLI and MCP integration.
 * Provides seamless switching between CLI and MCP execution modes.
 *
 * @module integrations/openai-codex/codex-bridge
 * @since v10.3.0
 */

import { logger } from '../../utils/logger.js';
import { CodexCLI, getDefaultCLI } from './cli-wrapper.js';
import { CodexMCPManager, getDefaultMCPManager } from './mcp-manager.js';
import type {
  CodexConfig,
  CodexMCPConfig,
  CodexExecutionOptions,
  CodexExecutionResult,
  IntegrationStatus,
  MCPServerStatus,
} from './types.js';
import { CodexError, CodexErrorType } from './types.js';

/**
 * Codex Bridge Configuration
 */
export interface CodexBridgeConfig {
  /** CLI configuration */
  cli?: CodexConfig;
  /** MCP server configuration */
  mcp?: CodexMCPConfig;
  /** Prefer MCP over CLI when both available */
  preferMCP?: boolean;
  /** Auto-start MCP server if enabled */
  autoStartMCP?: boolean;
}

/**
 * Codex Bridge Options
 */
export interface CodexBridgeOptions extends CodexExecutionOptions {
  /** Force CLI mode (ignore MCP) */
  forceCLI?: boolean;
  /** Force MCP mode (fail if unavailable) */
  forceMCP?: boolean;
}

/**
 * OpenAI Codex Bridge
 *
 * Provides unified interface for both CLI and MCP execution modes.
 * Automatically selects best available method based on configuration.
 *
 * **Usage:**
 * ```typescript
 * const bridge = new CodexBridge({
 *   cli: { command: 'codex', timeout: 60000 },
 *   mcp: { enabled: true, command: 'codex', transport: 'stdio' },
 *   preferMCP: true
 * });
 *
 * await bridge.initialize();
 *
 * const result = await bridge.executeTask({
 *   prompt: 'Implement user authentication'
 * });
 * ```
 */
export class CodexBridge {
  private cli!: CodexCLI;
  private mcpManager: CodexMCPManager | null = null;
  private initialized = false;

  constructor(private config: CodexBridgeConfig = {}) {
    this.validateConfig();
  }

  /**
   * Initialize bridge (start MCP if configured)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('CodexBridge already initialized');
      return;
    }

    logger.info('CodexBridge: Initializing', {
      preferMCP: this.config.preferMCP,
      autoStartMCP: this.config.autoStartMCP,
    });

    // Initialize CLI
    this.cli = getDefaultCLI(this.config.cli);

    // Initialize MCP if enabled
    if (this.config.mcp?.enabled) {
      this.mcpManager = getDefaultMCPManager(this.config.mcp);

      // Auto-start MCP server if configured
      if (this.config.autoStartMCP) {
        try {
          await this.mcpManager.startServer();
          logger.info('CodexBridge: MCP server started automatically');
        } catch (error) {
          logger.warn('CodexBridge: Failed to auto-start MCP server', {
            error: (error as Error).message,
          });
          // Continue with CLI-only mode
        }
      }
    }

    this.initialized = true;
    logger.info('CodexBridge: Initialization complete');
  }

  /**
   * Execute task using best available method
   *
   * @param options - Execution options
   * @returns Execution result
   */
  async executeTask(options: CodexBridgeOptions): Promise<CodexExecutionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Determine execution mode
      const useMCP = await this.shouldUseMCP(options);

      logger.debug('CodexBridge.executeTask', {
        mode: useMCP ? 'MCP' : 'CLI',
        promptLength: options.prompt.length,
        forceCLI: options.forceCLI,
        forceMCP: options.forceMCP,
      });

      // Execute via MCP or CLI
      if (useMCP && this.mcpManager) {
        return await this.executeViaMCP(options);
      } else {
        return await this.executeViaCLI(options);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('CodexBridge.executeTask failed', {
        error: (error as Error).message,
        duration,
      });

      // Return error result instead of throwing
      return {
        content: '',
        duration,
        exitCode: 1,
        error: error as Error,
      };
    }
  }

  /**
   * Check if Codex CLI is available
   *
   * @returns True if available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.cli.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Get Codex CLI version
   *
   * @returns Version string
   */
  async getVersion(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cli.getVersion();
  }

  /**
   * Get integration status
   *
   * @returns Current status
   */
  async getStatus(): Promise<IntegrationStatus> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cliAvailable = await this.cli.isAvailable();
    let version: string | undefined;
    let mcpServer: MCPServerStatus | undefined;

    if (cliAvailable) {
      try {
        version = await this.cli.getVersion();
      } catch {
        // Version detection failed - not critical
      }
    }

    if (this.mcpManager) {
      mcpServer = this.mcpManager.getStatus();
    }

    return {
      cliAvailable,
      version,
      mcpServer,
      configValid: this.isConfigValid(),
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Start MCP server (if configured)
   *
   * @returns Server status
   */
  async startMCPServer(): Promise<MCPServerStatus> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.mcpManager) {
      throw new CodexError(
        CodexErrorType.CONFIG_ERROR,
        'MCP server not configured',
        { config: this.config }
      );
    }

    return await this.mcpManager.startServer();
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
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.debug('CodexBridge.cleanup');

    if (this.cli) {
      await this.cli.cleanup();
    }

    if (this.mcpManager) {
      await this.mcpManager.cleanup();
    }

    this.initialized = false;
  }

  /**
   * Execute via MCP server
   */
  private async executeViaMCP(options: CodexBridgeOptions): Promise<CodexExecutionResult> {
    if (!this.mcpManager) {
      throw new CodexError(
        CodexErrorType.MCP_ERROR,
        'MCP manager not initialized',
        { options }
      );
    }

    // Check if MCP server is healthy
    const isHealthy = await this.mcpManager.isHealthy();
    if (!isHealthy) {
      logger.warn('CodexBridge: MCP server unhealthy, falling back to CLI');
      return this.executeViaCLI(options);
    }

    logger.debug('CodexBridge: Executing via MCP');

    // MCP execution would go here
    // For now, this is a placeholder - actual MCP tool invocation
    // would be implemented similar to how AutomatosX MCP server works
    throw new CodexError(
      CodexErrorType.MCP_ERROR,
      'MCP execution not yet implemented - falling back to CLI',
      { options }
    );
  }

  /**
   * Execute via CLI wrapper
   */
  private async executeViaCLI(options: CodexBridgeOptions): Promise<CodexExecutionResult> {
    logger.debug('CodexBridge: Executing via CLI');
    return await this.cli.execute(options);
  }

  /**
   * Determine if MCP should be used
   */
  private async shouldUseMCP(options: CodexBridgeOptions): Promise<boolean> {
    // Force CLI mode
    if (options.forceCLI) {
      return false;
    }

    // Force MCP mode
    if (options.forceMCP) {
      if (!this.mcpManager) {
        throw new CodexError(
          CodexErrorType.CONFIG_ERROR,
          'MCP mode forced but MCP not configured',
          { options }
        );
      }
      return true;
    }

    // MCP not available
    if (!this.mcpManager) {
      return false;
    }

    // Check if MCP server is running
    const mcpStatus = this.mcpManager.getStatus();
    if (!mcpStatus.running) {
      return false;
    }

    // Use preference setting
    return this.config.preferMCP ?? false;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.mcp?.enabled && !this.config.mcp.command) {
      throw new CodexError(
        CodexErrorType.CONFIG_ERROR,
        'MCP enabled but no command specified',
        { config: this.config }
      );
    }

    if (this.config.cli && !this.config.cli.command) {
      throw new CodexError(
        CodexErrorType.CONFIG_ERROR,
        'CLI config provided but no command specified',
        { config: this.config }
      );
    }
  }

  /**
   * Check if configuration is valid
   */
  private isConfigValid(): boolean {
    try {
      this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Default bridge instance
 */
let defaultBridge: CodexBridge | null = null;

/**
 * Get default Codex bridge instance
 *
 * @param config - Configuration (optional)
 * @returns Default bridge instance
 */
export function getDefaultBridge(config?: CodexBridgeConfig): CodexBridge {
  if (!defaultBridge || config) {
    defaultBridge = new CodexBridge(
      config || {
        cli: {
          command: 'codex',
          sandboxMode: 'workspace-write',
          timeout: 60000,
        },
        mcp: {
          enabled: false,
          command: 'codex',
          transport: 'stdio',
        },
        preferMCP: false,
        autoStartMCP: false,
      }
    );
  }
  return defaultBridge;
}
