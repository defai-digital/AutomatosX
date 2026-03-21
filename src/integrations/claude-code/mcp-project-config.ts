/**
 * MCP Project Config Generator
 *
 * Generates .mcp.json at the project root — the modern Claude Code standard
 * for team-shared MCP server configuration (committed to git, unlike .claude/).
 *
 * @module integrations/claude-code/mcp-project-config
 */

import { join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import { fileExists, readJsonFile, writeJsonFile } from './utils/file-reader.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface McpServerEntry {
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface McpProjectConfig {
  mcpServers: Record<string, McpServerEntry>;
}

export interface McpProjectConfigResult {
  path: string;
  created: boolean;
  merged: boolean;
}

// ─── McpProjectConfigGenerator ───────────────────────────────────────────────

export class McpProjectConfigGenerator {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  private get configPath(): string {
    return join(this.projectDir, '.mcp.json');
  }

  /**
   * Generate or update .mcp.json with the AutomatosX stdio server entry.
   *
   * Merge strategy: if .mcp.json already exists, add/update only the
   * "automatosx" key; other mcpServers entries are preserved.
   */
  async generate(): Promise<McpProjectConfigResult> {
    logger.info('[McpProjectConfig] Generating .mcp.json...');

    const existed = await fileExists(this.configPath);
    let config: McpProjectConfig = { mcpServers: {} };

    if (existed) {
      try {
        config = await readJsonFile<McpProjectConfig>(this.configPath);
        if (!config.mcpServers || typeof config.mcpServers !== 'object') {
          config.mcpServers = {};
        }
      } catch (error) {
        logger.warn('[McpProjectConfig] Could not parse existing .mcp.json — overwriting', { error });
        config = { mcpServers: {} };
      }
    }

    const wasPresent = 'automatosx' in config.mcpServers;

    config.mcpServers['automatosx'] = {
      type: 'stdio',
      command: 'automatosx',
      args: ['mcp'],
      env: {
        AUTOMATOSX_LOG_LEVEL: 'warn',
      },
    };

    await writeJsonFile(this.configPath, config);

    logger.info('[McpProjectConfig] .mcp.json written', {
      path: this.configPath,
      created: !existed,
      merged: existed && !wasPresent,
    });

    return {
      path: this.configPath,
      created: !existed,
      merged: existed && !wasPresent,
    };
  }

  /**
   * Check if .mcp.json exists and contains an automatosx entry.
   */
  async isGenerated(): Promise<boolean> {
    if (!(await fileExists(this.configPath))) {
      return false;
    }
    try {
      const config = await readJsonFile<McpProjectConfig>(this.configPath);
      return 'automatosx' in (config.mcpServers ?? {});
    } catch {
      return false;
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
