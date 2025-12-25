/**
 * Context Domain Internal Types
 *
 * Internal types for the context loader implementation.
 */

import type {
  ContextFile,
  ProjectContext,
  ContextLoaderConfig,
  ContextLoadResult,
} from '@defai.digital/contracts';

// Re-export contract types for convenience
export type {
  ContextFile,
  ProjectContext,
  ContextLoaderConfig,
  ContextLoadResult,
};

/**
 * Context loader interface
 */
export interface IContextLoader {
  /**
   * Load project context from a directory
   */
  load(projectPath: string): Promise<ContextLoadResult>;

  /**
   * Get the context directory path for a project
   */
  getContextPath(projectPath: string): string;

  /**
   * Check if context directory exists
   */
  hasContext(projectPath: string): Promise<boolean>;
}

/**
 * Context file reader options
 */
export interface ContextFileReaderOptions {
  maxFileSize: number;
  encoding: BufferEncoding;
}

/**
 * Internal file info
 */
export interface FileInfo {
  path: string;
  name: string;
  size: number;
}
