/**
 * AutomatosX v8.0.0 - History Command
 *
 * Display conversation history
 */

import chalk from 'chalk';
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';

/**
 * History Command
 *
 * Shows recent messages from conversation
 */
export class HistoryCommand implements SlashCommand {
  name = 'history';
  description = 'View conversation history';
  usage = '/history [limit]';
  aliases = ['hist'];

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

    // Parse limit argument
    const limit = args.length > 0 ? parseInt(args[0], 10) : 10;
    if (isNaN(limit) || limit <= 0) {
      console.log(chalk.red('\n❌ Invalid limit. Must be a positive number.\n'));
      return;
    }

    const messages = this.conversationContext.getRecentMessages(limit);

    if (messages.length === 0) {
      console.log(chalk.yellow('\n📭 No messages in conversation history\n'));
      return;
    }

    console.log(chalk.bold.cyan(`\n📜 Conversation History (last ${messages.length} messages)\n`));

    for (const message of messages) {
      // Role icon and color
      let roleIcon: string;
      let roleColor: (text: string) => string;

      switch (message.role) {
        case 'user':
          roleIcon = '👤';
          roleColor = chalk.blue;
          break;
        case 'assistant':
          roleIcon = '🤖';
          roleColor = chalk.green;
          break;
        case 'system':
          roleIcon = '⚙️';
          roleColor = chalk.gray;
          break;
      }

      // Format timestamp
      const timestamp = new Date(message.timestamp).toLocaleString();

      // Header
      console.log(roleColor(`${roleIcon} ${message.role.toUpperCase()} [${timestamp}]`));

      // Content (truncate if too long)
      const content = message.content;
      const maxLength = 200;
      const displayContent = content.length > maxLength
        ? content.slice(0, maxLength) + chalk.gray('... (truncated)')
        : content;

      console.log(chalk.white(displayContent));

      // Metadata if present
      if (message.metadata && Object.keys(message.metadata).length > 0) {
        const metadataStr = JSON.stringify(message.metadata);
        if (metadataStr.length < 100) {
          console.log(chalk.gray(`  Metadata: ${metadataStr}`));
        }
      }

      console.log(); // Blank line between messages
    }

    // Show hint if there are more messages
    const totalMessages = this.conversationContext.getMessageCount();
    if (totalMessages > messages.length) {
      console.log(chalk.gray(`Showing ${messages.length} of ${totalMessages} total messages.`));
      console.log(chalk.gray(`Use /history ${totalMessages} to see all messages.\n`));
    }
  }
}
