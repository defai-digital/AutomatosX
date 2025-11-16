/**
 * Session Command - Manage multi-agent sessions
 * Phase 3: Advanced Features - Week 3
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '../../core/SessionManager.js';
import { printError } from '../../utils/error-formatter.js';

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/**
 * Format date to relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Command: ax session create
 */
function createCreateCommand(): Command {
  return new Command('create')
    .description('Create a new multi-agent session')
    .argument('<name>', 'Session name')
    .argument('<agents...>', 'Agent names to include in session')
    .action(async (name: string, agents: string[]) => {
      try {
        const manager = new SessionManager();
        const session = await manager.createSession(name, agents);

        console.log(chalk.green.bold('\n✓ Session created successfully\n'));
        console.log(chalk.white(`Session ID: ${chalk.cyan(session.id)}`));
        console.log(chalk.white(`Name: ${chalk.cyan(session.name)}`));
        console.log(chalk.white(`Agents: ${chalk.cyan(session.agents.length > 0 ? session.agents.join(', ') : '(none)')}`));
        console.log(chalk.gray(`\nUse with: ax run <agent> "<task>" --session ${session.id}\n`));
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });
}

/**
 * Command: ax session list
 */
function createListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List all sessions')
    .option('-a, --all', 'Show closed sessions (default: active only)')
    .action(async (options) => {
      try {
        const manager = new SessionManager();
        let sessions = await manager.listSessions();

        if (!options.all) {
          sessions = sessions.filter(s => s.status === 'active');
        }

        if (sessions.length === 0) {
          console.log(chalk.yellow('\nNo sessions found\n'));
          console.log(chalk.gray('Create one with: ax session create <name> <agents...>\n'));
          return;
        }

        console.log(chalk.bold('\n📋 Sessions\n'));
        console.log('─'.repeat(80));

        for (const session of sessions) {
          const statusColor = session.status === 'active' ? chalk.green : chalk.gray;
          const statusText = session.status === 'active' ? '●' : '○';

          console.log(chalk.white(`\n${statusColor(statusText)} ${chalk.bold(session.name)}`));
          console.log(chalk.gray(`   ID: ${session.id}`));
          console.log(chalk.gray(`   Agents: ${session.agents.length > 0 ? session.agents.join(', ') : '(none)'}`));
          console.log(chalk.gray(`   History: ${session.history.length} executions`));
          console.log(chalk.gray(`   Updated: ${formatRelativeTime(session.updatedAt)}`));
        }

        console.log('\n' + '─'.repeat(80));
        console.log(chalk.gray(`Total: ${sessions.length} sessions\n`));
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });
}

/**
 * Command: ax session show
 */
function createShowCommand(): Command {
  return new Command('show')
    .description('Show session details')
    .argument('<id>', 'Session ID')
    .option('-v, --verbose', 'Show full execution history')
    .action(async (id: string, options) => {
      try {
        const manager = new SessionManager();
        const session = await manager.loadSession(id);

        if (!session) {
          console.error(chalk.red(`\n❌ Session not found: ${id}\n`));
          process.exit(1);
        }

        const statusColor = session.status === 'active' ? chalk.green : chalk.gray;

        console.log(chalk.bold(`\n📋 Session: ${session.name}\n`));
        console.log('─'.repeat(80));
        console.log(chalk.white(`ID: ${session.id}`));
        console.log(chalk.white(`Status: ${statusColor(session.status)}`));
        console.log(chalk.white(`Agents: ${session.agents.length > 0 ? session.agents.join(', ') : '(none)'}`));
        console.log(chalk.white(`Created: ${session.createdAt.toLocaleString()}`));
        console.log(chalk.white(`Updated: ${session.updatedAt.toLocaleString()}`));
        console.log(chalk.white(`Executions: ${session.history.length}`));

        if (session.history.length > 0) {
          console.log(chalk.bold('\n📜 Execution History\n'));

          const historyToShow = options.verbose
            ? session.history
            : session.history.slice(-5);

          for (const entry of historyToShow) {
            console.log(chalk.cyan(`\n[${entry.timestamp.toLocaleString()}]`));
            console.log(chalk.white(`  Agent: ${entry.agent}`));
            console.log(chalk.white(`  Task: ${entry.task}`));
            console.log(chalk.white(`  Duration: ${formatDuration(entry.duration)}`));
            if (entry.provider) {
              console.log(chalk.gray(`  Provider: ${entry.provider}/${entry.model || 'default'}`));
            }
            if (options.verbose) {
              console.log(chalk.gray(`  Result: ${entry.result.substring(0, 200)}${entry.result.length > 200 ? '...' : ''}`));
            }
          }

          if (!options.verbose && session.history.length > 5) {
            console.log(chalk.gray(`\n  ... and ${session.history.length - 5} more (use --verbose to see all)`));
          }
        }

        console.log('\n' + '─'.repeat(80) + '\n');
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });
}

/**
 * Command: ax session close
 */
function createCloseCommand(): Command {
  return new Command('close')
    .description('Close a session')
    .argument('<id>', 'Session ID')
    .action(async (id: string) => {
      try {
        const manager = new SessionManager();
        await manager.closeSession(id);

        console.log(chalk.green(`\n✓ Session closed: ${id}\n`));
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });
}

/**
 * Command: ax session delete
 */
function createDeleteCommand(): Command {
  return new Command('delete')
    .alias('rm')
    .description('Delete a session')
    .argument('<id>', 'Session ID')
    .action(async (id: string) => {
      try {
        const manager = new SessionManager();
        await manager.deleteSession(id);

        console.log(chalk.green(`\n✓ Session deleted: ${id}\n`));
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });
}

/**
 * Create session command with subcommands
 */
export function createSessionCommand(): Command {
  const sessionCommand = new Command('session')
    .description('Manage multi-agent sessions');

  sessionCommand.addCommand(createCreateCommand());
  sessionCommand.addCommand(createListCommand());
  sessionCommand.addCommand(createShowCommand());
  sessionCommand.addCommand(createCloseCommand());
  sessionCommand.addCommand(createDeleteCommand());

  return sessionCommand;
}
