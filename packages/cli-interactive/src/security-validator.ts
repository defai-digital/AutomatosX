/**
 * Security Validator
 *
 * Validates file operations for security:
 * - Path traversal prevention
 * - Workspace boundary enforcement
 * - File extension validation
 * - File size limits
 */

import { join, resolve, normalize, relative, extname, isAbsolute } from 'path';
import { stat, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  absolutePath?: string;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  exists: boolean;
  size?: number;
  isDirectory?: boolean;
  extension?: string;
}

export interface SecurityConfig {
  workspaceRoot: string;
  allowedExtensions?: string[];
  maxFileSize?: number;  // in bytes
  allowDotfiles?: boolean;
  allowHiddenDirs?: boolean;
}

export class SecurityValidator {
  private workspaceRoot: string;
  private allowedExtensions: string[];
  private maxFileSize: number;
  private allowDotfiles: boolean;
  private allowHiddenDirs: boolean;

  // Critical files that should be protected
  private static readonly CRITICAL_PATTERNS = [
    /^\.git\//i,
    /^\.env$/i,
    /^\.env\./i,
    /node_modules\//i,
    /^package-lock\.json$/i,
    /^npm-debug\.log$/i,
    /^\.ssh\//i,
    /^\.aws\//i,
    /^\.npmrc$/i,
    /^\.npmrc\./i,
    /credentials/i,
    /secrets/i,
    /private.*key/i,
    /id_rsa/i,
    /id_dsa/i
  ];

  constructor(config: SecurityConfig) {
    this.workspaceRoot = resolve(config.workspaceRoot);
    this.allowedExtensions = config.allowedExtensions || this.getDefaultExtensions();
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowDotfiles = config.allowDotfiles ?? false;
    this.allowHiddenDirs = config.allowHiddenDirs ?? false;
  }

  /**
   * Validate a file path for a specific operation
   */
  async validatePath(
    filepath: string,
    operation: 'read' | 'write' | 'edit'
  ): Promise<ValidationResult> {
    // 1. Basic validation
    if (!filepath || filepath.trim() === '') {
      return { valid: false, error: 'File path cannot be empty' };
    }

    // 2. Check for path traversal
    const traversalCheck = this.checkPathTraversal(filepath);
    if (!traversalCheck.valid) {
      return traversalCheck;
    }

    // 3. Resolve to absolute path
    const absolutePath = this.resolveToAbsolute(filepath);

    // 4. Check workspace boundaries
    const boundaryCheck = this.checkWorkspaceBoundary(absolutePath);
    if (!boundaryCheck.valid) {
      return boundaryCheck;
    }

    // 5. Check for critical files
    // BUG #33 FIX: Pass workspace-relative path to properly match patterns
    const workspaceRelative = relative(this.workspaceRoot, absolutePath);
    const criticalCheck = this.checkCriticalFile(workspaceRelative);
    if (!criticalCheck.valid) {
      return criticalCheck;
    }

    // 6. Check dotfiles and hidden directories
    const hiddenCheck = this.checkHiddenPaths(filepath);
    if (!hiddenCheck.valid) {
      return hiddenCheck;
    }

    // 7. Check file extension
    const extensionCheck = this.checkExtension(filepath);
    if (!extensionCheck.valid) {
      return extensionCheck;
    }

    // 8. Get file metadata
    const metadata = await this.getFileMetadata(absolutePath);

    // 9. Check file size (for read/edit operations)
    if (operation === 'read' || operation === 'edit') {
      if (metadata.exists && metadata.size && metadata.size > this.maxFileSize) {
        return {
          valid: false,
          error: `File too large: ${this.formatBytes(metadata.size)} (max: ${this.formatBytes(this.maxFileSize)})`
        };
      }
    }

    // 10. Check if it's a directory
    if (metadata.isDirectory) {
      return {
        valid: false,
        error: 'Path is a directory, not a file'
      };
    }

    return {
      valid: true,
      absolutePath,
      metadata
    };
  }

  /**
   * Check for path traversal attempts
   */
  private checkPathTraversal(filepath: string): ValidationResult {
    // Check for obvious traversal patterns
    if (filepath.includes('../') || filepath.includes('..\\')) {
      return {
        valid: false,
        error: 'Path traversal detected (../ or ..\\)'
      };
    }

    // Check for encoded traversal
    if (filepath.includes('%2e%2e') || filepath.includes('%252e')) {
      return {
        valid: false,
        error: 'Encoded path traversal detected'
      };
    }

    // Check after normalization
    const normalized = normalize(filepath);
    if (normalized.startsWith('..')) {
      return {
        valid: false,
        error: 'Path traversal detected after normalization'
      };
    }

    return { valid: true };
  }

