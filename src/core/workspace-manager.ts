/**
 * Workspace Manager - Simplified management for automatosx/ directory
 *
 * Provides:
 * - automatosx/PRD/ - Planning documents (permanent storage)
 * - automatosx/tmp/ - Temporary files (auto-cleanup)
 *
 * Changes in v5.2.0:
 * - Removed agent-specific workspace isolation
 * - Removed session-based workspaces
 * - Removed permission control system
 * - Simplified to PRD/tmp structure
 *
 * @module core/workspace-manager
 * @since v5.2.0
 */

import { promises as fs } from 'fs';
import {
  joinPath,
  normalizePath,
  resolvePath,
  dirname,
  getRelativePath,
  isAbsolutePath
} from '../shared/validation/path-utils.js';
import { logger } from '../shared/logging/logger.js';

/**
 * Workspace statistics
 */
export interface WorkspaceStats {
  /** Number of PRD files */
  prdFiles: number;

  /** Number of temporary files */
  tmpFiles: number;

  /** Total size in bytes */
  totalSizeBytes: number;

  /** PRD workspace size in bytes */
  prdSizeBytes: number;

  /** Tmp workspace size in bytes */
  tmpSizeBytes: number;
}

/**
 * Simplified Workspace Manager (v5.2.0)
 *
 * Manages automatosx/ working directory with two subdirectories:
 * - PRD/: Planning documents, workflow designs, proposals (permanent)
 * - tmp/: Scripts, tools, temporary analysis (auto-cleanup)
 *
 * Key features:
 * - Lazy initialization (directories created on first use)
 * - Path security validation (prevents path traversal)
 * - No permission control (all agents have equal access)
 * - Auto-cleanup for temporary files
 *
 * @example
 * ```typescript
 * const workspaceManager = new WorkspaceManager('/path/to/project');
 *
 * // Write PRD document
 * await workspaceManager.writePRD('feature-auth.md', '# Auth Feature...');
 *
 * // Write temporary script
 * await workspaceManager.writeTmp('test.sh', '#!/bin/bash...');
 *
 * // Clean up old temporary files
 * await workspaceManager.cleanupTmp(7); // older than 7 days
 * ```
 */
export class WorkspaceManager {
  private readonly projectDir: string;
  private readonly prdDir: string;
  private readonly tmpDir: string;
  private directoriesEnsured: boolean = false;

  /** Maximum file size in bytes (10MB) */
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Create WorkspaceManager
   *
   * @param projectDir - Project directory path
   * @param config - Optional workspace configuration
   */
  constructor(projectDir: string, config?: { prdPath?: string; tmpPath?: string }) {
    this.projectDir = projectDir;

    // Support custom paths or use defaults
    const prdPath = config?.prdPath ?? 'automatosx/PRD';
    const tmpPath = config?.tmpPath ?? 'automatosx/tmp';

    this.prdDir = joinPath(projectDir, prdPath);
    this.tmpDir = joinPath(projectDir, tmpPath);
  }

  /**
   * Ensure PRD/tmp directories exist (lazy initialization with caching)
   *
   * Creates directories only when needed, not during init.
   * Uses caching to avoid repeated filesystem checks.
   */
  private async ensureDirectories(): Promise<void> {
    if (this.directoriesEnsured) {
      return; // Already ensured, skip
    }

    // v5.6.0: Use 0o755 permissions for cross-platform compatibility
    // Prevents "permission denied" errors in multi-user/provider scenarios
    await fs.mkdir(this.prdDir, { recursive: true, mode: 0o755 });
    await fs.mkdir(this.tmpDir, { recursive: true, mode: 0o755 });

    this.directoriesEnsured = true;
    logger.debug('Workspace directories ensured', {
      prdDir: normalizePath(this.prdDir),
      tmpDir: normalizePath(this.tmpDir)
    });
  }

