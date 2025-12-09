/**
 * Git Utilities for Bugfix
 *
 * Provides git-aware file filtering for bugfix scanning.
 *
 * @module core/bugfix/git-utils
 * @since v12.6.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../shared/logging/logger.js';

const execAsync = promisify(exec);

/**
 * Git file filter options
 */
export interface GitFilterOptions {
  /** Get files changed in working tree (unstaged + staged) */
  changed?: boolean;
  /** Get only staged files */
  staged?: boolean;
  /** Get files changed since a branch/commit */
  since?: string;
  /** Working directory */
  cwd?: string;
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get changed files based on filter options
 *
 * @param options - Git filter options
 * @returns Array of file paths relative to repo root
 */
export async function getChangedFiles(options: GitFilterOptions): Promise<string[]> {
  const cwd = options.cwd || process.cwd();

  // Check if git repo
  if (!(await isGitRepo(cwd))) {
    logger.warn('Not a git repository, cannot use git-aware scanning');
    return [];
  }

  try {
    let command: string;

    if (options.staged) {
      // Get only staged files
      command = 'git diff --cached --name-only --diff-filter=ACMR';
    } else if (options.since) {
      // Get files changed since branch/commit
      // First, find the merge base
      const mergeBaseCmd = `git merge-base HEAD ${options.since}`;
      const { stdout: mergeBase } = await execAsync(mergeBaseCmd, { cwd });
      command = `git diff --name-only ${mergeBase.trim()}..HEAD`;
    } else if (options.changed) {
      // Get all changed files (staged + unstaged)
      command = 'git diff --name-only HEAD';
    } else {
      // Default: get all changed files
      command = 'git diff --name-only HEAD';
    }

    const { stdout } = await execAsync(command, { cwd });

    const files = stdout
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    logger.debug('Git changed files', {
      command,
      fileCount: files.length,
      options
    });

    return files;
  } catch (error) {
    logger.warn('Failed to get changed files from git', {
      error: (error as Error).message
    });
    return [];
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get the default branch (main or master)
 */
export async function getDefaultBranch(cwd: string): Promise<string> {
  try {
    // Try to get the default branch from remote
    const { stdout } = await execAsync(
      'git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo "refs/remotes/origin/main"',
      { cwd }
    );
    const ref = stdout.trim();
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    // Fall back to 'main'
    return 'main';
  }
}
