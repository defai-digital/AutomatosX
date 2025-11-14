/**
 * AutomatosX v8.0.0 - Load Command
 *
 * Load conversation from file
 * Day 3: Stub implementation
 * Day 4: Full file import with validation
 */

import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { SlashCommand, CommandContext, ContextSnapshot } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';

/**
 * Load Command
 *
 * Loads conversation snapshot from JSON file
 */
export class LoadCommand implements SlashCommand {
  name = 'load';
  description = 'Load conversation from file';
  usage = '/load <path>';
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
      console.log(chalk.gray('Usage: /load <path>'));
      console.log(chalk.gray('Example: /load conversation.json\n'));
      return;
    }

    const filePath = args.join(' '); // Support paths with spaces
    const absolutePath = resolve(filePath);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      console.log(chalk.red(`\n❌ File not found: ${absolutePath}\n`));
      return;
    }

    try {
      // Read file
      const json = readFileSync(absolutePath, 'utf-8');

      // Parse JSON
      const snapshot = JSON.parse(json) as ContextSnapshot;

      // Validate snapshot structure (basic validation for Day 3)
      if (!snapshot.conversationId || !snapshot.userId || !Array.isArray(snapshot.messages)) {
        console.log(chalk.red('\n❌ Invalid conversation file format\n'));
        console.log(chalk.gray('File must contain: conversationId, userId, messages\n'));
        return;
      }

      // Restore conversation from snapshot
      this.conversationContext.restoreFromSnapshot(snapshot);

      console.log(chalk.green(`\n✓ Conversation loaded from: ${chalk.bold(absolutePath)}\n`));

      // Show stats
      const summary = this.conversationContext.getSummary();
      console.log(chalk.gray(`  Conversation ID: ${summary.conversationId}`));
      console.log(chalk.gray(`  Messages: ${summary.messageCount}`));
      console.log(chalk.gray(`  Variables: ${summary.variableCount}`));
      if (summary.activeAgent) {
        console.log(chalk.gray(`  Active Agent: ${summary.activeAgent}`));
      }
      if (summary.activeWorkflow) {
        console.log(chalk.gray(`  Active Workflow: ${summary.activeWorkflow}`));
      }
      console.log();

      console.log(chalk.cyan('Use /history to view loaded messages\n'));

    } catch (error) {
      if ((error as Error).name === 'SyntaxError') {
        console.log(chalk.red('\n❌ Invalid JSON format in file\n'));
      } else {
        console.log(chalk.red(`\n❌ Failed to load conversation: ${(error as Error).message}\n`));
      }
    }
  }
}
