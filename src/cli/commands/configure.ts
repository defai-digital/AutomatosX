/**
 * Configure Command - Interactive configuration wizard
 *
 * v6.0.7 Phase 2: OpenAI integration mode selection
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { loadConfig, saveConfigFile } from '../../core/config.js';
import { showModeWizard, detectEnvironment } from '../../providers/integration-mode-wizard.js';
import type { IntegrationMode } from '../../types/config.js';
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
import { resolve } from 'path';

interface ConfigureOptions {
  provider?: string;
  verbose?: boolean;
}

export const configureCommand: CommandModule<Record<string, unknown>, ConfigureOptions> = {
  command: 'configure [provider]',
  describe: 'Interactive configuration wizard for provider configuration',

  builder: (yargs) => {
    return yargs
      .positional('provider', {
        describe: 'Provider to configure (e.g., openai)',
        type: 'string',
        choices: ['openai'],
        default: 'openai'
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Show detailed output',
        type: 'boolean',
        default: false
      })
      .example('$0 configure', 'Configure OpenAI integration mode')
      .example('$0 configure openai', 'Configure OpenAI integration mode')
      .example('$0 configure --verbose', 'Detailed configuration wizard');
  },

  handler: async (argv) => {
    try {
      const provider = argv.provider || 'openai';

      if (provider !== 'openai') {
        console.log(chalk.yellow(`\n⚠️  Setup wizard currently only supports OpenAI provider\n`));
        process.exit(1);
      }

      console.log(chalk.bold.cyan('\n✨ AutomatosX Setup Wizard\n'));
      console.log(chalk.dim('This wizard will help you configure the OpenAI integration mode.\n'));

      // Load current config
      const configPath = resolve(process.cwd(), 'ax.config.json');
      const config = await loadConfig(configPath);

      if (!config.providers.openai) {
        console.log(chalk.red('\n❌ OpenAI provider not found in configuration\n'));
        process.exit(1);
      }

      const currentMode = config.providers.openai.integration;

      // Show current configuration
      if (currentMode) {
        console.log(chalk.bold('Current Configuration:'));
        console.log(chalk.dim(`  Integration Mode: ${chalk.cyan(currentMode)}\n`));
      }

      // Detect environment
      if (argv.verbose) {
        console.log(chalk.bold('🔍 Detecting environment...\n'));
        const env = await detectEnvironment();
        console.log(chalk.dim('Environment Status:'));
        console.log(chalk.dim(`  Codex CLI: ${env.hasCodexCLI ? chalk.green('✓ Installed') : chalk.red('✗ Not found')}`));
        console.log(chalk.dim(`  API Key: ${env.hasAPIKey ? chalk.green('✓ Configured') : chalk.yellow('⚠ Not set')}`));
        console.log(chalk.dim(`  API Access: ${env.canReachAPI ? chalk.green('✓ Available') : chalk.red('✗ Blocked')}`));
        if (env.isBehindFirewall) {
          console.log(chalk.dim(`  Firewall: ${chalk.yellow('⚠ Detected')}`));
        }
        console.log();
      }

      // Run wizard
      const selectedMode: IntegrationMode = await showModeWizard(currentMode, {
        autoDetect: false,
        verbose: argv.verbose || false
      });

      // Save to config
      config.providers.openai.integration = selectedMode;
      await saveConfigFile(configPath, config);

      console.log(chalk.bold.green('\n✅ Configuration saved successfully!\n'));

      // Show next steps
      console.log(chalk.bold('Next Steps:'));
      console.log(chalk.dim('  1. Run ' + chalk.cyan('ax doctor openai') + ' to verify setup'));
      console.log(chalk.dim('  2. Test with ' + chalk.cyan('ax run backend "hello world"')));
      console.log();

      logger.info('Setup completed', {
        provider: 'openai',
        selectedMode,
        previousMode: currentMode
      });

    } catch (error) {
      printError(error, {
        verbose: argv.verbose || false,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      logger.error('Setup command failed', { error: (error as Error).message });
      process.exit(1);
    }
  }
};
