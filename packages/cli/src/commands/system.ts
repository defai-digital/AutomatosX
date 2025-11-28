/**
 * System Commands
 *
 * Commands for system status, configuration, and diagnostics.
 *
 * Usage:
 *   ax status         - Show system status
 *   ax config show    - Show current configuration
 *   ax config path    - Show config file path
 *   ax doctor         - Run system diagnostics
 *
 * @module @ax/cli/commands/system
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getContext, getMinimalContext, getBasePath } from '../utils/context.js';
import * as output from '../utils/output.js';
import * as spinner from '../utils/spinner.js';

// =============================================================================
// Types
// =============================================================================

interface StatusArgs {
  json: boolean;
}

interface ConfigShowArgs {
  json: boolean;
}

interface DoctorArgs {
  fix: boolean;
  json: boolean;
}

// =============================================================================
// Status Command
// =============================================================================

export const statusCommand: CommandModule<object, StatusArgs> = {
  command: 'status',
  describe: 'Show system status',

  builder: (yargs) =>
    yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false,
    }),

  handler: async (argv: ArgumentsCamelCase<StatusArgs>) => {
    try {
      const { json } = argv;

      if (!json) {
        spinner.start('Checking system status...');
      }

      const ctx = await getContext();
      const healthStatus = await ctx.providerRouter.checkAllHealth();
      const memoryStats = ctx.memoryManager.getStats();
      const agentCount = ctx.agentRegistry.getIds().length;

      const status = {
        version: '11.0.0-alpha.0',
        basePath: ctx.basePath,
        configPath: ctx.configPath,
        providers: healthStatus,
        agents: {
          total: agentCount,
          enabled: ctx.agentRegistry.getAll().filter((a) => a.enabled).length,
        },
        memory: {
          entries: memoryStats.totalEntries,
          size: memoryStats.databaseSizeBytes,
        },
      };

      if (json) {
        output.json(status);
      } else {
        const healthyProviders = Object.values(healthStatus).filter((h: { healthy: boolean }) => h.healthy).length;
        const totalProviders = Object.keys(healthStatus).length;

        spinner.succeed('System Status');

        output.newline();
        output.section('AutomatosX');
        output.keyValue('Version', status.version);
        output.keyValue('Base Path', status.basePath);
        output.keyValue('Config', status.configPath ?? 'Using defaults');

        output.newline();
        output.section('Providers');
        output.keyValue('Status', `${healthyProviders}/${totalProviders} healthy`);
        for (const [provider, health] of Object.entries(healthStatus)) {
          const h = health as { healthy: boolean };
          output.listItem(
            `${output.providerBadge(provider)}: ${output.statusBadge(h.healthy ? 'healthy' : 'unhealthy')}`
          );
        }

        output.newline();
        output.section('Agents');
        output.keyValue('Total', status.agents.total);
        output.keyValue('Enabled', status.agents.enabled);

        output.newline();
        output.section('Memory');
        output.keyValue('Entries', status.memory.entries.toLocaleString());
        output.keyValue('Size', output.formatBytes(status.memory.size));
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Status check failed', message);
      process.exit(1);
    }
  },
};

// =============================================================================
// Config Command
// =============================================================================

const configShowCommand: CommandModule<object, ConfigShowArgs> = {
  command: 'show',
  describe: 'Show current configuration',

  builder: (yargs) =>
    yargs.option('json', {
      describe: 'Output as JSON',
      type: 'boolean',
      default: false,
    }),

  handler: async (argv: ArgumentsCamelCase<ConfigShowArgs>) => {
    try {
      const { json } = argv;

      if (!json) {
        spinner.start('Loading configuration...');
      }

      const { config, configPath } = await getMinimalContext();

      if (json) {
        output.json({ configPath, config });
      } else {
        spinner.succeed('Configuration');

        output.newline();
        output.keyValue('Config File', configPath ?? 'Using defaults');

        output.newline();
        output.section('Providers');
        output.keyValue('Default', config.providers.default);
        output.keyValue('Fallback Order', config.providers.fallbackOrder?.join(' → ') ?? 'None configured');

        output.newline();
        output.section('Router');
        output.keyValue('Health Check Interval', output.formatDuration(config.router.healthCheckInterval));
        output.keyValue('Prefer MCP', config.router.preferMcp ? 'Yes' : 'No');

        output.newline();
        output.section('Execution');
        output.keyValue('Default Timeout', output.formatDuration(config.execution.timeout));
        output.keyValue('Max Retries', config.execution.retry.maxAttempts);

        output.newline();
        output.section('Memory');
        output.keyValue('Max Entries', config.memory.maxEntries.toLocaleString());
        output.keyValue('Cleanup Enabled', config.memory.autoCleanup ? 'Yes' : 'No');
        if (config.memory.autoCleanup) {
          output.keyValue('Cleanup Strategy', config.memory.cleanupStrategy);
          output.keyValue('Retention Days', config.memory.retentionDays);
        }
      }
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to load configuration', message);
      process.exit(1);
    }
  },
};

const configPathCommand: CommandModule = {
  command: 'path',
  describe: 'Show config file path',

  handler: async () => {
    try {
      const { configPath } = await getMinimalContext();
      console.log(configPath ?? 'No config file found (using defaults)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Failed to get config path', message);
      process.exit(1);
    }
  },
};

export const configCommand: CommandModule = {
  command: 'config',
  describe: 'View configuration',

  builder: (yargs) =>
    yargs
      .command(configShowCommand)
      .command(configPathCommand)
      .demandCommand(1, 'Please specify a subcommand'),

  handler: () => {
    // This won't be called since we demand a subcommand
  },
};

// =============================================================================
// Doctor Command
// =============================================================================

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

export const doctorCommand: CommandModule<object, DoctorArgs> = {
  command: 'doctor',
  describe: 'Run system diagnostics',

  builder: (yargs) =>
    yargs
      .option('fix', {
        alias: 'f',
        describe: 'Attempt to fix issues',
        type: 'boolean',
        default: false,
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      }),

  handler: async (argv: ArgumentsCamelCase<DoctorArgs>) => {
    try {
      const { json } = argv;

      if (!json) {
        spinner.start('Running diagnostics...');
      }

      const results: DiagnosticResult[] = [];
      const basePath = getBasePath();

      // Check 1: Base directory exists
      try {
        await access(basePath);
        results.push({
          name: 'Base Directory',
          status: 'pass',
          message: `Directory exists at ${basePath}`,
        });
      } catch {
        results.push({
          name: 'Base Directory',
          status: 'fail',
          message: `Directory not found at ${basePath}`,
          fix: 'Run "ax setup" to create the directory structure',
        });
      }

      // Check 2: Memory directory
      const memoryPath = join(basePath, 'memory');
      try {
        await access(memoryPath);
        results.push({
          name: 'Memory Directory',
          status: 'pass',
          message: 'Memory directory exists',
        });
      } catch {
        results.push({
          name: 'Memory Directory',
          status: 'warn',
          message: 'Memory directory not found',
          fix: 'Will be created on first memory operation',
        });
      }

      // Check 3: Agents directory
      const agentsPath = join(basePath, 'agents');
      try {
        await access(agentsPath);
        results.push({
          name: 'Agents Directory',
          status: 'pass',
          message: 'Agents directory exists',
        });
      } catch {
        results.push({
          name: 'Agents Directory',
          status: 'warn',
          message: 'Agents directory not found',
          fix: 'Run "ax setup" to create with default agents',
        });
      }

      // Check 4: Configuration file
      const { configPath } = await getMinimalContext();
      if (configPath) {
        results.push({
          name: 'Configuration',
          status: 'pass',
          message: `Found at ${configPath}`,
        });
      } else {
        results.push({
          name: 'Configuration',
          status: 'warn',
          message: 'No config file found, using defaults',
          fix: 'Create ax.config.json in project root',
        });
      }

      // Check 5: Provider connectivity
      try {
        const ctx = await getContext();
        const healthStatus = await ctx.providerRouter.checkAllHealth();
        const healthyCount = Object.values(healthStatus).filter((h: { healthy: boolean }) => h.healthy).length;

        if (healthyCount > 0) {
          results.push({
            name: 'Providers',
            status: 'pass',
            message: `${healthyCount} provider(s) available`,
          });
        } else {
          results.push({
            name: 'Providers',
            status: 'fail',
            message: 'No providers available',
            fix: 'Check API keys and provider configuration',
          });
        }
      } catch (error) {
        results.push({
          name: 'Providers',
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          fix: 'Check provider configuration',
        });
      }

      // Check 6: Memory database
      const memoryDbPath = join(basePath, 'memory', 'memories.db');
      try {
        const stats = await stat(memoryDbPath);
        results.push({
          name: 'Memory Database',
          status: 'pass',
          message: `Database exists (${output.formatBytes(stats.size)})`,
        });
      } catch {
        results.push({
          name: 'Memory Database',
          status: 'warn',
          message: 'Database not found',
          fix: 'Will be created on first memory operation',
        });
      }

      if (json) {
        output.json(results);
      } else {
        const passCount = results.filter((r) => r.status === 'pass').length;
        const warnCount = results.filter((r) => r.status === 'warn').length;
        const failCount = results.filter((r) => r.status === 'fail').length;

        if (failCount > 0) {
          spinner.fail(`${failCount} issue(s) found`);
        } else if (warnCount > 0) {
          spinner.warn(`${warnCount} warning(s)`);
        } else {
          spinner.succeed('All checks passed');
        }

        output.newline();
        for (const result of results) {
          const icon =
            result.status === 'pass'
              ? output.symbols.success
              : result.status === 'warn'
                ? output.symbols.warning
                : output.symbols.error;

          console.log(`${icon} ${result.name}: ${result.message}`);
          if (result.fix && result.status !== 'pass') {
            console.log(`    ${output.symbols.arrow} Fix: ${result.fix}`);
          }
        }

        output.newline();
        output.divider();
        output.keyValue('Passed', passCount);
        output.keyValue('Warnings', warnCount);
        output.keyValue('Failed', failCount);
      }

      process.exit(results.some((r) => r.status === 'fail') ? 1 : 0);
    } catch (error) {
      spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      output.error('Diagnostics failed', message);
      process.exit(1);
    }
  },
};
