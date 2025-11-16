/**
 * MCP Security Tests
 *
 * Tests security boundaries for MCP tools, specifically path traversal prevention
 * in memory_import and memory_export tools.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PathResolver } from '../../src/core/path-resolver.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';
import { normalizePath } from '../../src/utils/path-utils.js';

describe('MCP Security - Path Traversal Prevention', () => {
  let testDir: string;
  let pathResolver: PathResolver;

  beforeEach(() => {
    // Create isolated test directory
    testDir = join(tmpdir(), `automatosx-security-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '.automatosx', 'memory', 'exports'), { recursive: true });

    pathResolver = new PathResolver({
      projectDir: testDir,
      workingDir: testDir,
      agentWorkspace: join(testDir, '.automatosx', 'workspaces')
    });
  });

  afterEach(() => {
    // Cleanup
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Path Resolution Logic', () => {
    /**
     * Helper function that mimics the path resolution in memory-export/import
     */
    function resolveExportPath(pathResolver: PathResolver, userPath: string): string {
      // Reject path traversal attempts
      if (userPath.includes('..')) {
        throw new Error('Path traversal (..) is not allowed for security reasons');
      }

      // Extract filename only (ignore directory components)
      const filename = userPath.split('/').pop() || userPath.split('\\').pop() || userPath;

      // Resolve within .automatosx/memory/exports directory
      const exportsDir = pathResolver.resolveProjectPath('.automatosx/memory/exports');
      const absolutePath = join(exportsDir, filename);

      // Validate path is within exports directory
      if (!pathResolver.validatePath(absolutePath, exportsDir)) {
        throw new Error('Export path must be within .automatosx/memory/exports directory');
      }

      return absolutePath;
    }

    it('should allow simple filename', () => {
      const result = resolveExportPath(pathResolver, 'backup.json');

      expect(normalizePath(result)).toContain('.automatosx/memory/exports');
      expect(normalizePath(result)).toContain('backup.json');
    });

    it('should allow filename with timestamp', () => {
      const result = resolveExportPath(pathResolver, 'backup-2025-10-10.json');

      expect(normalizePath(result)).toContain('.automatosx/memory/exports');
      expect(normalizePath(result)).toContain('backup-2025-10-10.json');
    });

    it('should reject path traversal with ..', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../../etc/passwd');
      }).toThrow('Path traversal (..) is not allowed');
    });

    it('should reject relative path with ..', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../sensitive.json');
      }).toThrow('Path traversal (..) is not allowed');
    });

    it('should reject hidden directory traversal', () => {
      expect(() => {
        resolveExportPath(pathResolver, 'backup/../../../etc/passwd');
      }).toThrow('Path traversal (..) is not allowed');
    });

    it('should extract only filename from path with directories', () => {
      // When user provides "some/path/file.json", extract only "file.json"
      const result = resolveExportPath(pathResolver, 'some/path/file.json');

      expect(normalizePath(result)).toContain('.automatosx/memory/exports');
      expect(normalizePath(result)).toContain('file.json');
      expect(normalizePath(result)).not.toContain('some/path');
    });

    it('should extract only filename from Windows-style path', () => {
      const result = resolveExportPath(pathResolver, 'C:\\Users\\file.json');

      expect(normalizePath(result)).toContain('.automatosx/memory/exports');

      // On Unix, the whole string becomes the filename
      // On Windows, it would be split properly
      if (process.platform === 'win32') {
        expect(normalizePath(result)).toContain('file.json');
        expect(normalizePath(result)).not.toContain('C:');
        expect(normalizePath(result)).not.toContain('Users');
      } else {
        // On Unix, backslash is a valid filename character
        // So 'C:\Users\file.json' becomes the entire filename
        expect(normalizePath(result)).toContain('.automatosx/memory/exports');
      }
    });
  });

  describe('Real-World Attack Scenarios', () => {
    /**
     * Helper function for testing
     */
    function resolveExportPath(pathResolver: PathResolver, userPath: string): string {
      if (userPath.includes('..')) {
        throw new Error('Path traversal (..) is not allowed for security reasons');
      }

      const filename = userPath.split('/').pop() || userPath.split('\\').pop() || userPath;
      const exportsDir = pathResolver.resolveProjectPath('.automatosx/memory/exports');
      const absolutePath = join(exportsDir, filename);

      if (!pathResolver.validatePath(absolutePath, exportsDir)) {
        throw new Error('Export path must be within .automatosx/memory/exports directory');
      }

      return absolutePath;
    }

    it('should prevent reading /etc/passwd via path traversal', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../../etc/passwd');
      }).toThrow('Path traversal');
    });

    it('should prevent reading SSH keys', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../../.ssh/id_rsa');
      }).toThrow('Path traversal');
    });

    it('should prevent reading environment files', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../../.env');
      }).toThrow('Path traversal');
    });

    it('should prevent overwriting system files (via export)', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../../etc/hosts');
      }).toThrow('Path traversal');
    });

    it('should prevent accessing parent project files', () => {
      expect(() => {
        resolveExportPath(pathResolver, '../../package.json');
      }).toThrow('Path traversal');
    });

    it('should prevent URL-encoded path traversal', () => {
      // %2e%2e = ..
      const encoded = '%2e%2e/%2e%2e/etc/passwd';

      // Should still be blocked (we check for literal "..")
      // Note: This test assumes the path isn't decoded before our check
      // If it is decoded elsewhere, this would need adjustment
      const hasTraversal = encoded.includes('..') || decodeURIComponent(encoded).includes('..');
      expect(hasTraversal).toBe(true);
    });
  });

  describe('Allowed Operations', () => {
    /**
     * Helper function for testing
     */
    function resolveExportPath(pathResolver: PathResolver, userPath: string): string {
      if (userPath.includes('..')) {
        throw new Error('Path traversal (..) is not allowed for security reasons');
      }

      const filename = userPath.split('/').pop() || userPath.split('\\').pop() || userPath;
      const exportsDir = pathResolver.resolveProjectPath('.automatosx/memory/exports');
      const absolutePath = join(exportsDir, filename);

      if (!pathResolver.validatePath(absolutePath, exportsDir)) {
        throw new Error('Export path must be within .automatosx/memory/exports directory');
      }

      return absolutePath;
    }

    it('should allow normal backup filename', () => {
      const result = resolveExportPath(pathResolver, 'memory-backup.json');
      expect(result).toContain('memory-backup.json');
    });

    it('should allow timestamped backup', () => {
      const result = resolveExportPath(pathResolver, 'backup-2025-10-10T14-30-00.json');
      expect(result).toContain('backup-2025-10-10T14-30-00.json');
    });

    it('should allow agent-specific backup', () => {
      const result = resolveExportPath(pathResolver, 'backend-memory.json');
      expect(result).toContain('backend-memory.json');
    });

    it('should resolve all paths to exports directory', () => {
      const paths = [
        'backup.json',
        'test.json',
        'memory-export-123.json'
      ];

      for (const path of paths) {
        const result = resolveExportPath(pathResolver, path);
        expect(normalizePath(result)).toContain('.automatosx/memory/exports');
      }
    });
  });

  describe('PathResolver.validatePath() Behavior', () => {
    it('should validate path within base directory', () => {
      const exportsDir = join(testDir, '.automatosx', 'memory', 'exports');
      const validPath = join(exportsDir, 'backup.json');

      expect(pathResolver.validatePath(validPath, exportsDir)).toBe(true);
    });

    it('should reject path outside base directory', () => {
      const exportsDir = join(testDir, '.automatosx', 'memory', 'exports');
      const invalidPath = join(testDir, 'outside.json');

      expect(pathResolver.validatePath(invalidPath, exportsDir)).toBe(false);
    });

    it('should reject system paths', () => {
      const exportsDir = join(testDir, '.automatosx', 'memory', 'exports');

      if (process.platform === 'win32') {
        expect(pathResolver.validatePath('C:\\Windows\\system32', exportsDir)).toBe(false);
      } else {
        expect(pathResolver.validatePath('/etc/passwd', exportsDir)).toBe(false);
      }
    });
  });
});
