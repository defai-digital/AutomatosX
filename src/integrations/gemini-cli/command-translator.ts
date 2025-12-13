/**
 * Gemini CLI Integration - Command Translator
 *
 * Bidirectional translation between Gemini CLI TOML commands
 * and AutomatosX markdown abilities.
 *
 * @module integrations/gemini-cli/command-translator
 */

import { readFile, writeFile, readdir, mkdir, realpath, stat } from 'fs/promises';
import { join, basename, extname, dirname, relative, sep } from 'path';
import { parse as parseToml } from '@iarna/toml';
import type { TomlCommand, CommandInfo, TranslationOptions } from './types.js';
import { GeminiCLIError, GeminiCLIErrorType } from './types.js';
import { validateTomlCommand } from './utils/validation.js';
import {
  getUserCommandsPath,
  getProjectCommandsPath,
  fileExists,
} from './utils/file-reader.js';

/**
 * Maximum allowed size for TOML files (1MB)
 * Prevents DoS attacks from extremely large files
 */
const MAX_TOML_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Command Translator
 *
 * Provides bidirectional translation between Gemini CLI TOML commands
 * and AutomatosX markdown abilities.
 */
export class CommandTranslator {
  /**
   * Convert Gemini CLI .toml command to AutomatosX ability
   *
   * @param tomlPath - Path to .toml file
   * @param outputPath - Path for output .md file
   * @param options - Translation options
   * @throws {GeminiCLIError} If conversion fails
   */
  async tomlToAbility(
    tomlPath: string,
    outputPath: string,
    options: TranslationOptions = {}
  ): Promise<void> {
    const { validate = true, overwrite = false, includeTimestamp = true } = options;

    // Check if output exists
    if (!overwrite && (await fileExists(outputPath))) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.FILE_ERROR,
        `Output file already exists: ${outputPath}. Use overwrite option to replace.`,
        { path: outputPath }
      );
    }

    try {
      // Check file size to prevent DoS
      const fileStats = await stat(tomlPath);
      if (fileStats.size > MAX_TOML_FILE_SIZE) {
        throw new GeminiCLIError(
          GeminiCLIErrorType.FILE_ERROR,
          `TOML file exceeds maximum allowed size (${MAX_TOML_FILE_SIZE} bytes): ${tomlPath}`,
          { path: tomlPath, size: fileStats.size, maxSize: MAX_TOML_FILE_SIZE }
        );
      }

      // Read and parse .toml file
      const content = await readFile(tomlPath, 'utf-8');
      const command = parseToml(content) as unknown as TomlCommand;

      // Validate if requested
      if (validate) {
        const commandName = basename(tomlPath, '.toml');
        const validation = validateTomlCommand(command, commandName);
        if (!validation.valid) {
          throw new GeminiCLIError(
            GeminiCLIErrorType.VALIDATION_ERROR,
            `TOML command validation failed: ${validation.errors.join(', ')}`,
            { path: tomlPath, errors: validation.errors }
          );
        }
      }

      // Extract command name from path
      const commandName = basename(tomlPath, '.toml');

      // Convert to Markdown ability format
      const abilityContent = this.generateAbilityMarkdown(commandName, command, includeTimestamp);

      // Ensure output directory exists
      const outputDir = dirname(outputPath);
      await mkdir(outputDir, { recursive: true });

      // Write ability file
      await writeFile(outputPath, abilityContent, 'utf-8');
    } catch (error) {
      if (error instanceof GeminiCLIError) {
        throw error;
      }

      throw new GeminiCLIError(
        GeminiCLIErrorType.CONVERSION_ERROR,
        `Failed to convert TOML to ability: ${tomlPath}`,
        { path: tomlPath, originalError: error }
      );
    }
  }

  /**
   * Convert AutomatosX ability to Gemini CLI .toml command
   *
   * @param abilityPath - Path to .md ability file
   * @param outputPath - Path for output .toml file
   * @param options - Translation options
   * @throws {GeminiCLIError} If conversion fails
   */
  async abilityToToml(
    abilityPath: string,
    outputPath: string,
    options: TranslationOptions = {}
  ): Promise<void> {
    const { overwrite = false } = options;

    // Check if output exists
    if (!overwrite && (await fileExists(outputPath))) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.FILE_ERROR,
        `Output file already exists: ${outputPath}. Use overwrite option to replace.`,
        { path: outputPath }
      );
    }

    try {
      // Read ability file
      const content = await readFile(abilityPath, 'utf-8');

      // Parse markdown structure
      const { description, instructions } =
        this.parseAbilityMarkdown(content);

      // Generate .toml content
      const tomlContent = this.generateTomlContent(description, instructions);

      // Ensure output directory exists
      const outputDir = dirname(outputPath);
      await mkdir(outputDir, { recursive: true });

      // Write .toml file
      await writeFile(outputPath, tomlContent, 'utf-8');
    } catch (error) {
      if (error instanceof GeminiCLIError) {
        throw error;
      }

      throw new GeminiCLIError(
        GeminiCLIErrorType.CONVERSION_ERROR,
        `Failed to convert ability to TOML: ${abilityPath}`,
        { path: abilityPath, originalError: error }
      );
    }
  }

  /**
   * Scan for all Gemini CLI commands
   *
   * @param basePath - Base directory to scan (defaults to user commands)
   * @param includeProjectCommands - Also scan project commands
   * @returns Array of discovered commands
   */
  async scanGeminiCommands(
    basePath?: string,
    includeProjectCommands = false
  ): Promise<CommandInfo[]> {
    const commands: CommandInfo[] = [];
    const paths: string[] = [];

    // Determine which paths to scan
    if (basePath) {
      paths.push(basePath);
    } else {
      paths.push(getUserCommandsPath());
      if (includeProjectCommands) {
        paths.push(getProjectCommandsPath());
      }
    }

    // Scan each path
    for (const path of paths) {
      const discovered = await this.scanDirectory(path);
      commands.push(...discovered);
    }

    return commands;
  }

  /**
   * Import a Gemini CLI command as an AutomatosX ability
   *
   * @param commandName - Command name to import
   * @param outputDir - Directory for output ability file
   * @param options - Translation options
   * @returns Path to created ability file
   * @throws {GeminiCLIError} If command not found or import fails
   */
  async importCommand(
    commandName: string,
    outputDir = '.automatosx/abilities',
    options: TranslationOptions = {}
  ): Promise<string> {
    // Find command
    const commands = await this.scanGeminiCommands(undefined, true);
    const command = commands.find((c) => c.name === commandName);

    if (!command) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.COMMAND_NOT_FOUND,
        `Command not found: ${commandName}`,
        { name: commandName, availableCommands: commands.map((c) => c.name) }
      );
    }

    // Generate output path
    const safeName = commandName.replace(/:/g, '-');
    const outputPath = join(outputDir, `gemini-${safeName}.md`);

    // Convert command
    await this.tomlToAbility(command.path, outputPath, options);

    return outputPath;
  }

  /**
   * Import multiple commands
   *
   * @param commandNames - Array of command names to import
   * @param outputDir - Directory for output ability files
   * @param options - Translation options
   * @returns Array of created ability file paths
   */
  async importCommands(
    commandNames: string[],
    outputDir = '.automatosx/abilities',
    options: TranslationOptions = {}
  ): Promise<string[]> {
    const results: string[] = [];

    for (const name of commandNames) {
      try {
        const path = await this.importCommand(name, outputDir, options);
        results.push(path);
      } catch (error) {
        if (error instanceof GeminiCLIError) {
          // Continue with other commands
          console.error(`Failed to import ${name}: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * List all available Gemini CLI commands
   *
   * @param includeProjectCommands - Also include project-level commands
   * @returns Array of command names
   */
  async listCommands(includeProjectCommands = false): Promise<string[]> {
    const commands = await this.scanGeminiCommands(
      undefined,
      includeProjectCommands
    );
    return commands.map((c) => c.name);
  }

  /**
   * Get command info by name
   *
   * @param commandName - Command name to find
   * @param includeProjectCommands - Also search project commands
   * @returns Command info or undefined if not found
   */
  async getCommand(
    commandName: string,
    includeProjectCommands = false
  ): Promise<CommandInfo | undefined> {
    const commands = await this.scanGeminiCommands(
      undefined,
      includeProjectCommands
    );
    return commands.find((c) => c.name === commandName);
  }

  // Private helper methods

  /**
   * Scan a directory for .toml command files
   *
   * @param dir - Directory to scan
   * @param namespace - Current namespace (for recursive calls)
   * @param depth - Current recursion depth
   * @param baseDir - Base directory for path validation (prevents traversal)
   * @returns Array of discovered commands
   * @private
   */
  private async scanDirectory(
    dir: string,
    namespace?: string,
    depth = 0,
    baseDir?: string
  ): Promise<CommandInfo[]> {
    const commands: CommandInfo[] = [];

    // Set base directory on first call
    if (baseDir === undefined) {
      try {
        baseDir = await realpath(dir);
      } catch {
        // Directory doesn't exist or not accessible
        return commands;
      }
    }

    // Limit recursion depth to prevent DoS
    const MAX_DEPTH = 3;
    if (depth >= MAX_DEPTH) {
      console.warn(
        `[Security] Maximum recursion depth (${MAX_DEPTH}) reached at: ${dir}`
      );
      return commands;
    }

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Resolve real path to handle symbolic links
        let realPath: string;
        try {
          realPath = await realpath(fullPath);
        } catch {
          // Skip if can't resolve path
          console.warn(`[Security] Cannot resolve path: ${fullPath}`);
          continue;
        }

        // Validate that resolved path is within base directory
        const relativePath = relative(baseDir, realPath);
        if (relativePath.startsWith('..') || relativePath.startsWith(sep)) {
          console.warn(
            `[Security] Path traversal detected: ${fullPath} -> ${realPath}`
          );
          continue;
        }

        if (entry.isDirectory()) {
          // Recurse into subdirectory (namespace)
          const subCommands = await this.scanDirectory(
            realPath,
            entry.name,
            depth + 1,
            baseDir
          );
          commands.push(...subCommands);
        } else if (entry.isFile() && extname(entry.name) === '.toml') {
          const name = basename(entry.name, '.toml');
          const commandName = namespace ? `${namespace}:${name}` : name;

          try {
            // Check file size before reading
            const fileStats = await stat(realPath);
            if (fileStats.size > MAX_TOML_FILE_SIZE) {
              console.warn(
                `[Security] TOML file exceeds maximum size (${MAX_TOML_FILE_SIZE} bytes): ${realPath}`
              );
              continue;
            }

            // Read description from .toml
            const content = await readFile(realPath, 'utf-8');
            const parsed = parseToml(content) as unknown as TomlCommand;

            commands.push({
              name: commandName,
              path: realPath,
              description: parsed.description || 'No description',
              namespace,
            });
          } catch (error) {
            // Skip files that can't be parsed
            console.error(`Failed to parse ${realPath}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } catch {
      // Directory may not exist or not be accessible
      // Return empty array
    }

    return commands;
  }

  /**
   * Escape markdown special characters to prevent injection
   *
   * @param text - Text to escape
   * @returns Escaped text safe for markdown
   * @private
   */
  private escapeMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Generate AutomatosX ability markdown from TOML command
   *
   * @param name - Command name
   * @param command - Parsed TOML command
   * @param includeTimestamp - Whether to include generation timestamp (default: true)
   * @returns Markdown content
   * @private
   */
  private generateAbilityMarkdown(
    name: string,
    command: TomlCommand,
    includeTimestamp = true
  ): string {
    // Escape description to prevent markdown injection
    const safeDescription = this.escapeMarkdown(command.description);
    const safeName = this.escapeMarkdown(name);

    // Replace {{args}} with {USER_INPUT}
    const prompt = command.prompt.replace(/\{\{args\}\}/g, '{USER_INPUT}');

    // Build timestamp line conditionally
    const timestampLine = includeTimestamp
      ? `- Generated on ${new Date().toISOString()}\n`
      : '';

    return `# ${safeDescription}

## Objective
${safeDescription}

## Instructions
${prompt}

## Expected Output
Clear, actionable results based on the user's request.

## Notes
- Imported from Gemini CLI command: /${safeName}
- Original placeholder {{args}} mapped to {USER_INPUT}
${timestampLine}
## Source
Gemini CLI custom slash command
`;
  }

  /**
   * Parse AutomatosX ability markdown
   *
   * Uses safe string splitting instead of regex to avoid ReDoS attacks.
   *
   * @param content - Markdown content
   * @returns Parsed description and instructions
   * @private
   */
  private parseAbilityMarkdown(content: string): {
    description: string;
    instructions: string;
  } {
    // Split by section headers (safer than regex for large files)
    const sections = content.split(/\n##\s+/);
    let objectiveText = '';
    let instructionsText = '';

    for (const section of sections) {
      const lines = section.split('\n');
      const header = lines[0]?.trim().toLowerCase();

      if (!header) continue;

      if (header.startsWith('objective')) {
        // Extract content after header
        objectiveText = lines.slice(1).join('\n').trim();
      } else if (header.startsWith('instructions')) {
        // Extract content after header, stop at next section
        const contentLines: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line && line.trim().startsWith('##')) {
            break; // Stop at next section
          }
          if (line !== undefined) {
            contentLines.push(line);
          }
        }
        instructionsText = contentLines.join('\n').trim();
      }
    }

    if (!objectiveText) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.CONVERSION_ERROR,
        'Unable to parse ability markdown: no Objective section found',
        { content: content.substring(0, 200) }
      );
    }

    if (!instructionsText) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.CONVERSION_ERROR,
        'Unable to parse ability markdown: no Instructions section found',
        { content: content.substring(0, 200) }
      );
    }

    // Extract first non-empty line from Objective as description
    const descriptionLines = objectiveText.split('\n').filter(line => line.trim());
    const description = descriptionLines[0] ?? objectiveText;

    return {
      description: description.trim(),
      instructions: instructionsText,
    };
  }

  /**
   * Generate TOML content from description and instructions
   *
   * @param description - Command description
   * @param instructions - Command instructions/prompt
   * @returns TOML content
   * @private
   */
  private generateTomlContent(
    description: string,
    instructions: string
  ): string {
    // Replace {USER_INPUT} with {{args}}
    const prompt = instructions.replace(/\{USER_INPUT\}/g, '{{args}}');

    // Escape special characters in description
    const escapedDescription = description.replace(/"/g, '\\"');

    return `description = "${escapedDescription}"
prompt = """
${prompt}
"""
`;
  }
}

/**
 * Default CommandTranslator instance
 */
export const defaultTranslator = new CommandTranslator();
