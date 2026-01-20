/**
 * Git MCP Tools
 *
 * Provides Git workflow operations for AI-assisted development.
 * These tools enable git status, diff, commit preparation, and PR creation.
 *
 * @module mcp-server/tools/git
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { MCPTool, ToolHandler } from '../types.js';
import { getErrorMessage } from '@defai.digital/contracts';

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

const GIT_TIMEOUT = 30000; // 30 seconds default timeout
const MAX_DIFF_SIZE = 100000; // 100KB max diff output

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Git status tool definition
 */
export const gitStatusTool: MCPTool = {
  name: 'git_status',
  description:
    'Get the current git repository status including branch, staged changes, unstaged changes, and untracked files. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Repository path (defaults to current working directory)',
      },
      short: {
        type: 'boolean',
        description: 'Use short format output',
        default: false,
      },
    },
  },
  idempotent: true,
};

/**
 * Git diff tool definition
 */
export const gitDiffTool: MCPTool = {
  name: 'git_diff',
  description:
    'Get diff for files, staged changes, or between commits. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific file paths to diff (optional)',
      },
      staged: {
        type: 'boolean',
        description: 'Show staged changes (--cached)',
        default: false,
      },
      commit: {
        type: 'string',
        description: 'Compare with a specific commit (e.g., HEAD~1, main)',
      },
      base: {
        type: 'string',
        description: 'Base commit for comparison (when using commit parameter)',
      },
      stat: {
        type: 'boolean',
        description: 'Show diffstat summary instead of full diff',
        default: false,
      },
    },
  },
  idempotent: true,
};

/**
 * Commit prepare tool definition
 */
export const commitPrepareTool: MCPTool = {
  name: 'commit_prepare',
  description:
    'Prepare a git commit with AI-generated commit message. Stages specified files and generates a conventional commit message based on the changes. SIDE EFFECTS: Stages files. Requires user confirmation to commit.',
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to stage and commit',
      },
      type: {
        type: 'string',
        enum: ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'style', 'perf', 'build', 'ci'],
        description: 'Commit type for conventional commits',
      },
      scope: {
        type: 'string',
        description: 'Commit scope (e.g., dashboard, api, auth)',
      },
      stageAll: {
        type: 'boolean',
        description: 'Stage all modified files',
        default: false,
      },
    },
    required: ['paths'],
  },
  idempotent: false,
};

/**
 * PR create tool definition
 */
export const prCreateTool: MCPTool = {
  name: 'pr_create',
  description:
    'Create a GitHub pull request with AI-generated description. SIDE EFFECTS: Pushes branch and creates PR. Requires GitHub CLI (gh) to be installed and authenticated.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'PR title',
      },
      body: {
        type: 'string',
        description: 'PR body (optional, AI generates if empty)',
      },
      base: {
        type: 'string',
        description: 'Base branch for the PR',
        default: 'main',
      },
      draft: {
        type: 'boolean',
        description: 'Create as draft PR',
        default: false,
      },
      push: {
        type: 'boolean',
        description: 'Push current branch before creating PR',
        default: true,
      },
    },
    required: ['title'],
  },
  idempotent: false,
};

/**
 * PR review tool definition
 */
export const prReviewTool: MCPTool = {
  name: 'pr_review',
  description:
    'Get PR details for AI-assisted review. Fetches PR diff, commits, and files for analysis. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      prNumber: {
        type: 'number',
        description: 'PR number to review',
      },
      focus: {
        type: 'string',
        enum: ['security', 'architecture', 'performance', 'all'],
        description: 'Review focus area',
        default: 'all',
      },
    },
    required: ['prNumber'],
  },
  idempotent: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute a git command with timeout and error handling
 */
async function execGit(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const cwd = options?.cwd ?? process.cwd();
  const timeout = options?.timeout ?? GIT_TIMEOUT;

  try {
    const result = await execAsync(`git ${args.join(' ')}`, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });
    return result;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    // If git command failed but has output, return it
    if (execError.stdout || execError.stderr) {
      return {
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? '',
      };
    }
    throw error;
  }
}

/**
 * Execute GitHub CLI command
 */
async function execGh(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const cwd = options?.cwd ?? process.cwd();
  const timeout = options?.timeout ?? GIT_TIMEOUT;

  const result = await execAsync(`gh ${args.join(' ')}`, {
    cwd,
    timeout,
    maxBuffer: 1024 * 1024 * 10,
  });
  return result;
}

/**
 * Parse git status output into structured format
 */
