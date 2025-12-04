/**
 * MCP Command - Manage MCP Servers and Tools
 *
 * Comprehensive CLI for managing MCP (Model Context Protocol) servers
 * across all providers (Claude, Gemini, OpenAI/Codex).
 *
 * Subcommands:
 * - mcp server: Start AutomatosX as MCP server (for Claude Code)
 * - mcp status: Show status of all MCP servers
 * - mcp health: Run health checks on all servers
 * - mcp tools: List available MCP tools
 * - mcp start: Start specific MCP server
 * - mcp stop: Stop specific MCP server
 * - mcp restart: Restart specific MCP server
 * - mcp discover: Discover installed MCP servers
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import Table from 'cli-table3';
import { McpServer } from '../../mcp/server.js';
import { logger } from '../../shared/logging/logger.js';
import { YamlConfigLoader } from '../../core/config-loaders/yaml-config-loader.js';
import { getDefaultGeminiMCPManager } from '../../integrations/gemini-cli/mcp-manager.js';
// Note: Claude Code and Codex MCP managers not used here - status/health/tools only check Gemini MCP
// For Claude Code MCP, use: ax mcp server (starts AutomatosX as MCP server for Claude Code)
// For Codex MCP, integration is handled directly by openai-codex provider
import { KNOWN_MCP_SERVERS } from '../../mcp/types-common.js';
import { existsSync } from 'fs';
import { join } from 'path';

interface McpServerArgs {
  debug?: boolean;
}

interface McpStatusArgs {
  provider?: string;
  json?: boolean;
}

interface McpServerControlArgs {
  server: string;
  provider?: string;
}

interface McpDiscoverArgs {
  install?: boolean;
}

/**
 * MCP Server subcommand - Start AutomatosX as MCP server
 */
const serverCommand: CommandModule<object, McpServerArgs> = {
  command: 'server',
  describe: 'Start AutomatosX as MCP server for Claude Code integration',

  builder: (yargs) => {
    return yargs
      .option('debug', {
        alias: 'd',
        type: 'boolean',
        description: 'Enable debug logging',
        default: false,
      })
      .example('$0 mcp server', 'Start MCP server (stdio mode)')
      .example('$0 mcp server --debug', 'Start with debug logging');
  },

  handler: async (argv) => {
    try {
      logger.info('Starting AutomatosX MCP Server...');

      const server = new McpServer({
        debug: argv.debug,
      });

      await server.start();

      // Server runs until stopped (SIGINT/SIGTERM)
    } catch (error) {
      logger.error('Failed to start MCP server', { error });
      process.exit(1);
    }
  },
};

/**
 * MCP Status subcommand - Show status of all MCP servers
 */
const statusCommand: CommandModule<object, McpStatusArgs> = {
  command: 'status',
  describe: 'Show status of all MCP servers across all providers',

  builder: (yargs) => {
    return yargs
      .option('provider', {
        alias: 'p',
        type: 'string',
        description: 'Filter by provider (claude, gemini, codex)',
        choices: ['claude', 'gemini', 'codex'],
      })
      .option('json', {
        alias: 'j',
        type: 'boolean',
        description: 'Output as JSON',
        default: false,
      })
      .example('$0 mcp status', 'Show all MCP servers')
      .example('$0 mcp status --provider gemini', 'Show Gemini MCP servers only')
      .example('$0 mcp status --json', 'Output as JSON');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.cyan.bold('\n📡 MCP Server Status\n'));

      const allStatuses: any[] = [];

      // Get Gemini MCP status
      if (!argv.provider || argv.provider === 'gemini') {
        try {
          const geminiManager = getDefaultGeminiMCPManager();
          await geminiManager.initialize();
          const statuses = await geminiManager.getStatus();

          statuses.forEach(s => allStatuses.push({ provider: 'gemini', ...s }));
        } catch (error) {
          logger.debug('Gemini MCP not available', { error });
        }
      }

      // Grok MCP removed in v11.0.0

      // Output
      if (argv.json) {
        console.log(JSON.stringify(allStatuses, null, 2));
      } else {
        if (allStatuses.length === 0) {
          console.log(chalk.yellow('No MCP servers running'));
          console.log(chalk.gray('\nTo enable MCP servers, configure them in your provider YAML files.'));
          console.log(chalk.gray('See: examples/providers/ for MCP configuration templates\n'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('Provider'),
            chalk.cyan('Server'),
            chalk.cyan('Status'),
            chalk.cyan('PID'),
            chalk.cyan('Uptime'),
          ],
          style: { head: [], border: [] },
        });

        allStatuses.forEach(s => {
          const uptime = s.startTime
            ? formatUptime(Date.now() - new Date(s.startTime).getTime())
            : 'N/A';

          const status = s.running
            ? chalk.green('●') + ' Running'
            : chalk.red('●') + ' Stopped';

          table.push([
            s.provider,
            s.name,
            status,
            s.pid?.toString() || 'N/A',
            uptime,
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`\nTotal servers: ${allStatuses.length}`));
        console.log(
          chalk.gray(
            `Running: ${allStatuses.filter(s => s.running).length} | Stopped: ${
              allStatuses.filter(s => !s.running).length
            }\n`
          )
        );
      }
    } catch (error) {
      logger.error('Failed to get MCP status', { error });
      process.exit(1);
    }
  },
};

