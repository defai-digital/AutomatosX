/**
 * Threaded Agent Updates
 *
 * Show agent delegation hierarchy like Claude Code's threaded view
 * Phase 3 P1: Visual agent communication
 */

import chalk from 'chalk';

export interface AgentUpdate {
  agent: string;
  displayName?: string;
  task: string;
  status: 'starting' | 'in_progress' | 'complete' | 'error' | 'delegated';
  message?: string;
  parentAgent?: string;
  depth: number;
  timestamp: Date;
  duration?: number;  // in milliseconds
  output?: string;
  error?: string;
}

export interface AgentThread {
  root: AgentUpdate;
  children: AgentThread[];
}

/**
 * Agent avatars/icons (matches agent personalities)
 */
const AGENT_AVATARS: Record<string, string> = {
  backend: '🔧',
  frontend: '🎨',
  security: '🔒',
  quality: '✅',
  product: '📋',
  design: '🎨',
  devops: '⚙️',
  data: '📊',
  writer: '✍️',
  cto: '👔',
  ceo: '💼',
  researcher: '🔬',
  'data-scientist': '📈',
  architecture: '🏗️',
  fullstack: '⚡',
  mobile: '📱',
  default: '🤖'
};

/**
 * Status indicators
 */
const STATUS_INDICATORS = {
  starting: chalk.blue('◉'),
  in_progress: chalk.yellow('⏳'),
  complete: chalk.green('✓'),
  error: chalk.red('✗'),
  delegated: chalk.cyan('→')
};

/**
 * Render a single agent update
 */
export function renderAgentUpdate(update: AgentUpdate, options: {
  showTimestamp?: boolean;
  showDuration?: boolean;
  compact?: boolean;
} = {}): string {
  const {
    showTimestamp = false,
    showDuration = true,
    compact = false
  } = options;

  const lines: string[] = [];

  // Indentation for depth
  const indent = '  '.repeat(update.depth);

  // Avatar
  const avatar = AGENT_AVATARS[update.agent] || AGENT_AVATARS.default;

  // Status indicator
  const status = STATUS_INDICATORS[update.status];

  // Display name
  const displayName = update.displayName || update.agent;

  // Timestamp
  const timestamp = showTimestamp ? chalk.dim(` [${update.timestamp.toLocaleTimeString()}]`) : '';

  // Duration
  const duration = showDuration && update.duration
    ? chalk.dim(` (${formatDuration(update.duration)})`)
    : '';

  // Header line
  const header = `${indent}${status} ${avatar} ${chalk.bold.white(displayName)}${timestamp}${duration}`;
  lines.push(header);

  // Task (if not compact)
  if (!compact && update.task) {
    const taskLine = `${indent}   ${chalk.dim('Task:')} ${chalk.white(update.task)}`;
    lines.push(taskLine);
  }

  // Message (if present)
  if (update.message) {
    const msgLine = `${indent}   ${chalk.dim(update.message)}`;
    lines.push(msgLine);
  }

  // Output preview (if complete and has output)
  if (update.status === 'complete' && update.output && !compact) {
    const preview = update.output.split('\n').slice(0, 3).join('\n');
    const outputLine = `${indent}   ${chalk.dim('↳')} ${chalk.green(preview)}`;
    lines.push(outputLine);

    if (update.output.split('\n').length > 3) {
      lines.push(`${indent}   ${chalk.dim('   ... (truncated)')}`);
    }
  }

  // Error (if present)
  if (update.error) {
    const errorLine = `${indent}   ${chalk.red('Error:')} ${chalk.red(update.error)}`;
    lines.push(errorLine);
  }

  return lines.join('\n');
}

/**
 * Render threaded agent hierarchy
 */
export function renderAgentThread(thread: AgentThread, options: {
  showTimestamp?: boolean;
  showDuration?: boolean;
  compact?: boolean;
} = {}): string {
  const lines: string[] = [];

  // Render root
  lines.push(renderAgentUpdate(thread.root, options));

  // Render children recursively
  thread.children.forEach((child, idx) => {
    const isLast = idx === thread.children.length - 1;
    const childLines = renderAgentThread(child, options);

    // Add connection lines (Claude-style)
    const connector = isLast ? '└─' : '├─';
    const prefix = '  '.repeat(thread.root.depth + 1);

    const formattedChild = childLines.split('\n').map((line, lineIdx) => {
      if (lineIdx === 0) {
        return `${prefix}${connector} ${line.trim()}`;
      } else {
        const continuation = isLast ? '  ' : '│ ';
        return `${prefix}${continuation} ${line.trim()}`;
      }
    }).join('\n');

    lines.push(formattedChild);
  });

  return lines.join('\n');
}

/**
 * Render delegation chain (simplified view)
 */
