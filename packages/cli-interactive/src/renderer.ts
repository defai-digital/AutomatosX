/**
 * Output Renderer
 *
 * Handles rendering of AI responses, streaming events, and formatted output
 * MVP version uses simple terminal colors
 */

import chalk from 'chalk';
import type { StreamEvent } from './types.js';

export class OutputRenderer {
  private colors: boolean;

  constructor(options?: { colors?: boolean }) {
    this.colors = options?.colors ?? true;
  }

  /**
   * Display welcome message with tips
   */
  displayWelcome(provider: string): void {
    const message = `
╭─────────────────────────────────────────────────────╮
│   AutomatosX Interactive CLI v0.1.1                 │
│   Type /help for commands, /exit to quit            │
│   Using: ${provider.padEnd(40)}│
╰─────────────────────────────────────────────────────╯
    `.trim();

    console.log(this.colors ? chalk.cyan(message) : message);
    console.log();

    // Quick tips
    const tips = [
      '💡 Quick Tips:',
      '   • Chat naturally or use @agent syntax for delegation',
      '   • /save <name> to save, /list to view saved conversations',
      '   • /stats to see conversation statistics, /export for markdown',
      ''
    ];

    tips.forEach(tip => {
      if (this.colors) {
        if (tip.startsWith('💡')) {
          console.log(chalk.yellow(tip));
        } else if (tip.startsWith('   •')) {
          console.log(chalk.dim(tip));
        } else {
          console.log(tip);
        }
      } else {
        console.log(tip);
      }
    });
  }

  /**
   * Render a stream event
   */
  renderStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'token':
        // Write token directly to stdout (for streaming effect)
        process.stdout.write(event.data);
        break;

      case 'agent_delegation':
        const delegation = event.data;
        this.displayInfo(`[@${delegation.agent}] Starting task: ${delegation.task}`);
        break;

      case 'provider_switch':
        this.displayInfo(`Switched to provider: ${event.data.provider}`);
        break;

      case 'completion':
        // Add newline after completion
        console.log('\n');
        break;

      case 'error':
        this.displayError(event.data.message || 'An error occurred');
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Display AI response prefix
   */
  displayAIPrefix(): void {
    const prefix = this.colors ? chalk.green('AI: ') : 'AI: ';
    console.log(prefix);
  }

  /**
   * Display info message
   */
  displayInfo(message: string): void {
    const formatted = this.colors ? chalk.yellow(`ℹ ${message}`) : `[INFO] ${message}`;
    console.log(formatted);
  }

  /**
   * Display success message
   */
  displaySuccess(message: string): void {
    const formatted = this.colors ? chalk.green(`✓ ${message}`) : `[SUCCESS] ${message}`;
    console.log(formatted);
  }

  /**
   * Display error message
   */
  displayError(message: string): void {
    const formatted = this.colors ? chalk.red(`✗ ${message}`) : `[ERROR] ${message}`;
    console.error(formatted);
  }

  /**
   * Display help text
   */
  displayHelp(commands: Array<{ name: string; description: string; usage?: string }>): void {
    console.log(this.colors ? chalk.cyan('\nAvailable Commands:') : '\nAvailable Commands:');
    console.log();

    for (const cmd of commands) {
      const name = this.colors ? chalk.bold(`/${cmd.name}`) : `/${cmd.name}`;
      const usage = cmd.usage ? ` ${cmd.usage}` : '';
      console.log(`  ${name}${usage}`);
      console.log(`    ${cmd.description}`);
      console.log();
    }

    console.log(this.colors ? chalk.cyan('Agent Delegation:') : 'Agent Delegation:');
    console.log('  @agent task          Delegate task to specified agent');
    console.log('  Example: @backend implement authentication');
    console.log();
  }

  /**
   * Display conversation history
   */
  displayHistory(messages: Array<{ role: string; content: string; timestamp: number }>): void {
    console.log(this.colors ? chalk.cyan('\nConversation History:') : '\nConversation History:');
    console.log();

    for (const msg of messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const role = this.colors ?
        (msg.role === 'user' ? chalk.blue('You') : chalk.green('AI')) :
        msg.role;

      console.log(`[${time}] ${role}:`);
      console.log(msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''));
      console.log();
    }
  }

  /**
   * Display agent list
   */
  displayAgents(agents: Array<{ name: string; description?: string }>): void {
    console.log(this.colors ? chalk.cyan('\nAvailable Agents:') : '\nAvailable Agents:');
    console.log();

    for (const agent of agents) {
      const name = this.colors ? chalk.bold(agent.name) : agent.name;
      const desc = agent.description || 'No description available';
      console.log(`  ${name}`);
      console.log(`    ${desc}`);
      console.log();
    }
  }

  /**
   * Display goodbye message
   */
  displayGoodbye(): void {
    const message = this.colors ? chalk.cyan('\nGoodbye! 👋\n') : '\nGoodbye!\n';
    console.log(message);
  }
}
