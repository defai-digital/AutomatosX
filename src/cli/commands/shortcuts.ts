/**
 * CLI Shortcuts - Quick commands for common workflow operations
 *
 * Provides convenient shortcuts:
 * - ax plan "task" - Set plan mode and run task
 * - ax iterate "task" - Set iterate mode and run task
 * - ax review "path" - Set review mode and analyze code
 *
 * @since v11.3.1
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../../shared/logging/logger.js';
import { saveModeState } from '../../core/workflow/index.js';

interface ShortcutOptions {
  task?: string;
  agent?: string;
  provider?: string;
  verbose?: boolean;
  quiet?: boolean;
}

/**
 * Helper to run ax command with given arguments
 */
async function runAxCommand(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const nodeExe = process.argv[0];
    const cliScript = process.argv[1];

    if (!nodeExe || !cliScript) {
      reject(new Error('Cannot determine CLI path'));
      return;
    }

    const child: ChildProcess = spawn(nodeExe, [cliScript, ...args], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * ax plan "task" - Enter plan mode and run a task
 */
export const planCommand: CommandModule<Record<string, unknown>, ShortcutOptions> = {
  command: 'plan [task]',
  describe: 'Enter plan mode and explore/plan a task (shortcut for ax mode plan + ax run)',

  builder: (yargs) => {
    return yargs
      .positional('task', {
        describe: 'Task to plan (optional - if not provided, just sets mode)',
        type: 'string'
      })
      .option('agent', {
        alias: 'a',
        describe: 'Agent to use (auto-selects if not specified)',
        type: 'string'
      })
      .option('provider', {
        alias: 'p',
        describe: 'Override provider',
        type: 'string'
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      })
      .option('quiet', {
        alias: 'q',
        describe: 'Quiet output',
        type: 'boolean',
        default: false
      })
      .example('$0 plan', 'Enter plan mode')
      .example('$0 plan "design auth system"', 'Plan a task with auto-selected agent')
      .example('$0 plan "design API" --agent architecture', 'Plan with specific agent');
  },

  handler: async (argv) => {
    try {
      // Set plan mode
      const saved = await saveModeState('plan', {
        setBy: 'shortcut',
        reason: 'ax plan command'
      });

      if (!saved) {
        logger.warn('Failed to persist mode state, continuing anyway');
      }

      if (!argv.quiet) {
        console.log(chalk.cyan.bold('\n📋 Plan Mode Activated\n'));
        console.log(chalk.gray('Read-only exploration mode - no file modifications allowed'));
        console.log(chalk.gray('Use `ax mode default` to exit plan mode\n'));
      }

      // If task provided, run it
      if (argv.task) {
        const runArgs = ['run'];
        if (argv.agent) runArgs.push(argv.agent);
        runArgs.push(argv.task);
        if (argv.provider) runArgs.push('--provider', argv.provider);
        if (argv.verbose) runArgs.push('--verbose');
        if (argv.quiet) runArgs.push('--quiet');

        await runAxCommand(runArgs);
      } else {
        console.log(chalk.gray('No task specified. Use `ax run <agent> "task"` to run in plan mode.'));
      }

      logger.info('Plan shortcut executed', { task: argv.task, agent: argv.agent });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Error: ${err.message}\n`));
      process.exit(1);
    }
  }
};

/**
 * ax iterate "task" - Enter iterate mode and run a task
 */
export const iterateCommand: CommandModule<Record<string, unknown>, ShortcutOptions & {
  timeout?: number;
  maxTokens?: number;
}> = {
  command: 'iterate [task]',
  describe: 'Enter iterate mode and run a task autonomously (shortcut for ax mode iterate + ax run --iterate)',

  builder: (yargs) => {
    return yargs
      .positional('task', {
        describe: 'Task to execute (optional - if not provided, just sets mode)',
        type: 'string'
      })
      .option('agent', {
        alias: 'a',
        describe: 'Agent to use (auto-selects if not specified)',
        type: 'string'
      })
      .option('timeout', {
        alias: 't',
        describe: 'Max duration in minutes',
        type: 'number'
      })
      .option('max-tokens', {
        describe: 'Max total tokens',
        type: 'number'
      })
      .option('provider', {
        alias: 'p',
        describe: 'Override provider',
        type: 'string'
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      })
      .option('quiet', {
        alias: 'q',
        describe: 'Quiet output',
        type: 'boolean',
        default: false
      })
      .example('$0 iterate', 'Enter iterate mode')
      .example('$0 iterate "implement auth"', 'Run task in iterate mode')
      .example('$0 iterate "fix bug" --agent backend', 'Iterate with specific agent');
  },

  handler: async (argv) => {
    try {
      // Set iterate mode
      const saved = await saveModeState('iterate', {
        setBy: 'shortcut',
        reason: 'ax iterate command'
      });

      if (!saved) {
        logger.warn('Failed to persist mode state, continuing anyway');
      }

      if (!argv.quiet) {
        console.log(chalk.cyan.bold('\n🔄 Iterate Mode Activated\n'));
        console.log(chalk.gray('Autonomous execution mode - agent will work continuously'));
        console.log(chalk.gray('Use `ax mode default` to exit iterate mode\n'));
      }

      // If task provided, run it with --iterate flag
      if (argv.task) {
        const runArgs = ['run'];
        if (argv.agent) runArgs.push(argv.agent);
        runArgs.push(argv.task);
        runArgs.push('--iterate');
        if (argv.timeout) runArgs.push('--iterate-timeout', String(argv.timeout));
        if (argv.maxTokens) runArgs.push('--iterate-max-tokens', String(argv.maxTokens));
        if (argv.provider) runArgs.push('--provider', argv.provider);
        if (argv.verbose) runArgs.push('--verbose');
        if (argv.quiet) runArgs.push('--quiet');

        await runAxCommand(runArgs);
      } else {
        console.log(chalk.gray('No task specified. Use `ax run <agent> "task"` to run in iterate mode.'));
      }

      logger.info('Iterate shortcut executed', { task: argv.task, agent: argv.agent });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Error: ${err.message}\n`));
      process.exit(1);
    }
  }
};

