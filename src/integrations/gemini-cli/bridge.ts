/**
 * Gemini CLI Integration - Bridge
 *
 * Main integration bridge for discovering and registering MCP servers
 * between AutomatosX and Gemini CLI.
 *
 * @module integrations/gemini-cli/bridge
 */

import { access, constants, realpath } from 'fs';
import { promisify } from 'util';
import { basename, isAbsolute } from 'path';
import type {
  MCPServerConfig,
  GeminiConfig,
  RegisterMCPOptions,
  MCPDiscoveryStats,
  ConfigScope,
} from './types.js';
import { GeminiCLIError, GeminiCLIErrorType } from './types.js';
import { ConfigManager } from './config-manager.js';
import {
  getUserConfigPath,
  getProjectConfigPath,
  writeJsonFile,
  readJsonFile,
} from './utils/file-reader.js';
import { validateMCPServer, isValidServerName } from './utils/validation.js';

const accessAsync = promisify(access);
const realpathAsync = promisify(realpath);

/**
 * Allowed commands for MCP servers (whitelist)
 */
const ALLOWED_COMMANDS = [
  'node',
  'python',
  'python3',
  'ax',
  'gemini',
  'npm',
  'npx',
];

/**
 * Gemini CLI Bridge
 *
 * Provides bidirectional integration between AutomatosX and Gemini CLI,
 * enabling MCP server discovery and registration.
 */
export class GeminiCLIBridge {
  private configManager: ConfigManager;

