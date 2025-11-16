/**
 * Path Resolution Module
 *
 * Handles path resolution for AutomatosX v4.0 with three directory contexts:
 * 1. Project Directory - User's project root (auto-detected)
 * 2. Working Directory - Command execution location
 * 3. Agent Workspace - Agent's isolated workspace
 *
 * @see PRD/16-path-resolution-strategy.md
 */

import { findUp } from 'find-up';
import {
  resolvePath,
  dirname,
  getRelativePath,
  normalizePath,
  isAbsolutePath
} from '../utils/path-utils.js';
import type { PathResolverConfig, PathType, PathContext } from '../types/path.js';
import { PathError } from '../types/path.js';

/**
 * Check if a path is a Windows-style path (e.g., C:\, D:\)
 */
function isWindowsPath(path: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(path);
}

/**
 * Project root detection
 * Priority: .git > package.json > other markers > fallback to cwd
 */
export async function detectProjectRoot(
  startDir: string = process.cwd()
): Promise<string> {
  // Priority 1: Find .git directory
  const gitDir = await findUp('.git', {
    cwd: startDir,
    type: 'directory'
  });
  if (gitDir) {
    return dirname(gitDir);
  }

  // Priority 2: Find package.json
  const pkgJson = await findUp('package.json', {
    cwd: startDir
  });
  if (pkgJson) {
    return dirname(pkgJson);
  }

  // Priority 3: Find other project markers
  const markers = [
    'pyproject.toml',  // Python
    'Cargo.toml',      // Rust
    'go.mod',          // Go
    'pom.xml',         // Java/Maven
    'build.gradle',    // Java/Gradle
    '.automatosx'      // AutomatosX marker
  ];

  for (const marker of markers) {
    const found = await findUp(marker, { cwd: startDir });
    if (found) {
      return dirname(found);
    }
  }

  // Priority 4: Fallback to startDir
  return startDir;
}

/**
 * Path Resolver
 * Provides safe path resolution with boundary validation
 */
export class PathResolver implements PathContext {
  private readonly config: PathResolverConfig;

  constructor(config: PathResolverConfig) {
    this.config = config;
  }

  /**
   * Auto-detect project root
   */
  async detectProjectRoot(startDir?: string): Promise<string> {
    return detectProjectRoot(startDir);
  }

  /**
   * Resolve user-provided path
   * - Absolute paths: validated within project
   * - Relative paths: resolved from workingDir
   */
  resolveUserPath(userPath: string): string {
    // Reject Windows paths on non-Windows platforms
    if (process.platform !== 'win32' && isWindowsPath(userPath)) {
      throw new PathError(
        `Windows paths are not supported on ${process.platform}`,
        { path: userPath, type: 'invalid_path' }
      );
    }

    // Handle absolute paths
    if (isAbsolutePath(userPath)) {
      const normalized = resolvePath(userPath);
      this.validateInProject(normalized);
      return normalized;
    }

    // Handle relative paths (relative to workingDir)
    const resolved = resolvePath(this.config.workingDir, userPath);
    this.validateInProject(resolved);
    return resolved;
  }

  /**
   * Resolve paths relative to project root
   */
  resolveProjectPath(relativePath: string): string {
    const resolved = resolvePath(this.config.projectDir, relativePath);
    this.validateInProject(resolved);
    return resolved;
  }

  /**
   * Resolve paths relative to working directory
   */
  resolveWorkingPath(relativePath: string): string {
    const resolved = resolvePath(this.config.workingDir, relativePath);
    this.validateInProject(resolved);
    return resolved;
  }

  /**
   * Resolve agent workspace path
   * - Always within agent workspace
   * - Full read/write access
   */
  resolveWorkspacePath(agentPath: string): string {
    return resolvePath(this.config.agentWorkspace, agentPath);
  }

  /**
   * Validate path is within allowed base directory
   */
  validatePath(path: string, baseDir: string): boolean {
    const normalized = normalizePath(resolvePath(path));
    const base = normalizePath(resolvePath(baseDir));

    // Check if path starts with baseDir
    // Use forward slash separator after normalization for cross-platform consistency
    const separator = '/';
    const pathWithSep = normalized + separator;
    const baseWithSep = base + separator;

    return pathWithSep.startsWith(baseWithSep) || normalized === base;
  }

  /**
   * Check if path is within allowed boundaries
   */
  isPathAllowed(path: string): boolean {
    const boundary = this.checkBoundaries(path);
    return boundary === 'agent_workspace' || boundary === 'user_project';
  }

  /**
   * Check which boundary a path belongs to
   */
  checkBoundaries(path: string): PathType {
    const normalized = resolvePath(path);

    // Check agent workspace first (more specific)
    if (this.validatePath(normalized, this.config.agentWorkspace)) {
      return 'agent_workspace';
    }

    // Check user project
    if (this.validatePath(normalized, this.config.projectDir)) {
      return 'user_project';
    }

    // Check system directories (platform-specific)
    const systemDirs = this.getSystemDirs();
    for (const sysDir of systemDirs) {
      if (this.validatePath(normalized, sysDir)) {
        return 'system_restricted';
      }
    }

    return 'outside_boundaries';
  }

  /**
   * Get relative path from project root
   */
  getRelativeToProject(path: string): string {
    const normalized = resolvePath(path);
    return normalizePath(getRelativePath(this.config.projectDir, normalized));
  }

  /**
   * Get relative path from working directory
   */
  getRelativeToWorking(path: string): string {
    const normalized = resolvePath(path);
    return normalizePath(getRelativePath(this.config.workingDir, normalized));
  }

  /**
   * Get agents directory path
   */
  getAgentsDirectory(): string {
    return resolvePath(this.config.projectDir, '.automatosx', 'agents');
  }

  /**
   * Get abilities directory path
   */
  getAbilitiesDirectory(): string {
    return resolvePath(this.config.projectDir, '.automatosx', 'abilities');
  }

  /**
   * Validate path is within project boundaries
   * @throws PathError if outside project
   */
  private validateInProject(path: string): void {
    const boundary = this.checkBoundaries(path);

    if (boundary === 'outside_boundaries' || boundary === 'system_restricted') {
      throw new PathError('Path outside project directory', {
        path,
        projectDir: this.config.projectDir,
        boundary
      });
    }
  }

  /**
   * Get system directories (platform-specific)
   */
  private getSystemDirs(): string[] {
    const platform = process.platform;

    if (platform === 'win32') {
      return [
        'C:\\Windows',
        'C:\\Program Files',
        'C:\\Program Files (x86)'
      ];
    } else {
      return ['/etc', '/proc', '/sys', '/var', '/usr'];
    }
  }
}