/**
 * ax review "path" - Enter review mode and analyze code
 */
export const reviewCommand: CommandModule<Record<string, unknown>, ShortcutOptions & {
  path?: string;
}> = {
  command: 'review [path]',
  describe: 'Enter review mode and analyze code (shortcut for ax mode review + ax run quality)',

  builder: (yargs) => {
    return yargs
      .positional('path', {
        describe: 'Path to review (file or directory)',
        type: 'string'
      })
      .option('agent', {
        alias: 'a',
        describe: 'Agent to use (defaults to quality)',
        type: 'string',
        default: 'quality'
      })
      .option('provider', {
        alias: 'p',
        describe: 'Override provider',
        type: 'string'
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      })
      .option('quiet', {
        alias: 'q',
        describe: 'Quiet output',
        type: 'boolean',
        default: false
      })
      .example('$0 review', 'Enter review mode')
      .example('$0 review src/core/', 'Review a directory')
      .example('$0 review src/api.ts', 'Review a specific file');
  },

  handler: async (argv) => {
    try {
      // Set review mode
      const saved = await saveModeState('review', {
        setBy: 'shortcut',
        reason: 'ax review command'
      });

      if (!saved) {
        logger.warn('Failed to persist mode state, continuing anyway');
      }

      if (!argv.quiet) {
        console.log(chalk.cyan.bold('\n🔍 Review Mode Activated\n'));
        console.log(chalk.gray('Code review mode - analyzing for quality, security, and best practices'));
        console.log(chalk.gray('Use `ax mode default` to exit review mode\n'));
      }

      // If path provided, run quality agent on it
      if (argv.path) {
        const task = `Review the code at ${argv.path} for quality, security, and best practices`;
        const runArgs = ['run', argv.agent || 'quality', task];
        if (argv.provider) runArgs.push('--provider', argv.provider);
        if (argv.verbose) runArgs.push('--verbose');
        if (argv.quiet) runArgs.push('--quiet');

        await runAxCommand(runArgs);
      } else {
        console.log(chalk.gray('No path specified. Use `ax run quality "Review <path>"` to review code.'));
      }

      logger.info('Review shortcut executed', { path: argv.path, agent: argv.agent });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Error: ${err.message}\n`));
      process.exit(1);
    }
  }
};
