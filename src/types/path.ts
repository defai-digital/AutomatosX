/**
 * Path resolution types
 */

export type PathType =
  | 'agent_workspace'
  | 'user_project'
  | 'system_restricted'
  | 'outside_boundaries';

export interface PathResolverConfig {
  projectDir: string;
  workingDir: string;
  agentWorkspace: string;
  allowSystemAccess?: boolean;
}

export interface PathContext {
  /** Auto-detect project root (priority: .git > package.json > cwd) */
  detectProjectRoot(startDir?: string): Promise<string>;

  /** Resolve paths relative to project root */
  resolveProjectPath(relativePath: string): string;

  /** Resolve paths relative to working directory */
  resolveWorkingPath(relativePath: string): string;

  /** Validate path safety (prevent path traversal) */
  validatePath(path: string, baseDir: string): boolean;

  /** Check if path is within allowed boundaries */
  isPathAllowed(path: string): boolean;
}

export class PathError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PathError';
  }
}