function parseGitStatus(output: string): {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
} {
  const lines = output.trim().split('\n').filter(Boolean);
  const result = {
    branch: '',
    staged: [] as string[],
    unstaged: [] as string[],
    untracked: [] as string[],
  };

  for (const line of lines) {
    // Parse branch name from "On branch X" or "HEAD detached at X"
    if (line.startsWith('On branch ')) {
      result.branch = line.replace('On branch ', '');
    } else if (line.startsWith('HEAD detached at ')) {
      result.branch = line.replace('HEAD detached at ', '(detached) ');
    }

    // Parse porcelain-style status
    const match = line.match(/^(.)(.) (.+)$/);
    if (match) {
      const indexStatus = match[1] ?? '';
      const worktreeStatus = match[2] ?? '';
      const file = match[3] ?? '';
      if (indexStatus !== ' ' && indexStatus !== '?') {
        result.staged.push(`${indexStatus} ${file}`);
      }
      if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
        result.unstaged.push(`${worktreeStatus} ${file}`);
      }
      if (indexStatus === '?' && worktreeStatus === '?') {
        result.untracked.push(file);
      }
    }
  }

  return result;
}

/**
 * Generate commit message based on diff
 */
function generateCommitMessageSuggestion(
  diff: string,
  type?: string,
  scope?: string
): string {
  // Analyze diff to suggest commit message
  const lines = diff.split('\n');
  const filesChanged = new Set<string>();
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match && match[1]) filesChanged.add(match[1]);
    }
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }

  const prefix = type ? (scope ? `${type}(${scope}): ` : `${type}: `) : '';

  // Simple heuristic for commit message
  if (filesChanged.size === 1) {
    const file = [...filesChanged][0];
    if (additions > deletions * 2) {
      return `${prefix}add functionality to ${file}`;
    } else if (deletions > additions * 2) {
      return `${prefix}remove code from ${file}`;
    } else {
      return `${prefix}update ${file}`;
    }
  } else {
    return `${prefix}update ${filesChanged.size} files (+${additions}/-${deletions})`;
  }
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle git_status tool
 */
export const handleGitStatus: ToolHandler = async (args) => {
  try {
    const repoPath = (args.path as string) ?? process.cwd();
    const useShort = args.short === true;

    // Get branch name
    const branchResult = await execGit(['branch', '--show-current'], { cwd: repoPath });
    const branch = branchResult.stdout.trim() || '(detached)';

    // Get status
    const statusArgs = ['status', '--porcelain=v1'];
    const statusResult = await execGit(statusArgs, { cwd: repoPath });

    // Parse status
    const parsed = parseGitStatus(statusResult.stdout);
    parsed.branch = branch;

    // Get commit info
    const commitResult = await execGit(['log', '-1', '--format=%h %s'], { cwd: repoPath });
    const lastCommit = commitResult.stdout.trim();

    if (useShort) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            branch,
            staged: parsed.staged.length,
            unstaged: parsed.unstaged.length,
            untracked: parsed.untracked.length,
            lastCommit,
          }),
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          branch,
          lastCommit,
          staged: parsed.staged,
          unstaged: parsed.unstaged,
          untracked: parsed.untracked,
          summary: `${parsed.staged.length} staged, ${parsed.unstaged.length} unstaged, ${parsed.untracked.length} untracked`,
        }),
      }],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: { code: 'GIT_STATUS_FAILED', message },
        }),
      }],
      isError: true,
    };
  }
};

/**
 * Handle git_diff tool
 */
export const handleGitDiff: ToolHandler = async (args) => {
  try {
    const paths = (args.paths as string[]) ?? [];
    const staged = args.staged === true;
    const commit = args.commit as string | undefined;
    const base = args.base as string | undefined;
    const stat = args.stat === true;

    // Build diff command
    const diffArgs = ['diff'];
    if (staged) diffArgs.push('--cached');
    if (stat) diffArgs.push('--stat');
    if (base && commit) {
      diffArgs.push(`${base}...${commit}`);
    } else if (commit) {
      diffArgs.push(commit);
    }
    if (paths.length > 0) {
      diffArgs.push('--');
      diffArgs.push(...paths);
    }

    const result = await execGit(diffArgs);

    // Truncate if too large
    let diff = result.stdout;
    let truncated = false;
    if (diff.length > MAX_DIFF_SIZE) {
      diff = diff.substring(0, MAX_DIFF_SIZE);
      truncated = true;
    }

    // Get diff stats
    const statsResult = await execGit([...diffArgs.filter(a => a !== '--stat'), '--stat']);
    const statsLines = statsResult.stdout.trim().split('\n');
    const summaryLine = statsLines[statsLines.length - 1] || '';

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          diff,
          summary: summaryLine,
          truncated,
          command: `git ${diffArgs.join(' ')}`,
        }),
      }],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: { code: 'GIT_DIFF_FAILED', message },
        }),
      }],
      isError: true,
    };
  }
};

/**
 * Handle commit_prepare tool
 */
