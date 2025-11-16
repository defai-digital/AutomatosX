/**
 * Config Reset Command - Reset to default configuration
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../../types/config.js';
import { saveConfigFile } from '../../../core/config.js';
import { printError } from '../../../utils/error-formatter.js';
import { printSuccess } from '../../../utils/message-formatter.js';
import { logger } from '../../../utils/logger.js';
import { resolveConfigPath } from './utils.js';

interface ResetOptions {
  verbose?: boolean;
  confirm?: boolean;
}

export const resetCommand: CommandModule<{}, ResetOptions> = {
  command: 'reset',
  describe: 'Reset configuration to defaults',

  builder: (yargs) => {
    return yargs
      .option('confirm', {
        describe: 'Skip confirmation prompt',
        type: 'boolean',
        alias: 'y',
        default: false
      })
      .option('verbose', {
        describe: 'Show detailed output',
        type: 'boolean',
        alias: 'v',
        default: false
      });
  },

  handler: async (argv) => {
    try {
      const configPath = resolveConfigPath((argv as any).config || (argv as any).c);

      // Confirm reset
      if (!argv.confirm) {
        console.log(chalk.yellow('\n⚠️  This will reset your configuration to defaults'));
        console.log(chalk.gray(`   Config file: ${configPath}`));
        console.log(chalk.gray('   Use --confirm to skip this prompt\n'));

        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>(resolve => {
          rl.question('Are you sure? (y/N): ', answer => {
            rl.close();
            resolve(answer);
          });
        });

        if (answer.toLowerCase() !== 'y') {
          console.log(chalk.gray('\nReset cancelled\n'));
          process.exit(0);
        }
      }

      // Reset to defaults
      const config = {
        ...DEFAULT_CONFIG,
        $schema: './schema/config.json',
        version: '5.0.0'
      };

      await saveConfigFile(configPath, config);
      printSuccess('Configuration reset to defaults');

      if (argv.verbose) {
        console.log(chalk.gray(`\nConfig file: ${configPath}\n`));
      }

      logger.info('Configuration reset', { path: configPath });

    } catch (error) {
      printError(error, {
        verbose: argv.verbose || false,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      process.exit(1);
    }
  }
};
