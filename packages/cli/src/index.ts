/**
 * AutomatosX CLI
 *
 * The command-line interface for AutomatosX - an AI agent orchestration platform.
 *
 * Usage:
 *   ax <command> [options]
 *   ax run <agent> <task>       - Execute a task with an agent
 *   ax agent list               - List available agents
 *   ax memory search <query>    - Search memory
 *   ax status                   - Show system status
 *
 * @module @ax/cli
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

// Commands
import { runCommand } from './commands/run.js';
import { agentCommand } from './commands/agent.js';
import { memoryCommand } from './commands/memory.js';
import { providerCommand } from './commands/provider.js';
import { sessionCommand } from './commands/session.js';
import { statusCommand, configCommand, doctorCommand } from './commands/system.js';
import { setupCommand } from './commands/setup.js';

// =============================================================================
// Constants
// =============================================================================

const VERSION = '11.0.0-alpha.0';
const LOGO = `
   ╔═══════════════════════════════════════╗
   ║     ${chalk.cyan('AutomatosX')} ${chalk.gray(`v${VERSION}`)}           ║
   ║     ${chalk.gray('AI Agent Orchestration Platform')}    ║
   ╚═══════════════════════════════════════╝
`;

// =============================================================================
// CLI Setup
// =============================================================================

async function main(): Promise<void> {
  try {
    await yargs(hideBin(process.argv))
      .scriptName('ax')
      .usage(LOGO + '\nUsage: $0 <command> [options]')

      // Commands
      .command(runCommand)
      .command(setupCommand)
      .command(agentCommand)
      .command(memoryCommand)
      .command(providerCommand)
      .command(sessionCommand)
      .command(statusCommand)
      .command(configCommand)
      .command(doctorCommand)

      // Global options
      .option('debug', {
        describe: 'Enable debug output',
        type: 'boolean',
        global: true,
      })
      .option('quiet', {
        alias: 'q',
        describe: 'Suppress non-essential output',
        type: 'boolean',
        global: true,
      })

      // Help and version
      .help('help')
      .alias('h', 'help')
      .version('version', VERSION)
      .alias('v', 'version')

      // Error handling
      .fail((msg, err, yargs) => {
        if (err) {
          console.error(chalk.red('Error:'), err.message);
          if (process.env['DEBUG']) {
            console.error(err.stack);
          }
        } else if (msg) {
          console.error(chalk.red('Error:'), msg);
          console.error();
          yargs.showHelp();
        }
        process.exit(1);
      })

      // Require a command
      .demandCommand(1, 'Please specify a command. Run "ax --help" for usage.')

      // Strict mode
      .strict()

      // Example usage
      .example('$0 setup', 'Initialize AutomatosX in your project')
      .example('$0 run backend "implement user auth"', 'Run a task with the backend agent')
      .example('$0 agent list', 'List all available agents')
      .example('$0 memory search "authentication"', 'Search memory for past conversations')
      .example('$0 status', 'Show system status')
      .example('$0 doctor', 'Run system diagnostics')

      // Epilog
      .epilog(
        chalk.gray(
          'For more information, visit: https://github.com/defai-digital/automatosx'
        )
      )

      .parseAsync();
  } catch (error) {
    // Most errors are handled by the fail handler
    if (error instanceof Error && error.message !== 'process.exit') {
      console.error(chalk.red('Fatal error:'), error.message);
      process.exit(1);
    }
  }
}

// Run CLI
main();
