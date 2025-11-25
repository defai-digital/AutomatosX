/**
 * Provider Commands
 *
 * Commands for managing AI providers.
 *
 * Usage:
 *   ax provider list      - List configured providers
 *   ax provider status    - Check provider health
 *   ax provider test      - Test provider connectivity
 *
 * @module @ax/cli/commands/provider
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { getContext, getMinimalContext } from '../utils/context.js';
import * as output from '../utils/output.js';
import * as spinner from '../utils/spinner.js';

// =============================================================================
// Types
// =============================================================================

interface ProviderListArgs {
  json?: boolean;
}

interface ProviderStatusArgs {
  json?: boolean;
}

interface ProviderTestArgs {
  provider: string;
  json?: boolean;
}

// =============================================================================
// Provider List Command
// =============================================================================

const listCommand: CommandModule<object, ProviderListArgs> = {
  command: 'list',
  describe: 'List configured providers',

  builder: (yargs) =>
    yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false,
    }),

  handler: async (argv: ArgumentsCamelCase<ProviderListArgs>) => {
    try {
      const { json } = argv;

      if (!json) {
        spinner.start('Loading provider configuration...');
      }

      const { config } = await getMinimalContext();

      const providers = config.providers.fallbackOrder.map((provider, index) => ({
        provider,
        priority: index + 1,
        enabled: true,
      }));

      if (json) {
        output.json(providers);
      } else {
        spinner.succeed(`${providers.length} providers configured`);
        output.newline();

        const rows = providers.map((p) => [
          output.providerBadge(p.provider),
          p.priority.toString(),
          output.statusBadge(p.enabled ? 'enabled' : 'disabled'),
        ]);

        output.simpleTable(['Provider', 'Priority', 'Status'], rows);

        output.newline();
        output.info('Use "ax provider status" to check health');
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to list providers', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Provider Status Command
// =============================================================================

const statusCommand: CommandModule<object, ProviderStatusArgs> = {
  command: 'status',
  describe: 'Check provider health status',

  builder: (yargs) =>
    yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false,
    }),

  handler: async (argv: ArgumentsCamelCase<ProviderStatusArgs>) => {
    try {
      const { json } = argv;

      if (!json) {
        spinner.start('Checking provider health...');
      }

      const ctx = await getContext();
      const healthStatus = await ctx.providerRouter.checkHealth();

      if (json) {
        output.json(healthStatus);
      } else {
        const healthyCount = Object.values(healthStatus).filter((h) => h.healthy).length;
        const totalCount = Object.keys(healthStatus).length;

        spinner.succeed(`${healthyCount}/${totalCount} providers healthy`);
        output.newline();

        const rows = Object.entries(healthStatus).map(([provider, status]) => [
          output.providerBadge(provider),
          output.statusBadge(status.healthy ? 'healthy' : 'unhealthy'),
          status.latency ? `${status.latency}ms` : '-',
          status.lastCheck ? output.formatRelativeTime(new Date(status.lastCheck)) : '-',
          status.error ?? '-',
        ]);

        output.simpleTable(['Provider', 'Status', 'Latency', 'Last Check', 'Error'], rows);
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Health check failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Provider Test Command
// =============================================================================

const testCommand: CommandModule<object, ProviderTestArgs> = {
  command: 'test <provider>',
  describe: 'Test provider connectivity',

  builder: (yargs) =>
    yargs
      .positional('provider', {
        describe: 'Provider name to test',
        type: 'string',
        demandOption: true,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<ProviderTestArgs>) => {
    try {
      const { provider, json } = argv;

      if (!json) {
        spinner.start(`Testing ${provider}...`);
      }

      const ctx = await getContext();

      const startTime = Date.now();
      const result = await ctx.providerRouter.testProvider(provider);
      const duration = Date.now() - startTime;

      if (json) {
        output.json({
          provider,
          success: result.success,
          duration,
          message: result.message,
          error: result.error,
        });
      } else {
        if (result.success) {
          spinner.succeed(`${provider} is working (${duration}ms)`);
          if (result.message) {
            output.newline();
            output.info(result.message);
          }
        } else {
          spinner.fail(`${provider} test failed`);
          if (result.error) {
            output.newline();
            output.error('Error', result.error);
          }
        }
      }

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Test failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Main Provider Command
// =============================================================================

export const providerCommand: CommandModule = {
  command: 'provider',
  describe: 'Manage AI providers',

  builder: (yargs) =>
    yargs
      .command(listCommand)
      .command(statusCommand)
      .command(testCommand)
      .demandCommand(1, 'Please specify a subcommand'),

  handler: () => {
    // This won't be called since we demand a subcommand
  },
};
