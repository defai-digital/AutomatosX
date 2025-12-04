/**
 * Workspace Manager - Unit Tests (v5.2.0)
 *
 * Tests for simplified shared workspace structure:
 * - automatosx/PRD/ - Planning documents (permanent)
 * - automatosx/tmp/ - Temporary files (auto-cleanup)
 *
 * @group unit
 * @group core
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { WorkspaceManager } from '../../src/core/workspace-manager.js';
import { joinPathDisplay } from '../../src/shared/validation/path-utils.js';

describe('WorkspaceManager (v5.2.0)', () => {
  let workspaceManager: WorkspaceManager;
  let testProjectDir: string;

  beforeEach(async () => {
    // Create temp directory for testing
    testProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    workspaceManager = new WorkspaceManager(testProjectDir);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(testProjectDir, { recursive: true, force: true });
  });

  describe('PRD Workspace', () => {
    describe('Writing', () => {
      it('should write file to PRD workspace', async () => {
        const content = '# API Specification\n\nGET /users';
        await workspaceManager.writePRD('api-spec.md', content);

        const filePath = path.join(testProjectDir, 'automatosx', 'PRD', 'api-spec.md');
        const written = await fs.readFile(filePath, 'utf-8');
        expect(written).toBe(content);
      });

      it('should create PRD directory on first write (lazy initialization)', async () => {
        const prdPath = path.join(testProjectDir, 'automatosx', 'PRD');

        // Verify directory doesn't exist yet
        await expect(fs.stat(prdPath)).rejects.toThrow();

        // Write a file - should create directory
        await workspaceManager.writePRD('test.md', 'content');

        // Verify directory was created
        const stat = await fs.stat(prdPath);
        expect(stat.isDirectory()).toBe(true);
      });

      it('should create nested directories when writing', async () => {
        await workspaceManager.writePRD(
          'features/auth/api-spec.md',
          '# Auth API'
        );

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'PRD',
          'features/auth/api-spec.md'
        );

        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      });

      it('should reject empty paths', async () => {
        await expect(
          workspaceManager.writePRD('', 'content')
        ).rejects.toThrow('File path cannot be empty');
      });

      it('should reject current directory paths', async () => {
        await expect(
          workspaceManager.writePRD('.', 'content')
        ).rejects.toThrow('Cannot write to base directory itself');

        await expect(
          workspaceManager.writePRD('./', 'content')
        ).rejects.toThrow('Cannot write to base directory itself');
      });

      it('should reject path traversal attempts', async () => {
        await expect(
          workspaceManager.writePRD('../../../etc/passwd', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject absolute paths', async () => {
        await expect(
          workspaceManager.writePRD('/etc/passwd', 'malicious')
        ).rejects.toThrow('Absolute paths not allowed');
      });

      it('should reject complex path traversal with multiple ..', async () => {
        await expect(
          workspaceManager.writePRD('a/../../b/../../../etc/passwd', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should allow valid nested paths with ./', async () => {
        await expect(
          workspaceManager.writePRD('./features/auth.md', 'content')
        ).resolves.not.toThrow();

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'PRD',
          'features/auth.md'
        );

        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      });

      it('should reject files exceeding 10MB', async () => {
        const largeContent = 'x'.repeat(11 * 1024 * 1024);

        await expect(
          workspaceManager.writePRD('large.txt', largeContent)
        ).rejects.toThrow('File too large');
      });

      it('should accept files under 10MB', async () => {
        const content = 'x'.repeat(5 * 1024 * 1024);

        await expect(
          workspaceManager.writePRD('ok.txt', content)
        ).resolves.not.toThrow();
      });

      it('should handle multi-byte characters in file size calculation', async () => {
        // Chinese characters are 3 bytes each
        // 3.5M characters * 3 bytes = 10.5MB (over limit)
        const largeContent = '測試'.repeat(3500000);

        await expect(
          workspaceManager.writePRD('chinese.txt', largeContent)
        ).rejects.toThrow('File too large');
      });
    });

    describe('Reading', () => {
      it('should read file from PRD workspace', async () => {
        const content = '# API Specification';
        await workspaceManager.writePRD('api-spec.md', content);

        const read = await workspaceManager.readPRD('api-spec.md');
        expect(read).toBe(content);
      });

      it('should read nested files', async () => {
        const content = '# Auth API';
        await workspaceManager.writePRD('features/auth/spec.md', content);

        const read = await workspaceManager.readPRD('features/auth/spec.md');
        expect(read).toBe(content);
      });

      it('should throw error when file not found', async () => {
        await expect(
          workspaceManager.readPRD('nonexistent.md')
        ).rejects.toThrow();
      });

      it('should reject path traversal in reads', async () => {
        await expect(
          workspaceManager.readPRD('../../../etc/passwd')
        ).rejects.toThrow('Path outside workspace');
      });
    });

    describe('Listing', () => {
      it('should list files in PRD workspace', async () => {
        await workspaceManager.writePRD('file1.md', 'content1');
        await workspaceManager.writePRD('features/file2.md', 'content2');
        await workspaceManager.writePRD('designs/ui.md', 'content3');

        const files = await workspaceManager.listPRD();

        expect(files).toHaveLength(3);
        expect(files).toContain('file1.md');
        expect(files).toContain(joinPathDisplay('features', 'file2.md'));
        expect(files).toContain(joinPathDisplay('designs', 'ui.md'));
      });

      it('should return empty array when PRD directory is empty', async () => {
        // Create PRD directory
        await workspaceManager.writePRD('temp.md', 'content');
        await fs.unlink(path.join(testProjectDir, 'automatosx', 'PRD', 'temp.md'));

        const files = await workspaceManager.listPRD();
        expect(files).toEqual([]);
      });

      it('should return empty array when PRD directory does not exist', async () => {
        const files = await workspaceManager.listPRD();
        expect(files).toEqual([]);
      });
    });
  });

  describe('Tmp Workspace', () => {
    describe('Writing', () => {
      it('should write file to tmp workspace', async () => {
        const content = 'console.log("test");';
        await workspaceManager.writeTmp('test-script.js', content);

        const filePath = path.join(testProjectDir, 'automatosx', 'tmp', 'test-script.js');
        const written = await fs.readFile(filePath, 'utf-8');
        expect(written).toBe(content);
      });

      it('should create tmp directory on first write (lazy initialization)', async () => {
        const tmpPath = path.join(testProjectDir, 'automatosx', 'tmp');

        // Verify directory doesn't exist yet
        await expect(fs.stat(tmpPath)).rejects.toThrow();

        // Write a file - should create directory
        await workspaceManager.writeTmp('test.js', 'content');

        // Verify directory was created
        const stat = await fs.stat(tmpPath);
        expect(stat.isDirectory()).toBe(true);
      });

      it('should create nested directories when writing', async () => {
        await workspaceManager.writeTmp(
          'analysis/user-data.json',
          '{"users": 100}'
        );

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'tmp',
          'analysis/user-data.json'
        );

        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      });

      it('should reject path traversal attempts', async () => {
        await expect(
          workspaceManager.writeTmp('../../../etc/passwd', 'malicious')
        ).rejects.toThrow('Path outside workspace');
      });

      it('should reject absolute paths', async () => {
        await expect(
          workspaceManager.writeTmp('/tmp/malicious.txt', 'malicious')
        ).rejects.toThrow('Absolute paths not allowed');
      });
    });

    describe('Reading', () => {
      it('should read file from tmp workspace', async () => {
        const content = 'console.log("test");';
        await workspaceManager.writeTmp('script.js', content);

        const read = await workspaceManager.readTmp('script.js');
        expect(read).toBe(content);
      });

      it('should read nested files', async () => {
        const content = '{"data": "test"}';
        await workspaceManager.writeTmp('analysis/results.json', content);

        const read = await workspaceManager.readTmp('analysis/results.json');
        expect(read).toBe(content);
      });

      it('should throw error when file not found', async () => {
        await expect(
          workspaceManager.readTmp('nonexistent.js')
        ).rejects.toThrow();
      });
    });

    describe('Listing', () => {
      it('should list files in tmp workspace', async () => {
        await workspaceManager.writeTmp('script1.js', 'content1');
        await workspaceManager.writeTmp('analysis/data.json', 'content2');
        await workspaceManager.writeTmp('reports/summary.md', 'content3');

        const files = await workspaceManager.listTmp();

        expect(files).toHaveLength(3);
        expect(files).toContain('script1.js');
        expect(files).toContain(joinPathDisplay('analysis', 'data.json'));
        expect(files).toContain(joinPathDisplay('reports', 'summary.md'));
      });

      it('should return empty array when tmp directory is empty', async () => {
        // Create tmp directory
        await workspaceManager.writeTmp('temp.js', 'content');
        await fs.unlink(path.join(testProjectDir, 'automatosx', 'tmp', 'temp.js'));

        const files = await workspaceManager.listTmp();
        expect(files).toEqual([]);
      });

      it('should return empty array when tmp directory does not exist', async () => {
        const files = await workspaceManager.listTmp();
        expect(files).toEqual([]);
      });
    });

    describe('Cleanup', () => {
      it('should remove old temporary files', async () => {
        // Create test files
        await workspaceManager.writeTmp('old-file.txt', 'old content');
        await workspaceManager.writeTmp('recent-file.txt', 'recent content');

        // Modify old file's timestamp to be 8 days old
        const oldFilePath = path.join(
          testProjectDir,
          'automatosx',
          'tmp',
          'old-file.txt'
        );
        const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
        await fs.utimes(oldFilePath, new Date(eightDaysAgo), new Date(eightDaysAgo));

        // Cleanup files older than 7 days
        const removed = await workspaceManager.cleanupTmp(7);

        expect(removed).toBe(1);

        // Verify old file is removed
        await expect(fs.stat(oldFilePath)).rejects.toThrow();

        // Verify recent file still exists
        const recentFilePath = path.join(
          testProjectDir,
          'automatosx',
          'tmp',
          'recent-file.txt'
        );
        const stat = await fs.stat(recentFilePath);
        expect(stat.isFile()).toBe(true);
      });

      it('should not remove files within age threshold', async () => {
        await workspaceManager.writeTmp('recent.txt', 'content');

        const removed = await workspaceManager.cleanupTmp(7);

        expect(removed).toBe(0);

        const filePath = path.join(
          testProjectDir,
          'automatosx',
          'tmp',
          'recent.txt'
        );
        const stat = await fs.stat(filePath);
        expect(stat.isFile()).toBe(true);
      });

      it('should handle nested directories in cleanup', async () => {
        // Create nested old files
        await workspaceManager.writeTmp('analysis/old-data.json', 'data');
        await workspaceManager.writeTmp('reports/old-report.md', 'report');

        // Make files old
        const file1 = path.join(testProjectDir, 'automatosx', 'tmp', 'analysis/old-data.json');
        const file2 = path.join(testProjectDir, 'automatosx', 'tmp', 'reports/old-report.md');
        const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;

        await fs.utimes(file1, new Date(oldDate), new Date(oldDate));
        await fs.utimes(file2, new Date(oldDate), new Date(oldDate));

        const removed = await workspaceManager.cleanupTmp(7);

        expect(removed).toBe(2);
      });

      it('should return 0 when tmp directory does not exist', async () => {
        const removed = await workspaceManager.cleanupTmp(7);
        expect(removed).toBe(0);
      });

      it('should return 0 when tmp directory is empty', async () => {
        // Create and immediately delete to have empty directory
        await workspaceManager.writeTmp('temp.txt', 'content');
        await fs.unlink(path.join(testProjectDir, 'automatosx', 'tmp', 'temp.txt'));

        const removed = await workspaceManager.cleanupTmp(7);
        expect(removed).toBe(0);
      });
    });
  });

  describe('Workspace Statistics', () => {
    it('should return accurate workspace statistics', async () => {
      // Create files in both workspaces
      await workspaceManager.writePRD('api-spec.md', 'API specification');
      await workspaceManager.writePRD('designs/ui.md', 'UI designs');
      await workspaceManager.writeTmp('test.js', 'Test script');

      const stats = await workspaceManager.getStats();

      expect(stats.prdFiles).toBe(2);
      expect(stats.tmpFiles).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.prdSizeBytes).toBeGreaterThan(0);
      expect(stats.tmpSizeBytes).toBeGreaterThan(0);
    });

    it('should return zero stats when workspaces are empty', async () => {
      const stats = await workspaceManager.getStats();

      expect(stats.prdFiles).toBe(0);
      expect(stats.tmpFiles).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.prdSizeBytes).toBe(0);
      expect(stats.tmpSizeBytes).toBe(0);
    });

    it('should calculate file sizes correctly', async () => {
      const prdContent = 'a'.repeat(1000); // 1KB
      const tmpContent = 'b'.repeat(2000); // 2KB

      await workspaceManager.writePRD('file.md', prdContent);
      await workspaceManager.writeTmp('file.js', tmpContent);

      const stats = await workspaceManager.getStats();

      expect(stats.prdSizeBytes).toBeGreaterThanOrEqual(1000);
      expect(stats.tmpSizeBytes).toBeGreaterThanOrEqual(2000);
      expect(stats.totalSizeBytes).toBe(stats.prdSizeBytes + stats.tmpSizeBytes);
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for path traversal', async () => {
      await expect(
        workspaceManager.writePRD('../outside.txt', 'content')
      ).rejects.toThrow(/Path outside workspace/);
    });

    it('should provide clear error messages for absolute paths', async () => {
      await expect(
        workspaceManager.writePRD('/absolute/path.txt', 'content')
      ).rejects.toThrow(/Absolute paths not allowed/);
    });

    it('should provide clear error messages for empty paths', async () => {
      await expect(
        workspaceManager.writePRD('', 'content')
      ).rejects.toThrow(/File path cannot be empty/);
    });

    it('should provide clear error messages for file size violations', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024);

      await expect(
        workspaceManager.writePRD('large.txt', largeContent)
      ).rejects.toThrow(/File too large/);
    });
  });
});
