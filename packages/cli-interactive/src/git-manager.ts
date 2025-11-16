/**
 * Git Manager
 *
 * Manages git operations (status, diff, commit, push, pull).
 */

import { spawn } from 'child_process';
import { join } from 'path';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface CommitOptions {
  all?: boolean;
  amend?: boolean;
  noVerify?: boolean;
}

export class GitManager {
  constructor(private workspaceRoot: string) {}

  /**
   * Check if directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      const result = await this.exec(['rev-parse', '--git-dir']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    const result = await this.exec(['status', '--porcelain', '-b']);

    if (result.exitCode !== 0) {
      throw new Error('Failed to get git status');
    }

    const lines = result.stdout.split('\n').filter(l => l.trim());
    const status: GitStatus = {
      branch: 'unknown',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: []
    };

    // Parse branch info (first line)
    const branchLine = lines[0];
    if (branchLine) {
      // BUG #40 FIX: Match until whitespace, not until dot (supports versions like release/1.2.0)
      const branchMatch = branchLine.match(/##\s+([^\s]+)/);
      if (branchMatch) {
        status.branch = branchMatch[1] || 'unknown';
      }

      const aheadMatch = branchLine.match(/ahead\s+(\d+)/);
      if (aheadMatch) {
        status.ahead = parseInt(aheadMatch[1] || '0', 10);
      }

      const behindMatch = branchLine.match(/behind\s+(\d+)/);
      if (behindMatch) {
        status.behind = parseInt(behindMatch[1] || '0', 10);
      }
    }

    // Parse file statuses
    for (const line of lines.slice(1)) {
      const statusCode = line.substring(0, 2);
      const file = line.substring(3);

      if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
        status.staged.push(file);
      }

      if (statusCode[1] !== ' ' && statusCode[1] !== '?') {
        status.unstaged.push(file);
      }

      if (statusCode === '??') {
        status.untracked.push(file);
      }
    }

    return status;
  }

  /**
   * Get diff
   */
  async getDiff(files?: string[], staged = false): Promise<string> {
    const args = ['diff'];

    if (staged) {
      args.push('--cached');
    }

    if (files && files.length > 0) {
      args.push('--');
      args.push(...files);
    }

    const result = await this.exec(args);
    return result.stdout;
  }

  /**
   * Commit changes
   */
  async commit(message: string, files?: string[], options: CommitOptions = {}): Promise<void> {
    // Stage files if specified
    if (files && files.length > 0) {
      await this.exec(['add', ...files]);
    } else if (options.all) {
      await this.exec(['add', '-A']);
    }

    // Build commit args
    const args = ['commit', '-m', message];

    if (options.amend) {
      args.push('--amend');
    }

    if (options.noVerify) {
      args.push('--no-verify');
    }

    const result = await this.exec(args);

    if (result.exitCode !== 0) {
      throw new Error(`Commit failed: ${result.stderr}`);
    }
  }

  /**
   * Push changes
   */
  async push(remote = 'origin', branch?: string, force = false): Promise<void> {
    const args = ['push'];

    if (force) {
      args.push('--force');
    }

    args.push(remote);

    if (branch) {
      args.push(branch);
    }

    const result = await this.exec(args);

    if (result.exitCode !== 0) {
      throw new Error(`Push failed: ${result.stderr}`);
    }
  }

  /**
   * Pull changes
   */
  async pull(remote = 'origin', branch?: string): Promise<void> {
    const args = ['pull', remote];

    if (branch) {
      args.push(branch);
    }

    const result = await this.exec(args);

    if (result.exitCode !== 0) {
      throw new Error(`Pull failed: ${result.stderr}`);
    }
  }

  /**
   * Execute git command
   */
  async exec(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      git.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      git.on('close', (code: number | null) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1
        });
      });

      git.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}
