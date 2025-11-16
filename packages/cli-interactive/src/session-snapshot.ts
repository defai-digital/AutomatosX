/**
 * Session Snapshot Cards
 *
 * Display workspace state like Claude Code's sidebar
 * Phase 3 P1: Persistent context awareness
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export interface SessionSnapshot {
  name: string;
  lastAction?: string;
  lastActionTime?: Date;
  activeAgents: string[];
  pendingApprovals: number;
  branch?: string;
  policyMode?: string;
  provider?: string;
  costToday?: number;
  messagesInSession: number;
  workspaceRoot?: string;
}

export interface WorkspaceState {
  hasGit: boolean;
  currentBranch?: string;
  hasPendingChanges: boolean;
  hasTests: boolean;
  hasBuild: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

/**
 * Render session snapshot card (Claude-style sidebar)
 */
export function renderSessionSnapshot(snapshot: SessionSnapshot): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('╭─ Session: ' + snapshot.name + ' ─'.repeat(Math.max(0, 40 - snapshot.name.length))));

  // Last action
  if (snapshot.lastAction && snapshot.lastActionTime) {
    const timeAgo = formatTimeAgo(snapshot.lastActionTime);
    lines.push(chalk.cyan('│') + ' ' + chalk.white('Last action:') + ' ' +
               chalk.dim(snapshot.lastAction.substring(0, 25)) + ' ' +
               chalk.dim(`(${timeAgo})`));
  }

  // Active agents
  if (snapshot.activeAgents.length > 0) {
    lines.push(chalk.cyan('│') + ' ' + chalk.white('Active agents:') + ' ' +
               snapshot.activeAgents.map(a => chalk.green(`@${a}`)).join(', '));
  }

  // Pending approvals
  if (snapshot.pendingApprovals > 0) {
    lines.push(chalk.cyan('│') + ' ' + chalk.yellow(`⚠ ${snapshot.pendingApprovals} approval${snapshot.pendingApprovals !== 1 ? 's' : ''} pending`));
  }

  // Workspace info
  const workspaceInfo = [];
  if (snapshot.branch) {
    workspaceInfo.push(chalk.blue(snapshot.branch));
  }
  if (snapshot.policyMode) {
    workspaceInfo.push(chalk.dim(snapshot.policyMode));
  }

  if (workspaceInfo.length > 0) {
    lines.push(chalk.cyan('│') + ' ' + workspaceInfo.join(' • '));
  }

  // Provider and cost
  if (snapshot.provider) {
    const providerInfo = [chalk.white(snapshot.provider)];
    if (snapshot.costToday !== undefined) {
      providerInfo.push(chalk.dim(`$${snapshot.costToday.toFixed(4)} today`));
    }
    lines.push(chalk.cyan('│') + ' ' + providerInfo.join(' • '));
  }

  // Message count
  if (snapshot.messagesInSession > 0) {
    lines.push(chalk.cyan('│') + ' ' + chalk.dim(`${snapshot.messagesInSession} messages in conversation`));
  }

  // Footer
  lines.push(chalk.cyan('╰' + '─'.repeat(48)));
  lines.push('');

  return lines.join('\n');
}

/**
 * Render compact session bar (persistent header)
 */
export function renderSessionBar(snapshot: SessionSnapshot): string {
  const parts: string[] = [];

  // Session name
  parts.push(chalk.bold.cyan(snapshot.name));

  // Branch
  if (snapshot.branch) {
    parts.push(chalk.blue(`@ ${snapshot.branch}`));
  }

  // Provider
  if (snapshot.provider) {
    parts.push(chalk.white(snapshot.provider));
  }

  // Cost
  if (snapshot.costToday !== undefined) {
    parts.push(chalk.dim(`$${snapshot.costToday.toFixed(4)}`));
  }

  // Active agents
  if (snapshot.activeAgents.length > 0) {
    parts.push(snapshot.activeAgents.map(a => chalk.green(`@${a}`)).join(','));
  }

  // Pending approvals
  if (snapshot.pendingApprovals > 0) {
    parts.push(chalk.yellow(`⚠${snapshot.pendingApprovals}`));
  }

  return parts.join(' • ');
}

/**
 * Detect workspace state
 */
