/**
 * Tests for SecurityValidator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecurityValidator } from '../src/security-validator.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SecurityValidator', () => {
  let testDir: string;
  let validator: SecurityValidator;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `ax-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    validator = new SecurityValidator({
      workspaceRoot: testDir,
      allowedExtensions: ['.ts', '.js', '.txt', '.md'],
      maxFileSize: 1024 * 1024, // 1MB
      allowDotfiles: false,
      allowHiddenDirs: false
    });
  });

  afterEach(async () => {
    // Clean up
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Path Traversal Prevention', () => {
    it('should reject ../  traversal', async () => {
      const result = await validator.validatePath('../etc/passwd', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('traversal');
    });

    it('should reject ../ in middle of path', async () => {
      const result = await validator.validatePath('foo/../../../etc/passwd', 'read');
      expect(result.valid).toBe(false);
    });

    it('should reject ..\\  traversal (Windows)', async () => {
      const result = await validator.validatePath('..\\windows\\system32', 'read');
      expect(result.valid).toBe(false);
    });

    it('should reject encoded traversal', async () => {
      const result = await validator.validatePath('foo%2e%2e/bar', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Encoded path traversal');
    });
  });

  describe('Workspace Boundary Enforcement', () => {
    it('should allow files within workspace', async () => {
      await writeFile(join(testDir, 'test.txt'), 'hello');
      const result = await validator.validatePath('test.txt', 'read');
      expect(result.valid).toBe(true);
      expect(result.absolutePath).toContain(testDir);
    });

    it('should reject absolute paths outside workspace', async () => {
      const result = await validator.validatePath('/etc/passwd', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside workspace');
    });

    it('should allow nested files within workspace', async () => {
      await mkdir(join(testDir, 'subdir'), { recursive: true });
      await writeFile(join(testDir, 'subdir', 'file.txt'), 'test');

      const result = await validator.validatePath('subdir/file.txt', 'read');
      expect(result.valid).toBe(true);
    });
  });

  describe('Critical File Protection', () => {
    it('should reject .git directory access', async () => {
      const result = await validator.validatePath('.git/config', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('critical');
    });

    it('should reject .env files', async () => {
      const result = await validator.validatePath('.env', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('critical');
    });

    it('should reject .env.* files', async () => {
      const result = await validator.validatePath('.env.local', 'read');
      expect(result.valid).toBe(false);
    });

    it('should reject SSH keys', async () => {
      const result = await validator.validatePath('.ssh/id_rsa', 'read');
      expect(result.valid).toBe(false);
    });

    it('should reject credential files', async () => {
      const result = await validator.validatePath('credentials.json', 'read');
      expect(result.valid).toBe(false);
    });
  });

  describe('File Extension Validation', () => {
    it('should allow whitelisted extensions', async () => {
      await writeFile(join(testDir, 'test.ts'), 'code');
      const result = await validator.validatePath('test.ts', 'read');
      expect(result.valid).toBe(true);
    });

    it('should reject non-whitelisted extensions', async () => {
      const result = await validator.validatePath('malware.exe', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('extension not allowed');
    });

    it('should allow files with no extension', async () => {
      await writeFile(join(testDir, 'README'), 'docs');
      const result = await validator.validatePath('README', 'read');
      expect(result.valid).toBe(true);
    });
  });

  describe('File Size Limits', () => {
    it('should reject files exceeding size limit', async () => {
      // Create file larger than 1MB limit
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      await writeFile(join(testDir, 'large.txt'), largeContent);

      const result = await validator.validatePath('large.txt', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should allow files under size limit', async () => {
      const smallContent = 'small file';
      await writeFile(join(testDir, 'small.txt'), smallContent);

      const result = await validator.validatePath('small.txt', 'read');
      expect(result.valid).toBe(true);
    });

    it('should not check size for write operations', async () => {
      // Write operations don't check existing file size
      const result = await validator.validatePath('new-file.txt', 'write');
      expect(result.valid).toBe(true);
    });
  });

  describe('Hidden Files and Directories', () => {
    it('should reject dotfiles by default', async () => {
      const result = await validator.validatePath('.hidden', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dotfiles');
    });

    it('should allow whitelisted dotfiles', async () => {
      await writeFile(join(testDir, '.gitignore'), 'node_modules/');
      const result = await validator.validatePath('.gitignore', 'read');
      expect(result.valid).toBe(true);
    });

    it('should reject hidden directories', async () => {
      const result = await validator.validatePath('.config/settings.json', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hidden directories');
    });
  });

  describe('File Metadata', () => {
    it('should detect non-existent files', async () => {
      const result = await validator.validatePath('nonexistent.txt', 'read');
      expect(result.valid).toBe(true); // Path is valid, file just doesn't exist yet
      expect(result.metadata?.exists).toBe(false);
    });

    it('should detect existing files', async () => {
      await writeFile(join(testDir, 'exists.txt'), 'content');
      const result = await validator.validatePath('exists.txt', 'read');
      expect(result.valid).toBe(true);
      expect(result.metadata?.exists).toBe(true);
      expect(result.metadata?.size).toBeGreaterThan(0);
    });

    it('should reject directories', async () => {
      await mkdir(join(testDir, 'subdir'));
      const result = await validator.validatePath('subdir', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('directory');
    });
  });

  describe('Synchronous Safety Check', () => {
    it('should quickly check path safety', () => {
      expect(validator.isPathSafe('test.txt')).toBe(true);
      expect(validator.isPathSafe('../etc/passwd')).toBe(false);
      expect(validator.isPathSafe('.git/config')).toBe(false);
      expect(validator.isPathSafe('malware.exe')).toBe(false);
    });
  });
});
