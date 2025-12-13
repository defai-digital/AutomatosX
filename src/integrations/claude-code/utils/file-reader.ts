/**
 * Claude Code Integration - File Reader Utilities
 *
 * Provides utilities for reading and writing Claude Code configuration files.
 * Includes path validation to prevent directory traversal attacks.
 *
 * @module integrations/claude-code/utils/file-reader
 */

import { readFile, writeFile, access, realpath, stat } from 'fs/promises';
import { join, normalize, dirname, basename } from 'path';
import { homedir } from 'os';
import { ClaudeCodeError, ClaudeCodeErrorType } from '../types.js';

/**
 * Maximum allowed file size (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Get allowed base paths for Claude Code configuration
 *
 * Returns paths dynamically to handle process.cwd() changes.
 *
 * @returns Array of allowed base paths
 */
function getAllowedBasePaths(): string[] {
  return [
    join(homedir(), '.claude'),
    join(process.cwd(), '.claude'),
  ];
}

/**
 * Validate that a file path is within allowed directories
 *
 * Resolves symbolic links to prevent bypass attempts.
 * Prevents directory traversal attacks.
 *
 * @param filePath - Path to validate
 * @throws {ClaudeCodeError} If path is invalid or outside allowed directories
 */
export async function validatePath(filePath: string): Promise<void> {
  const normalized = normalize(filePath);

  // Check for directory traversal in raw path
  if (normalized.includes('..')) {
    throw new ClaudeCodeError(
      ClaudeCodeErrorType.VALIDATION_ERROR,
      'Path contains directory traversal',
      { path: filePath }
    );
  }

  // Resolve symlinks to real path
  let realPath: string;
  try {
    realPath = await realpath(normalized);
  } catch {
    // File doesn't exist yet - validate parent directory
    const parent = dirname(normalized);
    try {
      const parentReal = await realpath(parent);
      realPath = join(parentReal, basename(normalized));
    } catch {
      // Parent doesn't exist - check against normalized path
      realPath = normalized;
    }
  }

  // Check if real path is within allowed directories
  const allowedPaths = getAllowedBasePaths();
  const isAllowed = allowedPaths.some((basePath) =>
    realPath.startsWith(normalize(basePath))
  );

  if (!isAllowed) {
    throw new ClaudeCodeError(
      ClaudeCodeErrorType.VALIDATION_ERROR,
      'Path is outside allowed directories',
      { path: filePath, realPath, allowedPaths }
    );
  }
}

/**
 * Safely read a file with path validation and size limits
 *
 * @param filePath - Path to file
 * @returns File contents as string
 * @throws {ClaudeCodeError} If file cannot be read, path is invalid, or file is too large
 */
export async function safeReadFile(filePath: string): Promise<string> {
  await validatePath(filePath);

  // Check file size before reading
  try {
    const fileStats = await stat(filePath);

    if (fileStats.size > MAX_FILE_SIZE) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        `File exceeds maximum allowed size (${MAX_FILE_SIZE} bytes): ${filePath}`,
        { path: filePath, size: fileStats.size, maxSize: MAX_FILE_SIZE }
      );
    }
  } catch (error) {
    if (error instanceof ClaudeCodeError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.FILE_ERROR,
        `File not found: ${filePath}`,
        { path: filePath }
      );
    }
    throw new ClaudeCodeError(
      ClaudeCodeErrorType.FILE_ERROR,
      `Failed to check file: ${filePath}`,
      { path: filePath, error }
    );
  }

  return readFile(filePath, 'utf-8');
}

/**
 * Get path to global Claude Code configuration
 *
 * @returns Path to ~/.claude/config.json
 */
export function getGlobalConfigPath(): string {
  return join(homedir(), '.claude', 'config.json');
}

/**
 * Get path to project Claude Code configuration
 *
 * @param projectDir - Project directory (defaults to cwd)
 * @returns Path to .claude/config.json
 */
export function getProjectConfigPath(projectDir?: string): string {
  const baseDir = projectDir ?? process.cwd();
  return join(baseDir, '.claude', 'config.json');
}

/**
 * Get path to global Claude Code commands directory
 *
 * @returns Path to ~/.claude/commands/
 */
export function getGlobalCommandsPath(): string {
  return join(homedir(), '.claude', 'commands');
}

/**
 * Get path to project Claude Code commands directory
 *
 * @param projectDir - Project directory (defaults to cwd)
 * @returns Path to .claude/commands/
 */
export function getProjectCommandsPath(projectDir?: string): string {
  const baseDir = projectDir ?? process.cwd();
  return join(baseDir, '.claude', 'commands');
}

/**
 * Get path to project Claude Code MCP directory
 *
 * @param projectDir - Project directory (defaults to cwd)
 * @returns Path to .claude/mcp/
 */
export function getProjectMCPPath(projectDir?: string): string {
  const baseDir = projectDir ?? process.cwd();
  return join(baseDir, '.claude', 'mcp');
}

/**
 * Check if a file exists
 *
 * @param path - File path to check
 * @returns True if file exists and is accessible
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file
 *
 * @param path - Path to JSON file
 * @returns Parsed JSON content
 * @throws {ClaudeCodeError} If file cannot be read or parsed
 */
export async function readJsonFile<T = unknown>(path: string): Promise<T> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ClaudeCodeError(
        ClaudeCodeErrorType.INVALID_CONFIG,
        `Invalid JSON in file: ${path}`,
        { path, error }
      );
    }

    throw new ClaudeCodeError(
      ClaudeCodeErrorType.FILE_ERROR,
      `Failed to read file: ${path}`,
      { path, error }
    );
  }
}

/**
 * Write JSON content to a file
 *
 * @param path - Path to write to
 * @param data - Data to write
 * @param pretty - Pretty-print JSON (default: true)
 * @throws {ClaudeCodeError} If file cannot be written
 */
export async function writeJsonFile<T = unknown>(
  path: string,
  data: T,
  pretty: boolean = true
): Promise<void> {
  try {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await writeFile(path, content, 'utf-8');
  } catch (error) {
    throw new ClaudeCodeError(
      ClaudeCodeErrorType.FILE_ERROR,
      `Failed to write file: ${path}`,
      { path, error }
    );
  }
}

/**
 * Read a markdown file
 *
 * @param path - Path to markdown file
 * @returns File content
 * @throws {ClaudeCodeError} If file cannot be read
 */
export async function readMarkdownFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    throw new ClaudeCodeError(
      ClaudeCodeErrorType.FILE_ERROR,
      `Failed to read markdown file: ${path}`,
      { path, error }
    );
  }
}

/**
 * Extract description from markdown content
 *
 * Extracts the first H1 heading or the first paragraph.
 *
 * @param content - Markdown content
 * @returns Extracted description or empty string
 */
export function extractMarkdownDescription(content: string): string {
  // Try to find first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match?.[1]) {
    return h1Match[1].trim();
  }

  // Try to find first non-empty paragraph
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
      return trimmed;
    }
  }

  return '';
}
