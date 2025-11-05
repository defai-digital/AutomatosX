/**
 * Command Palette
 *
 * Provides contextual quick actions after AI responses
 * Phase 2 P0: Help users discover features without overwhelming them
 */

import type { CommandHandler, Message } from './types.js';
import chalk from 'chalk';
import { execSync } from 'child_process';

export interface QuickAction {
  label: string;
  command: string;
  description: string;
  category: 'test' | 'build' | 'code' | 'git' | 'agent' | 'info';
  contextRelevant: boolean;
}

export interface PaletteContext {
  lastMessages: Message[];
  hasCodeChanges: boolean;
  hasTests: boolean;
  hasBuild: boolean;
  activeAgent: string | null;
  currentBranch: string | null;
}

/**
 * Generate contextual quick actions based on conversation context
 */
export function generateQuickActions(context: PaletteContext): QuickAction[] {
  const actions: QuickAction[] = [];

  // Code changes detected → suggest testing
  if (context.hasCodeChanges) {
    actions.push({
      label: 'Run Tests',
      command: 'test',
      description: 'Verify changes with test suite',
      category: 'test',
      contextRelevant: true
    });

    actions.push({
      label: 'Check Lint',
      command: 'lint',
      description: 'Check code style and quality',
      category: 'code',
      contextRelevant: true
    });

    actions.push({
      label: 'Format Code',
      command: 'format',
      description: 'Apply code formatting',
      category: 'code',
      contextRelevant: true
    });
  }

  // After tests → suggest build or coverage
  if (context.hasTests) {
    actions.push({
      label: 'Build Project',
      command: 'build',
      description: 'Create production build',
      category: 'build',
      contextRelevant: true
    });

    actions.push({
      label: 'Coverage Report',
      command: 'coverage',
      description: 'See test coverage metrics',
      category: 'test',
      contextRelevant: true
    });
  }

  // Build completed → suggest git operations
  if (context.hasBuild) {
    actions.push({
      label: 'Git Status',
      command: 'status',
      description: 'Check changed files',
      category: 'git',
      contextRelevant: true
    });

    actions.push({
      label: 'View Diff',
      command: 'git diff',
      description: 'See code changes',
      category: 'git',
      contextRelevant: true
    });
  }

  // Agent delegation available
  if (context.activeAgent) {
    actions.push({
      label: 'Delegate to @quality',
      command: '@quality review this code',
      description: 'Get QA review',
      category: 'agent',
      contextRelevant: true
    });

    actions.push({
      label: 'Delegate to @security',
      command: '@security audit this',
      description: 'Security audit',
      category: 'agent',
      contextRelevant: true
    });
  }

  // Always show some common actions
  if (actions.length < 4) {
    addCommonActions(actions, context);
  }

  // Limit to 6 actions max for clean UI
  return actions.slice(0, 6);
}

/**
 * Add common/default actions
 */
function addCommonActions(actions: QuickAction[], context: PaletteContext): void {
  const commonActions: QuickAction[] = [
    {
      label: 'Run Tests',
      command: 'test',
      description: 'Execute test suite',
      category: 'test',
      contextRelevant: false
    },
    {
      label: 'Show Files',
      command: 'tree',
      description: 'View directory structure',
      category: 'info',
      contextRelevant: false
    },
    {
      label: 'Search Code',
      command: 'search',
      description: 'Find in codebase',
      category: 'code',
      contextRelevant: false
    },
    {
      label: 'Memory Search',
      command: 'memory search',
      description: 'Search past conversations',
      category: 'info',
      contextRelevant: false
    },
    {
      label: 'List Agents',
      command: 'agents',
      description: 'View available agents',
      category: 'agent',
      contextRelevant: false
    },
    {
      label: 'Save Session',
      command: 'save',
      description: 'Save this conversation',
      category: 'info',
      contextRelevant: false
    }
  ];

  // Add actions that aren't already in the list
  for (const action of commonActions) {
    if (!actions.find(a => a.command === action.command)) {
      actions.push(action);
    }
  }
}

/**
 * Render quick actions as formatted text
 */
