/**
 * Claude Code Integration - Bridge
 *
 * Main bridge class for Claude Code integration.
 * Provides high-level API for initializing and managing Claude Code integration.
 *
 * @module integrations/claude-code/bridge
 */

import { join } from 'path';
import type { InitOptions, IntegrationStatus } from './types.js';
import { ClaudeCodeError, ClaudeCodeErrorType } from './types.js';
import { ConfigManager, defaultConfigManager } from './config-manager.js';
import { CommandManager, defaultCommandManager } from './command-manager.js';
import { MCPManager, defaultMCPManager } from './mcp-manager.js';
import {
  getProjectCommandsPath,
  getProjectMCPPath,
  fileExists,
} from './utils/file-reader.js';

/**
 * Claude Code Bridge
 *
 * High-level interface for Claude Code integration.
 * Orchestrates ConfigManager, CommandManager, and MCPManager.
 */
export class ClaudeCodeBridge {
  private configManager: ConfigManager;
  private commandManager: CommandManager;
  private mcpManager: MCPManager;

  /**
   * Create a new Claude Code Bridge
   *
   * @param configManager - Config manager instance (optional)
   * @param commandManager - Command manager instance (optional)
   * @param mcpManager - MCP manager instance (optional)
   */
  constructor(
    configManager?: ConfigManager,
    commandManager?: CommandManager,
    mcpManager?: MCPManager
  ) {
    this.configManager = configManager ?? defaultConfigManager;
    this.commandManager = commandManager ?? defaultCommandManager;
    this.mcpManager = mcpManager ?? defaultMCPManager;
  }

  /**
   * Initialize Claude Code integration for a project
   *
   * Sets up .claude/ directory with commands and MCP configuration.
   *
   * @param projectDir - Project directory
   * @param options - Initialization options
   * @throws {ClaudeCodeError} If initialization fails
   */
  async initialize(projectDir: string, options?: InitOptions): Promise<void> {
    try {
      const force = options?.force ?? false;
      const sourceDir = options?.sourceDir;
      const verbose = options?.verbose ?? false;

      if (!sourceDir) {
        throw new ClaudeCodeError(
          ClaudeCodeErrorType.INVALID_PATH,
          'Source directory is required for initialization',
          { projectDir, options }
        );
      }

      // Install commands
      if (verbose) {
        console.log('Installing Claude Code commands...');
      }

      const commandsSourceDir = join(sourceDir, 'commands');
      const commandCount = await this.commandManager.installCommands(
        projectDir,
        commandsSourceDir,
        force
      );

      if (verbose) {
        console.log(`✓ Installed ${commandCount} commands`);
      }

      // Install MCP configuration
      if (verbose) {
        console.log('Installing MCP configuration...');
      }

      const mcpSourceDir = join(sourceDir, 'mcp');
      const mcpCount = await this.mcpManager.installMCPConfig(
        projectDir,
        mcpSourceDir,
        force
      );

      if (verbose) {
        console.log(`✓ Installed ${mcpCount} MCP manifests`);
      }

      // Invalidate cache after installation
      this.configManager.invalidateCache('project');

    } catch (error) {
      if (error instanceof ClaudeCodeError) {
        throw error;
      }

      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        'Failed to initialize Claude Code integration',
        { projectDir, options, error }
      );
    }
  }

  /**
   * Check Claude Code integration status
   *
   * @param projectDir - Project directory
   * @returns Integration status
   */
  async checkStatus(projectDir?: string): Promise<IntegrationStatus> {
    try {
      const dir = projectDir ?? process.cwd();

      // Check if directories exist
      const commandsDir = getProjectCommandsPath(dir);
      const mcpDir = getProjectMCPPath(dir);

      const hasCommandsDir = await fileExists(commandsDir);
      const hasMCPDir = await fileExists(mcpDir);

      // Count commands and MCP servers
      const commandCount = hasCommandsDir
        ? (await this.commandManager.listCommandNames(dir)).length
        : 0;

      const mcpServerCount = hasMCPDir
        ? (await this.mcpManager.listServers(dir)).length
        : 0;

      const configured = hasCommandsDir || hasMCPDir;

      return {
        configured,
        hasCommandsDir,
        hasMCPDir,
        commandCount,
        mcpServerCount,
        projectDir: dir,
      };
    } catch (error) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        'Failed to check integration status',
        { projectDir, error }
      );
    }
  }

  /**
   * Sync Claude Code integration
   *
   * Re-installs commands and MCP configuration from source.
   *
   * @param projectDir - Project directory
   * @param sourceDir - Source directory
   * @param force - Force overwrite existing files
   */
  async syncIntegration(
    projectDir: string,
    sourceDir: string,
    force: boolean = true
  ): Promise<void> {
    await this.initialize(projectDir, {
      sourceDir,
      force,
      verbose: true,
    });
  }

  /**
   * Get configuration manager
   *
   * @returns Config manager instance
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get command manager
   *
   * @returns Command manager instance
   */
  getCommandManager(): CommandManager {
    return this.commandManager;
  }

  /**
   * Get MCP manager
   *
   * @returns MCP manager instance
   */
  getMCPManager(): MCPManager {
    return this.mcpManager;
  }

  /**
   * List all available commands
   *
   * @param projectDir - Project directory
   * @returns List of command names
   */
  async listCommands(projectDir?: string): Promise<string[]> {
    return this.commandManager.listCommandNames(projectDir);
  }

  /**
   * List all MCP servers
   *
   * @param projectDir - Project directory
   * @returns List of MCP servers
   */
  async listMCPServers(projectDir: string): Promise<Array<{
    name: string;
    command: string;
    args?: string[];
  }>> {
    const servers = await this.mcpManager.listServers(projectDir);
    return servers.map(({ name, server }) => ({
      name,
      command: server.command,
      args: server.args,
    }));
  }

  /**
   * Get detailed integration information
   *
   * @param projectDir - Project directory
   * @returns Detailed integration info
   */
  async getIntegrationInfo(projectDir?: string): Promise<{
    status: IntegrationStatus;
    commands: string[];
    mcpServers: Array<{ name: string; command: string }>;
    config: {
      hasGlobalConfig: boolean;
      hasProjectConfig: boolean;
    };
  }> {
    const dir = projectDir ?? process.cwd();

    const status = await this.checkStatus(dir);
    const commands = await this.listCommands(dir);
    const mcpServers = await this.listMCPServers(dir);
    const config = await this.configManager.getConfigStats(dir);

    return {
      status,
      commands,
      mcpServers,
      config,
    };
  }
}

/**
 * Default Claude Code Bridge instance
 */
export const defaultBridge = new ClaudeCodeBridge();
