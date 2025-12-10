/**
 * Gemini CLI Command Group
 *
 * Manage Gemini CLI integration from the AutomatosX CLI.
 */

import type { Argv, CommandModule } from 'yargs';
import chalk from 'chalk';
import Table from 'cli-table3';
import { basename, resolve, join } from 'path';
import { glob } from 'glob';
import { spawn, spawnSync } from 'child_process';
import { GeminiCLIBridge } from '../../integrations/gemini-cli/bridge.js';
import { CommandTranslator } from '../../integrations/gemini-cli/command-translator.js';
import type {
  MCPServerConfig,
  CommandInfo,
} from '../../integrations/gemini-cli/types.js';
import { GeminiCLIError, GeminiCLIErrorType } from '../../integrations/gemini-cli/types.js';
import {
  getUserConfigPath,
  getProjectConfigPath,
  fileExists,
} from '../../integrations/gemini-cli/utils/file-reader.js';
import { loadConfig } from '../../core/config/loader.js';

const bridge = new GeminiCLIBridge();
const translator = new CommandTranslator();

interface SyncMcpOptions {
  force?: boolean;
}

interface ListMcpOptions {
  json?: boolean;
}

interface ListCommandsOptions {
  json?: boolean;
}

interface ImportGeminiCommandOptions {
  name: string;
  outputDir?: string;
  'output-dir'?: string;
  overwrite?: boolean;
}

interface StatusOptions {
  json?: boolean;
}

interface ExportAbilityOptions {
  name: string;
  outputDir?: string;
  'output-dir'?: string;
  overwrite?: boolean;
}

interface ValidateOptions {
  json?: boolean;
  fix?: boolean;
}

interface SetupOptions {
  skipMcp?: boolean;
  skipImport?: boolean;
}

interface DoctorOptions {
  verbose?: boolean;
  fix?: boolean;
}

function handleGeminiError(error: unknown, context: string): never {
  if (error instanceof GeminiCLIError) {
    console.error(chalk.red.bold(`\n✗ ${context}\n`));
    console.error(chalk.red(error.message));

    if (error.details && Object.keys(error.details).length > 0) {
      const detailLines = Object.entries(error.details).map(([key, value]) => {
        let printable: string;

        if (value === undefined) {
          printable = 'undefined';
        } else if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          printable = String(value);
        } else if (Array.isArray(value)) {
          printable = value
            .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
            .join(', ');
        } else {
          try {
            printable = JSON.stringify(value);
          } catch {
            printable = String(value);
          }
        }

        return `  - ${key}: ${printable}`;
      });

      console.error(chalk.gray(detailLines.join('\n')));
    }
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red.bold(`\n✗ ${context}\n`));
    console.error(chalk.red(message));
  }

  console.error();
  process.exit(1);
}

function formatCommandInvocation(server: MCPServerConfig): string {
  const args = server.args?.length ? ` ${server.args.join(' ')}` : '';
  return `${server.command}${args}`;
}

function namespaceKey(namespace?: string): string {
  return namespace ?? 'global';
}

const syncMcpCommand: CommandModule<Record<string, unknown>, SyncMcpOptions> = {
  command: 'sync-mcp',
  describe: 'Sync the AutomatosX MCP server into Gemini CLI settings',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<SyncMcpOptions> => {
    return (yargs as Argv<SyncMcpOptions>)
      .option('force', {
        type: 'boolean',
        default: false,
        describe: 'Overwrite the AutomatosX MCP entry if it already exists',
      })
      .example('$0 gemini sync-mcp', 'Register the AutomatosX MCP server with Gemini CLI');
  },

  handler: async (argv) => {
    try {
      const overwrite = Boolean(argv.force);
      await bridge.syncAutomatosXMCP(overwrite);

      console.log(chalk.green.bold('\n✓ AutomatosX MCP server synced with Gemini CLI\n'));
      console.log(chalk.gray(`User settings: ${chalk.white(getUserConfigPath())}`));
      if (!overwrite) {
        console.log(chalk.gray('Existing entries were preserved; rerun with --force to overwrite.'));
      }
      console.log(chalk.gray('Use `ax gemini list-mcp` to review registered servers.\n'));

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, 'Failed to sync AutomatosX MCP server with Gemini CLI');
    }
  },
};

