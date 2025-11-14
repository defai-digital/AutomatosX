/**
 * AutomatosX v8.0.0 - Memory Command
 *
 * Delegate to existing `ax memory search` command
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import type { SlashCommand, CommandContext } from '../types.js';

/**
 * Memory Command
 *
 * Delegates to the existing memory search functionality
 * Usage:
 *   /memory <query>           - Search code memory
 *   /memory index <path>      - Index a directory
 */
export class MemoryCommand implements SlashCommand {
  name = 'memory';
  description = 'Search code memory';
  usage = '/memory <query>';
  aliases = ['mem'];

  async execute(args: string[], context: CommandContext): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.red('\n❌ Missing query\n'));
      console.log(chalk.gray('Usage: /memory <query>'));
      console.log(chalk.gray('Examples:'));
      console.log(chalk.gray('  /memory getUserById'));
      console.log(chalk.gray('  /memory index ./src\n'));
      return;
    }

    // Build command arguments
    const command = 'npm';
    const commandArgs = ['run', 'cli', '--', 'memory', 'search', ...args];

    console.log(chalk.cyan(`\n🔍 Searching memory: ${chalk.bold(args.join(' '))}\n`));

    // Execute command
    await this.executeCommand(command, commandArgs);
  }

  /**
   * Execute external command and stream output
   */
  private executeCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        console.log(); // Blank line after output
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        console.log(chalk.red(`\n❌ Failed to execute command: ${error.message}\n`));
        reject(error);
      });
    });
  }
}
