/**
 * AutomatosX v8.0.0 - Context Command
 *
 * Display current conversation context
 */

import chalk from 'chalk';
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';

/**
 * Context Command
 *
 * Shows current context state:
 * - Conversation ID
 * - Message count
 * - Active agent
 * - Active workflow
 * - Variables
 */
export class ContextCommand implements SlashCommand {
  name = 'context';
  description = 'Show current conversation context';
  usage = '/context';
  aliases = ['ctx'];

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

    const summary = this.conversationContext.getSummary();

    console.log(chalk.bold.cyan('\n📋 Conversation Context\n'));

    // Conversation metadata
    console.log(chalk.bold('Conversation:'));
    console.log(`  ${chalk.gray('ID:')} ${summary.conversationId}`);
    console.log(`  ${chalk.gray('Messages:')} ${summary.messageCount}`);
    console.log(`  ${chalk.gray('Created:')} ${summary.createdAt.toLocaleString()}`);
    console.log(`  ${chalk.gray('Updated:')} ${summary.updatedAt.toLocaleString()}`);
    console.log();

    // Active state
    if (summary.activeAgent || summary.activeWorkflow) {
      console.log(chalk.bold('Active State:'));
      if (summary.activeAgent) {
        console.log(`  ${chalk.gray('Agent:')} ${chalk.green(summary.activeAgent)}`);
      }
      if (summary.activeWorkflow) {
        console.log(`  ${chalk.gray('Workflow:')} ${chalk.green(summary.activeWorkflow)}`);
      }
      console.log();
    }

    // Variables
    if (summary.variableCount > 0) {
      console.log(chalk.bold('Variables:'));
      const variables = this.conversationContext.getVariables();
      for (const [key, value] of Object.entries(variables)) {
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        const truncated = displayValue.length > 50
          ? displayValue.slice(0, 47) + '...'
          : displayValue;
        console.log(`  ${chalk.gray(key + ':')} ${truncated}`);
      }
      console.log();
    }

    // Usage hints
    console.log(chalk.gray('Commands:'));
    console.log(chalk.gray('  /history - View conversation history'));
    console.log(chalk.gray('  /agent <name> - Set active agent'));
    console.log(chalk.gray('  /save <path> - Save conversation'));
    console.log(chalk.gray('  /clear - Clear conversation'));
    console.log();
  }
}
