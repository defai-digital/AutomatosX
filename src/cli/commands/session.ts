/**
 * Session Command - Manage multi-agent collaborative sessions
 *
 * @since v4.7.0
 */

import type { CommandModule, Argv } from 'yargs';
import { createSessionManager } from '../utils/session-utils.js';
import chalk from 'chalk';
import Table from 'cli-table3';

interface SessionCreateOptions {
  task: string;
  initiator: string;
}

interface SessionListOptions {
  agent?: string;
  status?: 'active' | 'completed' | 'failed';
  json?: boolean;
}

interface SessionStatusOptions {
  id: string;
  json?: boolean;
}

interface SessionCompleteOptions {
  id: string;
}

interface SessionFailOptions {
  id: string;
}

/**
 * Session Create Command
 */
const createCommand: CommandModule<Record<string, unknown>, SessionCreateOptions> = {
  command: 'create <task> <initiator>',
  describe: 'Create a new multi-agent session',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<SessionCreateOptions> => {
    return yargs
      .positional('task', {
        describe: 'Overall task/goal for the session',
        type: 'string',
        demandOption: true
      })
      .positional('initiator', {
        describe: 'Agent that initiates the session',
        type: 'string',
        demandOption: true
      }) as Argv<SessionCreateOptions>;
  },

  handler: async (argv) => {
    try {
      const sessionManager = await createSessionManager();

      const session = await sessionManager.createSession(argv.task, argv.initiator);

      console.log(chalk.green.bold('\n✓ Session created successfully\n'));
      console.log(chalk.gray(`Session ID: ${chalk.white(session.id)}`));
      console.log(chalk.gray(`Task: ${chalk.white(session.task)}`));
      console.log(chalk.gray(`Initiator: ${chalk.white(session.initiator)}`));
      console.log(chalk.gray(`Status: ${chalk.white(session.status)}`));
      console.log(chalk.gray(`Created: ${chalk.white(session.createdAt.toISOString())}`));
      console.log();

      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to create session\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Session List Command
 */
const listCommand: CommandModule<Record<string, unknown>, SessionListOptions> = {
  command: 'list',
  describe: 'List all sessions',

  builder: (yargs) => {
    return yargs
      .option('agent', {
        describe: 'Filter by agent name',
        type: 'string'
      })
      .option('status', {
        describe: 'Filter by status',
        type: 'string',
        choices: ['active', 'completed', 'failed']
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    try {
      const sessionManager = await createSessionManager();

      let sessions = argv.agent
        ? await sessionManager.getActiveSessionsForAgent(argv.agent)
        : await sessionManager.getActiveSessions();

      // Filter by status if specified
      if (argv.status) {
        sessions = sessions.filter(s => s.status === argv.status);
      }

      if (argv.json) {
        console.log(JSON.stringify(sessions, null, 2));
        process.exit(0);
      }

      if (sessions.length === 0) {
        console.log(chalk.yellow('\nNo sessions found\n'));
        process.exit(0);
      }

      console.log(chalk.blue.bold(`\n📋 Sessions (${sessions.length})\n`));

      const table = new Table({
        head: ['ID', 'Task', 'Initiator', 'Agents', 'Status', 'Created'],
        colWidths: [38, 40, 15, 25, 12, 12]
      });

      sessions.forEach(session => {
        table.push([
          session.id.substring(0, 8) + '...',
          session.task.substring(0, 37) + (session.task.length > 37 ? '...' : ''),
          session.initiator,
          session.agents.join(', ').substring(0, 22),
          session.status,
          new Date(session.createdAt).toLocaleDateString()
        ]);
      });

      console.log(table.toString());
      console.log();

      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to list sessions\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Session Status Command
 */
const statusCommand: CommandModule<Record<string, unknown>, SessionStatusOptions> = {
  command: 'status <id>',
  describe: 'Show session status',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<SessionStatusOptions> => {
    return yargs
      .positional('id', {
        describe: 'Session ID',
        type: 'string',
        demandOption: true
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false
      }) as Argv<SessionStatusOptions>;
  },

  handler: async (argv) => {
    try {
      const sessionManager = await createSessionManager();
      const session = await sessionManager.getSession(argv.id);

      if (!session) {
        console.log(chalk.red.bold(`\n✗ Session not found: ${argv.id}\n`));
        process.exit(1);
      }

      if (argv.json) {
        console.log(JSON.stringify(session, null, 2));
        process.exit(0);
      }

      console.log(chalk.blue.bold('\n📊 Session Status\n'));
      console.log(chalk.gray(`ID: ${chalk.white(session.id)}`));
      console.log(chalk.gray(`Task: ${chalk.white(session.task)}`));
      console.log(chalk.gray(`Initiator: ${chalk.white(session.initiator)}`));
      console.log(chalk.gray(`Status: ${chalk.white(session.status)}`));
      console.log(chalk.gray(`Agents: ${chalk.white(session.agents.join(', '))}`));
      console.log(chalk.gray(`Created: ${chalk.white(session.createdAt.toISOString())}`));
      console.log(chalk.gray(`Updated: ${chalk.white(session.updatedAt.toISOString())}`));

      if (session.metadata && Object.keys(session.metadata).length > 0) {
        console.log(chalk.gray(`\nMetadata:`));
        Object.entries(session.metadata).forEach(([key, value]) => {
          console.log(chalk.gray(`  ${key}: ${JSON.stringify(value)}`));
        });
      }

      console.log();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to get session status\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Session Complete Command
 */
const completeCommand: CommandModule<Record<string, unknown>, SessionCompleteOptions> = {
  command: 'complete <id>',
  describe: 'Mark session as completed',

  builder: (yargs) => {
    return yargs.positional('id', {
      describe: 'Session ID',
      type: 'string',
      demandOption: true
    });
  },

  handler: async (argv) => {
    try {
      const sessionManager = await createSessionManager();
      await sessionManager.completeSession(argv.id);

      console.log(chalk.green.bold(`\n✓ Session marked as completed: ${argv.id}\n`));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to complete session\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Session Fail Command
 */
const failCommand: CommandModule<Record<string, unknown>, SessionFailOptions> = {
  command: 'fail <id>',
  describe: 'Mark session as failed',

  builder: (yargs) => {
    return yargs.positional('id', {
      describe: 'Session ID',
      type: 'string',
      demandOption: true
    });
  },

  handler: async (argv) => {
    try {
      const sessionManager = await createSessionManager();
      await sessionManager.failSession(argv.id, new Error('Manually marked as failed'));

      console.log(chalk.yellow.bold(`\n⚠ Session marked as failed: ${argv.id}\n`));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\n✗ Failed to mark session as failed\n'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }
};

/**
 * Main Session Command
 */
export const sessionCommand: CommandModule = {
  command: 'session <command>',
  describe: 'Manage multi-agent collaborative sessions',

  builder: (yargs) => {
    return yargs
      .command(createCommand)
      .command(listCommand)
      .command(statusCommand)
      .command(completeCommand)
      .command(failCommand)
      .demandCommand(1, 'You must specify a session command')
      .help();
  },

  handler: () => {
    // Parent command handler (not used, subcommands handle everything)
  }
};
