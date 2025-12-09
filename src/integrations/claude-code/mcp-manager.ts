/**
 * Claude Code Integration - MCP Manager
 *
 * Handles management of MCP (Model Context Protocol) server configurations.
 *
 * @module integrations/claude-code/mcp-manager
 */

import { readdir, copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type {
  MCPManifest,
  ClaudeMCPServer,
  MCPDiscoveryStats,
  ValidationResult,
} from './types.js';
import { ClaudeCodeError, ClaudeCodeErrorType } from './types.js';
import {
  getProjectMCPPath,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from './utils/file-reader.js';
import { validateMCPManifest, validateMCPServer } from './utils/validation.js';

/**
 * MCP Manager for Claude Code
 *
 * Handles reading, validation, and installation of MCP server configurations.
 */
export class MCPManager {
  /**
   * Read MCP manifest from a file
   *
   * @param path - Path to manifest file
   * @returns Parsed manifest
   * @throws {ClaudeCodeError} If file cannot be read or is invalid
   */
  async readManifest(path: string): Promise<MCPManifest> {
    try {
      const manifest = await readJsonFile<MCPManifest>(path);
      return manifest;
    } catch (error) {
      if (error instanceof ClaudeCodeError) {
        throw error;
      }

      throw new ClaudeCodeError(
        ClaudeCodeErrorType.MCP_ERROR,
        `Failed to read MCP manifest: ${path}`,
        { path, error }
      );
    }
  }

  /**
   * Write MCP manifest to a file
   *
   * @param path - Path to write to
   * @param manifest - Manifest to write
   * @throws {ClaudeCodeError} If file cannot be written
   */
  async writeManifest(path: string, manifest: MCPManifest): Promise<void> {
    try {
      await writeJsonFile(path, manifest);
    } catch (error) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.MCP_ERROR,
        `Failed to write MCP manifest: ${path}`,
        { path, error }
      );
    }
  }

  /**
   * Install MCP configuration to project
   *
   * Copies MCP manifest files from source directory to project .claude/mcp/
   *
   * @param projectDir - Project directory
   * @param sourceDir - Source directory containing MCP manifests
   * @param force - Overwrite existing files
   * @returns Number of manifest files installed
   */
  async installMCPConfig(
    projectDir: string,
    sourceDir: string,
    force: boolean = false
  ): Promise<number> {
    try {
      // Ensure target directory exists
      const targetDir = getProjectMCPPath(projectDir);
      await mkdir(targetDir, { recursive: true });

      // Read source directory
      const entries = await readdir(sourceDir);
      let count = 0;

      for (const entry of entries) {
        // Only copy .json files
        if (!entry.endsWith('.json')) {
          continue;
        }

        const sourcePath = join(sourceDir, entry);
        const targetPath = join(targetDir, entry);

        // Check if target exists
        if (!force && (await fileExists(targetPath))) {
          console.warn(`Skipping ${entry} (already exists)`);
          continue;
        }

        // Validate manifest before copying
        try {
          const manifest = await this.readManifest(sourcePath);
          const validation = this.validateManifest(manifest);

          if (!validation.valid) {
            console.warn(`Skipping ${entry} (validation failed):`, validation.errors);
            continue;
          }

          if (validation.warnings.length > 0) {
            console.warn(`Warnings for ${entry}:`, validation.warnings);
          }
        } catch (error) {
          console.warn(`Skipping ${entry} (cannot read):`, error);
          continue;
        }

        // Copy file
        await copyFile(sourcePath, targetPath);
        count++;
      }

      return count;
    } catch (error) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.MCP_ERROR,
        'Failed to install MCP configuration',
        { projectDir, sourceDir, error }
      );
    }
  }

  /**
   * Validate MCP manifest
   *
   * @param manifest - Manifest to validate
   * @returns Validation result
   */
  validateManifest(manifest: MCPManifest): ValidationResult {
    return validateMCPManifest(manifest);
  }

  /**
   * Validate MCP server configuration
   *
   * @param server - Server configuration to validate
   * @param name - Server name
   * @returns Validation result
   */
  validateServer(server: ClaudeMCPServer, name: string): ValidationResult {
    return validateMCPServer(server, name);
  }

  /**
   * List all MCP servers in project
   *
   * @param projectDir - Project directory
   * @returns List of MCP servers
   */
  async listServers(projectDir: string): Promise<Array<{
    name: string;
    server: ClaudeMCPServer;
    source: string;
  }>> {
    const servers: Array<{
      name: string;
      server: ClaudeMCPServer;
      source: string;
    }> = [];

    try {
      const mcpDir = getProjectMCPPath(projectDir);
      const exists = await fileExists(mcpDir);

      if (!exists) {
        return servers;
      }

      const entries = await readdir(mcpDir);

      for (const entry of entries) {
        if (!entry.endsWith('.json')) {
          continue;
        }

        try {
          const manifestPath = join(mcpDir, entry);
          const manifest = await this.readManifest(manifestPath);

          if (manifest.mcpServers) {
            for (const [name, server] of Object.entries(manifest.mcpServers)) {
              servers.push({
                name,
                server,
                source: entry,
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to read ${entry}:`, error);
        }
      }
    } catch (error) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.MCP_ERROR,
        'Failed to list MCP servers',
        { projectDir, error }
      );
    }

    return servers;
  }

  /**
   * Get MCP discovery statistics
   *
   * @param projectDir - Project directory
   * @returns MCP statistics
   */
  async getMCPStats(projectDir: string): Promise<MCPDiscoveryStats> {
    const servers = await this.listServers(projectDir);

    const stats: MCPDiscoveryStats = {
      total: servers.length,
      projectScope: servers.length,
      globalScope: 0, // Claude Code doesn't use global MCP config
      byTransport: {},
    };

    // Count by transport (all are stdio for Claude Code)
    for (const _server of servers) {
      const transport = 'stdio'; // Claude Code uses stdio by default
      stats.byTransport[transport] = (stats.byTransport[transport] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get a specific MCP server by name
   *
   * @param projectDir - Project directory
   * @param serverName - Server name to find
   * @returns Server configuration or undefined
   */
  async getServer(
    projectDir: string,
    serverName: string
  ): Promise<ClaudeMCPServer | undefined> {
    const servers = await this.listServers(projectDir);
    const found = servers.find(s => s.name === serverName);
    return found?.server;
  }

  /**
   * Check if MCP directory exists in project
   *
   * @param projectDir - Project directory
   * @returns True if MCP directory exists
   */
  async hasMCPDir(projectDir: string): Promise<boolean> {
    const mcpDir = getProjectMCPPath(projectDir);
    return fileExists(mcpDir);
  }

  /**
   * Count MCP manifest files in project
   *
   * @param projectDir - Project directory
   * @returns Number of manifest files
   */
  async countManifests(projectDir: string): Promise<number> {
    try {
      const mcpDir = getProjectMCPPath(projectDir);
      const exists = await fileExists(mcpDir);

      if (!exists) {
        return 0;
      }

      const entries = await readdir(mcpDir);
      return entries.filter(entry => entry.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }
}

/**
 * Default MCPManager instance
 */
export const defaultMCPManager = new MCPManager();
