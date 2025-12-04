/**
 * Config Command - Manage AutomatosX configuration
 */

import type { CommandModule } from 'yargs';
import { access } from 'fs/promises';
import { resolve } from 'path';
import { constants } from 'fs';
import chalk from 'chalk';
import { DEFAULT_CONFIG } from '../../types/config.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { logger } from '../../shared/logging/logger.js';
import { printError } from '../../shared/errors/error-formatter.js';
import { printSuccess, formatInfo, formatKeyValue, formatWarning } from '../../shared/logging/message-formatter.js';
import { validateConfig, formatValidationErrors } from '../../core/config/validator.js';
import { loadConfigFile, saveConfigFile } from '../../core/config/loader.js';

interface ConfigOptions {
  get?: string;
  set?: string;
  value?: string;
  list?: boolean;
  reset?: boolean;
  validate?: boolean;
  verbose?: boolean;
}

export const configCommand: CommandModule<Record<string, unknown>, ConfigOptions> = {
  command: 'config',
  describe: 'Manage AutomatosX configuration',

  builder: (yargs) => {
    return yargs
      .option('get', {
        alias: 'g',
        describe: 'Get configuration value',
        type: 'string'
      })
      .option('set', {
        alias: 's',
        describe: 'Set configuration key',
        type: 'string'
      })
      .option('value', {
        describe: 'Value to set',
        type: 'string'
      })
      .option('list', {
        alias: 'l',
        describe: 'List all configuration',
        type: 'boolean',
        default: false
      })
      .option('reset', {
        alias: 'r',
        describe: 'Reset to default configuration',
        type: 'boolean',
        default: false
      })
      .option('validate', {
        describe: 'Validate configuration',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        describe: 'Show detailed output',
        type: 'boolean',
        default: false
      })
      .example('$0 config --list', 'List all configuration')
      .example('$0 config --get logging.level', 'Get log level')
      .example('$0 config --set logging.level --value debug', 'Set log level to debug')
      .example('$0 config --validate', 'Validate configuration')
      .example('$0 config --reset', 'Reset to default configuration');
  },

  handler: async (argv) => {
    try {
      // Debug: Print received arguments (only in debug mode)
      if (process.env.AUTOMATOSX_DEBUG) {
        console.error('[DEBUG] Config handler argv:', {
          config: (argv as any).config,
          c: (argv as any).c,
          all: Object.keys(argv)
        });
      }

      // Support multiple config path sources (priority order)
      let configPath: string;

      if ((argv as any).config) {
        configPath = (argv as any).config;
      } else if ((argv as any).c) {
        configPath = (argv as any).c;
      } else if (process.env.AUTOMATOSX_CONFIG_PATH) {
        configPath = process.env.AUTOMATOSX_CONFIG_PATH;
      } else {
        // Check in priority order: project root config, then hidden dir config
        const projectConfig = resolve(process.cwd(), 'ax.config.json');
        const hiddenConfig = resolve(process.cwd(), '.automatosx', 'config.json');

        const fs = await import('fs');
        if (fs.existsSync(projectConfig)) {
          configPath = projectConfig;
        } else if (fs.existsSync(hiddenConfig)) {
          configPath = hiddenConfig;
        } else {
          // Default to project config (for error message)
          configPath = projectConfig;
        }
      }

      if (process.env.AUTOMATOSX_DEBUG) {
        console.error('[DEBUG] Resolved config path:', configPath);
      }

      // Check if config exists
      const exists = await checkExists(configPath);
      if (!exists) {
        console.log(chalk.yellow('⚠️  Configuration file not found'));
        console.log(chalk.gray(`   Searched at: ${configPath}`));
        console.log(chalk.gray('   Run "automatosx setup" to create configuration\n'));
        process.exit(1);
      }

      // Load config (supports both YAML and JSON)
      const config = await loadConfigFile(configPath);

      // Handle operations
      if (argv.reset) {
        await resetConfig(configPath, argv.verbose || false);
      } else if (argv.validate) {
        await validateConfigFile(config, argv.verbose || false);
      } else if (argv.list) {
        await listConfig(config, argv.verbose || false);
      } else if (argv.get) {
        await getConfig(config, argv.get, argv.verbose || false);
      } else if (argv.set && argv.value !== undefined) {
        await setConfig(configPath, config, argv.set, argv.value, argv.verbose || false);
      } else if (argv.set && argv.value === undefined) {
        console.log(chalk.red('❌ Error: --value is required when using --set\n'));
        process.exit(1);
      } else {
        // Default: show config path
        console.log(formatInfo('Configuration file:'));
        console.log(chalk.gray(`   ${configPath}\n`));
      }

    } catch (error) {
      printError(error, {
        verbose: argv.verbose || false,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      logger.error('Config command failed', { error: (error as Error).message });
      process.exit(1);
    }
  }
};

/**
 * Check if file exists
 */
async function checkExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate configuration file
 */
async function validateConfigFile(
  config: AutomatosXConfig,
  verbose: boolean
): Promise<void> {
  console.log(chalk.cyan('\n🔍 Validating configuration...\n'));

  const result = validateConfig(config);

  if (result.valid) {
    printSuccess('Configuration is valid');

    if (verbose) {
      console.log(chalk.gray('\nValidation checks passed:'));
      console.log(chalk.gray('  ✓ All required fields present'));
      console.log(chalk.gray('  ✓ All field types correct'));
      console.log(chalk.gray('  ✓ All values within valid ranges'));
      console.log(chalk.gray('  ✓ At least one provider enabled'));
    }
  } else {
    console.log(formatWarning(`Found ${result.errors.length} validation error(s)\n`));
    console.log(formatValidationErrors(result.errors));
    console.log();

    logger.warn('Configuration validation failed', {
      errorCount: result.errors.length,
      errors: result.errors
    });

    process.exit(1);
  }

  console.log();
}

/**
 * Reset configuration to defaults
 */
async function resetConfig(path: string, verbose: boolean): Promise<void> {
  // Read version from package.json dynamically
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  let version = '11.2.6'; // fallback
  try {
    const packageJson = require('../../../package.json');
    version = packageJson.version;
  } catch {
    // Use fallback version
  }

  const config = {
    ...DEFAULT_CONFIG,
    // Note: $schema removed because schema directory is not copied to user projects
    // Users should rely on IDE JSON Schema plugins that fetch from npm package
    version
  };

  await saveConfigFile(path, config);
  printSuccess('Configuration reset to defaults');

  if (verbose) {
    console.log(chalk.gray(`\nConfig file: ${path}\n`));
  }

  logger.info('Configuration reset', { path });
}

/**
 * List all configuration
 */
async function listConfig(config: AutomatosXConfig, verbose: boolean): Promise<void> {
  console.log(chalk.bold.cyan('\n📋 AutomatosX Configuration\n'));

  // Providers Section
  console.log(chalk.bold.white('┌─────────────────────────────────────────────────────'));
  console.log(chalk.bold.white('│ ') + chalk.bold.cyan('Providers'));
  console.log(chalk.bold.white('└─────────────────────────────────────────────────────\n'));

  // Provider table
  const providers = Object.entries(config.providers);
  const maxNameLength = providers.length > 0
    ? Math.max(...providers.map(([name]) => name.length))
    : 0;

  providers.forEach(([name, provider]) => {
    const status = provider.enabled ? chalk.green('✓ Enabled ') : chalk.gray('✗ Disabled');
    const paddedName = name.padEnd(maxNameLength + 2);
    console.log(`  ${chalk.bold(paddedName)} ${status}`);

    if (verbose) {
      console.log(chalk.gray(`  │ Priority: ${provider.priority.toString().padStart(2)} │ Timeout: ${provider.timeout}ms`));
      console.log(chalk.gray(`  │ Command:  ${provider.command}`));
      console.log(chalk.gray('  └─────────────────────────────────────────────────'));
    }
  });

  // Memory Section
  console.log(chalk.bold.white('\n┌─────────────────────────────────────────────────────'));
  console.log(chalk.bold.white('│ ') + chalk.bold.cyan('Memory'));
  console.log(chalk.bold.white('└─────────────────────────────────────────────────────\n'));

  console.log(formatKeyValue('  Max Entries    ', chalk.yellow(config.memory.maxEntries.toString())));
  console.log(formatKeyValue('  Persist Path   ', chalk.blue(config.memory.persistPath)));

  if (verbose) {
    console.log(formatKeyValue('  Auto Cleanup   ', config.memory.autoCleanup ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')));
    console.log(formatKeyValue('  Cleanup Days   ', chalk.yellow(config.memory.cleanupDays.toString())));
  }

  // Workspace Section
  console.log(chalk.bold.white('\n┌─────────────────────────────────────────────────────'));
  console.log(chalk.bold.white('│ ') + chalk.bold.cyan('Workspace'));
  console.log(chalk.bold.white('└─────────────────────────────────────────────────────\n'));

  console.log(formatKeyValue('  PRD Path       ', chalk.blue(config.workspace.prdPath)));
  console.log(formatKeyValue('  Tmp Path       ', chalk.blue(config.workspace.tmpPath)));
  console.log(formatKeyValue('  Auto Cleanup   ', config.workspace.autoCleanupTmp ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')));

  if (verbose) {
    console.log(formatKeyValue('  Cleanup Days   ', chalk.yellow(config.workspace.tmpCleanupDays.toString())));
  }

  // Logging Section
  console.log(chalk.bold.white('\n┌─────────────────────────────────────────────────────'));
  console.log(chalk.bold.white('│ ') + chalk.bold.cyan('Logging'));
  console.log(chalk.bold.white('└─────────────────────────────────────────────────────\n'));

  const levelColor = getLevelColor(config.logging.level);
  console.log(formatKeyValue('  Level          ', levelColor(config.logging.level)));
  console.log(formatKeyValue('  Path           ', chalk.blue(config.logging.path)));

  if (verbose) {
    console.log(formatKeyValue('  Console        ', config.logging.console ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')));
  }

  console.log();
}

/**
 * Get color for log level
 */
function getLevelColor(level: string): (text: string) => string {
  switch (level) {
    case 'debug':
      return chalk.magenta;
    case 'info':
      return chalk.cyan;
    case 'warn':
      return chalk.yellow;
    case 'error':
      return chalk.red;
    default:
      return chalk.white;
  }
}

/**
 * Get configuration value
 */
async function getConfig(
  config: AutomatosXConfig,
  key: string,
  verbose: boolean
): Promise<void> {
  const value = getNestedValue(config, key);

  if (value === undefined) {
    console.log(chalk.yellow(`⚠️  Configuration key not found: ${key}\n`));
    process.exit(1);
  }

  if (verbose) {
    console.log(formatKeyValue(key, typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)));
  } else {
    if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
  }
}

/**
 * Set configuration value
 */
async function setConfig(
  path: string,
  config: AutomatosXConfig,
  key: string,
  value: string,
  verbose: boolean
): Promise<void> {
  // Parse value (try JSON first, then use as string)
  let parsedValue: any = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Use as string if not valid JSON
  }

  // Set nested value
  const updated = setNestedValue(config, key, parsedValue);

  if (!updated) {
    console.log(chalk.yellow(`⚠️  Configuration key not found: ${key}\n`));
    process.exit(1);
  }

  // Validate updated config
  const validationResult = validateConfig(config);
  if (!validationResult.valid) {
    console.log(chalk.red('\n❌ Validation failed after update:\n'));
    console.log(formatValidationErrors(validationResult.errors));
    console.log();
    process.exit(1);
  }

  // Save config (supports both YAML and JSON)
  await saveConfigFile(path, config);
  printSuccess(`Configuration updated: ${key} = ${value}`);

  if (verbose) {
    console.log(chalk.gray(`\nConfig file: ${path}`));
    console.log(chalk.gray('Configuration validated successfully\n'));
  }

  logger.info('Configuration updated', { key, value });
}

/**
 * Get nested object value by dot notation
 */
function getNestedValue(obj: any, path: string): any {
  if (!path || !path.trim()) return undefined;
  return path.split('.').filter(Boolean).reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested object value by dot notation
 */
function setNestedValue(obj: any, path: string, value: any): boolean {
  const keys = path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) return false;

  const target = keys.reduce((current, key) => {
    if (current?.[key] === undefined) return undefined;
    return current[key];
  }, obj);

  if (target === undefined) return false;

  target[lastKey] = value;
  return true;
}