export function detectWorkspaceState(workspaceRoot?: string): WorkspaceState {
  const root = workspaceRoot || process.cwd();
  const state: WorkspaceState = {
    hasGit: false,
    hasPendingChanges: false,
    hasTests: false,
    hasBuild: false
  };

  try {
    // Check for git
    if (existsSync(`${root}/.git`)) {
      state.hasGit = true;

      try {
        // Get current branch
        const branch = execSync('git branch --show-current', {
          cwd: root,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        state.currentBranch = branch;

        // Check for pending changes
        const status = execSync('git status --porcelain', {
          cwd: root,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        state.hasPendingChanges = status.length > 0;
      } catch {
        // Git commands failed, skip
      }
    }

    // Check for test files
    try {
      const hasTestFiles = existsSync(`${root}/test`) ||
                          existsSync(`${root}/tests`) ||
                          existsSync(`${root}/__tests__`);
      state.hasTests = hasTestFiles;
    } catch {
      // Skip
    }

    // Check for build tools
    try {
      const hasBuildConfig = existsSync(`${root}/webpack.config.js`) ||
                            existsSync(`${root}/vite.config.ts`) ||
                            existsSync(`${root}/rollup.config.js`) ||
                            existsSync(`${root}/tsconfig.json`);
      state.hasBuild = hasBuildConfig;
    } catch {
      // Skip
    }

    // Detect package manager
    if (existsSync(`${root}/pnpm-lock.yaml`)) {
      state.packageManager = 'pnpm';
    } else if (existsSync(`${root}/yarn.lock`)) {
      state.packageManager = 'yarn';
    } else if (existsSync(`${root}/package-lock.json`)) {
      state.packageManager = 'npm';
    }

  } catch (error) {
    // Failed to detect state, return defaults
  }

  return state;
}

/**
 * Create session snapshot from current state
 */
export function createSessionSnapshot(
  sessionName: string,
  workspaceRoot?: string,
  additionalData?: Partial<SessionSnapshot>
): SessionSnapshot {
  const workspaceState = detectWorkspaceState(workspaceRoot);

  return {
    name: sessionName,
    branch: workspaceState.currentBranch,
    activeAgents: [],
    pendingApprovals: 0,
    messagesInSession: 0,
    workspaceRoot,
    ...additionalData
  };
}

/**
 * Format time ago (like "2m ago", "1h ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHr < 24) {
    return `${diffHr}h ago`;
  } else {
    return `${diffDay}d ago`;
  }
}

/**
 * Render workspace info banner
 */
export function renderWorkspaceBanner(state: WorkspaceState, workspaceRoot?: string): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.dim('─'.repeat(50)));

  const info: string[] = [];

  // Workspace root
  if (workspaceRoot) {
    const shortPath = workspaceRoot.split('/').slice(-2).join('/');
    info.push(chalk.white(`📁 ${shortPath}`));
  }

  // Git info
  if (state.hasGit && state.currentBranch) {
    const branchInfo = chalk.blue(`🌿 ${state.currentBranch}`);
    if (state.hasPendingChanges) {
      info.push(branchInfo + ' ' + chalk.yellow('(changes)'));
    } else {
      info.push(branchInfo);
    }
  }

  // Package manager
  if (state.packageManager) {
    info.push(chalk.dim(`📦 ${state.packageManager}`));
  }

  // Features
  const features: string[] = [];
  if (state.hasTests) features.push('tests');
  if (state.hasBuild) features.push('build');

  if (features.length > 0) {
    info.push(chalk.dim(`(${features.join(', ')})`));
  }

  lines.push('  ' + info.join(' • '));
  lines.push(chalk.dim('─'.repeat(50)));
  lines.push('');

  return lines.join('\n');
}

/**
 * Update session snapshot with new data
 */
export function updateSessionSnapshot(
  snapshot: SessionSnapshot,
  updates: Partial<SessionSnapshot>
): SessionSnapshot {
  return {
    ...snapshot,
    ...updates
  };
}

/**
 * Render session list (for /sessions command)
 */
export function renderSessionList(sessions: SessionSnapshot[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Active Sessions'));
  lines.push('');

  if (sessions.length === 0) {
    lines.push(chalk.dim('No active sessions'));
    lines.push('');
    return lines.join('\n');
  }

  sessions.forEach((session, idx) => {
    const num = chalk.dim(`${idx + 1}.`);
    const name = chalk.bold.white(session.name);
    const branch = session.branch ? chalk.blue(`@ ${session.branch}`) : '';
    const msgs = chalk.dim(`(${session.messagesInSession} messages)`);

    lines.push(`  ${num} ${name} ${branch} ${msgs}`);

    if (session.lastAction && session.lastActionTime) {
      const timeAgo = formatTimeAgo(session.lastActionTime);
      lines.push(`     ${chalk.dim(`Last: ${session.lastAction} (${timeAgo})`)}`);
    }
  });

  lines.push('');
  return lines.join('\n');
}
