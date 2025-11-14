/**
 * AutomatosX v8.0.0 - Save Command
 *
 * Save conversation to file
 * Day 3: Stub implementation
 * Day 4: Full file export with proper JSON formatting
 */

import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';

/**
 * Save Command
 *
 * Saves conversation snapshot to JSON file
 */
export class SaveCommand implements SlashCommand {
  name = 'save';
  description = 'Save conversation to file';
  usage = '/save <path>';
  aliases = [];

  // ConversationContext will be injected by REPLSession
  private conversationContext?: ConversationContext;

  setConversationContext(context: ConversationContext): void {
    this.conversationContext = context;
  }

  async execute(args: string[], context: CommandContext): Promise<void> {
    if (!this.conversationContext) {
      console.log(chalk.red('\n❌ No conversation context available\n'));
      return;
    }

    // Validate path argument
    if (args.length === 0) {
      console.log(chalk.red('\n❌ Missing file path\n'));
      console.log(chalk.gray('Usage: /save <path>'));
      console.log(chalk.gray('Example: /save conversation.json\n'));
      return;
    }

    const filePath = args.join(' '); // Support paths with spaces
    const absolutePath = resolve(filePath);

    try {
      // Get conversation snapshot
      const snapshot = this.conversationContext.getSnapshot();

      // Convert to JSON with pretty printing
      const json = JSON.stringify(snapshot, null, 2);

      // Write to file
      writeFileSync(absolutePath, json, 'utf-8');

      console.log(chalk.green(`\n✓ Conversation saved to: ${chalk.bold(absolutePath)}\n`));

      // Show stats
      const summary = this.conversationContext.getSummary();
      console.log(chalk.gray(`  Messages: ${summary.messageCount}`));
      console.log(chalk.gray(`  Variables: ${summary.variableCount}`));
      if (summary.activeAgent) {
        console.log(chalk.gray(`  Active Agent: ${summary.activeAgent}`));
      }
      console.log();

    } catch (error) {
      console.log(chalk.red(`\n❌ Failed to save conversation: ${(error as Error).message}\n`));

      // Provide troubleshooting hints
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(chalk.gray('Hint: Directory may not exist. Create it first or use a different path.\n'));
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        console.log(chalk.gray('Hint: Permission denied. Check file/directory permissions.\n'));
      }
    }
  }
}
