/**
 * Output Renderer
 *
 * Handles rendering of AI responses, streaming events, and formatted output
 * Phase 3: Enhanced with markdown rendering and syntax highlighting
 */

import chalk from 'chalk';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ErrorHandler, type EnhancedError } from './error-handler.js';
import type { StreamEvent } from './types.js';

export class OutputRenderer {
  private colors: boolean;
  private markdownRenderer: MarkdownRenderer | null = null;
  private markdownEnabled: boolean;

  constructor(options?: { colors?: boolean; markdown?: boolean }) {
    this.colors = options?.colors ?? true;
    this.markdownEnabled = options?.markdown ?? true;

    // Initialize markdown renderer if enabled
    if (this.markdownEnabled) {
      try {
        this.markdownRenderer = new MarkdownRenderer({ enabled: true });
      } catch (error) {
        // Fallback to plain text if markdown initialization fails
        console.warn('Markdown renderer unavailable, using plain text');
        this.markdownEnabled = false;
      }
    }
  }

  /**
   * Bug #14 fix: Sanitize terminal output to prevent escape sequence injection
   * Strips dangerous ANSI escapes while preserving safe formatting
   */
  private sanitizeOutput(text: string): string {
    // Remove OSC (Operating System Command) sequences - clipboard, title, etc.
    text = text.replace(/\x1b\][^\x07]*\x07/g, '');          // OSC terminated with BEL
    text = text.replace(/\x1b\][^\x1b]*\x1b\\/g, '');        // OSC terminated with ST

    // Remove dangerous CSI sequences, keep basic colors/formatting
    text = text.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, (match) => {
      // Allow SGR (Select Graphic Rendition) - colors and text attributes
      // Format: ESC [ <params> m (where params are digits/semicolons)
      if (/^\x1b\[[0-9;]*m$/.test(match)) {
        return match;  // Keep colors/bold/italic/etc
      }
      return '';  // Strip everything else (cursor positioning, etc.)
    });

    // Remove other control characters except newline, tab, carriage return
    // Allow: \n (10), \r (13), \t (9)
    // Remove: C0 controls (0-31 except 9,10,13), DEL (127), C1 controls (128-159)
    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    return text;
  }

  /**
   * Display welcome message with tips
   * Bug #10 fix: Truncate long provider names to prevent overflow
   */
  displayWelcome(provider: string): void {
    // Bug #10 fix: Truncate provider name if too long (max 37 chars to fit in box)
    const maxProviderLength = 37;
    const truncatedProvider = provider.length > maxProviderLength
      ? provider.substring(0, maxProviderLength - 3) + '...'
      : provider;

    const message = `
╭─────────────────────────────────────────────────────╮
│   AutomatosX Interactive CLI v0.1.1                 │
│   Type /help for commands, /exit to quit            │
│   Using: ${truncatedProvider.padEnd(40)}│
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
        // Bug #14 fix: Sanitize output before writing to prevent terminal escape injection
        const sanitized = this.sanitizeOutput(event.data);
        process.stdout.write(sanitized);
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
   * Display error message (basic)
   */
  displayError(message: string): void {
    const formatted = this.colors ? chalk.red(`✗ ${message}`) : `[ERROR] ${message}`;
    console.error(formatted);
  }

  /**
   * Display enhanced error with recovery suggestions
   */
  displayEnhancedError(error: Error | string | EnhancedError): void {
    let enhanced: EnhancedError;

    if (typeof error === 'string' || error instanceof Error) {
      enhanced = ErrorHandler.enhance(error);
    } else {
      enhanced = error;
    }

    const formatted = ErrorHandler.format(enhanced, { colors: this.colors });
    console.error(formatted);
  }

  /**
   * Display warning message
   */
  displayWarning(message: string): void {
    const formatted = this.colors ? chalk.yellow(`⚠ ${message}`) : `[WARNING] ${message}`;
    console.warn(formatted);
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

  /**
   * Render markdown content (Phase 3)
   */
  renderMarkdown(text: string): void {
    if (this.markdownEnabled && this.markdownRenderer?.hasMarkdown(text)) {
      try {
        const rendered = this.markdownRenderer.render(text);
        // Bug #14 fix: Sanitize markdown output before display
        console.log(this.sanitizeOutput(rendered));
      } catch (error) {
        // Bug #14 fix: Sanitize fallback text
        console.log(this.sanitizeOutput(text));
      }
    } else {
      // Bug #14 fix: Sanitize plain text output
      console.log(this.sanitizeOutput(text));
    }
  }

  /**
   * Render code block with syntax highlighting (Phase 3)
   */
  renderCodeBlock(code: string, language?: string): void {
    if (this.markdownEnabled && this.markdownRenderer) {
      try {
        const highlighted = this.markdownRenderer.highlightCode(code, language);
        console.log(highlighted);
      } catch (error) {
        // Fallback to plain code
        console.log('```' + (language || '') + '\n' + code + '\n```');
      }
    } else {
      // Plain code block
      console.log('```' + (language || '') + '\n' + code + '\n```');
    }
  }

  /**
   * Check if text contains markdown
   */
  hasMarkdown(text: string): boolean {
    if (!this.markdownRenderer) {
      return false;
    }
    return this.markdownRenderer.hasMarkdown(text);
  }

  /**
   * Strip ANSI codes from text (for length calculations)
   */
  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
