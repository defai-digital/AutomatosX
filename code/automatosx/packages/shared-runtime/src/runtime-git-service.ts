import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  RuntimeCommitPrepareResponse,
  RuntimeGitStatusFile,
  RuntimeGitStatusResponse,
  RuntimePrCreateResponse,
  RuntimePrReviewResponse,
  SharedRuntimeService,
} from './runtime-service-types.js';

const execFileAsync = promisify(execFile);

export interface RuntimeGitServiceConfig {
  basePath: string;
}

type RuntimeGitService = Pick<
  SharedRuntimeService,
  'gitStatus' | 'gitDiff' | 'commitPrepare' | 'reviewPullRequest' | 'createPullRequest'
>;

export function createRuntimeGitService(config: RuntimeGitServiceConfig): RuntimeGitService {
  const { basePath } = config;

  return {
    gitStatus(request) {
      return getGitStatus(request?.basePath ?? basePath);
    },

    async gitDiff(request) {
      const diffBasePath = request?.basePath ?? basePath;
      const command = ['diff'];
      if (request?.staged === true) {
        command.push('--cached');
      }
      if (request?.stat === true) {
        command.push('--stat');
      }
      if (typeof request?.commit === 'string' && request.commit.length > 0) {
        command.push(request.commit);
      }
      if (Array.isArray(request?.paths) && request.paths.length > 0) {
        command.push('--', ...request.paths);
      }

      try {
        const { stdout } = await execFileAsync('git', command, {
          cwd: diffBasePath,
          maxBuffer: 1024 * 1024 * 4,
        });
        return {
          diff: stdout,
          command: ['git', ...command],
          basePath: diffBasePath,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`git diff failed: ${message}`);
      }
    },

    commitPrepare(request) {
      return prepareCommit({
        basePath: request?.basePath ?? basePath,
        paths: request?.paths,
        stageAll: request?.stageAll,
        type: request?.type,
        scope: request?.scope,
      });
    },

    reviewPullRequest(request) {
      return reviewPullRequest({
        basePath: request?.basePath ?? basePath,
        base: request?.base,
        head: request?.head,
      });
    },

    createPullRequest(request) {
      return createPullRequest({
        basePath: request.basePath ?? basePath,
        title: request.title,
        body: request.body,
        base: request.base,
        head: request.head,
        draft: request.draft,
      });
    },
  };
}

async function getGitStatus(basePath: string): Promise<RuntimeGitStatusResponse> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain=1', '--branch'], {
      cwd: basePath,
      maxBuffer: 1024 * 1024 * 4,
    });
    return parseGitStatus(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git status failed: ${message}`);
  }
}

async function prepareCommit(request: {
  basePath: string;
  paths?: string[];
  stageAll?: boolean;
  type?: string;
  scope?: string;
}): Promise<RuntimeCommitPrepareResponse> {
  if (request.stageAll === true) {
    await execGit(request.basePath, ['add', '-A']);
  } else if (Array.isArray(request.paths) && request.paths.length > 0) {
    await execGit(request.basePath, ['add', '--', ...request.paths]);
  }

  const status = await getGitStatus(request.basePath);
  const candidatePaths = status.staged.map((entry) => entry.path);
  const paths = candidatePaths.length > 0
    ? candidatePaths
    : Array.from(new Set([
      ...status.unstaged.map((entry) => entry.path),
      ...status.untracked,
    ]));

  if (paths.length === 0) {
    throw new Error('commit prepare failed: no changed files found');
  }

  const diffStat = status.staged.length > 0
    ? (await execGit(request.basePath, ['diff', '--cached', '--stat'])).stdout
    : (await execGit(request.basePath, ['diff', '--stat'])).stdout;
  const type = request.type ?? inferCommitType(paths);
  const scope = request.scope ?? inferCommitScope(paths);

  return {
    message: `${type}${scope !== undefined ? `(${scope})` : ''}: ${buildCommitSummary(paths, type, scope)}`,
    stagedPaths: paths,
    diffStat,
    type,
    scope,
  };
}

async function reviewPullRequest(request: {
  basePath: string;
  base?: string;
  head?: string;
}): Promise<RuntimePrReviewResponse> {
  const base = request.base ?? 'main';
  const head = request.head ?? 'HEAD';
  const diffRange = `${base}...${head}`;

  const [diffStatResult, filesResult, commitsResult] = await Promise.all([
    execGit(request.basePath, ['diff', '--stat', diffRange]),
    execGit(request.basePath, ['diff', '--name-only', diffRange]),
    execGit(request.basePath, ['log', '--oneline', `${base}..${head}`]),
  ]);

  const changedFiles = filesResult.stdout.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const commits = commitsResult.stdout.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  return {
    base,
    head,
    commits,
    changedFiles,
    diffStat: diffStatResult.stdout,
    summary: `${changedFiles.length} changed file${changedFiles.length === 1 ? '' : 's'} across ${commits.length} commit${commits.length === 1 ? '' : 's'} from ${base} to ${head}.`,
  };
}

async function createPullRequest(request: {
  basePath: string;
  title: string;
  body?: string;
  base?: string;
  head?: string;
  draft?: boolean;
}): Promise<RuntimePrCreateResponse> {
  const base = request.base ?? 'main';
  const head = request.head ?? 'HEAD';
  const body = request.body ?? (await reviewPullRequest({
    basePath: request.basePath,
    base,
    head,
  })).summary;
  const command = ['pr', 'create', '--title', request.title, '--body', body, '--base', base, '--head', head];
  if (request.draft === true) {
    command.push('--draft');
  }

  try {
    const { stdout, stderr } = await execFileAsync('gh', command, {
      cwd: request.basePath,
      maxBuffer: 1024 * 1024 * 4,
    });
    const output = `${stdout}${stderr}`.trim();
    const url = output.split('\n').map((line) => line.trim()).find((line) => /^https?:\/\//.test(line));
    return {
      title: request.title,
      base,
      head,
      draft: request.draft ?? false,
      url,
      output,
      command: ['gh', ...command],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`pr create failed: ${message}`);
  }
}

async function execGit(basePath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync('git', args, {
      cwd: basePath,
      maxBuffer: 1024 * 1024 * 4,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args[0] ?? 'command'} failed: ${message}`);
  }
}