export const handleCommitPrepare: ToolHandler = async (args) => {
  try {
    const paths = (args.paths as string[]) ?? [];
    const type = args.type as string | undefined;
    const scope = args.scope as string | undefined;
    const stageAll = args.stageAll === true;

    // Stage files
    if (stageAll) {
      await execGit(['add', '-A']);
    } else if (paths.length > 0) {
      await execGit(['add', ...paths]);
    }

    // Get staged diff for message generation
    const diffResult = await execGit(['diff', '--cached']);
    const diff = diffResult.stdout;

    if (!diff.trim()) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: { code: 'NO_CHANGES', message: 'No staged changes to commit' },
          }),
        }],
        isError: true,
      };
    }

    // Generate commit message suggestion
    const suggestedMessage = generateCommitMessageSuggestion(diff, type, scope);

    // Get staged files
    const stagedResult = await execGit(['diff', '--cached', '--name-status']);
    const stagedFiles = stagedResult.stdout.trim().split('\n').filter(Boolean);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          staged: stagedFiles,
          suggestedMessage,
          commitCommand: `git commit -m "${suggestedMessage}"`,
          instructions: 'Review the suggested message and run the commit command to finalize.',
        }),
      }],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: { code: 'COMMIT_PREPARE_FAILED', message },
        }),
      }],
      isError: true,
    };
  }
};

/**
 * Handle pr_create tool
 */
export const handlePrCreate: ToolHandler = async (args) => {
  try {
    const title = args.title as string;
    const body = args.body as string | undefined;
    const base = (args.base as string) ?? 'main';
    const draft = args.draft === true;
    const push = args.push !== false;

    // Check if gh is available
    try {
      await execAsync('gh --version');
    } catch {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: { code: 'GH_NOT_FOUND', message: 'GitHub CLI (gh) is not installed or not authenticated' },
          }),
        }],
        isError: true,
      };
    }

    // Push branch if requested
    if (push) {
      const branchResult = await execGit(['branch', '--show-current']);
      const branch = branchResult.stdout.trim();

      try {
        await execGit(['push', '-u', 'origin', branch]);
      } catch {
        // Branch might already be pushed, continue
      }
    }

    // Generate PR body if not provided
    let prBody = body;
    if (!prBody) {
      // Get commits since base
      const commitsResult = await execGit(['log', `${base}..HEAD`, '--oneline']);
      const commits = commitsResult.stdout.trim().split('\n').filter(Boolean);

      // Get diff stats
      const diffResult = await execGit(['diff', `${base}...HEAD`, '--stat']);
      const diffStats = diffResult.stdout.trim();

      prBody = `## Summary\n\n${commits.map(c => `- ${c}`).join('\n')}\n\n## Changes\n\n\`\`\`\n${diffStats}\n\`\`\`\n\n---\n*Generated with AutomatosX*`;
    }

    // Create PR
    const prArgs = ['pr', 'create', '--title', title, '--body', prBody, '--base', base];
    if (draft) prArgs.push('--draft');

    const result = await execGh(prArgs);
    const prUrl = result.stdout.trim();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          url: prUrl,
          title,
          base,
          draft,
        }),
      }],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: { code: 'PR_CREATE_FAILED', message },
        }),
      }],
      isError: true,
    };
  }
};

/**
 * Handle pr_review tool
 */
export const handlePrReview: ToolHandler = async (args) => {
  try {
    const prNumber = args.prNumber as number;
    const focus = (args.focus as string) ?? 'all';

    // Check if gh is available
    try {
      await execAsync('gh --version');
    } catch {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: { code: 'GH_NOT_FOUND', message: 'GitHub CLI (gh) is not installed or not authenticated' },
          }),
        }],
        isError: true,
      };
    }

    // Get PR details
    const prResult = await execGh(['pr', 'view', String(prNumber), '--json', 'title,body,author,additions,deletions,files,commits']);
    const prData = JSON.parse(prResult.stdout);

    // Get PR diff
    const diffResult = await execGh(['pr', 'diff', String(prNumber)]);
    let diff = diffResult.stdout;
    let truncated = false;
    if (diff.length > MAX_DIFF_SIZE) {
      diff = diff.substring(0, MAX_DIFF_SIZE);
      truncated = true;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          prNumber,
          title: prData.title,
          author: prData.author?.login,
          body: prData.body,
          stats: {
            additions: prData.additions,
            deletions: prData.deletions,
            filesChanged: prData.files?.length ?? 0,
            commits: prData.commits?.length ?? 0,
          },
          files: prData.files?.map((f: { path: string }) => f.path) ?? [],
          diff,
          truncated,
          focus,
        }),
      }],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: { code: 'PR_REVIEW_FAILED', message },
        }),
      }],
      isError: true,
    };
  }
};

// ============================================================================
// Exports
// ============================================================================

export const GIT_TOOLS: MCPTool[] = [
  gitStatusTool,
  gitDiffTool,
  commitPrepareTool,
  prCreateTool,
  prReviewTool,
];

export const GIT_HANDLERS: Record<string, ToolHandler> = {
  git_status: handleGitStatus,
  git_diff: handleGitDiff,
  commit_prepare: handleCommitPrepare,
  pr_create: handlePrCreate,
  pr_review: handlePrReview,
};