export function renderDelegationChain(updates: AgentUpdate[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Agent Delegation Chain'));
  lines.push('');

  updates.forEach((update, idx) => {
    const avatar = AGENT_AVATARS[update.agent] || AGENT_AVATARS.default;
    const status = STATUS_INDICATORS[update.status];
    const displayName = update.displayName || update.agent;

    // Arrow connector
    if (idx > 0) {
      const indent = '  '.repeat(idx - 1);
      lines.push(`${indent}  ${chalk.cyan('↓')}`);
    }

    // Agent line
    const indent = '  '.repeat(idx);
    const duration = update.duration ? chalk.dim(` (${formatDuration(update.duration)})`) : '';
    lines.push(`${indent}${status} ${avatar} ${chalk.bold.white(displayName)}${duration}`);

    // Task (abbreviated)
    if (update.task && update.task.length > 50) {
      lines.push(`${indent}  ${chalk.dim(update.task.substring(0, 47) + '...')}`);
    } else if (update.task) {
      lines.push(`${indent}  ${chalk.dim(update.task)}`);
    }
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Create an agent update
 */
export function createAgentUpdate(
  agent: string,
  task: string,
  status: AgentUpdate['status'] = 'starting',
  options: Partial<AgentUpdate> = {}
): AgentUpdate {
  return {
    agent,
    task,
    status,
    depth: options.depth || 0,
    timestamp: new Date(),
    ...options
  };
}

/**
 * Build thread from flat list of updates
 */
export function buildAgentThread(updates: AgentUpdate[]): AgentThread | null {
  if (updates.length === 0) return null;

  // Find root (depth 0)
  const root = updates.find(u => u.depth === 0);
  if (!root) return null;

  // Recursive function to build tree
  const buildTree = (parent: AgentUpdate, depth: number): AgentThread => {
    const children = updates
      .filter(u => u.parentAgent === parent.agent && u.depth === depth + 1)
      .map(child => buildTree(child, depth + 1));

    return {
      root: parent,
      children
    };
  };

  return buildTree(root, 0);
}

/**
 * Render agent activity summary
 */
export function renderAgentSummary(updates: AgentUpdate[]): string {
  const lines: string[] = [];

  // Group by agent
  const byAgent = updates.reduce((acc, update) => {
    if (!acc[update.agent]) {
      acc[update.agent] = [];
    }
    acc[update.agent]!.push(update);
    return acc;
  }, {} as Record<string, AgentUpdate[]>);

  lines.push('');
  lines.push(chalk.bold.cyan('Agent Activity Summary'));
  lines.push('');

  Object.entries(byAgent).forEach(([agent, agentUpdates]) => {
    const avatar = AGENT_AVATARS[agent] || AGENT_AVATARS.default;
    const completed = agentUpdates.filter(u => u.status === 'complete').length;
    const total = agentUpdates.length;
    const totalDuration = agentUpdates
      .filter(u => u.duration)
      .reduce((sum, u) => sum + (u.duration || 0), 0);

    const durationStr = totalDuration > 0 ? chalk.dim(` (${formatDuration(totalDuration)})`) : '';

    lines.push(`  ${avatar} ${chalk.bold.white(agent)} ${chalk.dim(`${completed}/${total} tasks`)}${durationStr}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Render live agent status (for multiple concurrent agents)
 */
export function renderLiveAgentStatus(updates: AgentUpdate[]): string {
  const lines: string[] = [];

  const inProgress = updates.filter(u => u.status === 'in_progress' || u.status === 'starting');

  if (inProgress.length === 0) {
    return chalk.dim('No agents currently active');
  }

  lines.push(chalk.bold.yellow(`⏳ ${inProgress.length} agent${inProgress.length !== 1 ? 's' : ''} working...`));
  lines.push('');

  inProgress.forEach(update => {
    const avatar = AGENT_AVATARS[update.agent] || AGENT_AVATARS.default;
    const displayName = update.displayName || update.agent;
    const elapsed = Date.now() - update.timestamp.getTime();
    const elapsedStr = chalk.dim(`(${formatDuration(elapsed)})`);

    lines.push(`  ${avatar} ${chalk.bold.white(displayName)} ${elapsedStr}`);
    lines.push(`     ${chalk.dim(update.task.substring(0, 50))}${update.task.length > 50 ? '...' : ''}`);
  });

  return lines.join('\n');
}

/**
 * Format duration (ms → human readable)
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get agent display name from agent ID
 */
export function getAgentDisplayName(agent: string): string {
  const displayNames: Record<string, string> = {
    backend: 'Bob (Backend)',
    frontend: 'Frank (Frontend)',
    security: 'Steve (Security)',
    quality: 'Queenie (QA)',
    product: 'Paris (Product)',
    design: 'Debbee (Design)',
    devops: 'Oliver (DevOps)',
    data: 'Daisy (Data)',
    writer: 'Wendy (Writer)',
    cto: 'Tony (CTO)',
    ceo: 'Eric (CEO)',
    researcher: 'Rodman (Research)',
    'data-scientist': 'Dana (Data Science)',
    architecture: 'Avery (Architecture)',
    fullstack: 'Felix (Full Stack)',
    mobile: 'Maya (Mobile)'
  };

  return displayNames[agent] || agent;
}