/**
 * MCP Health subcommand - Run health checks
 */
const healthCommand: CommandModule<object, McpStatusArgs> = {
  command: 'health',
  describe: 'Run health checks on all MCP servers',

  builder: (yargs) => {
    return yargs
      .option('provider', {
        alias: 'p',
        type: 'string',
        description: 'Filter by provider',
        choices: ['claude', 'gemini', 'codex'],
      })
      .option('json', {
        alias: 'j',
        type: 'boolean',
        description: 'Output as JSON',
        default: false,
      })
      .example('$0 mcp health', 'Check health of all servers')
      .example('$0 mcp health --provider gemini', 'Check Gemini servers only');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.cyan.bold('\n🏥 MCP Health Check\n'));

      const allResults: any[] = [];

      // Check Gemini
      if (!argv.provider || argv.provider === 'gemini') {
        try {
          const geminiManager = getDefaultGeminiMCPManager();
          await geminiManager.initialize();
          const results = await geminiManager.getStatus();

          results.forEach(r =>
            allResults.push({
              provider: 'gemini',
              serverName: r.name,
              healthy: r.running,
              timestamp: new Date(),
            })
          );
        } catch (error) {
          logger.debug('Gemini health check failed', { error });
        }
      }

      // Grok health check removed in v11.0.0

      // Output
      if (argv.json) {
        console.log(JSON.stringify(allResults, null, 2));
      } else {
        if (allResults.length === 0) {
          console.log(chalk.yellow('No MCP servers to check\n'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('Provider'),
            chalk.cyan('Server'),
            chalk.cyan('Health'),
            chalk.cyan('Checked At'),
          ],
          style: { head: [], border: [] },
        });

        allResults.forEach(r => {
          const health = r.healthy
            ? chalk.green('✓') + ' Healthy'
            : chalk.red('✗') + ' Unhealthy';

          table.push([
            r.provider,
            r.serverName,
            health,
            new Date(r.timestamp).toLocaleTimeString(),
          ]);
        });

        console.log(table.toString());

        const healthy = allResults.filter(r => r.healthy).length;
        const unhealthy = allResults.filter(r => !r.healthy).length;

        console.log(chalk.gray(`\nHealthy: ${healthy} | Unhealthy: ${unhealthy}\n`));

        if (unhealthy > 0) {
          console.log(chalk.yellow('⚠️  Some servers are unhealthy. Consider restarting them.'));
          console.log(chalk.gray('Use: ax mcp restart <server-name>\n'));
        }
      }
    } catch (error) {
      logger.error('Health check failed', { error });
      process.exit(1);
    }
  },
};

/**
 * MCP Tools subcommand - List available tools
 */
