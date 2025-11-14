/**
 * AutomatosX v8.0.0 - Exit Command
 *
 * Exit the Interactive CLI REPL
 */

import chalk from 'chalk';
import type { SlashCommand, CommandContext } from '../types.js';

/**
 * Exit Command
 *
 * Gracefully exits the REPL session
 */
export class ExitCommand implements SlashCommand {
  name = 'exit';
  description = 'Exit the interactive CLI';
  usage = '/exit';
  aliases = ['quit', 'q'];

  async execute(args: string[], context: CommandContext): Promise<void> {
    console.log(chalk.yellow('\n👋 Exiting... Goodbye!\n'));

    // Exit process
    process.exit(0);
  }
}
