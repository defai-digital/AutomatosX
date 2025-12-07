/**
 * MCP Config Injector (v12.0.0)
 *
 * Injects AutomatosX MCP server configuration into Claude and Gemini config files.
 * Enables bidirectional MCP communication where AI providers can call back to AutomatosX.
 *
 * Security Features:
 * - Atomic writes (temp file → rename)
 * - Automatic backup before modification
 * - Deep merge (preserves user's other servers)
 * - JSON validation before write
 * - Rollback on any failure
 * - File permission checks
 *
 * @module mcp/config-injector
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../shared/logging/logger.js';

/**
 * Supported providers for MCP config injection
 */
export type MCPProvider = 'claude' | 'gemini';

/**
 * MCP server configuration to inject
 */
export interface MCPServerConfig {
  /** Command to run the MCP server */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Result of injection operation
 */
export interface InjectionResult {
  success: boolean;
  backupPath?: string;
  configPath?: string;
  error?: string;
}

/**
 * Provider config file structure (Claude/Gemini MCP config)
 */
interface ProviderMCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

/**
 * Get the config file path for a provider
 */
export function getProviderConfigPath(provider: MCPProvider): string {
  const homeDir = os.homedir();

  switch (provider) {
    case 'claude':
      // Claude Code stores config in:
      // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
      // Linux: ~/.config/claude/claude_desktop_config.json
      // Windows: %APPDATA%/Claude/claude_desktop_config.json
      if (process.platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      } else {
        return path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
      }

    case 'gemini':
      // Gemini CLI stores config in:
      // macOS/Linux: ~/.config/gemini/config.json
      // Windows: %APPDATA%/gemini/config.json
      if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'gemini', 'config.json');
      } else {
        return path.join(homeDir, '.config', 'gemini', 'config.json');
      }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Validate file access (exists and writable)
 */
async function validateAccess(configPath: string): Promise<void> {
  try {
    // Check if directory exists
    const dir = path.dirname(configPath);
    await fs.access(dir, fs.constants.W_OK);
  } catch {
    // Create directory if it doesn't exist
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    // Check if file exists and is writable
    await fs.access(configPath, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    // File doesn't exist, that's OK - we'll create it
  }
}

/**
 * Read existing config or return empty object
 */
async function readExistingConfig(configPath: string): Promise<ProviderMCPConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.warn('Existing config is not an object, starting fresh', { configPath });
      return {};
    }

    return parsed as ProviderMCPConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return empty config
      return {};
    }

    // JSON parse error or other read error
    logger.warn('Failed to read existing config', {
      configPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return {};
  }
}

/**
 * Create backup of existing config
 */