const listMcpCommand: CommandModule<Record<string, unknown>, ListMcpOptions> = {
  command: 'list-mcp',
  describe: 'List MCP servers discovered by Gemini CLI',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<ListMcpOptions> => {
    return (yargs as Argv<ListMcpOptions>)
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Output results as JSON',
      })
      .example('$0 gemini list-mcp', 'Display discovered Gemini CLI MCP servers');
  },

  handler: async (argv) => {
    try {
      const [userServers, projectServers, stats] = await Promise.all([
        bridge.discoverMCPServersByScope('user'),
        bridge.discoverMCPServersByScope('project'),
        bridge.getDiscoveryStats(),
      ]);

      const servers: MCPServerConfig[] = [...userServers, ...projectServers].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      if (argv.json) {
        console.log(
          JSON.stringify(
            {
              servers,
              stats,
            },
            null,
            2,
          ),
        );
        process.exit(0);
        return;
      }

      if (servers.length === 0) {
        console.log(chalk.yellow('\nNo Gemini CLI MCP servers were found.\n'));
        console.log(
          chalk.gray(
            'Use `ax gemini sync-mcp` to register the AutomatosX MCP server or add entries to ~/.gemini/settings.json.',
          ),
        );
        console.log();
        process.exit(0);
        return;
      }

      console.log(chalk.blue.bold(`\nGemini CLI MCP Servers (${servers.length})\n`));

      const table = new Table({
        head: ['Name', 'Command', 'Transport', 'Source'],
        colWidths: [22, 46, 12, 12],
        wordWrap: true,
      });

      servers.forEach((server) => {
        const sourceLabel = server.source ?? 'merged';
        table.push([
          server.name,
          formatCommandInvocation(server),
          server.transport,
          sourceLabel,
        ]);
      });

      console.log(table.toString());
      console.log();

      const transportSummary = Object.entries(stats.byTransport)
        .filter(([, count]) => count > 0)
        .map(([transport, count]) => `${transport}: ${count}`)
        .join(', ');

      console.log(
        chalk.gray(
          `Total: ${stats.total} (user ${stats.userScope}, project ${stats.projectScope})${
            transportSummary ? ` • transports → ${transportSummary}` : ''
          }`,
        ),
      );
      console.log();

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, 'Failed to list Gemini CLI MCP servers');
    }
  },
};

const listCommandsCommand: CommandModule<Record<string, unknown>, ListCommandsOptions> = {
  command: 'list-commands',
  describe: 'List custom Gemini CLI commands',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<ListCommandsOptions> => {
    return (yargs as Argv<ListCommandsOptions>)
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Output results as JSON',
      })
      .example('$0 gemini list-commands', 'Show available Gemini CLI custom commands');
  },

  handler: async (argv) => {
    try {
      const sorted = [...(await translator.scanGeminiCommands(undefined, true))].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      if (argv.json) {
        console.log(
          JSON.stringify(
            {
              commands: sorted,
            },
            null,
            2,
          ),
        );
        process.exit(0);
        return;
      }

      if (sorted.length === 0) {
        console.log(chalk.yellow('\nNo Gemini CLI commands found.\n'));
        console.log(
          chalk.gray(
            'Add .toml files under ~/.gemini/commands or ./.gemini/commands to expose custom commands.',
          ),
        );
        console.log();
        process.exit(0);
        return;
      }

      console.log(chalk.blue.bold(`\nGemini CLI Commands (${sorted.length})\n`));

      const grouped = new Map<string, CommandInfo[]>();
      sorted.forEach((command) => {
        const key = namespaceKey(command.namespace);
        grouped.set(key, [...(grouped.get(key) ?? []), command]);
      });

      for (const [namespace, items] of Array.from(grouped.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        console.log(chalk.cyan.bold(`Namespace: ${namespace}`));

        const table = new Table({
          head: ['Command', 'Description'],
          colWidths: [30, 50],
          wordWrap: true,
        });

        items.forEach((command) => {
          table.push([
            command.name,
            command.description || 'No description',
          ]);
        });

        console.log(table.toString());
        console.log();
      }

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, 'Failed to list Gemini CLI commands');
    }
  },
};