  /**
   * Resolve filepath to absolute path within workspace
   */
  private resolveToAbsolute(filepath: string): string {
    // If already absolute, return as-is
    if (isAbsolute(filepath)) {
      return resolve(filepath);
    }

    // Otherwise, resolve relative to workspace root
    return resolve(this.workspaceRoot, filepath);
  }

  /**
   * Check if path is within workspace boundaries
   */
  private checkWorkspaceBoundary(absolutePath: string): ValidationResult {
    const normalized = normalize(absolutePath);
    const workspace = normalize(this.workspaceRoot);

    // Get relative path from workspace to file
    const rel = relative(workspace, normalized);

    // If relative path starts with '..', it's outside workspace
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return {
        valid: false,
        error: `Path outside workspace: ${absolutePath}`
      };
    }

    return { valid: true };
  }

  /**
   * Check if file matches critical file patterns
   * BUG #33 FIX: Now receives workspace-relative path for proper pattern matching
   */
  private checkCriticalFile(filepath: string): ValidationResult {
    // Normalize path for comparison (convert backslashes to forward slashes)
    const normalizedPath = filepath.replace(/\\/g, '/');

    for (const pattern of SecurityValidator.CRITICAL_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return {
          valid: false,
          error: `Access to critical files/directories is restricted: ${filepath}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check dotfiles and hidden directories
   */
  private checkHiddenPaths(filepath: string): ValidationResult {
    const parts = filepath.split(/[/\\]/);

    // Check for dotfiles (files starting with .)
    const filename = parts[parts.length - 1];
    if (filename && filename.startsWith('.') && !this.allowDotfiles) {
      // Allow some common dotfiles
      const allowedDotfiles = ['.gitignore', '.editorconfig', '.prettierrc'];
      if (!allowedDotfiles.includes(filename)) {
        return {
          valid: false,
          error: 'Access to dotfiles is restricted (enable with allowDotfiles option)'
        };
      }
    }

    // Check for hidden directories (directories starting with .)
    if (!this.allowHiddenDirs) {
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i]?.startsWith('.')) {
          return {
            valid: false,
            error: 'Access to hidden directories is restricted (enable with allowHiddenDirs option)'
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Check if file extension is allowed
   */
  private checkExtension(filepath: string): ValidationResult {
    const ext = extname(filepath).toLowerCase();

    // Allow files with no extension
    if (!ext) {
      return { valid: true };
    }

    // Check against allowed extensions
    if (!this.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension not allowed: ${ext} (allowed: ${this.allowedExtensions.join(', ')})`
      };
    }

    return { valid: true };
  }

  /**
   * Get file metadata
   */
  private async getFileMetadata(absolutePath: string): Promise<FileMetadata> {
    try {
      await access(absolutePath, fsConstants.F_OK);
      const stats = await stat(absolutePath);

      return {
        exists: true,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        extension: extname(absolutePath).toLowerCase()
      };
    } catch {
      return {
        exists: false,
        isDirectory: false
      };
    }
  }

  /**
   * Get default allowed extensions
   */
  private getDefaultExtensions(): string[] {
    return [
      // Code files
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.php', '.swift', '.kt', '.scala',

      // Markup/Data
      '.html', '.css', '.scss', '.sass', '.less',
      '.json', '.yaml', '.yml', '.toml', '.xml',
      '.md', '.markdown', '.txt', '.csv',

      // Config
      '.config', '.conf', '.cfg', '.ini',
      '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc',

      // Shell scripts
      '.sh', '.bash', '.zsh', '.fish',

      // Build files
      'Dockerfile', 'Makefile', '.lock'
    ];
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if a path would be safe to access
   * (Synchronous version for quick checks)
   */
  isPathSafe(filepath: string): boolean {
    // Quick check without async file access
    const traversalCheck = this.checkPathTraversal(filepath);
    if (!traversalCheck.valid) return false;

    const absolutePath = this.resolveToAbsolute(filepath);
    const boundaryCheck = this.checkWorkspaceBoundary(absolutePath);
    if (!boundaryCheck.valid) return false;

    const criticalCheck = this.checkCriticalFile(filepath);
    if (!criticalCheck.valid) return false;

    const hiddenCheck = this.checkHiddenPaths(filepath);
    if (!hiddenCheck.valid) return false;

    const extensionCheck = this.checkExtension(filepath);
    if (!extensionCheck.valid) return false;

    return true;
  }
}