export function renderQuickActions(actions: QuickAction[]): string {
  if (actions.length === 0) {
    return '';
  }

  const categoryIcons: Record<QuickAction['category'], string> = {
    test: '🧪',
    build: '📦',
    code: '📝',
    git: '🔀',
    agent: '🤖',
    info: 'ℹ️'
  };

  const lines: string[] = [];
  lines.push(''); // Blank line before
  lines.push(chalk.cyan('Quick Actions:'));

  // Render contextually relevant actions first
  const contextActions = actions.filter(a => a.contextRelevant);
  const otherActions = actions.filter(a => !a.contextRelevant);

  const renderAction = (action: QuickAction, index: number) => {
    const icon = categoryIcons[action.category];
    const label = action.contextRelevant ? chalk.bold.green(action.label) : chalk.white(action.label);
    return `${icon} ${label}    `;
  };

  if (contextActions.length > 0) {
    const rendered = contextActions.map((a, i) => renderAction(a, i)).join('');
    lines.push(`  ${rendered}`);
  }

  if (otherActions.length > 0) {
    const rendered = otherActions.map((a, i) => renderAction(a, i)).join('');
    lines.push(`  ${rendered}`);
  }

  lines.push(chalk.dim('  Type the action name or use natural language'));
  lines.push(''); // Blank line after

  return lines.join('\n');
}

/**
 * Detect context from recent messages
 */
export function detectPaletteContext(messages: Message[]): PaletteContext {
  const recentMessages = messages.slice(-5); // Last 5 messages
  const recentText = recentMessages.map(m => m.content.toLowerCase()).join(' ');

  return {
    lastMessages: recentMessages,
    hasCodeChanges: detectCodeChanges(recentText),
    hasTests: detectTests(recentText),
    hasBuild: detectBuild(recentText),
    activeAgent: detectActiveAgent(recentMessages),
    currentBranch: getCurrentGitBranch()
  };
}

/**
 * Helper: Detect if code changes were made
 */
function detectCodeChanges(text: string): boolean {
  const indicators = [
    'created file',
    'modified',
    'updated',
    'changed',
    'edited',
    'wrote to',
    'saved',
    'implementation',
    'refactored'
  ];

  return indicators.some(indicator => text.includes(indicator));
}

/**
 * Helper: Detect if tests were mentioned/run
 */
function detectTests(text: string): boolean {
  const indicators = [
    'test',
    'passing',
    'passed',
    'failed',
    'coverage',
    'spec',
    'unit test',
    'integration test'
  ];

  return indicators.some(indicator => text.includes(indicator));
}

/**
 * Helper: Detect if build was mentioned
 */
function detectBuild(text: string): boolean {
  const indicators = [
    'built',
    'build complete',
    'compilation',
    'compiled',
    'bundled',
    'webpack',
    'vite',
    'rollup'
  ];

  return indicators.some(indicator => text.includes(indicator));
}

/**
 * Helper: Detect active agent from delegation
 */
function detectActiveAgent(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === 'user' && msg.content.includes('@')) {
      const match = msg.content.match(/@(\w+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return null;
}

/**
 * Helper: Get current git branch
 * Returns null if not in a git repository or if git is not available
 */
function getCurrentGitBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 1000,
      cwd: process.cwd()
    }).trim();
    return branch || null;
  } catch {
    // Not in a git repository, git not installed, or command failed
    return null;
  }
}

/**
 * Command category metadata for help organization
 */
export const COMMAND_CATEGORIES = {
  'Build & Test': {
    icon: '📦',
    description: 'Building, testing, and quality assurance',
    commands: ['test', 'coverage', 'build', 'dev', 'lint', 'format']
  },
  'Code Operations': {
    icon: '📝',
    description: 'File operations and code editing',
    commands: ['read', 'write', 'edit', 'search', 'find', 'tree']
  },
  'Git & Version Control': {
    icon: '🔀',
    description: 'Git operations and repository management',
    commands: ['status', 'git']
  },
  'Package Management': {
    icon: '📦',
    description: 'Installing and managing dependencies',
    commands: ['install', 'update', 'outdated', 'run']
  },
  'Agent Collaboration': {
    icon: '🤖',
    description: 'Working with specialized AI agents',
    commands: ['agents', '@backend', '@security', '@quality']
  },
  'Memory & Context': {
    icon: '🧠',
    description: 'Searching and managing conversation memory',
    commands: ['memory', 'history', 'save', 'load']
  },
  'Process Management': {
    icon: '⚙️',
    description: 'Managing background processes',
    commands: ['processes', 'exec', 'kill', 'output']
  },
  'Session Control': {
    icon: '💬',
    description: 'Managing conversations and sessions',
    commands: ['new', 'save', 'load', 'list', 'export', 'delete', 'clear']
  },
  'System': {
    icon: 'ℹ️',
    description: 'System information and help',
    commands: ['help', 'provider', 'stats', 'exit']
  }
} as const;

/**
 * Get command category
 */
export function getCommandCategory(command: string): string | null {
  for (const [category, data] of Object.entries(COMMAND_CATEGORIES)) {
    if ((data.commands as readonly string[]).includes(command)) {
      return category;
    }
  }
  return null;
}