function parseGitStatus(output: string): RuntimeGitStatusResponse {
  const lines = output.replace(/\r/g, '').split('\n').filter((line) => line.length > 0);
  const header = lines[0]?.startsWith('## ') ? lines.shift() ?? '## HEAD' : '## HEAD';
  const { branch, upstream, ahead, behind } = parseGitBranchHeader(header);
  const staged: RuntimeGitStatusFile[] = [];
  const unstaged: RuntimeGitStatusFile[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    if (line.startsWith('?? ')) {
      untracked.push(line.slice(3));
      continue;
    }

    const indexStatus = line[0] ?? ' ';
    const workTreeStatus = line[1] ?? ' ';
    const path = line.slice(3).trim();
    const entry: RuntimeGitStatusFile = { path, indexStatus, workTreeStatus };
    if (indexStatus !== ' ') {
      staged.push(entry);
    }
    if (workTreeStatus !== ' ') {
      unstaged.push(entry);
    }
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    staged,
    unstaged,
    untracked,
    clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
  };
}

function parseGitBranchHeader(header: string): { branch: string; upstream?: string; ahead: number; behind: number } {
  const content = header.replace(/^##\s+/, '');
  const [branchPart, statusPart] = content.split(' [', 2);
  const [branch, upstream] = branchPart.split('...', 2);
  const status = statusPart?.replace(/\]$/, '') ?? '';
  const aheadMatch = status.match(/ahead\s+(\d+)/);
  const behindMatch = status.match(/behind\s+(\d+)/);

  return {
    branch: branch.trim(),
    upstream: upstream?.trim() || undefined,
    ahead: aheadMatch === null ? 0 : Number.parseInt(aheadMatch[1]!, 10),
    behind: behindMatch === null ? 0 : Number.parseInt(behindMatch[1]!, 10),
  };
}

function inferCommitType(paths: string[]): string {
  if (paths.every((path) => path.endsWith('.md') || path.startsWith('docs/') || path.startsWith('PRD/') || path.startsWith('ADR/'))) {
    return 'docs';
  }
  if (paths.every((path) => path.includes('/tests/') || path.endsWith('.test.ts') || path.endsWith('.test.js'))) {
    return 'test';
  }
  if (paths.some((path) => path === 'package.json' || path.endsWith('/package.json') || path === 'package-lock.json')) {
    return 'chore';
  }
  return 'feat';
}

function inferCommitScope(paths: string[]): string | undefined {
  const packageMatch = paths.find((path) => path.startsWith('packages/'));
  if (packageMatch !== undefined) {
    const parts = packageMatch.split('/');
    return parts[1];
  }
  if (paths.some((path) => path.startsWith('PRD/') || path.startsWith('ADR/'))) {
    return 'docs';
  }
  return undefined;
}

function buildCommitSummary(paths: string[], type: string, scope?: string): string {
  if (type === 'docs') {
    return 'update docs';
  }
  if (type === 'test') {
    return 'expand test coverage';
  }
  if (scope !== undefined && scope.length > 0) {
    return `update ${scope}`;
  }
  const packageMatch = inferCommitScope(paths);
  if (packageMatch !== undefined && packageMatch !== 'docs') {
    return `update ${packageMatch}`;
  }
  return `update ${paths.length} file${paths.length === 1 ? '' : 's'}`;
}
