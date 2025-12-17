/**
 * Context Loader
 *
 * Loads project-specific context files from .automatosx/context/
 * and prepares them for injection into agent system prompts.
 *
 * Invariants:
 * - INV-CTX-001: Individual files must not exceed maxFileSize
 * - INV-CTX-002: Total size must not exceed maxTotalSize
 * - INV-CTX-003: Files must be valid UTF-8
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  MAX_CONTEXT_FILE_SIZE,
  MAX_CONTEXT_TOTAL_SIZE,
  CONTEXT_DIRECTORY,
  type ContextFile,
  type ProjectContext,
  type ContextLoaderConfig,
  type ContextLoadResult,
} from '@automatosx/contracts';
import type { IContextLoader, FileInfo } from './types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ContextLoaderConfig = {
  maxFileSize: MAX_CONTEXT_FILE_SIZE,
  maxTotalSize: MAX_CONTEXT_TOTAL_SIZE,
  fileExtensions: ['.md', '.txt'],
  excludePatterns: [],
  recursive: false,
  sortBy: 'name',
};

// ============================================================================
// Context Loader Implementation
// ============================================================================

/**
 * Loads project context from .automatosx/context/ directory
 */
export class ContextLoader implements IContextLoader {
  private config: ContextLoaderConfig;

  constructor(config: Partial<ContextLoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the context directory path for a project
   */
  getContextPath(projectPath: string): string {
    return path.join(projectPath, '.automatosx', CONTEXT_DIRECTORY);
  }

  /**
   * Check if context directory exists
   */
  async hasContext(projectPath: string): Promise<boolean> {
    const contextPath = this.getContextPath(projectPath);
    try {
      const stat = await fs.stat(contextPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Load project context from a directory
   */
  async load(projectPath: string): Promise<ContextLoadResult> {
    const contextPath = this.getContextPath(projectPath);

    // Check if context directory exists
    const exists = await this.hasContext(projectPath);
    if (!exists) {
      return {
        success: true,
        context: this.createEmptyContext(projectPath, contextPath),
        filesLoaded: 0,
        filesSkipped: 0,
      };
    }

    try {
      // List files in context directory
      const fileInfos = await this.listContextFiles(contextPath);

      // Load files with size limits
      const loadedFiles: ContextFile[] = [];
      const skippedReasons: Array<{ filename: string; reason: string }> = [];
      let totalSize = 0;

      for (const fileInfo of fileInfos) {
        // Check individual file size
        if (fileInfo.size > this.config.maxFileSize) {
          skippedReasons.push({
            filename: fileInfo.name,
            reason: `File exceeds max size (${fileInfo.size} > ${this.config.maxFileSize})`,
          });
          continue;
        }

        // Check total size limit
        if (totalSize + fileInfo.size > this.config.maxTotalSize) {
          skippedReasons.push({
            filename: fileInfo.name,
            reason: `Would exceed total size limit`,
          });
          continue;
        }

        // Load file content
        try {
          const content = await fs.readFile(fileInfo.path, 'utf-8');
          const now = new Date().toISOString();

          loadedFiles.push({
            filename: fileInfo.name,
            relativePath: path.relative(contextPath, fileInfo.path),
            content,
            size: fileInfo.size,
            loadedAt: now,
          });

          totalSize += fileInfo.size;
        } catch (error) {
          skippedReasons.push({
            filename: fileInfo.name,
            reason: `Read error: ${error instanceof Error ? error.message : 'Unknown'}`,
          });
        }
      }

      // Sort files
      this.sortFiles(loadedFiles);

      // Create combined content
      const combinedContent = this.createCombinedContent(loadedFiles);

      const context: ProjectContext = {
        projectPath,
        contextPath,
        files: loadedFiles,
        totalSize,
        fileCount: loadedFiles.length,
        loadedAt: new Date().toISOString(),
        combinedContent,
      };

      return {
        success: true,
        context,
        filesLoaded: loadedFiles.length,
        filesSkipped: skippedReasons.length,
        skippedReasons: skippedReasons.length > 0 ? skippedReasons : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load context: ${error instanceof Error ? error.message : 'Unknown'}`,
        filesLoaded: 0,
        filesSkipped: 0,
      };
    }
  }

  /**
   * List context files in directory
   */
  private async listContextFiles(contextPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const entries = await fs.readdir(contextPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      // Check file extension
      const ext = path.extname(entry.name).toLowerCase();
      if (!this.config.fileExtensions.includes(ext)) continue;

      // Check exclude patterns
      const excluded = this.config.excludePatterns.some((pattern) =>
        entry.name.includes(pattern)
      );
      if (excluded) continue;

      const filePath = path.join(contextPath, entry.name);
      const stat = await fs.stat(filePath);

      files.push({
        path: filePath,
        name: entry.name,
        size: stat.size,
      });
    }

    return files;
  }

  /**
   * Sort files based on configuration
   */
  private sortFiles(files: ContextFile[]): void {
    switch (this.config.sortBy) {
      case 'name':
        files.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case 'size':
        files.sort((a, b) => a.size - b.size);
        break;
      // 'modified' would require storing modification time
      default:
        files.sort((a, b) => a.filename.localeCompare(b.filename));
    }
  }

  /**
   * Create combined content for system prompt injection
   */
  private createCombinedContent(files: ContextFile[]): string {
    if (files.length === 0) return '';

    const sections = files.map((file) => {
      const header = `## ${file.filename}`;
      return `${header}\n\n${file.content}`;
    });

    return `# Project Context\n\n${sections.join('\n\n---\n\n')}`;
  }

  /**
   * Create empty context when directory doesn't exist
   */
  private createEmptyContext(projectPath: string, contextPath: string): ProjectContext {
    return {
      projectPath,
      contextPath,
      files: [],
      totalSize: 0,
      fileCount: 0,
      loadedAt: new Date().toISOString(),
      combinedContent: '',
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a context loader with optional configuration
 */
export function createContextLoader(
  config?: Partial<ContextLoaderConfig>
): IContextLoader {
  return new ContextLoader(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick check if a project has context
 */
export async function hasProjectContext(projectPath: string): Promise<boolean> {
  const loader = new ContextLoader();
  return loader.hasContext(projectPath);
}

/**
 * Load context with default settings
 */
export async function loadProjectContext(
  projectPath: string
): Promise<ContextLoadResult> {
  const loader = new ContextLoader();
  return loader.load(projectPath);
}
