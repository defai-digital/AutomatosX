/**
 * Gemini CLI Integration - Command Manager
 *
 * Handles discovery, reading, and installation of Gemini CLI custom commands.
 *
 * @module integrations/gemini-cli/command-manager
 */

import { readdir, copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { CommandInfo, CommandDiscoveryStats, ValidationResult } from './types.js';
import { GeminiCLIError, GeminiCLIErrorType } from './types.js';
import {
  getUserCommandsPath,
  getProjectCommandsPath,
  fileExists,
} from './utils/file-reader.js';
import { validateTomlCommand } from './utils/validation.js';

/**
 * Command Manager for Gemini CLI custom commands
 *
 * Handles discovery, reading, validation, and installation of
 * Gemini CLI custom commands (.toml files).
 */
export class CommandManager {
  /**
   * Install commands to project
   *
   * Copies command files from source directory to project .gemini/commands/
   *
   * @param projectDir - Project directory
   * @param sourceDir - Source directory containing command files
   * @param force - Overwrite existing files
   * @returns Number of commands installed
   */
  async installCommands(
    projectDir: string,
    sourceDir: string,
    force: boolean = false
  ): Promise<number> {
    try {
      // Ensure target directory exists
      const targetDir = getProjectCommandsPath();
      await mkdir(targetDir, { recursive: true });

      // Read source directory
      const entries = await readdir(sourceDir);
      let count = 0;

      for (const entry of entries) {
        // Only copy .toml files
        if (!entry.endsWith('.toml')) {
          continue;
        }

        const sourcePath = join(sourceDir, entry);
        const targetPath = join(targetDir, entry);

        // Check if target exists
        if (!force && (await fileExists(targetPath))) {
          console.warn(`Skipping ${entry} (already exists)`);
          continue;
        }

        // Copy file
        await copyFile(sourcePath, targetPath);
        count++;
      }

      return count;
    } catch (error) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.FILE_ERROR,
        'Failed to install commands',
        { projectDir, sourceDir, error }
      );
    }
  }

  /**
   * Discover all Gemini CLI commands
   *
   * @param projectDir - Project directory
   * @param includeGlobal - Include global commands
   * @returns List of discovered commands
   */
  async discoverCommands(
    projectDir?: string,
    includeGlobal: boolean = true
  ): Promise<CommandInfo[]> {
    const commands: CommandInfo[] = [];

    try {
      // Scan project commands
      if (projectDir) {
        const projectPath = getProjectCommandsPath();
        const projectCommands = await this.scanDirectory(projectPath);
        commands.push(...projectCommands);
      }

      // Scan global commands
      if (includeGlobal) {
        const globalPath = getUserCommandsPath();
        const globalCommands = await this.scanDirectory(globalPath);
        commands.push(...globalCommands);
      }

      return commands;
    } catch (error) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.FILE_ERROR,
        'Failed to discover commands',
        { error, projectDir }
      );
    }
  }

  /**
   * Scan a directory for command files
   *
   * @param dirPath - Directory to scan
   * @returns List of commands found in directory
   * @private
   */
  private async scanDirectory(dirPath: string): Promise<CommandInfo[]> {
    const commands: CommandInfo[] = [];

    // Check if directory exists
    const exists = await fileExists(dirPath);
    if (!exists) {
      return commands;
    }

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        // Only process .toml files
        if (!entry.endsWith('.toml')) {
          continue;
        }

        const filePath = join(dirPath, entry);
        const name = entry.replace(/\.toml$/, '');

        // Extract namespace if present (e.g., "git:commit" -> namespace: "git")
        let namespace: string | undefined;
        if (name.includes(':')) {
          const parts = name.split(':');
          namespace = parts[0];
        }

        commands.push({
          name,
          path: filePath,
          description: '', // Could read from file if needed
          namespace,
        });
      }
    } catch (error) {
      // Directory read failed, return empty array
      return commands;
    }

    return commands;
  }

  /**
   * Get command statistics
   *
   * @param projectDir - Project directory
   * @returns Command statistics
   */
  async getCommandStats(projectDir?: string): Promise<CommandDiscoveryStats> {
    const commands = await this.discoverCommands(projectDir, true);

    const stats: CommandDiscoveryStats = {
      total: commands.length,
      userScope: 0,
      projectScope: 0,
      byNamespace: {},
    };

    const userPath = getUserCommandsPath();
    const projectPath = projectDir ? getProjectCommandsPath() : '';

    for (const command of commands) {
      // Count by scope
      if (command.path.startsWith(userPath)) {
        stats.userScope++;
      } else if (projectPath && command.path.startsWith(projectPath)) {
        stats.projectScope++;
      }

      // Count by namespace
      if (command.namespace) {
        stats.byNamespace[command.namespace] =
          (stats.byNamespace[command.namespace] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * List all command names
   *
   * @param projectDir - Project directory
   * @returns List of command names
   */
  async listCommandNames(projectDir?: string): Promise<string[]> {
    const commands = await this.discoverCommands(projectDir, true);
    return commands.map(cmd => cmd.name);
  }

  /**
   * Count commands in project
   *
   * @param projectDir - Project directory
   * @returns Number of commands
   */
  async countCommands(projectDir: string): Promise<number> {
    try {
      const commandsDir = getProjectCommandsPath();
      const exists = await fileExists(commandsDir);

      if (!exists) {
        return 0;
      }

      const entries = await readdir(commandsDir);
      return entries.filter(entry => entry.endsWith('.toml')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Check if commands directory exists
   *
   * @param projectDir - Project directory
   * @returns True if commands directory exists
   */
  async hasCommandsDir(projectDir: string): Promise<boolean> {
    const commandsDir = getProjectCommandsPath();
    return fileExists(commandsDir);
  }
}

/**
 * Default CommandManager instance
 */
export const defaultCommandManager = new CommandManager();
