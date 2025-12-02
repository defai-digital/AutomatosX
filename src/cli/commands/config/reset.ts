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
import { PromptHelper } from '../../../utils/prompt-helper.js';

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
      // v9.0.2: Refactored to use PromptHelper for automatic cleanup
      if (!argv.confirm) {
        console.log(chalk.yellow('\n⚠️  This will reset your configuration to defaults'));
        console.log(chalk.gray(`   Config file: ${configPath}`));
        console.log(chalk.gray('   Use --confirm to skip this prompt\n'));

        const prompt = new PromptHelper();
        try {
          const answer = await prompt.question('Are you sure? (y/N): ');

          if (answer.toLowerCase() !== 'y') {
            console.log(chalk.gray('\nReset cancelled\n'));
            process.exit(0);
          }
        } finally {
          prompt.close();
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