const importGeminiCommand: CommandModule<Record<string, unknown>, ImportGeminiCommandOptions> = {
  command: 'import-command <name>',
  describe: 'Import a Gemini CLI command as an AutomatosX ability',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<ImportGeminiCommandOptions> => {
    return (yargs as Argv<ImportGeminiCommandOptions>)
      .positional('name', {
        describe: 'Gemini CLI command name (use namespace:command for namespaced commands)',
        type: 'string',
        demandOption: true,
      })
      .option('output-dir', {
        alias: 'o',
        type: 'string',
        default: '.automatosx/abilities',
        describe: 'Directory for the generated AutomatosX ability markdown',
      })
      .option('overwrite', {
        type: 'boolean',
        default: false,
        describe: 'Overwrite the ability file if it already exists',
      })
      .example('$0 gemini import-command plan', 'Import the user-level "plan" command into AutomatosX abilities')
      .example('$0 gemini import-command git:commit', 'Import a namespaced Gemini CLI command');
  },

  handler: async (argv) => {
    try {
      if (!argv.name || typeof argv.name !== 'string') {
        console.error(chalk.red.bold('\n✗ Command name is required\n'));
        process.exit(1);
      }

      const rawOutputDir =
        typeof argv.outputDir === 'string'
          ? argv.outputDir
          : typeof argv['output-dir'] === 'string'
          ? argv['output-dir']
          : undefined;

      const outputDir = rawOutputDir && rawOutputDir.length > 0 ? rawOutputDir : '.automatosx/abilities';

      const outputPath = await translator.importCommand(argv.name, outputDir, {
        overwrite: Boolean(argv.overwrite),
        validate: true,
      });

      console.log(chalk.green.bold('\n✓ Gemini CLI command imported\n'));
      console.log(chalk.gray(`Command: ${chalk.white(argv.name)}`));
      console.log(chalk.gray(`Ability path: ${chalk.white(outputPath)}`));
      console.log();

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, `Failed to import Gemini CLI command "${argv.name}"`);
    }
  },
};

const statusCommand: CommandModule<Record<string, unknown>, StatusOptions> = {
  command: 'status',
  describe: 'Show Gemini CLI integration status',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<StatusOptions> => {
    return (yargs as Argv<StatusOptions>)
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Output status as JSON',
      })
      .example('$0 gemini status', 'Check Gemini CLI integration status');
  },

  handler: async (argv) => {
    try {
      const [configStatus, discoveryStats, commands] = await Promise.all([
        bridge.getConfigStatus(),
        bridge.getDiscoveryStats(),
        translator.scanGeminiCommands(undefined, true),
      ]);

      const namespaceCounts = commands.reduce<Record<string, number>>((acc, command) => {
        const key = namespaceKey(command.namespace);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

      if (argv.json) {
        console.log(
          JSON.stringify(
            {
              configuration: configStatus,
              mcp: discoveryStats,
              commands: {
                total: commands.length,
                namespaces: namespaceCounts,
              },
            },
            null,
            2,
          ),
        );
        process.exit(0);
        return;
      }

      const namespaceSummary = Object.entries(namespaceCounts)
        .map(([ns, count]) => `${ns}: ${count}`)
        .join(', ');
      const commandsSummary = namespaceSummary ? `${commands.length} (${namespaceSummary})` : String(commands.length);

      console.log(chalk.blue.bold('\nGemini CLI Integration Status\n'));
      console.log(
        `${chalk.gray('Gemini CLI configured:')} ${
          configStatus.configured ? chalk.green('Yes') : chalk.red('No')
        }`,
      );
      console.log(
        `${chalk.gray('AutomatosX MCP registered:')} ${
          configStatus.automatosxRegistered ? chalk.green('Yes') : chalk.red('No')
        }`,
      );
      console.log(
        `${chalk.gray('MCP servers:')} ${chalk.white(
          `${discoveryStats.total} (user ${discoveryStats.userScope}, project ${discoveryStats.projectScope})`,
        )}`,
      );

      const transportSummary = Object.entries(discoveryStats.byTransport)
        .filter(([, count]) => count > 0)
        .map(([transport, count]) => `${transport}: ${count}`)
        .join(', ');

      if (transportSummary) {
        console.log(chalk.gray(`  transports → ${transportSummary}`));
      }

      console.log(`${chalk.gray('Commands:')} ${chalk.white(commandsSummary)}`);

      if (configStatus.hasUserConfig) {
        console.log(chalk.gray(`User config: ${getUserConfigPath()}`));
      } else {
        console.log(chalk.gray(`User config not detected; expected at ${getUserConfigPath()}`));
      }

      if (configStatus.hasProjectConfig) {
        console.log(chalk.gray(`Project config: ${getProjectConfigPath()}`));
      }

      console.log();

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, 'Failed to compute Gemini CLI integration status');
    }
  },
};