async function createBackup(configPath: string): Promise<string | null> {
  try {
    await fs.access(configPath, fs.constants.R_OK);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup-${timestamp}`;

    await fs.copyFile(configPath, backupPath);

    logger.debug('Created config backup', { backupPath });
    return backupPath;
  } catch {
    // File doesn't exist, no backup needed
    return null;
  }
}

/**
 * Restore config from backup
 */
async function restoreBackup(backupPath: string | null, configPath: string): Promise<void> {
  if (!backupPath) {
    // No backup to restore, just delete the config if it exists
    try {
      await fs.unlink(configPath);
    } catch {
      // Ignore if file doesn't exist
    }
    return;
  }

  try {
    await fs.copyFile(backupPath, configPath);
    logger.info('Restored config from backup', { backupPath, configPath });
  } catch (error) {
    logger.error('Failed to restore backup', {
      backupPath,
      configPath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Deep merge two objects (source into target)
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      // Overwrite with source value
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Validate MCP config structure
 */
function validateMCPConfig(config: ProviderMCPConfig): void {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('Config must be an object');
  }

  if (config.mcpServers !== undefined) {
    if (typeof config.mcpServers !== 'object' || config.mcpServers === null) {
      throw new Error('mcpServers must be an object');
    }

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      if (typeof serverConfig !== 'object' || serverConfig === null) {
        throw new Error(`Server config for '${serverName}' must be an object`);
      }

      if (typeof serverConfig.command !== 'string' || serverConfig.command.length === 0) {
        throw new Error(`Server '${serverName}' must have a non-empty command`);
      }

      if (serverConfig.args !== undefined && !Array.isArray(serverConfig.args)) {
        throw new Error(`Server '${serverName}' args must be an array`);
      }

      if (serverConfig.env !== undefined && (typeof serverConfig.env !== 'object' || serverConfig.env === null)) {
        throw new Error(`Server '${serverName}' env must be an object`);
      }
    }
  }
}

/**
 * Atomic write to file (write to temp, then rename)
 */
async function atomicWrite(configPath: string, config: ProviderMCPConfig): Promise<void> {
  const content = JSON.stringify(config, null, 2);
  const tmpPath = `${configPath}.tmp.${process.pid}`;

  try {
    // Write to temp file
    await fs.writeFile(tmpPath, content, 'utf-8');

    // Atomic rename
    await fs.rename(tmpPath, configPath);

    logger.debug('Atomic write completed', { configPath });
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Inject AutomatosX MCP server config into a provider's config file
 *
 * @param provider - Target provider ('claude' or 'gemini')
 * @param mcpConfig - MCP server configuration to inject
 * @returns Injection result with success status and backup path
 *
 * @example
 * ```typescript
 * const result = await injectMCPConfig('claude', {
 *   command: 'npx',
 *   args: ['automatosx', 'mcp-server'],
 *   env: { AUTOMATOSX_PROJECT_DIR: process.cwd() }
 * });
 *
 * if (result.success) {
 *   console.log('Config injected, backup at:', result.backupPath);
 * } else {
 *   console.error('Injection failed:', result.error);
 * }
 * ```
 */
export async function injectMCPConfig(
  provider: MCPProvider,
  mcpConfig: MCPServerConfig
): Promise<InjectionResult> {
  const configPath = getProviderConfigPath(provider);

  logger.debug('Injecting MCP config', {
    provider,
    configPath,
    mcpConfig
  });

  // 1. Check file access
  try {
    await validateAccess(configPath);
  } catch (error) {
    return {
      success: false,
      configPath,
      error: `Cannot access config directory: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  // 2. Read existing config
  const existing = await readExistingConfig(configPath);

  // 3. Create backup
  const backupPath = await createBackup(configPath);

  try {
    // 4. Deep merge (don't overwrite user's other servers)
    const merged = deepMerge(existing, {
      mcpServers: {
        ...existing.mcpServers,
        automatosx: mcpConfig
      }
    });

    // 5. Validate merged structure
    validateMCPConfig(merged);

    // 6. Atomic write
    await atomicWrite(configPath, merged);

    logger.info('MCP config injected successfully', {
      provider,
      configPath,
      backupPath
    });

    return {
      success: true,
      configPath,
      backupPath: backupPath || undefined
    };
  } catch (error) {
    // 7. Rollback
    await restoreBackup(backupPath, configPath);

    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('MCP config injection failed, rolled back', {
      provider,
      configPath,
      error: errorMessage
    });

    return {
      success: false,
      configPath,
      backupPath: backupPath || undefined,
      error: errorMessage
    };
  }
}

/**
 * Remove AutomatosX MCP server config from a provider's config file
 *
 * @param provider - Target provider ('claude' or 'gemini')
 * @returns Injection result with success status
 */
export async function removeMCPConfig(provider: MCPProvider): Promise<InjectionResult> {
  const configPath = getProviderConfigPath(provider);

  logger.debug('Removing MCP config', { provider, configPath });

  try {
    await validateAccess(configPath);
  } catch (error) {
    return {
      success: false,
      configPath,
      error: `Cannot access config: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const existing = await readExistingConfig(configPath);

  if (!existing.mcpServers?.automatosx) {
    // Already removed
    return { success: true, configPath };
  }

  const backupPath = await createBackup(configPath);

  try {
    // Remove automatosx server
    const { automatosx: _, ...otherServers } = existing.mcpServers;
    const updated: ProviderMCPConfig = {
      ...existing,
      mcpServers: Object.keys(otherServers).length > 0 ? otherServers : undefined
    };

    // Clean up undefined mcpServers
    if (updated.mcpServers === undefined) {
      delete updated.mcpServers;
    }

    await atomicWrite(configPath, updated);

    logger.info('MCP config removed successfully', { provider, configPath });

    return {
      success: true,
      configPath,
      backupPath: backupPath || undefined
    };
  } catch (error) {
    await restoreBackup(backupPath, configPath);

    return {
      success: false,
      configPath,
      backupPath: backupPath || undefined,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if AutomatosX MCP config is already injected
 */
export async function isMCPConfigInjected(provider: MCPProvider): Promise<boolean> {
  const configPath = getProviderConfigPath(provider);

  try {
    const config = await readExistingConfig(configPath);
    return config.mcpServers?.automatosx !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get the default MCP server config for AutomatosX
 */
export function getDefaultMCPServerConfig(): MCPServerConfig {
  return {
    command: 'npx',
    args: ['automatosx', 'mcp-server'],
    env: {
      AUTOMATOSX_PROJECT_DIR: process.cwd()
    }
  };
}
