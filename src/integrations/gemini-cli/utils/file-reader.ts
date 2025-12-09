/**
 * Gemini CLI Integration - File Reader Utilities
 *
 * Safe file reading with validation and error handling.
 *
 * @module integrations/gemini-cli/utils/file-reader
 */

import {
  readFile,
  writeFile,
  access,
  mkdir,
  realpath,
  stat,
  rename,
  unlink,
} from 'fs/promises';
import { dirname, normalize, join, basename } from 'path';
import { homedir } from 'os';
import { constants } from 'fs';
import { GeminiCLIError, GeminiCLIErrorType } from '../types.js';

/**
 * Get allowed base paths for Gemini CLI configuration
 *
 * Returns paths dynamically to handle process.cwd() changes
 *
 * @returns Array of allowed base paths
 */
function getAllowedBasePaths(): string[] {
  return [
    join(homedir(), '.gemini'),
    join(process.cwd(), '.gemini'),
  ];
}

/**
 * Maximum allowed file size (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate that a file path is within allowed directories
 *
 * Resolves symbolic links to prevent bypass attempts.
 *
 * @param filePath - Path to validate
 * @throws {GeminiCLIError} If path is invalid or outside allowed directories
 */
export async function validatePath(filePath: string): Promise<void> {
  const normalized = normalize(filePath);

  // Check for directory traversal in raw path
  if (normalized.includes('..')) {
    throw new GeminiCLIError(
      GeminiCLIErrorType.INVALID_PATH,
      'Path contains directory traversal',
      { path: filePath }
    );
  }

  // Resolve symlinks to real path
  let realPath: string;
  try {
    realPath = await realpath(normalized);
  } catch (_error) {
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
    throw new GeminiCLIError(
      GeminiCLIErrorType.INVALID_PATH,
      'Path is outside allowed directories (after resolving symlinks)',
      { path: filePath, realPath, allowedPaths }
    );
  }
}

/**
 * Safely read a file with path validation and size limits
 *
 * @param filePath - Path to file
 * @returns File contents as string
 * @throws {GeminiCLIError} If file cannot be read, path is invalid, or file is too large
 */
export async function safeReadFile(filePath: string): Promise<string> {
  await validatePath(filePath);

  // Check file size before reading
  try {
    const fileStats = await stat(filePath);

    if (fileStats.size > MAX_FILE_SIZE) {
      throw new GeminiCLIError(
        GeminiCLIErrorType.FILE_ERROR,
        `File exceeds maximum allowed size (${MAX_FILE_SIZE} bytes): ${filePath}`,
        { path: filePath, size: fileStats.size, maxSize: MAX_FILE_SIZE }
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new GeminiCLIError(
        GeminiCLIErrorType.CONFIG_NOT_FOUND,
        `File not found: ${filePath}`,
        { path: filePath }
      );
    }
    // Re-throw our custom errors
    if (error instanceof GeminiCLIError) {
      throw error;
    }
    // Wrap other errors
    throw new GeminiCLIError(
      GeminiCLIErrorType.FILE_ERROR,
      `Failed to access file: ${filePath}`,
      { path: filePath, originalError: error }
    );
  }

  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new GeminiCLIError(
      GeminiCLIErrorType.FILE_ERROR,
      `Failed to read file: ${filePath}`,
      { path: filePath, originalError: error }
    );
  }
}

/**
 * Safely write a file with path validation and atomic operation
 *
 * Uses a temporary file and atomic rename to prevent partial writes.
 *
 * @param filePath - Path to file
 * @param content - Content to write
 * @throws {GeminiCLIError} If file cannot be written or path is invalid
 */
export async function safeWriteFile(
  filePath: string,
  content: string
): Promise<void> {
  await validatePath(filePath);

  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;

  try {
    // Ensure directory exists
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Write to temp file first
    await writeFile(tempPath, content, 'utf-8');

    // Atomic rename (replaces existing file)
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    throw new GeminiCLIError(
      GeminiCLIErrorType.FILE_ERROR,
      `Failed to write file: ${filePath}`,
      { path: filePath, originalError: error }
    );
  }
}

/**
 * File existence check result with detailed error information
 */
export interface FileExistsResult {
  exists: boolean;
  readable: boolean;
  error?: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'OTHER';
  errorCode?: string;
}

/**
 * Check if a file exists and is readable
 *
 * @param filePath - Path to check
 * @returns True if file exists and is readable
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check file existence with detailed error information
 *
 * Distinguishes between different error types for better error handling.
 *
 * @param filePath - Path to check
 * @returns Detailed result with error information
 */
export async function fileExistsDetailed(filePath: string): Promise<FileExistsResult> {
  try {
    await access(filePath, constants.R_OK);
    return { exists: true, readable: true };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return { exists: false, readable: false, error: 'NOT_FOUND', errorCode: code };
    }

    if (code === 'EACCES' || code === 'EPERM') {
      // File exists but not readable
      return { exists: true, readable: false, error: 'PERMISSION_DENIED', errorCode: code };
    }

    return { exists: false, readable: false, error: 'OTHER', errorCode: code };
  }
}

/**
 * Read JSON file safely with parsing
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON object
 * @throws {GeminiCLIError} If file cannot be read or parsed
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await safeReadFile(filePath);

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new GeminiCLIError(
      GeminiCLIErrorType.INVALID_CONFIG,
      `Invalid JSON in file: ${filePath}`,
      { path: filePath, originalError: error }
    );
  }
}

/**
 * Write JSON file safely with formatting
 *
 * @param filePath - Path to JSON file
 * @param data - Data to write
 * @throws {GeminiCLIError} If file cannot be written
 */
export async function writeJsonFile<T = unknown>(
  filePath: string,
  data: T
): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await safeWriteFile(filePath, content);
}

/**
 * Get user-level Gemini CLI config path
 *
 * @returns Path to user config
 */
export function getUserConfigPath(): string {
  return join(homedir(), '.gemini', 'settings.json');
}

/**
 * Get project-level Gemini CLI config path
 *
 * @returns Path to project config
 */
export function getProjectConfigPath(): string {
  return join(process.cwd(), '.gemini', 'settings.json');
}

/**
 * Get user-level commands directory
 *
 * @returns Path to user commands directory
 */
export function getUserCommandsPath(): string {
  return join(homedir(), '.gemini', 'commands');
}

/**
 * Get project-level commands directory
 *
 * @returns Path to project commands directory
 */
export function getProjectCommandsPath(): string {
  return join(process.cwd(), '.gemini', 'commands');
}
