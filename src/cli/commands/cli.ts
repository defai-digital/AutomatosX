/**
 * CLI Command - Launch ax-cli with AutomatosX integration
 *
 * This command launches ax-cli (Enterprise-Class AI CLI) with multi-provider support.
 * Provides seamless integration between AutomatosX and ax-cli for interactive AI sessions.
 */

import type { CommandModule } from 'yargs';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { logger } from '../../utils/logger.js';

interface CliCommandArgs {
  prompt?: string;
  model?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  directory?: string;
  maxToolRounds?: number;
}

export const cliCommand: CommandModule<{}, CliCommandArgs> = {
  command: 'cli [prompt]',
  describe: 'Launch ax-cli with multi-provider AI support',

  builder: (yargs) => {
    return yargs
      .positional('prompt', {
        type: 'string',
        describe: 'Optional initial prompt to send to AI'
      })
      .option('model', {
        type: 'string',
        alias: 'm',
        describe: 'AI model to use (e.g., glm-4.6, grok-2, gpt-4)'
      })
      .option('provider', {
        type: 'string',
        alias: 'p',
        describe: 'AI provider (glm, xai, openai, anthropic, ollama)'
      })
      .option('api-key', {
        type: 'string',
        alias: 'k',
        describe: 'AI API key (or set YOUR_API_KEY env var)'
      })
      .option('base-url', {
        type: 'string',
        alias: 'u',
        describe: 'AI API base URL (or set AI_BASE_URL env var)'
      })
      .option('directory', {
        type: 'string',
        alias: 'd',
        describe: 'Set working directory'
      })
      .option('max-tool-rounds', {
        type: 'number',
        describe: 'Maximum number of tool execution rounds (default: 400)'
      })
      .example('$0 cli', 'Launch ax-cli interactively')
      .example('$0 cli "Design a REST API"', 'Send prompt directly to AI')
      .example('$0 cli --model glm-4.6', 'Use specific GLM model')
      .example('$0 cli --provider xai --model grok-2', 'Use xAI Grok provider');
  },

  handler: async (argv) => {
    try {
      // Check if ax-cli is installed
      const axCliCommand = process.platform === 'win32' ? 'ax-cli.cmd' : 'ax-cli';

      logger.info('Launching ax-cli', {
        hasPrompt: !!argv.prompt,
        model: argv.model,
        provider: argv.provider
      });

      // Build ax-cli arguments
      const axCliArgs: string[] = [];

      // Add directory option
      if (argv.directory) {
        axCliArgs.push('--directory', argv.directory);
      }

      // Add API key option
      if (argv.apiKey) {
        axCliArgs.push('--api-key', argv.apiKey);
      }

      // Add base URL option
      if (argv.baseUrl) {
        axCliArgs.push('--base-url', argv.baseUrl);
      }

      // Add model option
      if (argv.model) {
        axCliArgs.push('--model', argv.model);
      }

      // Add max tool rounds option
      if (argv.maxToolRounds) {
        axCliArgs.push('--max-tool-rounds', String(argv.maxToolRounds));
      }

      // Add prompt if provided (non-interactive mode)
      if (argv.prompt) {
        axCliArgs.push('--prompt', argv.prompt);
      }

      // Display launch message
      console.log(chalk.blue('\n🚀 Launching ax-cli...'));
      if (argv.prompt) {
        console.log(chalk.gray('   Prompt:'), chalk.white(argv.prompt));
      }
      if (argv.model) {
        console.log(chalk.gray('   Model:'), chalk.white(argv.model));
      }
      if (argv.provider) {
        console.log(chalk.gray('   Provider:'), chalk.white(argv.provider));
      }
      if (argv.directory) {
        console.log(chalk.gray('   Directory:'), chalk.white(argv.directory));
      }
      console.log(chalk.gray('\n   Press Ctrl+C to exit\n'));

      // Build environment variables
      const env: NodeJS.ProcessEnv = {
        ...process.env
      };

      // Set provider via environment variable if specified
      if (argv.provider) {
        env.AI_PROVIDER = argv.provider;
      }

      // Spawn ax-cli process
      // SECURITY: Do not use shell: true - Node handles argument escaping
      const axCliProcess = spawn(axCliCommand, axCliArgs, {
        stdio: 'inherit',
        env
      });

      // Handle process events
      axCliProcess.on('error', (error) => {
        if ((error as any).code === 'ENOENT') {
          console.log(chalk.red('\n❌ ax-cli not found'));
          console.log(chalk.blue('\n💡 To install ax-cli:'));
          console.log(chalk.gray('   npm install -g @defai.digital/ax-cli'));
          console.log(chalk.gray('\n   Or visit: https://github.com/defai-digital/ax-cli\n'));
        } else {
          console.log(chalk.red('\n❌ Error launching ax-cli:'), error.message);
        }
        process.exit(1);
      });

      axCliProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logger.debug('ax-cli exited with code', { code });
        }
        process.exit(code || 0);
      });

      // Handle termination signals
      const cleanup = () => {
        if (!axCliProcess.killed) {
          axCliProcess.kill('SIGTERM');
        }
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);

    } catch (error) {
      logger.error('Failed to launch ax-cli', { error });
      console.log(chalk.red('\n❌ Failed to launch ax-cli'));
      if (error instanceof Error) {
        console.log(chalk.gray('   Error:'), error.message);
      }
      console.log(chalk.blue('\n💡 Try running ax-cli directly:'));
      console.log(chalk.gray('   ax-cli "your prompt"\n'));
      process.exit(1);
    }
  }
};
