/**
 * Test helper for creating temporary directories
 *
 * Provides utilities for creating and cleaning up temporary directories
 * in tests, with cross-platform path handling
 *
 * @module tests/helpers/temp-dir
 * @since 5.7.0
 */

import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { joinPath, normalizePath } from '../../src/shared/validation/path-utils.js';

/**
 * Options for creating a temporary directory
 */
export interface TempDirOptions {
  /**
   * Prefix for the temporary directory name
   * @default 'automatosx-test-'
   */
  prefix?: string;

  /**
   * Whether to automatically clean up on process exit
   * @default true
   */
  autoCleanup?: boolean;

  /**
   * Base directory for temporary files
   * @default os.tmpdir()
   */
  baseDir?: string;
}

/**
 * Temporary directory instance
 */
export interface TempDirectory {
  /**
   * Absolute path to the temporary directory
   */
  path: string;

  /**
   * Normalized path (forward slashes) for display
   */
  normalizedPath: string;

  /**
   * Create a subdirectory within the temp directory
   */
  createSubdir(name: string): Promise<string>;

  /**
   * Create a file within the temp directory
   */
  createFile(filename: string, content: string): Promise<string>;

  /**
   * Read a file from the temp directory
   */
  readFile(filename: string): Promise<string>;

  /**
   * Get the full path to a file/directory within the temp directory
   */
  resolve(...segments: string[]): string;

  /**
   * Clean up the temporary directory
   */
  cleanup(): Promise<void>;
}

// Track all temporary directories for cleanup
const tempDirs = new Set<string>();

// Register cleanup handler
let cleanupRegistered = false;
function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  // Synchronous cleanup function for reliability
  const cleanupSync = () => {
    const { rmSync } = require('node:fs');
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    tempDirs.clear();
  };

  // All cleanup handlers use synchronous cleanup to ensure
  // temporary files are removed before process exits
  process.on('exit', cleanupSync);

  process.on('SIGINT', () => {
    cleanupSync();
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    cleanupSync();
    process.exit(143);
  });
}

/**
 * Create a temporary directory for testing
 *
 * @example
 * const tempDir = await createTempDir();
 * const filePath = await tempDir.createFile('test.txt', 'content');
 * const content = await tempDir.readFile('test.txt');
 * await tempDir.cleanup();
 *
 * @param options - Configuration options
 * @returns Temporary directory instance
 */
export async function createTempDir(options: TempDirOptions = {}): Promise<TempDirectory> {
  const {
    prefix = 'automatosx-test-',
    autoCleanup = true,
    baseDir = tmpdir()
  } = options;

  // Create temporary directory
  const tempPath = await mkdtemp(join(baseDir, prefix));

  // Register for cleanup
  if (autoCleanup) {
    registerCleanup();
    tempDirs.add(tempPath);
  }

  const tempDir: TempDirectory = {
    path: tempPath,
    normalizedPath: normalizePath(tempPath),

    async createSubdir(name: string): Promise<string> {
      const subdirPath = joinPath(tempPath, name);
      await mkdir(subdirPath, { recursive: true });
      return subdirPath;
    },

    async createFile(filename: string, content: string): Promise<string> {
      const filePath = joinPath(tempPath, filename);
      const dirPath = dirname(filePath);
      await mkdir(dirPath, { recursive: true });
      await writeFile(filePath, content, 'utf8');
      return filePath;
    },

    async readFile(filename: string): Promise<string> {
      const filePath = joinPath(tempPath, filename);
      return await readFile(filePath, 'utf8');
    },

    resolve(...segments: string[]): string {
      return joinPath(tempPath, ...segments);
    },

    async cleanup(): Promise<void> {
      tempDirs.delete(tempPath);
      await rm(tempPath, { recursive: true, force: true });
    }
  };

  return tempDir;
}

/**
 * Create a temporary directory and automatically clean it up after the callback
 *
 * @example
 * await withTempDir(async (tempDir) => {
 *   await tempDir.createFile('test.txt', 'content');
 *   // ... test code ...
 * });
 * // tempDir is automatically cleaned up
 *
 * @param callback - Function to execute with the temporary directory
 * @param options - Configuration options
 * @returns Result of the callback
 */
export async function withTempDir<T>(
  callback: (tempDir: TempDirectory) => Promise<T>,
  options: TempDirOptions = {}
): Promise<T> {
  const tempDir = await createTempDir({ ...options, autoCleanup: false });

  try {
    return await callback(tempDir);
  } finally {
    await tempDir.cleanup();
  }
}

/**
 * Create a temporary directory with a predefined structure
 *
 * @example
 * const tempDir = await createTempDirWithStructure({
 *   'file1.txt': 'content1',
 *   'subdir/file2.txt': 'content2',
 *   'subdir/nested/file3.txt': 'content3'
 * });
 *
 * @param structure - Object mapping file paths to content
 * @param options - Configuration options
 * @returns Temporary directory instance
 */
export async function createTempDirWithStructure(
  structure: Record<string, string>,
  options: TempDirOptions = {}
): Promise<TempDirectory> {
  const tempDir = await createTempDir(options);

  // Create all files
  await Promise.all(
    Object.entries(structure).map(([path, content]) =>
      tempDir.createFile(path, content)
    )
  );

  return tempDir;
}

/**
 * Create multiple temporary directories at once
 *
 * @example
 * const [dir1, dir2, dir3] = await createTempDirs(3);
 *
 * @param count - Number of directories to create
 * @param options - Configuration options
 * @returns Array of temporary directory instances
 */
export async function createTempDirs(
  count: number,
  options: TempDirOptions = {}
): Promise<TempDirectory[]> {
  const promises = Array.from({ length: count }, () => createTempDir(options));
  return await Promise.all(promises);
}

/**
 * Clean up all temporary directories created with autoCleanup
 *
 * @example
 * await cleanupAllTempDirs();
 */
export async function cleanupAllTempDirs(): Promise<void> {
  const dirs = Array.from(tempDirs);
  tempDirs.clear();

  await Promise.all(
    dirs.map((dir) => rm(dir, { recursive: true, force: true }))
  );
}

/**
 * Get the count of active temporary directories
 *
 * @example
 * const count = getTempDirCount();
 * console.log(`Active temp dirs: ${count}`);
 */
export function getTempDirCount(): number {
  return tempDirs.size;
}
