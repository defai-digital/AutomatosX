/**
 * Session Commands
 *
 * Commands for managing execution sessions.
 *
 * Usage:
 *   ax session list           - List sessions
 *   ax session info <id>      - Get session details
 *
 * @module @ax/cli/commands/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { getContext } from '../utils/context.js';
import * as output from '../utils/output.js';
import * as spinner from '../utils/spinner.js';

// =============================================================================
// Types
// =============================================================================

interface SessionListArgs {
  state?: 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
  agent?: string;
  limit?: number;
  json?: boolean;
}

interface SessionInfoArgs {
  id: string;
  json?: boolean;
}

// =============================================================================
// Session List Command
// =============================================================================

const listCommand: CommandModule<object, SessionListArgs> = {
  command: 'list',
  describe: 'List sessions',

  builder: (yargs) =>
    yargs
      .option('state', {
        alias: 's',
        describe: 'Filter by state',
        choices: ['active', 'paused', 'completed', 'cancelled', 'failed'] as const,
      })
      .option('agent', {
        alias: 'a',
        describe: 'Filter by agent ID',
        type: 'string',
      })
      .option('limit', {
        alias: 'l',
        describe: 'Maximum results',
        type: 'number',
        default: 20,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<SessionListArgs>) => {
    try {
      const { state, agent, json } = argv;

      if (!json) {
        spinner.start('Loading sessions...');
      }

      const ctx = await getContext();
      const sessions = await ctx.sessionManager.list({
        state,
        agent,
      });

      if (json) {
        output.json(sessions);
      } else {
        spinner.succeed(`Found ${sessions.length} sessions`);
        output.newline();

        if (sessions.length === 0) {
          output.info('No sessions found');
          return;
        }

        const rows = sessions.map((s) => [
          s.id.slice(0, 8),
          s.name.slice(0, 20) + (s.name.length > 20 ? '...' : ''),
          output.statusBadge(s.state),
          `${s.agentCount}`,
          `${s.completedTasks}/${s.totalTasks}`,
          output.formatRelativeTime(s.createdAt),
        ]);

        output.simpleTable(['ID', 'Name', 'State', 'Agents', 'Tasks', 'Created'], rows);
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to list sessions', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Session Info Command
// =============================================================================

const infoCommand: CommandModule<object, SessionInfoArgs> = {
  command: 'info <id>',
  describe: 'Get session details',

  builder: (yargs) =>
    yargs
      .positional('id', {
        describe: 'Session ID',
        type: 'string',
        demandOption: true,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<SessionInfoArgs>) => {
    try {
      const { id, json } = argv;

      if (!json) {
        spinner.start('Loading session...');
      }

      const ctx = await getContext();
      const session = await ctx.sessionManager.get(id);

      if (!session) {
        if (json) {
          output.json({ error: `Session "${id}" not found` });
        } else {
          spinner.fail(`Session "${id}" not found`);
        }
        process.exit(1);
      }

      if (json) {
        output.json(session);
      } else {
        spinner.succeed(`Session: ${session.name}`);

        output.newline();
        output.section('Details');
        output.keyValue('ID', session.id);
        output.keyValue('Name', session.name);
        output.keyValue('State', output.statusBadge(session.state));
        output.keyValue('Agents', session.agents.join(', '));
        output.keyValue('Tasks', session.tasks.length.toString());
        output.keyValue('Created', session.createdAt.toLocaleString());

        if (session.completedAt) {
          output.keyValue('Completed', session.completedAt.toLocaleString());
        }

        if (session.goal) {
          output.newline();
          output.section('Goal');
          console.log(session.goal);
        }

        if (session.description) {
          output.newline();
          output.section('Description');
          console.log(session.description);
        }

        if (session.tasks.length > 0) {
          output.newline();
          output.section('Tasks');
          for (const task of session.tasks.slice(0, 10)) {
            const status = output.statusBadge(task.status);
            output.listItem(`[${status}] ${task.agentId}: ${task.description.slice(0, 50)}...`);
          }
          if (session.tasks.length > 10) {
            output.listItem(`... and ${session.tasks.length - 10} more`);
          }
        }

        if (session.tags.length > 0) {
          output.newline();
          output.section('Tags');
          console.log(session.tags.join(', '));
        }
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to get session', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Main Session Command
// =============================================================================

export const sessionCommand: CommandModule = {
  command: 'session',
  describe: 'Manage sessions',

  builder: (yargs) =>
    yargs
      .command(listCommand)
      .command(infoCommand)
      .demandCommand(1, 'Please specify a subcommand'),

  handler: () => {
    // This won't be called since we demand a subcommand
  },
};