  /**
   * Create a new GeminiCLIBridge
   *
   * @param configManager - Optional ConfigManager instance
   */
  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
  }

  /**
   * Discover all MCP servers from Gemini CLI configuration
   *
   * Reads both user-level and project-level configurations and extracts
   * all configured MCP servers.
   *
   * **Security Note**: Project-level servers override user-level servers with
   * the same name. This is intentional behavior that allows project-specific
   * configurations to take precedence. However, this means a malicious project
   * could override trusted user servers.
   *
   * @returns Array of discovered MCP server configurations
   */
  async discoverMCPServers(): Promise<MCPServerConfig[]> {
    const servers: MCPServerConfig[] = [];

    // Get configurations from both scopes to detect conflicts
    const [userConfig, projectConfig] = await Promise.all([
      this.configManager.readUserConfig(),
      this.configManager.readProjectConfig(),
    ]);

    // Track server names from user scope
    const userServerNames = new Set<string>();
    if (userConfig.mcpServers) {
      for (const name of Object.keys(userConfig.mcpServers)) {
        userServerNames.add(name);
      }
    }

    // Detect conflicts with project scope
    const conflicts: string[] = [];
    if (projectConfig.mcpServers) {
      for (const name of Object.keys(projectConfig.mcpServers)) {
        if (userServerNames.has(name)) {
          conflicts.push(name);
        }
      }
    }

    // Warn about conflicts
    if (conflicts.length > 0) {
      console.warn(
        `[Security Warning] Project-level MCP servers are overriding user-level servers: ${conflicts.join(', ')}. ` +
          `Ensure you trust this project before proceeding.`
      );
    }

    // Get merged configuration (project takes precedence)
    const config = await this.configManager.getMergedConfig();

    // Extract MCP servers
    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        servers.push({
          name,
          command: serverConfig.command,
          args: serverConfig.args || [],
          transport: serverConfig.transport || 'stdio',
          env: serverConfig.env,
          description: `MCP server from Gemini CLI: ${name}`,
        });
      }
    }

    return servers;
  }

  /**
   * Discover MCP servers from a specific scope
   *
   * @param scope - Configuration scope to search
   * @returns Array of discovered MCP server configurations
   */
  async discoverMCPServersByScope(
    scope: ConfigScope
  ): Promise<MCPServerConfig[]> {
    const servers: MCPServerConfig[] = [];

    const config =
      scope === 'user'
        ? await this.configManager.readUserConfig()
        : await this.configManager.readProjectConfig();

    if (config.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        servers.push({
          name,
          command: serverConfig.command,
          args: serverConfig.args || [],
          transport: serverConfig.transport || 'stdio',
          env: serverConfig.env,
          description: `MCP server from Gemini CLI (${scope}): ${name}`,
          source: scope,
        });
      }
    }

    return servers;
  }

  /**
   * Get MCP server discovery statistics
   *
   * @returns Statistics about discovered MCP servers
   */
  async getDiscoveryStats(): Promise<MCPDiscoveryStats> {
    const [userServers, projectServers] = await Promise.all([
      this.discoverMCPServersByScope('user'),
      this.discoverMCPServersByScope('project'),
    ]);

    const allServers = [...userServers, ...projectServers];

    // Count by transport
    const byTransport = {
      stdio: 0,
      sse: 0,
      http: 0,
    };

    for (const server of allServers) {
      byTransport[server.transport]++;
    }

    return {
      total: allServers.length,
      userScope: userServers.length,
      projectScope: projectServers.length,
      byTransport,
    };
  }

  /**
   * Register a new MCP server in Gemini CLI configuration
   *
   * @param config - MCP server configuration to register
   * @param options - Registration options
   * @throws {GeminiCLIError} If registration fails or validation fails
   */
  async registerMCPServer(
    config: MCPServerConfig,
    options: RegisterMCPOptions = {}
  ): Promise<void> {
    const {
      scope = 'user',
      overwrite = false,
      validate = true,
    } = options;

    // Validate server name
    if (!isValidServerName(config.name)) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.VALIDATION_ERROR,
        `Invalid server name: ${config.name}. Must be lowercase alphanumeric with hyphens or underscores.`,
        { name: config.name }
      );
    }

    // Validate server configuration
    if (validate) {
      const validation = validateMCPServer(
        {
          command: config.command,
          args: config.args,
          transport: config.transport,
          env: config.env,
        },
        config.name
      );

      if (!validation.valid) {
        throw new GeminiCLIError(
          GeminiCLIErrorType.VALIDATION_ERROR,
          `MCP server validation failed: ${validation.errors.join(', ')}`,
          { name: config.name, errors: validation.errors }
        );
      }

      // Validate command security
      try {
        // 1. Resolve command path (handles both absolute and relative paths)
        let resolvedCommand = config.command;

        if (isAbsolute(config.command)) {
          // Resolve symbolic links for absolute paths
          try {
            resolvedCommand = await realpathAsync(config.command);
          } catch (error) {
            throw new GeminiCLIError(
              GeminiCLIErrorType.VALIDATION_ERROR,
              `Command path cannot be resolved: ${config.command}`,
              { command: config.command, name: config.name, originalError: error }
            );
          }
        }

        // 2. Extract base command for whitelist check
        const baseCommand = basename(resolvedCommand);

        // 3. Validate against whitelist
        if (!ALLOWED_COMMANDS.includes(baseCommand)) {
          throw new GeminiCLIError(
            GeminiCLIErrorType.VALIDATION_ERROR,
            `Command "${baseCommand}" is not in the whitelist. Allowed: ${ALLOWED_COMMANDS.join(', ')}`,
            { command: config.command, baseCommand, name: config.name }
          );
        }

        // 4. For absolute paths, verify executability
        if (isAbsolute(resolvedCommand)) {
          try {
            await accessAsync(resolvedCommand, constants.X_OK);
          } catch (_error) {
            throw new GeminiCLIError(
              GeminiCLIErrorType.VALIDATION_ERROR,
              `Command not executable: ${resolvedCommand}`,
              { command: config.command, resolvedCommand, name: config.name }
            );
          }
        } else {
          // For commands in PATH, warn but allow (already whitelisted)
          console.warn(
            `[Info] Command "${config.command}" will be resolved from PATH. ` +
              'Ensure it is installed and accessible.'
          );
        }
      } catch (error) {
        if (error instanceof GeminiCLIError) {
          throw error;
        }
        throw new GeminiCLIError(
          GeminiCLIErrorType.VALIDATION_ERROR,
          `Command validation failed: ${config.command}`,
          { command: config.command, name: config.name, originalError: error }
        );
      }
    }

    // Get config path
    const configPath =
      scope === 'user' ? getUserConfigPath() : getProjectConfigPath();

    // Read existing configuration
    let existingConfig: GeminiConfig;
    try {
      existingConfig = await readJsonFile<GeminiConfig>(configPath);
    } catch (error) {
      // Create new config if file doesn't exist
      if (
        error instanceof GeminiCLIError &&
        error.type === GeminiCLIErrorType.CONFIG_NOT_FOUND
      ) {
        existingConfig = {};
      } else {
        throw error;
      }
    }

    // Check if server already exists
    if (
      existingConfig.mcpServers?.[config.name] &&
      !overwrite
    ) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.VALIDATION_ERROR,
        `MCP server "${config.name}" already exists. Use overwrite option to replace.`,
        { name: config.name, scope }
      );
    }

    // Add or update MCP server
    existingConfig.mcpServers = existingConfig.mcpServers || {};
    existingConfig.mcpServers[config.name] = {
      command: config.command,
      args: config.args,
      transport: config.transport,
      env: config.env,
    };

    // Write updated configuration
    await writeJsonFile(configPath, existingConfig);

    // Invalidate cache
    this.configManager.invalidateCache(scope);
  }

  /**
   * Remove an MCP server from Gemini CLI configuration
   *
   * @param name - Server name to remove
   * @param scope - Configuration scope
   * @throws {GeminiCLIError} If server not found
   */
  async removeMCPServer(name: string, scope: ConfigScope = 'user'): Promise<void> {
    const configPath =
      scope === 'user' ? getUserConfigPath() : getProjectConfigPath();

    // Read existing configuration
    const existingConfig = await readJsonFile<GeminiConfig>(configPath);

    // Check if server exists
    if (!existingConfig.mcpServers?.[name]) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.SERVER_NOT_FOUND,
        `MCP server "${name}" not found in ${scope} configuration`,
        { name, scope }
      );
    }

    // Remove server
    delete existingConfig.mcpServers[name];

    // Write updated configuration
    await writeJsonFile(configPath, existingConfig);

    // Invalidate cache
    this.configManager.invalidateCache(scope);
  }

  /**
   * Sync AutomatosX MCP server to Gemini CLI
   *
   * Registers the AutomatosX MCP server in user-level Gemini CLI configuration,
   * making it available to Gemini CLI sessions.
   *
   * @param overwrite - Overwrite if already exists (default: true)
   */
  async syncAutomatosXMCP(overwrite: boolean = true): Promise<void> {
    const axMCPConfig: MCPServerConfig = {
      name: 'automatosx',
      command: 'ax',
      args: ['mcp'],
      transport: 'stdio',
      description: 'AutomatosX MCP Server - AI Agent Orchestration Platform',
    };

    await this.registerMCPServer(axMCPConfig, {
      scope: 'user',
      overwrite,
      validate: true,
    });
  }

  /**
   * Check if AutomatosX MCP server is registered
   *
   * @param scope - Configuration scope to check (default: 'user')
   * @returns True if AutomatosX MCP is registered
   */
  async isAutomatosXMCPRegistered(scope: ConfigScope = 'user'): Promise<boolean> {
    const servers = await this.discoverMCPServersByScope(scope);
    return servers.some((s) => s.name === 'automatosx');
  }

  /**
   * Get a specific MCP server configuration
   *
   * @param name - Server name
   * @param scope - Configuration scope (default: merged)
   * @returns Server configuration or undefined if not found
   */
  async getMCPServer(
    name: string,
    scope?: ConfigScope
  ): Promise<MCPServerConfig | undefined> {
    const servers = scope
      ? await this.discoverMCPServersByScope(scope)
      : await this.discoverMCPServers();

    return servers.find((s) => s.name === name);
  }

  /**
   * List all MCP server names
   *
   * @param scope - Optional scope filter
   * @returns Array of server names
   */
  async listMCPServerNames(scope?: ConfigScope): Promise<string[]> {
    const servers = scope
      ? await this.discoverMCPServersByScope(scope)
      : await this.discoverMCPServers();

    return servers.map((s) => s.name);
  }

  /**
   * Check if Gemini CLI is configured
   *
   * @returns True if any Gemini CLI configuration exists
   */
  async isGeminiCLIConfigured(): Promise<boolean> {
    const [hasUser, hasProject] = await Promise.all([
      this.configManager.hasUserConfig(),
      this.configManager.hasProjectConfig(),
    ]);

    return hasUser || hasProject;
  }

  /**
   * Get configuration status
   *
   * @returns Configuration status information
   */
  async getConfigStatus(): Promise<{
    configured: boolean;
    hasUserConfig: boolean;
    hasProjectConfig: boolean;
    mcpServers: number;
    automatosxRegistered: boolean;
  }> {
    const [stats, configured, isAxRegistered] = await Promise.all([
      this.configManager.getConfigStats(),
      this.isGeminiCLIConfigured(),
      this.isAutomatosXMCPRegistered(),
    ]);

    return {
      configured,
      hasUserConfig: stats.hasUserConfig,
      hasProjectConfig: stats.hasProjectConfig,
      mcpServers: stats.totalMCPServers,
      automatosxRegistered: isAxRegistered,
    };
  }
}

/**
 * Default GeminiCLIBridge instance
 */
export const defaultBridge = new GeminiCLIBridge();
