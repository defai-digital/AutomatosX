/**
 * Tests for FileOperationsManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileOperationsManager } from '../src/file-operations.js';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileOperationsManager', () => {
  let testDir: string;
  let fileOps: FileOperationsManager;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `ax-fileops-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    fileOps = new FileOperationsManager({
      workspaceRoot: testDir,
      autoApprove: true, // Auto-approve for tests
      defaultYes: true
    });
  });

  afterEach(async () => {
    fileOps.close();

    // Clean up
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readFile', () => {
    it('should read file contents', async () => {
      const filepath = 'test.txt';
      const content = 'Hello, World!';
      await writeFile(join(testDir, filepath), content);

      const result = await fileOps.readFile(filepath);
      expect(result).toContain(content);
      expect(result).toContain('test.txt');
    });

    it('should read specific number of lines', async () => {
      const filepath = 'multiline.txt';
      const content = 'line1\nline2\nline3\nline4\nline5';
      await writeFile(join(testDir, filepath), content);

      const result = await fileOps.readFile(filepath, { lines: 2, from: 1 });
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).not.toContain('line3');
    });

    it('should read from specific line number', async () => {
      const filepath = 'multiline.txt';
      const content = 'line1\nline2\nline3\nline4\nline5';
      await writeFile(join(testDir, filepath), content);

      const result = await fileOps.readFile(filepath, { from: 3, lines: 2 });
      expect(result).toContain('line3');
      expect(result).toContain('line4');
      expect(result).not.toContain('line1');
    });

    it('should throw error for non-existent file', async () => {
      await expect(fileOps.readFile('nonexistent.txt')).rejects.toThrow('not found');
    });

    it('should throw error for path traversal', async () => {
      await expect(fileOps.readFile('../etc/passwd')).rejects.toThrow('validation failed');
    });
  });

  describe('writeFile', () => {
    it('should write new file', async () => {
      const filepath = 'new.txt';
      const content = 'New content';

      await fileOps.writeFile(filepath, content);

      const written = await readFile(join(testDir, filepath), 'utf-8');
      expect(written).toBe(content);
    });

    it('should fail to overwrite without force flag', async () => {
      const filepath = 'existing.txt';
      await writeFile(join(testDir, filepath), 'original');

      await expect(
        fileOps.writeFile(filepath, 'new content')
      ).rejects.toThrow('already exists');
    });

    it('should overwrite with force flag', async () => {
      const filepath = 'existing.txt';
      await writeFile(join(testDir, filepath), 'original');

      await fileOps.writeFile(filepath, 'new content', { force: true });

      const written = await readFile(join(testDir, filepath), 'utf-8');
      expect(written).toBe('new content');
    });

    it('should append to existing file', async () => {
      const filepath = 'append.txt';
      await writeFile(join(testDir, filepath), 'original\n');

      await fileOps.writeFile(filepath, 'appended', { append: true });

      const written = await readFile(join(testDir, filepath), 'utf-8');
      expect(written).toBe('original\nappended');
    });
  });

  describe('editFile', () => {
    it('should replace first occurrence', async () => {
      const filepath = 'edit.txt';
      const content = 'foo bar foo bar';
      await writeFile(join(testDir, filepath), content);

      await fileOps.editFile(filepath, 'foo', 'baz');

      const edited = await readFile(join(testDir, filepath), 'utf-8');
      expect(edited).toBe('baz bar foo bar');
    });

    it('should replace all occurrences with --all flag', async () => {
      const filepath = 'edit.txt';
      const content = 'foo bar foo bar';
      await writeFile(join(testDir, filepath), content);

      await fileOps.editFile(filepath, 'foo', 'baz', { all: true });

      const edited = await readFile(join(testDir, filepath), 'utf-8');
      expect(edited).toBe('baz bar baz bar');
    });

    it('should create backup with --backup flag', async () => {
      const filepath = 'edit.txt';
      const content = 'original content';
      await writeFile(join(testDir, filepath), content);

      await fileOps.editFile(filepath, 'original', 'modified', { backup: true });

      const backup = await readFile(join(testDir, `${filepath}.bak`), 'utf-8');
      expect(backup).toBe(content);
    });

    it('should throw error if search string not found', async () => {
      const filepath = 'edit.txt';
      await writeFile(join(testDir, filepath), 'foo bar');

      await expect(
        fileOps.editFile(filepath, 'nonexistent', 'replacement')
      ).rejects.toThrow('not found');
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        fileOps.editFile('nonexistent.txt', 'foo', 'bar')
      ).rejects.toThrow('not found');
    });
  });

  describe('File Metadata', () => {
    it('should check if file exists', async () => {
      const filepath = 'exists.txt';
      await writeFile(join(testDir, filepath), 'content');

      const exists = await fileOps.fileExists(filepath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await fileOps.fileExists('nonexistent.txt');
      expect(exists).toBe(false);
    });

    it('should get file metadata', async () => {
      const filepath = 'metadata.txt';
      const content = 'test content';
      await writeFile(join(testDir, filepath), content);

      const info = await fileOps.getFileInfo(filepath);
      expect(info).not.toBeNull();
      expect(info?.exists).toBe(true);
      expect(info?.size).toBeGreaterThan(0);
      expect(info?.isDirectory).toBe(false);
    });
  });

  describe('Security Integration', () => {
    it('should reject path traversal in write', async () => {
      await expect(
        fileOps.writeFile('../etc/passwd', 'malicious')
      ).rejects.toThrow('validation failed');
    });

    it('should reject critical files in write', async () => {
      await expect(
        fileOps.writeFile('.env', 'SECRET=value')
      ).rejects.toThrow('validation failed');
    });

    it('should reject dangerous extensions', async () => {
      await expect(
        fileOps.writeFile('malware.exe', 'virus')
      ).rejects.toThrow('validation failed');
    });
  });
});
