/**
 * Config Reset Command - Reset to default configuration
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../../types/config.js';
import { saveConfigFile } from '../../../core/config/loader.js';
import { printError } from '../../../shared/errors/error-formatter.js';
import { printSuccess } from '../../../shared/logging/message-formatter.js';
import { logger } from '../../../shared/logging/logger.js';
import { resolveConfigPath } from './utils.js';
import { withPrompt } from '../../../shared/helpers/prompt-helper.js';

interface ResetOptions {
  verbose?: boolean;
  confirm?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
      // v12.8.5: Refactored to use withPrompt() for automatic cleanup
      if (!argv.confirm) {
        console.log(chalk.yellow('\n⚠️  This will reset your configuration to defaults'));
        console.log(chalk.gray(`   Config file: ${configPath}`));
        console.log(chalk.gray('   Use --confirm to skip this prompt\n'));

        const confirmed = await withPrompt(async (prompt) => {
          const answer = await prompt.question('Are you sure? (y/N): ');
          return answer.toLowerCase() === 'y';
        });

        if (!confirmed) {
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
