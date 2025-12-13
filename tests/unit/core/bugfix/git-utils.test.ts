/**
 * Tests for git-utils - Git-aware file filtering for bugfix scanning
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Use vi.hoisted to ensure mock state persists
const mockState = vi.hoisted(() => ({
  responses: [] as Array<{ stdout: string; stderr: string } | Error>
}));

// Mock util.promisify to return our mock function
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: () => {
      // Return a mock async exec function
      return async (cmd: string, opts?: { cwd?: string }) => {
        const response = mockState.responses.shift();
        if (response instanceof Error) {
          throw response;
        }
        return response || { stdout: '', stderr: '' };
      };
    }
  };
});

describe('git-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.responses = [];
  });

  describe('isGitRepo', () => {
    it('should return true for valid git repository', async () => {
      mockState.responses = [{ stdout: 'true', stderr: '' }];

      const { isGitRepo } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await isGitRepo('/test/project');

      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      mockState.responses = [new Error('fatal: not a git repository')];

      const { isGitRepo } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await isGitRepo('/not/a/repo');

      expect(result).toBe(false);
    });
  });

  describe('getChangedFiles', () => {
    it('should return empty array when not in git repo', async () => {
      mockState.responses = [new Error('not a git repo')];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      const result = await getChangedFiles({ cwd: '/not/a/repo' });

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Not a git repository, cannot use git-aware scanning'
      );
    });

    it('should get staged files only when staged option is true', async () => {
      // First call checks if it's a git repo
      // Second call gets the files
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        { stdout: 'src/file1.ts\nsrc/file2.ts\n', stderr: '' }
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getChangedFiles({ staged: true, cwd: '/test/project' });

      expect(result).toEqual(['src/file1.ts', 'src/file2.ts']);
    });

    it('should get files changed since a branch', async () => {
      // First call checks if it's a git repo
      // Second call gets merge base
      // Third call gets the changed files
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        { stdout: 'abc123\n', stderr: '' },
        { stdout: 'src/changed.ts\nlib/updated.ts\n', stderr: '' }
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getChangedFiles({ since: 'main', cwd: '/test/project' });

      expect(result).toEqual(['src/changed.ts', 'lib/updated.ts']);
    });

    it('should get all changed files with changed option', async () => {
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        { stdout: 'src/modified.ts\n', stderr: '' }
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getChangedFiles({ changed: true, cwd: '/test/project' });

      expect(result).toEqual(['src/modified.ts']);
    });

    it('should use default command when no option is provided', async () => {
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        { stdout: 'src/file.ts\n', stderr: '' }
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getChangedFiles({ cwd: '/test/project' });

      expect(result).toEqual(['src/file.ts']);
    });

    it('should use process.cwd when no cwd provided', async () => {
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        { stdout: '', stderr: '' }
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getChangedFiles({});

      expect(result).toEqual([]);
    });

    it('should filter empty lines from output', async () => {
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        { stdout: '\nfile1.ts\n\nfile2.ts\n\n', stderr: '' }
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getChangedFiles({ cwd: '/test' });

      expect(result).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should return empty array on git command failure', async () => {
      mockState.responses = [
        { stdout: 'true', stderr: '' },
        new Error('git diff failed')
      ];

      const { getChangedFiles } = await import('../../../../src/core/bugfix/git-utils.js');
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      const result = await getChangedFiles({ cwd: '/test' });

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to get changed files from git',
        expect.objectContaining({ error: 'git diff failed' })
      );
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockState.responses = [{ stdout: 'feature/my-branch\n', stderr: '' }];

      const { getCurrentBranch } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getCurrentBranch('/test/project');

      expect(result).toBe('feature/my-branch');
    });

    it('should return null on error', async () => {
      mockState.responses = [new Error('not a git repo')];

      const { getCurrentBranch } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getCurrentBranch('/not/a/repo');

      expect(result).toBeNull();
    });

    it('should trim whitespace from branch name', async () => {
      mockState.responses = [{ stdout: '  main  \n', stderr: '' }];

      const { getCurrentBranch } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getCurrentBranch('/test');

      expect(result).toBe('main');
    });
  });

  describe('getDefaultBranch', () => {
    it('should return default branch from remote', async () => {
      mockState.responses = [{ stdout: 'refs/remotes/origin/main\n', stderr: '' }];

      const { getDefaultBranch } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getDefaultBranch('/test/project');

      expect(result).toBe('main');
    });

    it('should strip refs/remotes/origin/ prefix', async () => {
      mockState.responses = [{ stdout: 'refs/remotes/origin/develop\n', stderr: '' }];

      const { getDefaultBranch } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getDefaultBranch('/test');

      expect(result).toBe('develop');
    });

    it('should fallback to main on error', async () => {
      mockState.responses = [new Error('command failed')];

      const { getDefaultBranch } = await import('../../../../src/core/bugfix/git-utils.js');
      const result = await getDefaultBranch('/test');

      expect(result).toBe('main');
    });
  });
});
