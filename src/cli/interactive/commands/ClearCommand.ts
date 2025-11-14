/**
 * AutomatosX v8.0.0 - Clear Command
 *
 * Clear the terminal screen
 */

import type { SlashCommand, CommandContext } from '../types.js';

/**
 * Clear Command
 *
 * Clears the terminal screen
 */
export class ClearCommand implements SlashCommand {
  name = 'clear';
  description = 'Clear the terminal screen';
  usage = '/clear';
  aliases = ['cls'];

  async execute(args: string[], context: CommandContext): Promise<void> {
    // Clear screen using ANSI escape codes
    process.stdout.write('\x1Bc');
  }
}
