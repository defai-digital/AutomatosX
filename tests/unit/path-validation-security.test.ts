/**
 * Path Validation Security Tests - Queenie's Recommendations
 *
 * Comprehensive security tests for path validation logic across:
 * - WorkspaceManager.validatePath()
 * - PathResolver.validatePath()
 *
 * Test Categories:
 * 1. Path Traversal Attacks
 * 2. URL-Encoded Path Traversal
 * 3. Absolute Path Injection
 * 4. Legitimate Relative Paths
 * 5. Boundary Cases
 *
 * @see tmp/code-review-phase2-queenie-updated.md
 * @see tmp/phase2-final-validation.md
 * @since Phase 3.2
 * @group unit
 * @group security
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { WorkspaceManager } from '../../src/core/workspace-manager.js';
import { PathResolver } from '../../src/core/path-resolver.js';

describe('Path Validation Security Tests (Queenie)', () => {
  let workspaceManager: WorkspaceManager;
  let pathResolver: PathResolver;
  let testProjectDir: string;

  beforeEach(async () => {
    // Create temp directory for testing
    testProjectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'path-security-test-')
    );
    workspaceManager = new WorkspaceManager(testProjectDir);
    pathResolver = new PathResolver({
      projectDir: testProjectDir,
      workingDir: testProjectDir,
      agentWorkspace: path.join(testProjectDir, 'automatosx')
    });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(testProjectDir, { recursive: true, force: true });
  });

  describe('1. Path Traversal Attacks', () => {
    describe('WorkspaceManager', () => {
      it('should reject simple parent directory traversal (../secrets.txt)', async () => {
        await expect(
          workspaceManager.writePRD('../secrets.txt', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject nested parent directory traversal (foo/../../secrets.txt)', async () => {
        await expect(
          workspaceManager.writePRD('foo/../../secrets.txt', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject deep parent directory traversal (a/b/c/../../../../secrets.txt)', async () => {
        // a/b/c/../../../../secrets.txt → ../secrets.txt (outside workspace)
        await expect(
          workspaceManager.writePRD('a/b/c/../../../../secrets.txt', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject multiple parent directory references (../../../../../../etc/passwd)', async () => {
        await expect(
          workspaceManager.writePRD(
            '../../../../../../etc/passwd',
            'malicious'
          )
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject Windows-style parent traversal (..\\..\\secrets.txt)', async () => {
        await expect(
          workspaceManager.writePRD('..\\..\\secrets.txt', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject mixed slash parent traversal (../foo\\../bar/../secrets.txt)', async () => {
        await expect(
          workspaceManager.writePRD('../foo\\../bar/../secrets.txt', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });
    });

    describe('PathResolver', () => {
      it('should validate that parent traversal paths are outside base directory', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        expect(
          pathResolver.validatePath('../../../etc/passwd', baseDir)
        ).toBe(false);
      });

      it('should validate that nested traversal paths are outside base directory', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        expect(pathResolver.validatePath('foo/../../secrets.txt', baseDir)).toBe(
          false
        );
      });
    });
  });

  describe('2. URL-Encoded Path Traversal', () => {
    describe('WorkspaceManager', () => {
      it('should handle URL-encoded single dot (.%2e)', async () => {
        // Note: Current implementation doesn't decode URLs before validation
        // This test documents the behavior - URL-encoded paths are treated literally
        await expect(
          workspaceManager.writePRD('.%2e/secrets.txt', 'content')
        ).resolves.not.toThrow();
        // The file would be created with literal name '.%2e' which is safe
      });

      it('should handle URL-encoded parent traversal (..%2f..%2f)', async () => {
        // URL-encoded slashes are not decoded, so treated as literal characters
        await expect(
          workspaceManager.writePRD('..%2f..%2fsecrets.txt', 'content')
        ).resolves.not.toThrow();
        // Safe because %2f is not decoded to /
      });

      it('should handle double-encoded parent traversal (%252e%252e%252f)', async () => {
        // Double-encoded also treated as literal characters
        await expect(
          workspaceManager.writePRD('%252e%252e%252fsecrets.txt', 'content')
        ).resolves.not.toThrow();
      });
    });

    describe('PathResolver', () => {
      it('should handle URL-encoded paths as literal file names', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        const testPath = path.join(baseDir, '.%2e%2fsecrets.txt');
        // URL-encoded characters are NOT decoded, so the path is literally ".%2e%2fsecrets.txt"
        // which resolves to baseDir/.%2e%2fsecrets.txt (inside baseDir)
        expect(pathResolver.validatePath(testPath, baseDir)).toBe(true);
      });
    });
  });

  describe('3. Absolute Path Injection', () => {
    describe('WorkspaceManager', () => {
      it('should reject Unix absolute path (/etc/passwd)', async () => {
        await expect(
          workspaceManager.writePRD('/etc/passwd', 'malicious')
        ).rejects.toThrow('Absolute paths not allowed');
      });

      it('should reject Windows absolute path (C:\\Windows\\System32)', async () => {
        if (os.platform() === 'win32') {
          await expect(
            workspaceManager.writePRD('C:\\Windows\\System32', 'malicious')
          ).rejects.toThrow('Absolute paths not allowed');
        } else {
          // On Unix, this is treated as a relative path, which should succeed
          await expect(
            workspaceManager.writePRD('C:\\Windows\\System32', 'content')
          ).resolves.not.toThrow();
        }
      });

      it('should reject Windows absolute path with forward slashes (C:/Windows/System32)', async () => {
        if (os.platform() === 'win32') {
          await expect(
            workspaceManager.writePRD('C:/Windows/System32', 'malicious')
          ).rejects.toThrow('Absolute paths not allowed');
        } else {
          // On Unix, C:/... is treated as relative path, which should succeed
          await expect(
            workspaceManager.writePRD('C:/Windows/System32', 'content')
          ).resolves.not.toThrow();
        }
      });

      it('should reject UNC paths (\\\\server\\share)', async () => {
        if (os.platform() === 'win32') {
          await expect(
            workspaceManager.writePRD('\\\\server\\share', 'malicious')
          ).rejects.toThrow('Absolute paths not allowed');
        } else {
          // On Unix, \\server\share is treated as relative path with backslashes
          // After normalization it becomes //server/share which is still problematic
          await expect(
            workspaceManager.writePRD('\\\\server\\share', 'malicious')
          ).rejects.toThrow(); // Could throw either error depending on normalization
        }
      });

      it('should reject normalized UNC paths (//server/share)', async () => {
        if (os.platform() === 'win32') {
          await expect(
            workspaceManager.writePRD('//server/share', 'malicious')
          ).rejects.toThrow('Absolute paths not allowed');
        } else {
          // On Unix, //server/share might be treated as absolute
          await expect(
            workspaceManager.writePRD('//server/share', 'malicious')
          ).rejects.toThrow();
        }
      });
    });

    describe('PathResolver', () => {
      it('should detect Unix absolute paths as outside base directory', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        expect(pathResolver.validatePath('/etc/passwd', baseDir)).toBe(false);
      });

      it('should detect Windows absolute paths as outside base directory', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        expect(pathResolver.validatePath('C:\\Windows\\System32', baseDir)).toBe(
          false
        );
      });
    });
  });

  describe('4. Legitimate Relative Paths', () => {
    describe('WorkspaceManager', () => {
      it('should accept simple relative path (foo/bar.txt)', async () => {
        await expect(
          workspaceManager.writePRD('foo/bar.txt', 'content')
        ).resolves.not.toThrow();

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'PRD',
          'foo',
          'bar.txt'
        );
        const written = await fs.readFile(filePath, 'utf-8');
        expect(written).toBe('content');
      });

      it('should accept path with internal parent reference (a/b/../c/d.txt)', async () => {
        // This is legitimate: a/b/../c/d.txt resolves to a/c/d.txt
        await expect(
          workspaceManager.writePRD('a/b/../c/d.txt', 'content')
        ).resolves.not.toThrow();

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'PRD',
          'a',
          'c',
          'd.txt'
        );
        const written = await fs.readFile(filePath, 'utf-8');
        expect(written).toBe('content');
      });

      it('should accept nested directory path (features/auth/api-spec.md)', async () => {
        await expect(
          workspaceManager.writePRD('features/auth/api-spec.md', '# Auth API')
        ).resolves.not.toThrow();

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'PRD',
          'features',
          'auth',
          'api-spec.md'
        );
        const written = await fs.readFile(filePath, 'utf-8');
        expect(written).toBe('# Auth API');
      });

      it('should accept path with current directory reference (./foo/bar.txt)', async () => {
        await expect(
          workspaceManager.writePRD('./foo/bar.txt', 'content')
        ).resolves.not.toThrow();
      });

      it('should accept deeply nested path (a/b/c/d/e/f/file.txt)', async () => {
        await expect(
          workspaceManager.writePRD('a/b/c/d/e/f/file.txt', 'deep content')
        ).resolves.not.toThrow();
      });
    });

    describe('PathResolver', () => {
      it('should validate simple absolute paths as inside base directory', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        const testPath = path.join(baseDir, 'foo', 'bar.txt');
        expect(pathResolver.validatePath(testPath, baseDir)).toBe(true);
      });

      it('should validate paths with internal parent references', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        const testPath = path.join(baseDir, 'a', 'b', '..', 'c', 'd.txt');
        // After resolution: baseDir/a/c/d.txt
        expect(pathResolver.validatePath(testPath, baseDir)).toBe(true);
      });
    });
  });

  describe('5. Boundary Cases', () => {
    describe('WorkspaceManager', () => {
      it('should reject empty string', async () => {
        await expect(
          workspaceManager.writePRD('', 'content')
        ).rejects.toThrow('File path cannot be empty');
      });

      it('should reject whitespace-only string', async () => {
        await expect(
          workspaceManager.writePRD('   ', 'content')
        ).rejects.toThrow('File path cannot be empty');
      });

      it('should reject current directory (.) reference', async () => {
        await expect(
          workspaceManager.writePRD('.', 'content')
        ).rejects.toThrow('Cannot write to base directory itself');
      });

      it('should reject current directory with slash (./)', async () => {
        await expect(
          workspaceManager.writePRD('./', 'content')
        ).rejects.toThrow('Cannot write to base directory itself');
      });

      it('should reject current directory with multiple slashes (.//)', async () => {
        await expect(
          workspaceManager.writePRD('.//', 'content')
        ).rejects.toThrow(); // Could throw validation error or EISDIR
      });

      it('should accept single character filename (a)', async () => {
        await expect(
          workspaceManager.writePRD('a', 'content')
        ).resolves.not.toThrow();
      });

      it('should accept filename with special characters (foo-bar_baz.txt)', async () => {
        await expect(
          workspaceManager.writePRD('foo-bar_baz.txt', 'content')
        ).resolves.not.toThrow();
      });

      it('should handle very long path (255 characters)', async () => {
        const longPath = 'a/'.repeat(100) + 'file.txt'; // ~200+ chars
        await expect(
          workspaceManager.writePRD(longPath, 'content')
        ).resolves.not.toThrow();
      });
    });

    describe('PathResolver', () => {
      it('should reject empty paths', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        expect(pathResolver.validatePath('', baseDir)).toBe(false);
      });

      it('should validate single character paths', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        const testPath = path.join(baseDir, 'a');
        expect(pathResolver.validatePath(testPath, baseDir)).toBe(true);
      });

      it('should validate very long paths', () => {
        const baseDir = path.join(testProjectDir, 'automatosx', 'PRD');
        const longPath = 'a/'.repeat(100) + 'file.txt';
        const testPath = path.join(baseDir, longPath);
        expect(pathResolver.validatePath(testPath, baseDir)).toBe(true);
      });
    });
  });

  describe('6. Real-World Attack Scenarios', () => {
    describe('WorkspaceManager', () => {
      it('should reject攻擊scenario: accessing /etc/shadow', async () => {
        await expect(
          workspaceManager.writePRD('../../../etc/shadow', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject攻擊scenario: accessing ~/.ssh/id_rsa', async () => {
        await expect(
          workspaceManager.writePRD(
            '../../../../home/user/.ssh/id_rsa',
            'malicious'
          )
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject攻擊scenario: Windows SAM database', async () => {
        if (os.platform() === 'win32') {
          await expect(
            workspaceManager.writePRD(
              'C:\\Windows\\System32\\config\\SAM',
              'malicious'
            )
          ).rejects.toThrow('Absolute paths not allowed');
        } else {
          // On Unix, C:\... is treated as relative path
          await expect(
            workspaceManager.writePRD(
              'C:\\Windows\\System32\\config\\SAM',
              'content'
            )
          ).resolves.not.toThrow();
        }
      });

      it('should reject攻擊scenario: Overwriting package.json', async () => {
        await expect(
          workspaceManager.writePRD('../../package.json', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject攻擊scenario: Creating .git hooks', async () => {
        await expect(
          workspaceManager.writePRD(
            '../../.git/hooks/pre-commit',
            'malicious script'
          )
        ).rejects.toThrow('Path outside workspace');
      });
    });
  });

  describe('7. Edge Cases from Path Normalization', () => {
    describe('WorkspaceManager', () => {
      it('should handle multiple consecutive slashes (foo//bar///baz)', async () => {
        await expect(
          workspaceManager.writePRD('foo//bar///baz.txt', 'content')
        ).resolves.not.toThrow();
      });

      it('should handle mixed slashes (foo\\bar/baz)', async () => {
        await expect(
          workspaceManager.writePRD('foo\\bar/baz.txt', 'content')
        ).resolves.not.toThrow();
      });

      it('should handle trailing slashes (foo/bar/)', async () => {
        // Trailing slash should be removed during normalization
        await expect(
          workspaceManager.writePRD('foo/bar/', 'content')
        ).resolves.not.toThrow();
      });

      it('should handle dot-slash prefix (./foo/./bar)', async () => {
        await expect(
          workspaceManager.writePRD('./foo/./bar.txt', 'content')
        ).resolves.not.toThrow();
      });
    });
  });
});
