/**
 * AutomatosX CLI Entry Point
 *
 * Provides command-line interface for AutomatosX agent orchestration platform.
 *
 * Global Options:
 * - --debug: Enable debug mode with verbose output
 * - --quiet: Suppress non-essential output
 * - --config: Path to custom config file
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { logger, setLogLevel } from '../utils/logger.js';
import { globalTracker } from '../utils/performance.js';
import { getVersion } from '../utils/version.js';
import { installExitHandlers } from '../utils/process-manager.js';

// Install exit handlers to cleanup child processes
// Fixes: Background tasks hanging when run via Claude Code
installExitHandlers();

// Get version from package.json (single source of truth)
const VERSION = getVersion();

// Import all commands directly (lazy loading broke command options)
import { cacheCommand } from './commands/cache.js';
import { configCommand } from './commands/config.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { mcpCommand } from './commands/mcp.js';
import { memoryCommand } from './commands/memory.js';
import { runCommand } from './commands/run.js';
import { sessionCommand } from './commands/session.js';
import { statusCommand } from './commands/status.js';
import { updateCommand } from './commands/update.js';
import { workspaceCommand } from './commands/workspace.js';
import { agentCommand } from './commands/agent/index.js';
import { resumeCommand } from './commands/resume.js';
import { runsCommand } from './commands/runs.js';
import { geminiCommand } from './commands/gemini.js';
import { providerLimitsCommand } from './commands/provider-limits.js';
import { specCommand } from './commands/spec.js';
import { genCommand } from './commands/gen.js';
import { providersCommand } from './commands/providers.js';
import { doctorCommand } from './commands/doctor.js';
import { setupCommand } from './commands/setup.js';
import { cleanupCommand } from './commands/cleanup.js';
import { analyticsCommand } from './commands/analytics.js';

// Mark CLI startup
globalTracker.mark('cli_start');

// Main CLI execution wrapped in async IIFE to properly handle top-level await
// Fixes: "Warning: Detected unsettled top-level await" error
(async () => {
  try {
    // Parse CLI arguments
    globalTracker.mark('yargs_parse_start');
    const argv = await yargs(hideBin(process.argv))
  .scriptName('automatosx')
  .usage('$0 <command> [options]')
  .usage('\nAI Agent Orchestration Platform')
  .example('$0 init', 'Initialize project')
  .example('$0 agent create backend --template developer', 'Create agent from template')
  .example('$0 agent list', 'List all agents')
  .example('$0 run assistant "Hello"', 'Run assistant agent')
  .example('$0 run backend "task" --interactive', 'Run with interactive checkpoints')
  .example('$0 resume <run-id>', 'Resume from checkpoint')
  .example('$0 runs list', 'List checkpoint runs')
  .example('$0 session create "Build API" backend', 'Create multi-agent session')
  .example('$0 session list', 'List all sessions')
  .example('$0 workspace stats', 'Show workspace statistics')
  .example('$0 list agents', 'List available agents')
  .example('$0 memory search "topic"', 'Search memory')
  .example('$0 cache status', 'View cache statistics')
  .example('$0 config --list', 'View configuration')
  .example('$0 provider-limits', 'Show provider usage limits')
  .example('$0 mcp', 'Start MCP server for Claude Code')
  .example('$0 update', 'Update to latest version')
  .example('$0 gemini status', 'Show Gemini CLI integration status')
  .example('$0 spec run', 'Execute spec-driven tasks')
  .example('$0 spec status', 'Show spec task status')
  .example('$0 providers list', 'List all providers')
  .example('$0 providers info openai', 'Show provider details')
  .example('$0 gen plan workflow.ax.yaml', 'Generate execution plan')
  .example('$0 gen dag workflow.ax.yaml', 'Generate DAG JSON')
  .example('$0 doctor', 'Run diagnostic checks')
  .example('$0 doctor openai', 'Check OpenAI provider setup')
  .example('$0 setup', 'Interactive setup wizard for OpenAI')
  .example('$0 cleanup', 'Clean up orphaned processes')
  .example('$0 cleanup openai --force', 'Force cleanup OpenAI processes')
  .example('$0 analytics summary', 'Show usage analytics summary')
  .example('$0 analytics optimize', 'Show optimization recommendations')

  // Global options
  .option('debug', {
    alias: 'D',
    type: 'boolean',
    description: 'Enable debug mode with verbose output',
    global: true
  })
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'Suppress non-essential output',
    global: true
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to custom config file',
    global: true
  })

  // Commands
  .command(initCommand)
  .command(agentCommand)
  .command(listCommand)
  .command(runCommand)
  .command(resumeCommand)
  .command(runsCommand)
  .command(sessionCommand)
  .command(workspaceCommand)
  .command(cacheCommand)
  .command(configCommand)
  .command(statusCommand)
  .command(doctorCommand)
  .command(setupCommand)
  .command(cleanupCommand)
  .command(analyticsCommand)
  .command(memoryCommand)
  .command(mcpCommand)
  .command(geminiCommand)
  .command(providerLimitsCommand)
  .command(providersCommand)
  .command(specCommand)
  .command(genCommand)
  .command(updateCommand)

  // Configuration
  .demandCommand(1, 'You must provide a command. Run --help for usage.')
  .help()
  .version(VERSION)
  .alias('h', 'help')
  .alias('v', 'version')
  .strict()
  .wrap(Math.min(120, yargs().terminalWidth()))
      .parse();

    globalTracker.mark('yargs_parse_end');
    globalTracker.measure('yargs_parsing', 'yargs_parse_start', 'yargs_parse_end');

    // Apply global options
    globalTracker.mark('options_setup_start');

    if (argv.debug) {
      setLogLevel('debug');
      process.env.AUTOMATOSX_DEBUG = 'true';
      logger.debug('Debug mode enabled', {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
        argv: process.argv.slice(2)
      });
    }

    if (argv.quiet) {
      setLogLevel('error');
      process.env.AUTOMATOSX_QUIET = 'true';
    }

    // Store global options in process.env for access by commands
    if (argv.config) {
      process.env.AUTOMATOSX_CONFIG_PATH = argv.config as string;
      logger.debug('Custom config path set', { path: argv.config });
    }

    // Log startup info in debug mode
    if (argv.debug) {
      logger.debug('AutomatosX CLI started', {
        version: VERSION,
        command: argv._[0],
        options: {
          debug: argv.debug,
          quiet: argv.quiet,
          config: argv.config
        }
      });
    }

    globalTracker.mark('options_setup_end');
    globalTracker.measure('options_setup', 'options_setup_start', 'options_setup_end');

    // Mark CLI ready
    globalTracker.mark('cli_ready');
    globalTracker.measure('cli_startup', 'cli_start', 'cli_ready');

    // Output profile report if enabled
    if (globalTracker.isEnabled() && argv.debug) {
      console.error('\n' + globalTracker.generateReport() + '\n');
    }
  } catch (error) {
    // Handle any errors during CLI initialization
    console.error('Error initializing CLI:', error);
    process.exit(1);
  }
})();
