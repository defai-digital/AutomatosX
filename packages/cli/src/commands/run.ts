/**
 * Run Command
 *
 * Execute a task with an agent.
 *
 * Usage:
 *   ax run <agent> "task description"
 *   ax run backend "implement user authentication"
 *
 * @module @ax/cli/commands/run
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { getContext, cleanupContext } from '../utils/context.js';
import * as output from '../utils/output.js';
import * as spinner from '../utils/spinner.js';
import { selectAgentWithReason, findSimilar } from '@ax/core';

// =============================================================================
// Types
// =============================================================================

interface RunArgs {
  agent: string;
  task: string;
  timeout: number;
  session: string | undefined;
  stream: boolean;
  json: boolean;
}

// =============================================================================
// Command Definition
// =============================================================================

export const runCommand: CommandModule<object, RunArgs> = {
  command: 'run <agent> <task>',
  describe: 'Execute a task with an agent',

  builder: (yargs) =>
    yargs
      .positional('agent', {
        describe: 'Agent name to use',
        type: 'string',
        demandOption: true,
      })
      .positional('task', {
        describe: 'Task description',
        type: 'string',
        demandOption: true,
      })
      .option('timeout', {
        alias: 't',
        describe: 'Timeout in milliseconds',
        type: 'number',
        default: 300000,
      })
      .option('session', {
        alias: 's',
        describe: 'Session ID to use',
        type: 'string',
      })
      .option('stream', {
        describe: 'Enable streaming output',
        type: 'boolean',
        default: false,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<RunArgs>) => {
    try {
      const { agent, task, timeout, session, stream, json } = argv;

      if (!json) {
        output.header(`Running task with agent: ${agent}`);
        spinner.start('Initializing...');
      }

      const ctx = await getContext();

      // Determine which agent to use
      let selectedAgent = agent;
      let autoSelected = false;

      if (!ctx.agentRegistry.has(agent)) {
        // Try to find similar agent names first (typo correction)
        const available = ctx.agentRegistry.getIds();
        const similar = findSimilar(agent, available);

        if (similar.length > 0 && similar[0]) {
          // If there's a very close match, suggest it but don't auto-select
          if (!json) {
            spinner.fail(`Agent "${agent}" not found`);
            output.newline();
            output.info(`Did you mean: ${similar.join(', ')}?`);
            output.newline();
            output.info('Or run without an agent name to auto-select:');
            output.listItem(`ax run "${task}"`);
          } else {
            output.json({
              error: `Agent "${agent}" not found`,
              suggestions: similar,
              availableAgents: available,
            });
          }
          process.exit(1);
        }

        // Use the agent router to auto-select based on task keywords
        const selection = selectAgentWithReason(task, ctx.agentRegistry);
        selectedAgent = selection.agent.name;
        autoSelected = true;

        if (!json) {
          spinner.info(`Agent "${agent}" not found, auto-selected: ${selectedAgent}`);
          output.info(`Reason: ${selection.reason}`);
          if (selection.confidence < 0.5) {
            output.warning('Low confidence selection. Consider specifying an agent explicitly.');
          }
        }
      }

      if (!json) {
        spinner.update(`Executing task with ${selectedAgent}...`);
      }

      // Execute the task
      const result = await ctx.agentExecutor.execute(selectedAgent, task, {
        sessionId: session,
        timeout,
        stream,
        saveToMemory: true,
      });

      await cleanupContext();

      if (json) {
        output.json({
          success: result.response.success,
          agent: result.agentId,
          autoSelected,
          sessionId: result.session.id,
          taskId: result.task.id,
          output: result.response.output,
          duration: result.response.metadata.duration,
          provider: result.response.metadata.provider,
          error: result.response.error,
        });
      } else {
        if (result.response.success) {
          spinner.succeed('Task completed successfully');

          output.newline();
          output.section('Result');
          console.log(result.response.output);

          output.newline();
          output.divider();
          output.keyValue('Agent', result.agentId);
          output.keyValue('Session', result.session.id);
          output.keyValue('Duration', output.formatDuration(result.response.metadata.duration));
          output.keyValue('Provider', result.response.metadata.provider);
        } else {
          spinner.fail('Task failed');
          output.newline();
          output.error('Error', result.response.error);
        }
      }

      process.exit(result.response.success ? 0 : 1);
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (argv.json) {
        output.json({ error: message });
      } else {
        output.error('Execution failed', message);
      }

      process.exit(1);
    }
  },
};