const toolsCommand: CommandModule<object, McpStatusArgs> = {
  command: 'tools',
  describe: 'List all available MCP tools',

  builder: (yargs) => {
    return yargs
      .option('provider', {
        alias: 'p',
        type: 'string',
        description: 'Filter by provider',
        choices: ['claude', 'gemini', 'codex'],
      })
      .option('json', {
        alias: 'j',
        type: 'boolean',
        description: 'Output as JSON',
        default: false,
      })
      .example('$0 mcp tools', 'List all available tools')
      .example('$0 mcp tools --provider gemini', 'List Gemini tools only');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.cyan.bold('\n🔧 MCP Tools\n'));

      const allTools: any[] = [];

      // Get Gemini tools
      if (!argv.provider || argv.provider === 'gemini') {
        try {
          const geminiManager = getDefaultGeminiMCPManager();
          await geminiManager.initialize();
          const tools = await geminiManager.discoverTools();

          tools.forEach(t => allTools.push({ provider: 'gemini', ...t }));
        } catch (error) {
          logger.debug('Gemini tools not available', { error });
        }
      }

      // Grok tools discovery removed in v11.0.0

      // Output
      if (argv.json) {
        console.log(JSON.stringify(allTools, null, 2));
      } else {
        if (allTools.length === 0) {
          console.log(chalk.yellow('No MCP tools discovered'));
          console.log(chalk.gray('\nMCP servers need to be running to discover tools.'));
          console.log(chalk.gray('Check status with: ax mcp status\n'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('Provider'),
            chalk.cyan('Server'),
            chalk.cyan('Tool'),
            chalk.cyan('Description'),
          ],
          style: { head: [], border: [] },
          colWidths: [12, 15, 20, 50],
          wordWrap: true,
        });

        allTools.forEach(t => {
          table.push([
            t.provider,
            t.serverName,
            t.name,
            t.description || chalk.gray('(no description)'),
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`\nTotal tools: ${allTools.length}\n`));
      }
    } catch (error) {
      logger.error('Failed to list tools', { error });
      process.exit(1);
    }
  },
};

/**
 * MCP Discover subcommand - Discover installed MCP servers
 */
const discoverCommand: CommandModule<object, McpDiscoverArgs> = {
  command: 'discover',
  describe: 'Discover installed MCP servers',

  builder: (yargs) => {
    return yargs
      .option('install', {
        alias: 'i',
        type: 'boolean',
        description: 'Install missing servers',
        default: false,
      })
      .example('$0 mcp discover', 'List known MCP servers')
      .example('$0 mcp discover --install', 'Install missing servers');
  },

  handler: async (argv) => {
    try {
      console.log(chalk.cyan.bold('\n🔍 MCP Server Discovery\n'));

      const table = new Table({
        head: [
          chalk.cyan('Server'),
          chalk.cyan('Status'),
          chalk.cyan('Description'),
        ],
        style: { head: [], border: [] },
        colWidths: [15, 15, 60],
        wordWrap: true,
      });

      for (const [name, config] of Object.entries(KNOWN_MCP_SERVERS)) {
        // Check if server package is installed (simplified check)
        const packageName = config.args.find(arg => arg.startsWith('@'));
        const installed = packageName ? checkIfInstalled(packageName) : false;

        const status = installed
          ? chalk.green('✓') + ' Installed'
          : chalk.gray('○') + ' Not installed';

        table.push([name, status, config.description || '']);
      }

      console.log(table.toString());
      console.log(chalk.gray(`\nTotal known servers: ${Object.keys(KNOWN_MCP_SERVERS).length}\n`));

      if (argv.install) {
        console.log(chalk.yellow('\n⚠️  Auto-installation not yet implemented'));
        console.log(chalk.gray('To install MCP servers manually:'));
        console.log(chalk.gray('  npm install -g @modelcontextprotocol/server-filesystem'));
        console.log(chalk.gray('  npm install -g @modelcontextprotocol/server-github'));
        console.log(chalk.gray('  ...etc\n'));
      } else {
        console.log(chalk.gray('To install missing servers, use: ax mcp discover --install\n'));
      }
    } catch (error) {
      logger.error('Discovery failed', { error });
      process.exit(1);
    }
  },
};

/**
 * Main MCP command with subcommands
 */
export const mcpCommand: CommandModule = {
  command: 'mcp <command>',
  describe: 'Manage MCP servers and tools',

  builder: (yargs: Argv) => {
    return yargs
      .command(serverCommand)
      .command(statusCommand)
      .command(healthCommand)
      .command(toolsCommand)
      .command(discoverCommand)
      .demandCommand(1, 'Please specify a subcommand')
      .example('$0 mcp server', 'Start AutomatosX as MCP server')
      .example('$0 mcp status', 'Show MCP server status')
      .example('$0 mcp health', 'Run health checks')
      .example('$0 mcp tools', 'List available tools')
      .example('$0 mcp discover', 'Discover installed servers')
      .help();
  },

  handler: () => {
    // This is handled by subcommands
  },
};

// ========== Helper Functions ==========

/**
 * Format uptime duration
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Check if npm package is installed (simplified)
 */
function checkIfInstalled(packageName: string): boolean {
  try {
    // Check in global node_modules (simplified check)
    const globalNodeModules = process.env.NODE_PATH || '';
    const packagePath = join(globalNodeModules, packageName);
    return existsSync(packagePath);
  } catch {
    return false;
  }
}
