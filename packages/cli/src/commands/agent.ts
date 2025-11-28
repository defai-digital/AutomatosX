/**
 * Agent Commands
 *
 * Commands for managing and interacting with agents.
 *
 * Usage:
 *   ax agent list           - List all available agents
 *   ax agent info <name>    - Get detailed info about an agent
 *   ax agent create <name>  - Create a new agent
 *
 * @module @ax/cli/commands/agent
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

interface AgentListArgs {
  format: 'table' | 'json' | 'simple';
  team: string | undefined;
}

interface AgentInfoArgs {
  name: string;
  json: boolean;
}

// =============================================================================
// Agent List Command
// =============================================================================

const listCommand: CommandModule<object, AgentListArgs> = {
  command: 'list',
  describe: 'List all available agents',

  builder: (yargs) =>
    yargs
      .option('format', {
        alias: 'f',
        describe: 'Output format',
        choices: ['table', 'json', 'simple'] as const,
        default: 'table' as const,
      })
      .option('team', {
        alias: 't',
        describe: 'Filter by team',
        type: 'string',
      }),

  handler: async (argv: ArgumentsCamelCase<AgentListArgs>) => {
    try {
      const { format, team } = argv;

      if (format !== 'json') {
        spinner.start('Loading agents...');
      }

      const ctx = await getContext();
      let agents = ctx.agentRegistry.getAll();

      // Filter by team if specified
      if (team) {
        agents = agents.filter((a) => a.team === team);
      }

      if (format === 'json') {
        output.json(
          agents.map((a) => ({
            id: a.name,
            displayName: a.displayName,
            team: a.team,
            role: a.role,
            description: a.description,
            enabled: a.enabled,
          }))
        );
      } else if (format === 'simple') {
        spinner.stop();
        for (const agent of agents) {
          console.log(agent.name);
        }
      } else {
        spinner.succeed(`Found ${agents.length} agents`);
        output.newline();

        const rows = agents.map((a) => [
          a.name,
          a.displayName,
          a.team,
          a.role.slice(0, 30) + (a.role.length > 30 ? '...' : ''),
          a.enabled ? output.statusBadge('enabled') : output.statusBadge('disabled'),
        ]);

        output.simpleTable(['ID', 'Name', 'Team', 'Role', 'Status'], rows);
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to list agents', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Agent Info Command
// =============================================================================

const infoCommand: CommandModule<object, AgentInfoArgs> = {
  command: 'info <name>',
  describe: 'Get detailed info about an agent',

  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'Agent name or ID',
        type: 'string',
        demandOption: true,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<AgentInfoArgs>) => {
    try {
      const { name, json } = argv;

      if (!json) {
        spinner.start('Loading agent...');
      }

      const ctx = await getContext();
      const agent = ctx.agentRegistry.get(name);

      if (!agent) {
        if (json) {
          output.json({ error: `Agent "${name}" not found` });
        } else {
          spinner.fail(`Agent "${name}" not found`);
          output.newline();
          output.info('Use "ax agent list" to see available agents');
        }
        process.exit(1);
      }

      if (json) {
        output.json(agent);
      } else {
        spinner.succeed(`Agent: ${agent.displayName}`);

        output.newline();
        output.section('Details');
        output.keyValue('ID', agent.name);
        output.keyValue('Name', agent.displayName);
        output.keyValue('Role', agent.role);
        output.keyValue('Team', agent.team);
        output.keyValue('Description', agent.description ?? '-');
        output.keyValue('Status', agent.enabled ? 'Enabled' : 'Disabled');

        if (agent.systemPrompt) {
          output.newline();
          output.section('System Prompt');
          const preview = agent.systemPrompt.slice(0, 200);
          console.log(preview + (agent.systemPrompt.length > 200 ? '...' : ''));
        }

        if (agent.abilities && agent.abilities.length > 0) {
          output.newline();
          output.section('Abilities');
          for (const ability of agent.abilities) {
            output.listItem(ability);
          }
        }

        if (agent.orchestration) {
          output.newline();
          output.section('Orchestration');
          output.keyValue('Max Delegation Depth', agent.orchestration.maxDelegationDepth);
          output.keyValue('Priority', agent.orchestration.priority);
          if (agent.orchestration.canDelegateTo.length > 0) {
            output.keyValue('Can Delegate To', agent.orchestration.canDelegateTo.join(', '));
          }
        }
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to get agent info', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Main Agent Command
// =============================================================================

export const agentCommand: CommandModule = {
  command: 'agent',
  describe: 'Manage agents',

  builder: (yargs) =>
    yargs
      .command(listCommand)
      .command(infoCommand)
      .demandCommand(1, 'Please specify a subcommand'),

  handler: () => {
    // This won't be called since we demand a subcommand
  },
};
