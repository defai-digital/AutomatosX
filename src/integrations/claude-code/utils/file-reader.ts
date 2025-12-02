/**
 * Claude Code Integration - File Reader Utilities
 *
 * Provides utilities for reading and writing Claude Code configuration files.
 *
 * @module integrations/claude-code/utils/file-reader
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { ClaudeCodeError, ClaudeCodeErrorType } from '../types.js';

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