  /**
   * Validate file size
   *
   * @param content - File content
   * @throws {Error} If file size exceeds MAX_FILE_SIZE
   */
  private validateFileSize(content: string): void {
    const sizeInBytes = Buffer.byteLength(content, 'utf-8');
    if (sizeInBytes > WorkspaceManager.MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${sizeInBytes} bytes (max: ${WorkspaceManager.MAX_FILE_SIZE} bytes)`
      );
    }
  }

  /**
   * Validate path security (prevent path traversal attacks)
   *
   * Security checks:
   * 1. Reject absolute paths
   * 2. Normalize path and check for '..' at start
   * 3. Verify resolved path is within base directory
   *
   * @param baseDir - Base directory that file must be within
   * @param filePath - Relative file path to validate
   * @returns Resolved absolute path
   * @throws {Error} If path is unsafe
   */
  private validatePath(baseDir: string, filePath: string): string {
    // 0. Reject empty paths
    if (!filePath || !filePath.trim()) {
      throw new Error('File path cannot be empty');
    }

    // 1. Reject absolute paths
    if (isAbsolutePath(filePath)) {
      throw new Error(`Absolute paths not allowed: ${filePath}`);
    }

    // 2. Normalize path for further checks
    const normalized = normalizePath(filePath);

    // 3. Reject paths that resolve to base directory itself
    if (normalized === '.' || normalized === './') {
      throw new Error('Cannot write to base directory itself');
    }

    // 4. Resolve and verify within base directory
    const resolved = resolvePath(baseDir, normalized);
    const resolvedBase = resolvePath(baseDir);

    // Use normalized path comparison
    const normalizedResolved = normalizePath(resolved);
    const normalizedBase = normalizePath(resolvedBase);
    const separator = '/'; // Always use forward slash for normalized paths

    if (!normalizedResolved.startsWith(normalizedBase + separator) &&
        normalizedResolved !== normalizedBase) {
      throw new Error(`Path outside workspace: ${filePath}`);
    }

    return resolved;
  }

  /**
   * Write PRD document
   *
   * PRD documents are permanent and should contain:
   * - Feature designs (feature-*.md)
   * - Workflow plans (workflow-*.md)
   * - Architecture proposals (proposal-*.md)
   *
   * @param fileName - Relative file path within PRD/
   * @param content - File content
   * @throws {Error} If path is invalid, file too large, or write fails
   *
   * @example
   * ```typescript
   * await workspaceManager.writePRD('feature-auth.md', '# Authentication Feature...');
   * ```
   */
  async writePRD(fileName: string, content: string): Promise<void> {
    await this.ensureDirectories();

    // Validate file size before writing
    this.validateFileSize(content);

    const fullPath = this.validatePath(this.prdDir, fileName);

    // Ensure parent directory exists (v5.6.0: with 0o755 permissions)
    await fs.mkdir(dirname(fullPath), { recursive: true, mode: 0o755 });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    logger.info('PRD document created', { fileName, size: content.length });
  }

  /**
   * Write temporary file
   *
   * Temporary files should contain:
   * - Test scripts
   * - Analysis tools
   * - Temporary reports
   *
   * These files can be cleaned up anytime.
   *
   * @param fileName - Relative file path within tmp/
   * @param content - File content
   * @throws {Error} If path is invalid, file too large, or write fails
   *
   * @example
   * ```typescript
   * await workspaceManager.writeTmp('test.sh', '#!/bin/bash\necho "test"');
   * ```
   */
  async writeTmp(fileName: string, content: string): Promise<void> {
    await this.ensureDirectories();

    // Validate file size before writing
    this.validateFileSize(content);

    const fullPath = this.validatePath(this.tmpDir, fileName);

    // Ensure parent directory exists (v5.6.0: with 0o755 permissions)
    await fs.mkdir(dirname(fullPath), { recursive: true, mode: 0o755 });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    logger.debug('Temporary file created', { fileName, size: content.length });
  }

  /**
   * Read PRD document
   *
   * @param fileName - Relative file path within PRD/
   * @returns File content
   * @throws {Error} If path is invalid or file not found
   *
   * @example
   * ```typescript
   * const content = await workspaceManager.readPRD('feature-auth.md');
   * ```
   */
  async readPRD(fileName: string): Promise<string> {
    const fullPath = this.validatePath(this.prdDir, fileName);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Read temporary file
   *
   * @param fileName - Relative file path within tmp/
   * @returns File content
   * @throws {Error} If path is invalid or file not found
   */
  async readTmp(fileName: string): Promise<string> {
    const fullPath = this.validatePath(this.tmpDir, fileName);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * List all PRD documents
   *
   * @returns Array of relative file paths
   *
   * @example
   * ```typescript
   * const prdFiles = await workspaceManager.listPRD();
   * // ['feature-auth.md', 'workflow-ci-cd.md']
   * ```
   */
  async listPRD(): Promise<string[]> {
    try {
      await this.ensureDirectories();
      return await this.listFiles(this.prdDir);
    } catch (error) {
      // If directory doesn't exist yet, return empty array
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * List all temporary files
   *
   * @returns Array of relative file paths
   */
  async listTmp(): Promise<string[]> {
    try {
      await this.ensureDirectories();
      return await this.listFiles(this.tmpDir);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Clean up temporary files (recursively)
   *
   * @param olderThanDays - Optional: Only remove files older than N days
   * @returns Number of files removed
   *
   * @example
   * ```typescript
   * // Remove all temporary files
   * await workspaceManager.cleanupTmp();
   *
   * // Remove files older than 7 days
   * await workspaceManager.cleanupTmp(7);
   * ```
   */
  async cleanupTmp(olderThanDays?: number): Promise<number> {
    try {
      await this.ensureDirectories();
      return await this.cleanupDirectory(this.tmpDir, olderThanDays);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return 0; // Directory doesn't exist, nothing to clean
      }
      logger.warn('Failed to cleanup temporary files', {
        error: err.message
      });
      return 0;
    }
  }

  /**
   * Helper: Clean up directory recursively
   *
   * @param dir - Directory to clean
   * @param olderThanDays - Optional: Only remove files older than N days
   * @returns Number of files removed
   */
  private async cleanupDirectory(dir: string, olderThanDays?: number): Promise<number> {
    let removed = 0;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const filePath = joinPath(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively clean subdirectory
          removed += await this.cleanupDirectory(filePath, olderThanDays);
          continue;
        }

        // Check age if specified
        if (olderThanDays !== undefined) {
          try {
            const stats = await fs.stat(filePath);
            const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
            if (ageInDays < olderThanDays) {
              continue; // Skip files newer than threshold
            }
          } catch (statError) {
            // Skip if can't stat (file might be deleted)
            continue;
          }
        }

        // Remove file
        try {
          await fs.unlink(filePath);
          removed++;
        } catch (rmError) {
          // Log but continue with other files
          logger.warn('Failed to remove temporary file', {
            path: normalizePath(getRelativePath(this.tmpDir, filePath)),
            error: (rmError as Error).message
          });
        }
      }

      if (removed > 0) {
        logger.info('Temporary files cleaned up', { removed, olderThanDays });
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // Directory might have been deleted during cleanup
        return removed;
      }
      throw error;
    }

    return removed;
  }

  /**
   * Get workspace statistics
   *
   * @param options - Options for getting stats
   * @param options.readOnly - If true, don't create directories (Bug #v8.4.12)
   * @returns Workspace statistics
   *
   * @example
   * ```typescript
   * const stats = await workspaceManager.getStats();
   * console.log(`PRD files: ${stats.prdFiles}, Tmp files: ${stats.tmpFiles}`);
   *
   * // Read-only mode (for status checks)
   * const stats = await workspaceManager.getStats({ readOnly: true });
   * ```
   */
  async getStats(options?: { readOnly?: boolean }): Promise<WorkspaceStats> {
    try {
      // Bug #v8.4.12: Only create directories if not in read-only mode
      if (!options?.readOnly) {
        await this.ensureDirectories();
      }

      const prdFiles = await this.listFiles(this.prdDir);
      const tmpFiles = await this.listFiles(this.tmpDir);

      // Calculate PRD size
      let prdSize = 0;
      for (const file of prdFiles) {
        try {
          const stats = await fs.stat(joinPath(this.prdDir, file));
          prdSize += stats.size;
        } catch {
          // Skip files that can't be stat'd
        }
      }

      // Calculate Tmp size
      let tmpSize = 0;
      for (const file of tmpFiles) {
        try {
          const stats = await fs.stat(joinPath(this.tmpDir, file));
          tmpSize += stats.size;
        } catch {
          // Skip files that can't be stat'd
        }
      }

      return {
        prdFiles: prdFiles.length,
        tmpFiles: tmpFiles.length,
        totalSizeBytes: prdSize + tmpSize,
        prdSizeBytes: prdSize,
        tmpSizeBytes: tmpSize
      };
    } catch (error) {
      logger.warn('Failed to get workspace stats', {
        error: (error as Error).message
      });

      return {
        prdFiles: 0,
        tmpFiles: 0,
        totalSizeBytes: 0,
        prdSizeBytes: 0,
        tmpSizeBytes: 0
      };
    }
  }

  /**
   * Helper: List files recursively in a directory
   *
   * @param dir - Directory to scan
   * @returns Array of relative file paths (normalized with forward slashes)
   */
  private async listFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = joinPath(dir, entry.name);
        const relativePath = normalizePath(getRelativePath(dir, fullPath));

        try {
          if (entry.isDirectory()) {
            // Recursively list subdirectory files
            const subFiles = await this.listFiles(fullPath);
            files.push(...subFiles.map(f => normalizePath(joinPath(relativePath, f))));
          } else {
            files.push(relativePath);
          }
        } catch (err) {
          // Skip files/directories that were deleted during traversal
          const error = err as NodeJS.ErrnoException;
          if (error.code === 'ENOENT') {
            logger.debug('File removed during traversal', { path: relativePath });
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      // If directory is deleted during traversal, return what we have
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        logger.debug('Directory removed during traversal', { path: normalizePath(dir) });
        return files;
      }
      throw err;
    }

    return files;
  }
}
