/**
 * .mcp.json Generator
 *
 * Generates the team-shared .mcp.json at the project root.
 * This file is committable and tells Claude Code how to reach the
 * AutomatosX MCP server without per-user registration.
 */

import { join } from 'node:path';
import type { MCPManifest } from './types.js';
import { fileExists, readJsonFile, writeJsonFile } from './utils/file-utils.js';

const AUTOMATOSX_SERVER_NAME = 'automatosx';

export class McpProjectConfigGenerator {
  private mcpJsonPath: string;

  constructor(projectDir: string) {
    this.mcpJsonPath = join(projectDir, '.mcp.json');
  }

  /** Generate or merge .mcp.json. Never removes existing mcpServers entries. */
  async generate(): Promise<void> {
    let existing: MCPManifest = {};

    if (await fileExists(this.mcpJsonPath)) {
      try {
        existing = await readJsonFile<MCPManifest>(this.mcpJsonPath);
      } catch {
        existing = {};
      }
    }

    const mcpServers = existing.mcpServers ?? {};

    // Only add if not already present
    if (!mcpServers[AUTOMATOSX_SERVER_NAME]) {
      mcpServers[AUTOMATOSX_SERVER_NAME] = {
        type: 'stdio',
        command: 'ax',
        args: ['mcp', 'server'],
        env: { AUTOMATOSX_LOG_LEVEL: 'warn' },
      };
    }

    await writeJsonFile(this.mcpJsonPath, {
      ...existing,
      mcpServers,
    });
  }

  /** Returns true if the automatosx key is present in .mcp.json */
  async isGenerated(): Promise<boolean> {
    if (!(await fileExists(this.mcpJsonPath))) return false;
    try {
      const config = await readJsonFile<MCPManifest>(this.mcpJsonPath);
      return !!config.mcpServers?.[AUTOMATOSX_SERVER_NAME];
    } catch {
      return false;
    }
  }
}
