/**
 * Config Set Command - Set configuration value
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { loadConfigFile, saveConfigFile, validateConfig } from '../../../core/config/loader.js';
import { printError } from '../../../shared/errors/error-formatter.js';
import { printSuccess } from '../../../shared/logging/message-formatter.js';
import { formatValidationErrors } from '../../../core/config/validator.js';
import { logger } from '../../../shared/logging/logger.js';
import { resolveConfigPath, checkExists, setNestedValue } from './utils.js';

interface SetOptions {
  key: string;
  value: string;
  verbose?: boolean;
}

export const setCommand: CommandModule<{}, SetOptions> = {
  command: 'set <key> <value>',
  describe: 'Set configuration value',

  builder: (yargs) => {
    return yargs
      .positional('key', {
        describe: 'Configuration key (dot notation)',
        type: 'string',
        demandOption: true
      })
      .positional('value', {
        describe: 'Value to set (JSON-parseable)',
        type: 'string',
        demandOption: true
      })
      .option('verbose', {
        describe: 'Show detailed output',
        type: 'boolean',
        alias: 'v',
        default: false
      })
      .example('$0 config set logging.level debug', 'Set log level to debug')
      .example('$0 config set providers.claude-code.enabled true', 'Enable Claude provider')
      .example('$0 config set memory.maxEntries 20000', 'Set max memory entries');
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

      // Parse value (try JSON first, then use as string)
      let parsedValue: any = argv.value;
      try {
        parsedValue = JSON.parse(argv.value);
      } catch {
        // Use as string if not valid JSON
      }

      // Set nested value
      const updated = setNestedValue(config, argv.key, parsedValue);

      if (!updated) {
        console.log(chalk.yellow(`⚠️  Configuration key not found: ${argv.key}\n`));
        console.log(chalk.gray('   Use "ax config show" to see available keys\n'));
        process.exit(1);
      }

      // Validate updated config
      const validationErrors = validateConfig(config);
      if (validationErrors.length > 0) {
        console.log(chalk.red('\n❌ Validation failed after update:\n'));
        // Convert string[] to ValidationError[]
        const formattedErrors = validationErrors.map((error, index) => ({
          path: `error${index + 1}`,
          message: error
        }));
        console.log(formatValidationErrors(formattedErrors));
        console.log();
        process.exit(1);
      }

      // Save config (supports both YAML and JSON)
      await saveConfigFile(configPath, config);
      printSuccess(`Configuration updated: ${argv.key} = ${argv.value}`);

      if (argv.verbose) {
        console.log(chalk.gray(`\nConfig file: ${configPath}`));
        console.log(chalk.gray('Configuration validated successfully\n'));
      }

      logger.info('Configuration updated', { key: argv.key, value: argv.value });

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
