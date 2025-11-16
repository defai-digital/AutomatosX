/**
 * Claude Code Integration - Command Manager
 *
 * Handles discovery, reading, and installation of Claude Code slash commands.
 *
 * @module integrations/claude-code/command-manager
 */

import { readdir, stat, copyFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import type {
  ClaudeCommand,
  CommandDiscoveryStats,
  ScanCommandsOptions,
  ValidationResult,
} from './types.js';
import { ClaudeCodeError, ClaudeCodeErrorType } from './types.js';
import {
  getGlobalCommandsPath,
  getProjectCommandsPath,
  fileExists,
  readMarkdownFile,
  extractMarkdownDescription,
} from './utils/file-reader.js';
import { validateCommand } from './utils/validation.js';

/**
 * Command Manager for Claude Code slash commands
 *
 * Handles discovery, reading, validation, and installation of
 * Claude Code slash commands (.md files).
 */
export class CommandManager {
  /**
   * Discover all Claude Code commands
   *
   * @param options - Scan options
   * @returns List of discovered commands
   */
  async discoverCommands(options?: ScanCommandsOptions): Promise<ClaudeCommand[]> {
    const commands: ClaudeCommand[] = [];
    const basePath = options?.basePath;
    const includeGlobal = options?.includeGlobal ?? true;
    const filter = options?.filter;

    try {
      // Scan project commands
      if (basePath) {
        const projectPath = getProjectCommandsPath(basePath);
        const projectCommands = await this.scanDirectory(projectPath, filter);
        commands.push(...projectCommands);
      }

      // Scan global commands
      if (includeGlobal) {
        const globalPath = getGlobalCommandsPath();
        const globalCommands = await this.scanDirectory(globalPath, filter);
        commands.push(...globalCommands);
      }

      return commands;
    } catch (error) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        'Failed to discover commands',
        { error, options }
      );
    }
  }

  /**
   * Scan a directory for command files
   *
   * @param dirPath - Directory to scan
   * @param filter - Optional filter pattern
   * @returns List of commands found in directory
   * @private
   */
  private async scanDirectory(
    dirPath: string,
    filter?: string
  ): Promise<ClaudeCommand[]> {
    const commands: ClaudeCommand[] = [];

    // Check if directory exists
    const exists = await fileExists(dirPath);
    if (!exists) {
      return commands;
    }

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        // Only process .md files
        if (!entry.endsWith('.md')) {
          continue;
        }

        // Apply filter if specified
        if (filter) {
          const commandName = entry.replace(/\.md$/, '');
          if (!this.matchesFilter(commandName, filter)) {
            continue;
          }
        }

        const filePath = join(dirPath, entry);
        try {
          const command = await this.readCommand(filePath);
          commands.push(command);
        } catch (error) {
          // Log error but continue with other commands
          console.warn(`Failed to read command ${entry}:`, error);
        }
      }
    } catch (error) {
      // Directory read failed, return empty array
      return commands;
    }

    return commands;
  }

  /**
   * Check if a command name matches a filter pattern
   *
   * @param name - Command name
   * @param filter - Filter pattern (supports * wildcard)
   * @returns True if matches
   * @private
   */
  private matchesFilter(name: string, filter: string): boolean {
    if (filter === '*') {
      return true;
    }

    // Convert wildcard pattern to regex
    const pattern = filter
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${pattern}$`);

    return regex.test(name);
  }

  /**
   * Read a specific command by name
   *
   * Searches in project commands first, then global commands.
   *
   * @param name - Command name (without .md extension)
   * @param projectDir - Project directory (defaults to cwd)
   * @returns Command object
   * @throws {ClaudeCodeError} If command not found
   */
  async readCommandByName(
    name: string,
    projectDir?: string
  ): Promise<ClaudeCommand> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;

    // Try project commands first
    if (projectDir) {
      const projectPath = join(getProjectCommandsPath(projectDir), fileName);
      if (await fileExists(projectPath)) {
        return this.readCommand(projectPath);
      }
    }

    // Try global commands
    const globalPath = join(getGlobalCommandsPath(), fileName);
    if (await fileExists(globalPath)) {
      return this.readCommand(globalPath);
    }

    throw new ClaudeCodeError(
      ClaudeCodeErrorType.COMMAND_NOT_FOUND,
      `Command not found: ${name}`,
      { name, projectDir }
    );
  }

  /**
   * Read a command from a file path
   *
   * @param filePath - Path to command file
   * @returns Command object
   * @throws {ClaudeCodeError} If file cannot be read
   */
  async readCommand(filePath: string): Promise<ClaudeCommand> {
    try {
      // Read file content
      const content = await readMarkdownFile(filePath);

      // Extract command name from filename
      const fileName = basename(filePath);
      const name = fileName.replace(/\.md$/, '');

      // Extract description from content
      const description = extractMarkdownDescription(content);

      // Get file stats
      const stats = await stat(filePath);

      return {
        name,
        path: filePath,
        description,
        content,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      if (error instanceof ClaudeCodeError) {
        throw error;
      }

      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        `Failed to read command file: ${filePath}`,
        { filePath, error }
      );
    }
  }

  /**
   * Install commands to project
   *
   * Copies command files from source directory to project .claude/commands/
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
      const targetDir = getProjectCommandsPath(projectDir);
      await mkdir(targetDir, { recursive: true });

      // Read source directory
      const entries = await readdir(sourceDir);
      let count = 0;

      for (const entry of entries) {
        // Only copy .md files
        if (!entry.endsWith('.md')) {
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
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        'Failed to install commands',
        { projectDir, sourceDir, error }
      );
    }
  }

  /**
   * Validate a command
   *
   * @param command - Command to validate
   * @returns Validation result
   */
  validateCommand(command: ClaudeCommand): ValidationResult {
    return validateCommand(command);
  }

  /**
   * Get command statistics
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @returns Command statistics
   */
  async getCommandStats(projectDir?: string): Promise<CommandDiscoveryStats> {
    const commands = await this.discoverCommands({
      basePath: projectDir,
      includeGlobal: true,
    });

    const stats: CommandDiscoveryStats = {
      total: commands.length,
      byPrefix: {},
      projectScope: 0,
      globalScope: 0,
    };

    const projectPath = projectDir ? getProjectCommandsPath(projectDir) : '';
    const globalPath = getGlobalCommandsPath();

    for (const command of commands) {
      // Count by scope
      if (projectPath && command.path.startsWith(projectPath)) {
        stats.projectScope++;
      } else if (command.path.startsWith(globalPath)) {
        stats.globalScope++;
      }

      // Count by prefix (e.g., "ax" from "ax-agent")
      const prefix = command.name.split('-')[0];
      if (prefix) {
        stats.byPrefix[prefix] = (stats.byPrefix[prefix] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * List all command names
   *
   * @param projectDir - Project directory (defaults to cwd)
   * @returns List of command names
   */
  async listCommandNames(projectDir?: string): Promise<string[]> {
    const commands = await this.discoverCommands({
      basePath: projectDir,
      includeGlobal: true,
    });

    return commands.map(cmd => cmd.name);
  }
}

/**
 * Default CommandManager instance
 */
export const defaultCommandManager = new CommandManager();