const exportAbilityCommand: CommandModule<Record<string, unknown>, ExportAbilityOptions> = {
  command: 'export-ability <name>',
  describe: 'Export an AutomatosX ability as a Gemini CLI command',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<ExportAbilityOptions> => {
    return (yargs as Argv<ExportAbilityOptions>)
      .positional('name', {
        describe: 'AutomatosX ability name to export',
        type: 'string',
        demandOption: true,
      })
      .option('output-dir', {
        alias: 'o',
        type: 'string',
        default: '.gemini/commands',
        describe: 'Directory for the generated TOML command',
      })
      .option('overwrite', {
        type: 'boolean',
        default: false,
        describe: 'Overwrite the TOML file if it already exists',
      })
      .example('$0 gemini export-ability backend-development', 'Export backend-development ability to Gemini CLI');
  },

  handler: async (argv) => {
    try {
      if (!argv.name || typeof argv.name !== 'string') {
        console.error(chalk.red.bold('\n✗ Ability name is required\n'));
        process.exit(1);
      }

      const rawOutputDir =
        typeof argv.outputDir === 'string'
          ? argv.outputDir
          : typeof argv['output-dir'] === 'string'
          ? argv['output-dir']
          : undefined;

      const outputDir = rawOutputDir && rawOutputDir.length > 0 ? rawOutputDir : '.gemini/commands';

      // Use absolute path for abilities directory
      const abilitiesDir = resolve(process.cwd(), '.automatosx/abilities');
      const abilityPath = join(abilitiesDir, `${argv.name}.md`);

      // Verify ability file exists
      if (!(await fileExists(abilityPath))) {
        // List available abilities to help user
        const availableAbilities = await glob('*.md', { cwd: abilitiesDir });
        throw new GeminiCLIError(
          GeminiCLIErrorType.FILE_ERROR,
          `Ability "${argv.name}" not found`,
          {
            path: abilityPath,
            availableAbilities: availableAbilities.map((f: string) => basename(f, '.md'))
          }
        );
      }

      // Generate output path
      const outputPath = `${outputDir}/${argv.name}.toml`;

      await translator.abilityToToml(abilityPath, outputPath, {
        overwrite: Boolean(argv.overwrite),
      });

      console.log(chalk.green.bold('\n✓ AutomatosX ability exported\n'));
      console.log(chalk.gray(`Ability: ${chalk.white(argv.name)}`));
      console.log(chalk.gray(`TOML path: ${chalk.white(outputPath)}`));
      console.log(chalk.gray('\nTo use in Gemini CLI:'));
      console.log(chalk.white(`  1. Restart Gemini CLI or reload configuration`));
      console.log(chalk.white(`  2. Run: /${argv.name}`));
      console.log(chalk.gray('\nTo verify the export:'));
      console.log(chalk.white(`  ax gemini list-commands\n`));

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, `Failed to export ability "${argv.name}"`);
    }
  },
};

