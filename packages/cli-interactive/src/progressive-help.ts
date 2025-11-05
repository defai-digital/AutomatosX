/**
 * Progressive Help System
 *
 * Categorized, progressive help that doesn't overwhelm users
 * Phase 2 P0: Better discoverability and learning curve
 */

import chalk from 'chalk';
import { COMMAND_CATEGORIES } from './command-palette.js';
import type { CommandHandler } from './types.js';

export interface HelpSection {
  title: string;
  icon: string;
  description: string;
  commands: Array<{
    name: string;
    description: string;
    usage?: string;
    examples?: string[];
  }>;
}

/**
 * Render categorized help with progressive disclosure
 */
export function renderProgressiveHelp(allCommands: CommandHandler[]): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('╭─────────────────────────────────────────────╮'));
  lines.push(chalk.bold.cyan('│   AutomatosX Interactive CLI - Help         │'));
  lines.push(chalk.bold.cyan('╰─────────────────────────────────────────────╯'));
  lines.push('');

  // Introduction
  lines.push(chalk.white('Talk naturally or use commands - both work!'));
  lines.push(chalk.dim('Example: "run tests" or "/test"'));
  lines.push('');

  // Render categories
  lines.push(chalk.bold.yellow('📚 Command Categories'));
  lines.push('');

  for (const [categoryName, categoryData] of Object.entries(COMMAND_CATEGORIES)) {
    const icon = categoryData.icon;
    const desc = chalk.dim(categoryData.description);

    // Count available commands in this category
    const availableCount = categoryData.commands.filter(cmd =>
      allCommands.some(c => c.name === cmd || cmd.startsWith('@'))
    ).length;

    if (availableCount === 0) continue;

    lines.push(`  ${icon}  ${chalk.bold.white(categoryName)} ${chalk.dim(`(${availableCount} commands)`)}`);
    lines.push(`     ${desc}`);

    // Show 3 most common commands from this category
    const topCommands = categoryData.commands
      .slice(0, 3)
      .filter(cmd => allCommands.some(c => c.name === cmd))
      .map(cmd => {
        const handler = allCommands.find(c => c.name === cmd);
        return handler ? chalk.cyan(`/${handler.name}`) : chalk.cyan(cmd);
      });

    if (topCommands.length > 0) {
      lines.push(`     ${chalk.dim('→')} ${topCommands.join(chalk.dim(', '))}`);
    }

    lines.push('');
  }

  // Quick tips
  lines.push(chalk.bold.yellow('💡 Quick Tips'));
  lines.push('');
  lines.push(`  ${chalk.white('•')} Type ${chalk.cyan('/help <category>')} for detailed commands`);
  lines.push(`  ${chalk.white('•')} Press ${chalk.cyan('TAB')} for auto-completion`);
  lines.push(`  ${chalk.white('•')} Use ${chalk.cyan('@agent')} to delegate tasks (e.g., ${chalk.cyan('@backend "implement API"')})`);
  lines.push(`  ${chalk.white('•')} Natural language works: ${chalk.dim('"run tests", "show me the files", "search for TODO"')}`);
  lines.push('');

  // Most common commands
  lines.push(chalk.bold.yellow('🔥 Most Common'));
  lines.push('');
  const commonCommands = [
    { cmd: '/test', desc: 'Run tests', natural: '"run tests"' },
    { cmd: '/help', desc: 'Show this help', natural: '"help"' },
    { cmd: '/search <term>', desc: 'Search code', natural: '"search for TODO"' },
    { cmd: '/@backend <task>', desc: 'Delegate to agent', natural: '"have backend do X"' },
    { cmd: '/save <name>', desc: 'Save conversation', natural: '"save this session"' }
  ];

  for (const { cmd, desc, natural } of commonCommands) {
    lines.push(`  ${chalk.cyan(cmd.padEnd(20))} ${chalk.white(desc)}`);
    lines.push(`  ${' '.repeat(20)} ${chalk.dim(`or: ${natural}`)}`);
  }

  lines.push('');

  // Footer
  lines.push(chalk.dim('─'.repeat(48)));
  lines.push(chalk.dim('Type /exit to quit • Visit docs at https://github.com/defai-digital/automatosx'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Render detailed help for a specific category
 */
export function renderCategoryHelp(
  categoryName: string,
  allCommands: CommandHandler[]
): string {
  const lines: string[] = [];

  // Find category
  const category = Object.entries(COMMAND_CATEGORIES).find(
    ([name]) => name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!category) {
    return chalk.red(`Category not found: ${categoryName}\n`) +
           chalk.dim('Available categories: ') +
           Object.keys(COMMAND_CATEGORIES).map(c => chalk.cyan(c)).join(', ');
  }

  const [catName, catData] = category;

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan(`${catData.icon}  ${catName}`));
  lines.push(chalk.dim(catData.description));
  lines.push('');

  // List all commands in this category
  for (const cmdName of catData.commands) {
    const handler = allCommands.find(c => c.name === cmdName);

    if (!handler && !cmdName.startsWith('@')) continue;

    if (handler) {
      lines.push(chalk.bold.white(`/${handler.name}`));
      lines.push(`  ${chalk.dim(handler.description)}`);

      if (handler.usage) {
        lines.push(`  ${chalk.dim('Usage:')} ${chalk.cyan(`/${handler.name} ${handler.usage}`)}`);
      }

      if (handler.aliases && handler.aliases.length > 0) {
        lines.push(`  ${chalk.dim('Aliases:')} ${handler.aliases.map(a => chalk.cyan(`/${a}`)).join(', ')}`);
      }

      lines.push('');
    } else if (cmdName.startsWith('@')) {
      // Agent command
      lines.push(chalk.bold.white(cmdName));
      lines.push(`  ${chalk.dim('Delegate task to specialized agent')}`);
      lines.push(`  ${chalk.dim('Usage:')} ${chalk.cyan(`${cmdName} "your task description"`)}`);
      lines.push('');
    }
  }

  // Show natural language examples for this category
  const examples = getCategoryExamples(catName);
  if (examples.length > 0) {
    lines.push(chalk.bold.yellow('💬 Natural Language Examples'));
    lines.push('');
    for (const example of examples) {
      lines.push(`  ${chalk.dim('→')} ${chalk.white(example)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get natural language examples for a category
 */
function getCategoryExamples(categoryName: string): string[] {
  const examples: Record<string, string[]> = {
    'Build & Test': [
      'run tests',
      'run the unit tests',
      'check coverage',
      'build the project',
      'start dev server',
      'lint my code',
      'format everything'
    ],
    'Code Operations': [
      'read src/app.ts',
      'show me package.json',
      'edit config file',
      'search for TODO',
      'find all TypeScript files',
      'show file tree'
    ],
    'Git & Version Control': [
      'git status',
      'show me what changed',
      'git commit',
      'git push'
    ],
    'Package Management': [
      'install lodash',
      'add react',
      'update packages',
      'show outdated',
      'run dev script'
    ],
    'Agent Collaboration': [
      'list agents',
      'have backend implement auth',
      'ask security to audit this',
      'delegate to quality for testing'
    ],
    'Memory & Context': [
      'search memory for authentication',
      'show conversation history',
      'save this session',
      'load my previous work'
    ],
    'Process Management': [
      'show running processes',
      'run command ls -la',
      'kill process 1234',
      'view output of process'
    ]
  };

  return examples[categoryName] || [];
}

/**
 * Render quick reference card (single-screen cheatsheet)
 */
export function renderQuickReference(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('╭─ Quick Reference ─╮'));
  lines.push('');

  const shortcuts = [
    ['Natural Language', 'Just type what you want'],
    ['Commands', '/command [args]'],
    ['Agent Delegation', '@agent "task"'],
    ['Help', '/help or /help <category>'],
    ['History', '/history or "show history"'],
    ['Save/Load', '/save <name>, /load <name>'],
    ['Exit', '/exit or Ctrl+C twice']
  ];

  for (const [key, value] of shortcuts) {
    if (key) {
      lines.push(`  ${chalk.bold.white(key.padEnd(20))} ${chalk.dim(value)}`);
    }
  }

  lines.push('');
  lines.push(chalk.dim('Press TAB for completion • Type /help for full guide'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Get contextual help based on recent activity
 */
export function getContextualHelp(context: {
  lastCommand?: string;
  lastError?: string;
  messageCount: number;
}): string | null {
  // First time user
  if (context.messageCount === 0) {
    return chalk.dim('💡 Tip: Try saying "run tests" or "/help" to get started');
  }

  // After an error
  if (context.lastError) {
    if (context.lastError.includes('command not found')) {
      return chalk.dim('💡 Tip: Try natural language like "run tests" or use /help to see commands');
    }
    if (context.lastError.includes('permission')) {
      return chalk.dim('💡 Tip: Some operations require approval for safety');
    }
  }

  // After certain commands, suggest next steps
  if (context.lastCommand === 'test') {
    return chalk.dim('💡 Next: Try "check coverage" or "build project"');
  }

  if (context.lastCommand === 'build') {
    return chalk.dim('💡 Next: Try "git status" to review changes');
  }

  return null;
}
