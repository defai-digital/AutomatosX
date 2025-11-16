/**
 * Config Get Command - Get configuration value
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { loadConfigFile } from '../../../core/config.js';
import { printError } from '../../../utils/error-formatter.js';
import { formatKeyValue } from '../../../utils/message-formatter.js';
import { resolveConfigPath, checkExists, getNestedValue } from './utils.js';

interface GetOptions {
  key: string;
  verbose?: boolean;
}

export const getCommand: CommandModule<{}, GetOptions> = {
  command: 'get <key>',
  describe: 'Get configuration value',

  builder: (yargs) => {
    return yargs
      .positional('key', {
        describe: 'Configuration key (dot notation)',
        type: 'string',
        demandOption: true
      })
      .option('verbose', {
        describe: 'Show detailed output',
        type: 'boolean',
        alias: 'v',
        default: false
      })
      .example('$0 config get logging.level', 'Get log level')
      .example('$0 config get providers.claude-code', 'Get Claude provider config')
      .example('$0 config get memory.maxEntries', 'Get max memory entries');
  },

  handler: async (argv) => {
    try {
      const configPath = resolveConfigPath((argv as any).config || (argv as any).c);

      // Check if config exists
      const exists = await checkExists(configPath);
      if (!exists) {
        console.log(chalk.yellow('⚠️  Configuration file not found'));
        console.log(chalk.gray(`   Searched at: ${configPath}`));
        console.log(chalk.gray('   Run "ax init" to create configuration\n'));
        process.exit(1);
      }

      // Load config
      const config = await loadConfigFile(configPath);

      // Get value
      const value = getNestedValue(config, argv.key);

      if (value === undefined) {
        console.log(chalk.yellow(`⚠️  Configuration key not found: ${argv.key}\n`));
        process.exit(1);
      }

      // Display value
      if (argv.verbose) {
        console.log(formatKeyValue(argv.key, formatValue(value)));
      } else {
        console.log(formatValue(value));
      }

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

/**
 * Format value for display
 */
function formatValue(value: any): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