const validateCommand: CommandModule<Record<string, unknown>, ValidateOptions> = {
  command: 'validate',
  describe: 'Validate Gemini CLI configuration and commands',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<ValidateOptions> => {
    return (yargs as Argv<ValidateOptions>)
      .option('json', {
        type: 'boolean',
        default: false,
        describe: 'Output validation results as JSON',
      })
      .option('fix', {
        type: 'boolean',
        default: false,
        describe: 'Attempt to fix common issues automatically',
      })
      .example('$0 gemini validate', 'Validate Gemini CLI configuration');
  },

  handler: async (argv) => {
    try {
      const issues: Array<{ type: 'error' | 'warning'; message: string; file?: string }> = [];

      // Validate configurations
      const [userConfig, projectConfig] = await Promise.allSettled([
        bridge.getConfigStatus(),
        translator.scanGeminiCommands(undefined, true),
      ]);

      // Check user configuration
      if (userConfig.status === 'fulfilled') {
        if (!userConfig.value.hasUserConfig) {
          issues.push({
            type: 'warning',
            message: 'User-level Gemini CLI configuration not found',
            file: getUserConfigPath(),
          });
        }
      } else {
        issues.push({
          type: 'error',
          message: 'Failed to read user configuration',
          file: getUserConfigPath(),
        });
      }

      // Check commands
      if (projectConfig.status === 'fulfilled') {
        const commands = projectConfig.value;
        if (commands.length === 0) {
          issues.push({
            type: 'warning',
            message: 'No Gemini CLI commands found',
          });
        }
      } else {
        const error = projectConfig.reason;
        issues.push({
          type: 'error',
          message: `Failed to scan Gemini CLI commands: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      // Check MCP servers
      try {
        const servers = await bridge.discoverMCPServers();
        const automatosxServer = servers.find(s => s.name === 'automatosx');

        if (!automatosxServer) {
          issues.push({
            type: 'warning',
            message: 'AutomatosX MCP server not registered. Run: ax gemini sync-mcp',
          });
        }
      } catch (error) {
        issues.push({
          type: 'error',
          message: 'Failed to discover MCP servers',
        });
      }

      // Auto-fix if requested
      if (argv.fix && issues.length > 0) {
        console.log(chalk.cyan('\n🔧 Attempting to fix issues...\n'));

        let fixed = 0;

        // Fix: AutomatosX MCP not registered
        const mcpIssue = issues.find(i => i.message.includes('AutomatosX MCP server not registered'));
        if (mcpIssue) {
          try {
            await bridge.syncAutomatosXMCP(false);
            console.log(chalk.green('✓ Registered AutomatosX MCP server'));
            // Remove the fixed issue
            const index = issues.indexOf(mcpIssue);
            if (index > -1) {
              issues.splice(index, 1);
            }
            fixed++;
          } catch (error) {
            console.log(chalk.yellow('⚠ Could not register MCP server automatically'));
            console.log(chalk.gray(`  ${error instanceof Error ? error.message : String(error)}`));
          }
        }

        // Fix: User config not found
        const configIssue = issues.find(i => i.type === 'warning' && i.message.includes('User-level'));
        if (configIssue) {
          console.log(chalk.gray('ℹ User config missing - this requires manual setup with Gemini CLI'));
        }

        console.log(chalk.cyan(`\n${fixed} issue(s) fixed automatically\n`));
      }

      if (argv.json) {
        const hasErrors = issues.some(i => i.type === 'error');
        console.log(JSON.stringify({
          valid: !hasErrors,
          issues,
        }, null, 2));
        process.exit(hasErrors ? 1 : 0);
        return;
      }

      console.log(chalk.blue.bold('\nGemini CLI Validation Report\n'));

      if (issues.length === 0) {
        console.log(chalk.green('✓ No issues found. Configuration is valid.\n'));
        process.exit(0);
        return;
      }

      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');

      if (errors.length > 0) {
        console.log(chalk.red.bold(`Errors (${errors.length}):\n`));
        errors.forEach(issue => {
          console.log(chalk.red(`  ✗ ${issue.message}`));
          if (issue.file) {
            console.log(chalk.gray(`    File: ${issue.file}`));
          }
        });
        console.log();
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow.bold(`Warnings (${warnings.length}):\n`));
        warnings.forEach(issue => {
          console.log(chalk.yellow(`  ⚠ ${issue.message}`));
          if (issue.file) {
            console.log(chalk.gray(`    File: ${issue.file}`));
          }
        });
        console.log();
      }

      console.log(chalk.gray(`Total issues: ${issues.length} (${errors.length} errors, ${warnings.length} warnings)\n`));

      process.exit(errors.length > 0 ? 1 : 0);
    } catch (error) {
      handleGeminiError(error, 'Failed to validate Gemini CLI configuration');
    }
  },
};

const setupCommand: CommandModule<Record<string, unknown>, SetupOptions> = {
  command: 'setup',
  describe: 'Interactive setup wizard for Gemini CLI integration',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<SetupOptions> => {
    return (yargs as Argv<SetupOptions>)
      .option('skip-mcp', {
        type: 'boolean',
        default: false,
        describe: 'Skip AutomatosX MCP registration',
      })
      .option('skip-import', {
        type: 'boolean',
        default: false,
        describe: 'Skip command import suggestions',
      })
      .example('$0 gemini setup', 'Run interactive setup wizard');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.blue.bold('\n🚀 Gemini CLI Integration Setup\n'));

      // Step 1: Check Gemini CLI status
      console.log(chalk.cyan('Step 1: Checking Gemini CLI configuration...\n'));

      const configStatus = await bridge.getConfigStatus();

      if (!configStatus.configured) {
        console.log(chalk.yellow('⚠ Gemini CLI is not configured yet.'));
        console.log(chalk.gray('Please install and configure Gemini CLI first:'));
        console.log(chalk.white('  npm install -g @google/generative-ai-cli\n'));
        process.exit(1);
      }

      console.log(chalk.green('✓ Gemini CLI is configured\n'));

      // Step 2: Register AutomatosX MCP (unless skipped)
      const skipMcp = Boolean(argv.skipMcp);

      if (!skipMcp) {
        console.log(chalk.cyan('Step 2: Registering AutomatosX MCP server...\n'));

        if (configStatus.automatosxRegistered) {
          console.log(chalk.gray('AutomatosX MCP server is already registered.'));
          console.log(chalk.gray('Use --skip-mcp to skip this step in the future.\n'));
        } else {
          try {
            await bridge.syncAutomatosXMCP(false);
            console.log(chalk.green('✓ AutomatosX MCP server registered\n'));
          } catch (error) {
            if (error instanceof GeminiCLIError) {
              if (error.type === GeminiCLIErrorType.VALIDATION_ERROR) {
                console.log(chalk.red('✗ MCP server registration failed (validation):'));
                console.log(chalk.gray(`  ${error.message}`));
                console.log(chalk.gray('  Please check your Gemini CLI configuration.\n'));
              } else if (error.type === GeminiCLIErrorType.FILE_ERROR) {
                console.log(chalk.red('✗ MCP server registration failed (file access):'));
                console.log(chalk.gray(`  ${error.message}`));
                console.log(chalk.gray('  Check file permissions and try: ax gemini sync-mcp\n'));
              } else {
                console.log(chalk.yellow('⚠ Failed to register MCP server:'));
                console.log(chalk.gray(`  ${error.message}`));
                console.log(chalk.gray('You can register manually later with: ax gemini sync-mcp\n'));
              }
            } else {
              console.log(chalk.yellow('⚠ Unexpected error during MCP registration:'));
              console.log(chalk.gray(`  ${error instanceof Error ? error.message : String(error)}`));
              console.log(chalk.gray('You can register manually later with: ax gemini sync-mcp\n'));
            }
          }
        }
      } else {
        console.log(chalk.gray('Step 2: Skipped (--skip-mcp)\n'));
      }

      // Step 3: Show available commands
      const skipImport = Boolean(argv.skipImport);

      if (!skipImport) {
        console.log(chalk.cyan('Step 3: Available commands for import...\n'));

        try {
          const commands = await translator.scanGeminiCommands(undefined, true);

          if (commands.length > 0) {
            console.log(chalk.gray(`Found ${commands.length} Gemini CLI command(s):\n`));

            const grouped = new Map<string, CommandInfo[]>();
            commands.forEach(cmd => {
              const ns = cmd.namespace ?? 'global';
              const existing = grouped.get(ns);
              grouped.set(ns, existing ? [...existing, cmd] : [cmd]);
            });

            for (const [namespace, cmds] of grouped) {
              console.log(chalk.white(`  ${namespace}:`));
              cmds.forEach(cmd => {
                console.log(chalk.gray(`    - ${cmd.name}`));
              });
            }

            console.log(chalk.gray('\nTo import a command, use:'));
            console.log(chalk.white('  ax gemini import-command <command-name>\n'));
          } else {
            console.log(chalk.gray('No Gemini CLI commands found.'));
            console.log(chalk.gray('Add .toml files to ~/.gemini/commands or ./.gemini/commands\n'));
          }
        } catch (error) {
          console.log(chalk.yellow('⚠ Failed to scan commands'));
          console.log(chalk.gray(`  ${error instanceof Error ? error.message : String(error)}\n`));
        }
      } else {
        console.log(chalk.gray('Step 3: Skipped (--skip-import)\n'));
      }

      // Final summary
      console.log(chalk.green.bold('✓ Setup complete!\n'));
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.white('  • Check status: ax gemini status'));
      console.log(chalk.white('  • List MCP servers: ax gemini list-mcp'));
      console.log(chalk.white('  • List commands: ax gemini list-commands'));
      console.log(chalk.white('  • Import a command: ax gemini import-command <name>'));
      console.log(chalk.white('  • Validate config: ax gemini validate\n'));

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, 'Setup failed');
    }
  },
};

// v5.8.6: Doctor command for comprehensive diagnostics
const doctorCommand: CommandModule<Record<string, unknown>, DoctorOptions> = {
  command: 'doctor',
  describe: 'Run diagnostic checks for Gemini CLI integration',

  builder: (yargs: Argv<Record<string, unknown>>): Argv<DoctorOptions> => {
    return (yargs as Argv<DoctorOptions>)
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Show detailed information',
        default: false,
      })
      .option('fix', {
        type: 'boolean',
        description: 'Attempt to automatically fix issues',
        default: false,
      })
      .example('$0 gemini doctor', 'Run all diagnostic checks')
      .example('$0 gemini doctor --verbose', 'Show detailed diagnostic information');
  },

  handler: async (argv) => {
    interface CheckResult {
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
      details?: string;
      suggestion?: string;
    }

    function printResult(result: CheckResult, verbose: boolean): void {
      const icon =
        result.status === 'pass'
          ? chalk.green('✓')
          : result.status === 'warn'
            ? chalk.yellow('⚠')
            : chalk.red('✗');

      console.log(`${icon} ${chalk.bold(result.name)}: ${result.message}`);

      if (verbose && result.details) {
        console.log(`  ${chalk.gray(result.details)}`);
      }

      if (result.suggestion) {
        console.log(`  ${chalk.cyan('→')} ${result.suggestion}`);
      }

      console.log();
    }

    async function checkCLIInstalled(): Promise<CheckResult> {
      // Check if gemini command exists using which
      const which = spawnSync('which', ['gemini'], { timeout: 3000 });

      if (which.status === 0 && which.stdout) {
        const geminiPath = which.stdout.toString().trim();
        return {
          name: 'CLI Installation',
          status: 'pass',
          message: 'Gemini CLI is installed',
          details: `Found at: ${geminiPath}`,
        };
      } else {
        return {
          name: 'CLI Installation',
          status: 'fail',
          message: 'Gemini CLI not found in PATH',
          suggestion: 'Install: npm install -g @google/generative-ai-cli',
        };
      }
    }

    async function checkCLIVersion(): Promise<CheckResult> {
      return new Promise((resolve) => {
        const child = spawn('gemini', ['--version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let resolved = false;

        const safeResolve = (result: CheckResult) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        };

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0 && stdout.trim()) {
            safeResolve({
              name: 'CLI Version',
              status: 'pass',
              message: 'Gemini CLI version detected',
              details: stdout.trim(),
            });
          } else {
            safeResolve({
              name: 'CLI Version',
              status: 'warn',
              message: 'Could not detect version',
              details: stderr || 'No version output',
            });
          }
        });

        const timeoutId = setTimeout(() => {
          child.kill();
          safeResolve({
            name: 'CLI Version',
            status: 'fail',
            message: 'Version check timed out',
          });
        }, 5000);
      });
    }

    async function checkConfiguration(): Promise<CheckResult> {
      try {
        const config = await loadConfig(process.cwd());
        const geminiConfig = config?.providers?.['gemini-cli'];

        if (!geminiConfig) {
          return {
            name: 'Configuration',
            status: 'fail',
            message: 'Gemini provider not found in config',
            suggestion: 'Add gemini-cli to automatosx.config.json',
          };
        }

        if (!geminiConfig.enabled) {
          return {
            name: 'Configuration',
            status: 'warn',
            message: 'Gemini provider is disabled',
            suggestion: 'Enable: providers.gemini-cli.enabled = true',
          };
        }

        return {
          name: 'Configuration',
          status: 'pass',
          message: 'Configuration is valid',
          details: `Priority: ${geminiConfig.priority}, Timeout: ${geminiConfig.timeout}ms`,
        };
      } catch (error) {
        return {
          name: 'Configuration',
          status: 'fail',
          message: 'Failed to load configuration',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }

    async function checkMCPRegistration(): Promise<CheckResult> {
      try {
        const isRegistered = await bridge.isAutomatosXMCPRegistered('user');

        if (isRegistered) {
          return {
            name: 'MCP Registration',
            status: 'pass',
            message: 'AutomatosX MCP server is registered',
          };
        } else {
          return {
            name: 'MCP Registration',
            status: 'warn',
            message: 'AutomatosX MCP server not registered',
            suggestion: 'Run: ax gemini sync-mcp',
          };
        }
      } catch (error) {
        return {
          name: 'MCP Registration',
          status: 'fail',
          message: 'Failed to check MCP registration',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }

    try {
      console.log(chalk.bold('\n🏥 Gemini CLI Doctor\n'));
      console.log('Running diagnostic checks...\n');

      const checks: CheckResult[] = [];

      // Run all checks
      checks.push(await checkCLIInstalled());
      checks.push(await checkCLIVersion());
      checks.push(await checkConfiguration());
      checks.push(await checkMCPRegistration());

      // Print results
      for (const result of checks) {
        printResult(result, argv.verbose || false);
      }

      // Summary
      const passed = checks.filter((c) => c.status === 'pass').length;
      const warned = checks.filter((c) => c.status === 'warn').length;
      const failed = checks.filter((c) => c.status === 'fail').length;

      console.log(chalk.bold('Summary:'));
      console.log(`  ${chalk.green('✓')} ${passed} passed`);
      if (warned > 0) console.log(`  ${chalk.yellow('⚠')} ${warned} warnings`);
      if (failed > 0) console.log(`  ${chalk.red('✗')} ${failed} failed`);
      console.log();

      if (failed > 0) {
        console.log(chalk.yellow('⚠️  Some checks failed. Address issues above.\n'));
        process.exit(1);
      } else if (warned > 0) {
        console.log(chalk.cyan('ℹ️  Gemini CLI functional but has warnings.\n'));
      } else {
        console.log(chalk.green('✅ All checks passed! Gemini CLI is ready.\n'));
      }

      process.exit(0);
    } catch (error) {
      handleGeminiError(error, 'Doctor diagnostic failed');
    }
  },
};

export const geminiCommand: CommandModule = {
  command: 'gemini <command>',
  describe: 'Manage Gemini CLI integration',

  builder: (yargs) => {
    return yargs
      .command(syncMcpCommand)
      .command(listMcpCommand)
      .command(listCommandsCommand)
      .command(importGeminiCommand)
      .command(statusCommand)
      .command(exportAbilityCommand)
      .command(validateCommand)
      .command(setupCommand)
      .command(doctorCommand)
      .demandCommand(1, 'You must provide a valid subcommand')
      .help();
  },

  handler: () => {
    // No-op: subcommands handle the work.
  },
};
