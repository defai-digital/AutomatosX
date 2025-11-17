/**
 * CLI Command - Launch Grok CLI with AutomatosX integration
 *
 * This command launches the Grok CLI using the configuration from ~/.grok/
 * providing seamless integration between AutomatosX and Grok.
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
  config?: string;
}

export const cliCommand: CommandModule<{}, CliCommandArgs> = {
  command: 'cli [prompt]',
  describe: 'Launch Grok CLI with AutomatosX integration',

  builder: (yargs) => {
    return yargs
      .positional('prompt', {
        type: 'string',
        describe: 'Optional initial prompt to send to Grok'
      })
      .option('model', {
        type: 'string',
        alias: 'm',
        describe: 'Grok model to use (e.g., grok-2)'
      })
      .option('config', {
        type: 'string',
        alias: 'c',
        describe: 'Path to Grok settings file (default: ./.grok/settings.json or ~/.grok/settings.json)'
      })
      .example('$0 cli', 'Launch Grok CLI interactively')
      .example('$0 cli "Design a REST API"', 'Send prompt directly to Grok')
      .example('$0 cli --model grok-2', 'Use specific Grok model');
  },

  handler: async (argv) => {
    try {
      // Determine config path - check only settings.json in two locations
      let configPath = argv.config;
      if (!configPath) {
        const locations = [
          // 1. Project-specific .grok directory (current directory)
          join(process.cwd(), '.grok', 'settings.json'),
          // 2. User home directory .grok
          join(homedir(), '.grok', 'settings.json'),
        ];

        // Find first existing settings.json file
        for (const location of locations) {
          if (existsSync(location)) {
            configPath = location;
            break;
          }
        }

        // Default to home directory settings.json for error messages
        if (!configPath) {
          configPath = join(homedir(), '.grok', 'settings.json');
        }
      }

      // Check if Grok CLI is installed
      const grokCommand = process.platform === 'win32' ? 'grok.cmd' : 'grok';

      logger.info('Launching Grok CLI', {
        configPath,
        hasPrompt: !!argv.prompt,
        model: argv.model
      });

      // Check if settings.json exists
      if (!existsSync(configPath)) {
        console.log(chalk.yellow('\n⚠️  Grok settings not found'));
        console.log(chalk.gray('   Checked:'));
        console.log(chalk.gray('   - ./.grok/settings.json (project)'));
        console.log(chalk.gray('   - ~/.grok/settings.json (home)'));
        console.log(chalk.blue('\n💡 To set up Grok:'));
        console.log(chalk.gray('   1. Install Grok CLI: npm install -g @grok/cli'));
        console.log(chalk.gray('   2. Configure API key: grok config set api-key YOUR_KEY'));
        console.log(chalk.gray('   3. This will create ~/.grok/settings.json'));
        console.log(chalk.gray('   4. Run ax cli again\n'));
        process.exit(1);
      }

      // Load config to verify it's valid
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        if (!config.apiKey && !process.env.GROK_API_KEY) {
          console.log(chalk.yellow('\n⚠️  No API key found in Grok config'));
          console.log(chalk.blue('\n💡 To configure your API key:'));
          console.log(chalk.gray('   grok config set api-key YOUR_KEY\n'));
          process.exit(1);
        }

        logger.debug('Grok config loaded', {
          hasApiKey: !!config.apiKey,
          model: config.defaultModel || 'not set',
          server: config.server || 'default'
        });
      } catch (error) {
        console.log(chalk.red('\n❌ Invalid Grok settings file at:'), chalk.gray(configPath));
        console.log(chalk.gray('   Error:'), error instanceof Error ? error.message : String(error));
        console.log(chalk.blue('\n💡 Try recreating your settings:'));
        console.log(chalk.gray('   grok config set api-key YOUR_KEY'));
        console.log(chalk.gray('   This will recreate ~/.grok/settings.json\n'));
        process.exit(1);
      }

      // Build Grok CLI arguments
      const grokArgs: string[] = [];

      // Add model if specified
      if (argv.model) {
        grokArgs.push('--model', argv.model);
      }

      // Add config path if not default
      if (argv.config) {
        grokArgs.push('--config', argv.config);
      }

      // Add prompt if provided
      if (argv.prompt) {
        grokArgs.push(argv.prompt);
      }

      // Display launch message
      console.log(chalk.blue('\n🚀 Launching Grok CLI...'));
      if (argv.prompt) {
        console.log(chalk.gray('   Prompt:'), chalk.white(argv.prompt));
      }
      if (argv.model) {
        console.log(chalk.gray('   Model:'), chalk.white(argv.model));
      }
      console.log(chalk.gray('   Config:'), chalk.white(configPath));
      console.log(chalk.gray('\n   Press Ctrl+C to exit\n'));

      // Spawn Grok CLI process
      const grokProcess = spawn(grokCommand, grokArgs, {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          GROK_CONFIG_PATH: configPath
        }
      });

      // Handle process events
      grokProcess.on('error', (error) => {
        if ((error as any).code === 'ENOENT') {
          console.log(chalk.red('\n❌ Grok CLI not found'));
          console.log(chalk.blue('\n💡 To install Grok CLI:'));
          console.log(chalk.gray('   npm install -g @grok/cli'));
          console.log(chalk.gray('\n   Or visit: https://grok.x.ai/cli\n'));
        } else {
          console.log(chalk.red('\n❌ Error launching Grok CLI:'), error.message);
        }
        process.exit(1);
      });

      grokProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logger.debug('Grok CLI exited with code', { code });
        }
        process.exit(code || 0);
      });

      // Handle termination signals
      const cleanup = () => {
        if (!grokProcess.killed) {
          grokProcess.kill('SIGTERM');
        }
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);

    } catch (error) {
      logger.error('Failed to launch Grok CLI', { error });
      console.log(chalk.red('\n❌ Failed to launch Grok CLI'));
      if (error instanceof Error) {
        console.log(chalk.gray('   Error:'), error.message);
      }
      console.log(chalk.blue('\n💡 Try running Grok directly:'));
      console.log(chalk.gray('   grok "your prompt"\n'));
      process.exit(1);
    }
  }
};
