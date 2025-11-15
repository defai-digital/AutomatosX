/**
 * AutomatosX v8.0.0 - REPL Session Manager
 *
 * Core Interactive CLI session with readline interface
 */

import * as readline from 'readline';
import chalk from 'chalk';
import type { Database } from 'better-sqlite3';
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlashCommandRegistry } from './SlashCommandRegistry.js';
import type { REPLOptions, REPLState, CommandContext } from './types.js';
import { ConversationContext } from './ConversationContext.js';
import { StreamingHandler } from './StreamingHandler.js';

/**
 * REPL Session Manager
 *
 * Manages the interactive CLI session with readline interface
 */
export class REPLSession {
  private rl!: readline.Interface;
  private state: REPLState;
  private options: Required<REPLOptions>;
  private conversationContext: ConversationContext;
  private streamingHandler: StreamingHandler;

  // Multiline input support
  private multilineBuffer: string[] = [];
  private multilineMode: boolean = false;
  private multilineTrigger: string = '```';

  // History search support (Ctrl+R)
  private historySearchMode: boolean = false;
  private historySearchQuery: string = '';
  private historySearchIndex: number = 0;
  private historySearchMatches: string[] = [];

  constructor(
    private db: Database,
    private providerRouter: ProviderRouterV2,
    private agentRegistry: AgentRegistry,
    private commandRegistry: SlashCommandRegistry,
    options: REPLOptions = {}
  ) {
    this.options = {
      prompt: options.prompt || chalk.cyan('> '),
      welcomeMessage: options.welcomeMessage || this.getDefaultWelcome(),
      enableAutocomplete: options.enableAutocomplete !== false,
      contextSaveInterval: options.contextSaveInterval || 5,
      userId: options.userId || 'default-user'
    };

    // Create conversation context
    this.conversationContext = new ConversationContext(db, this.options.userId);

    // Create streaming handler
    this.streamingHandler = new StreamingHandler();

    this.state = {
      isProcessing: false,
      conversationId: this.conversationContext.getConversationId(),
      messageCount: 0,
      lastInput: null,
      startedAt: new Date()
    };
  }

  /**
   * Start the REPL session
   */
  async start(): Promise<void> {
    // Display welcome message
    this.displayWelcome();

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.options.prompt,
      completer: this.options.enableAutocomplete ? this.autocomplete.bind(this) : undefined
    });

    // Enable keypress events for Ctrl+R
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }

      // Handle keypress events
      process.stdin.on('keypress', this.handleKeypress.bind(this));
    }

    // Handle input
    this.rl.on('line', async (line: string) => {
      await this.handleInputLine(line);
      if (!this.state.isProcessing) {
        this.rl.prompt();
      }
    });

    // Handle CTRL+C
    this.rl.on('SIGINT', () => {
      // If in multiline mode, cancel it
      if (this.multilineMode) {
        console.log(chalk.yellow('\n(Multiline input cancelled)'));
        this.multilineMode = false;
        this.multilineBuffer = [];
        this.rl.setPrompt(this.options.prompt);
        this.rl.prompt();
        return;
      }

      console.log(chalk.yellow('\n\n👋 Received CTRL+C. Exiting...'));
      this.stop().catch(console.error);
    });

    // Handle CTRL+D (EOF)
    this.rl.on('close', () => {
      console.log(chalk.yellow('\n\n👋 Session ended. Goodbye!'));
      this.stop().catch(console.error);
    });

    // Show initial prompt
    this.rl.prompt();
  }

  /**
   * Stop the REPL session
   */
  async stop(): Promise<void> {
    // Mark as processing to prevent new input
    this.state.isProcessing = true;

    // Save context to SQLite
    if (this.state.conversationId && this.conversationContext.getMessageCount() > 0) {
      console.log(chalk.gray('Saving conversation to database...'));
      await this.conversationContext.saveToDB();
      console.log(chalk.green('✓ Conversation saved'));
    }

    // Close readline
    if (this.rl) {
      this.rl.close();
    }

    // Exit process
    process.exit(0);
  }

  /**
   * Handle input line (with multiline support)
   */
  private async handleInputLine(line: string): Promise<void> {
    // Check for multiline trigger (```)
    if (line.trim() === this.multilineTrigger) {
      if (!this.multilineMode) {
        // Start multiline mode
        this.multilineMode = true;
        this.multilineBuffer = [];
        this.rl.setPrompt(chalk.gray('... '));
        console.log(chalk.gray('(Multiline mode - type ``` again to finish)'));
        return;
      } else {
        // End multiline mode
        this.multilineMode = false;
        const fullInput = this.multilineBuffer.join('\n');
        this.multilineBuffer = [];
        this.rl.setPrompt(this.options.prompt);

        // Process the accumulated input
        await this.handleInput(fullInput);
        return;
      }
    }

    // In multiline mode - accumulate lines
    if (this.multilineMode) {
      this.multilineBuffer.push(line);
      return;
    }

    // Normal single-line processing
    await this.handleInput(line.trim());
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    // Ignore empty input
    if (!input) {
      return;
    }

    // Mark as processing
    this.state.isProcessing = true;
    this.state.lastInput = input;
    this.state.messageCount++;

    try {
      // Check if it's a slash command
      if (input.startsWith('/')) {
        await this.handleSlashCommand(input);
      } else {
        // Natural language input
        await this.handleNaturalLanguage(input);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), (error as Error).message);
    } finally {
      // Mark as not processing
      this.state.isProcessing = false;
    }
  }

  /**
   * Handle slash command
   */
  private async handleSlashCommand(input: string): Promise<void> {
    // Create command context from conversation context
    const context: CommandContext = {
      conversationId: this.conversationContext.getConversationId(),
      userId: this.options.userId,
      activeAgent: this.conversationContext.getActiveAgent(),
      activeWorkflow: this.conversationContext.getActiveWorkflow(),
      variables: this.conversationContext.getVariables(),
      db: this.db,
      providerRouter: this.providerRouter,
      agentRegistry: this.agentRegistry
    };

    try {
      // Execute command through registry
      await this.commandRegistry.execute(input, context);
    } catch (error) {
      console.error(chalk.red('\n❌ Command error:'), (error as Error).message);
      console.log(chalk.gray('Type /help for available commands'));
    }
  }

  /**
   * Handle natural language input
   */
  private async handleNaturalLanguage(input: string): Promise<void> {
    // Start spinner
    this.streamingHandler.startThinking();

    try {
      // Add user message to context
      this.conversationContext.addMessage('user', input);

      // Build conversation history for context
      const recentMessages = this.conversationContext.getRecentMessages(5);
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: 'You are a helpful AI assistant for AutomatosX, a code intelligence and workflow automation system.'
        }
      ];

      // Add recent conversation history
      for (const msg of recentMessages) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }

      // Get response from provider
      const response = await this.providerRouter.request({ messages });

      // Stop spinner
      this.streamingHandler.stop();

      // Add assistant response to context
      this.conversationContext.addMessage('assistant', response.content);

      // Display response with syntax highlighting
      console.log('\n');
      this.streamingHandler.displayResponse(response.content);
      console.log('\n');

      // Update state
      this.state.messageCount = this.conversationContext.getMessageCount();

      // Auto-save every N messages
      if (this.state.messageCount % this.options.contextSaveInterval === 0) {
        await this.conversationContext.saveToDB();
      }
    } catch (error) {
      // Stop spinner with error
      this.streamingHandler.stopError(new Error('Failed to get response'));

      console.error(chalk.red('\n❌ Error:'), (error as Error).message);
    }
  }

  /**
   * Autocomplete handler
   */
  private autocomplete(line: string): [string[], string] {
    // Only autocomplete slash commands
    if (!line.startsWith('/')) {
      return [[], line];
    }

    // Get all command names and aliases
    const commands = this.commandRegistry.list();
    const completions: string[] = [];

    for (const cmd of commands) {
      // Check command name
      if (`/${cmd.name}`.startsWith(line)) {
        completions.push(`/${cmd.name}`);
      }

      // Check aliases
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          if (`/${alias}`.startsWith(line)) {
            completions.push(`/${alias}`);
          }
        }
      }
    }

    return [completions, line];
  }

  /**
   * Display welcome message
   */
  private displayWelcome(): void {
    console.log(this.options.welcomeMessage);
  }

  /**
   * Get default welcome message
   */
  private getDefaultWelcome(): string {
    return chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                  AutomatosX v8.0.0 - Interactive CLI                  ║
╚══════════════════════════════════════════════════════════════╝

${chalk.white('Welcome to the AutomatosX Interactive CLI!')}

${chalk.gray('Type:')}
  ${chalk.green('/help')}     - Show all available commands
  ${chalk.green('your question')} - Ask anything in natural language
  ${chalk.green('```')}       - Start/end multiline input
  ${chalk.green('/exit')}     - Exit the REPL

${chalk.gray('Tips:')}
  - Press ${chalk.bold('TAB')} for command autocompletion
  - Press ${chalk.bold('↑/↓')} to navigate command history
  - Press ${chalk.bold('CTRL+R')} for reverse history search (type to filter, repeat CTRL+R to cycle)
  - Use ${chalk.bold('```')} for multiline code blocks
  - Press ${chalk.bold('CTRL+C')} or ${chalk.bold('CTRL+D')} to exit

${chalk.gray('─────────────────────────────────────────────────────────────')}
`);
  }

  /**
   * Get current state (for testing)
   */
  getState(): Readonly<REPLState> {
    return { ...this.state };
  }

  /**
   * Get conversation context (for command injection)
   */
  getConversationContext(): ConversationContext {
    return this.conversationContext;
  }

  /**
   * Handle keypress events (for Ctrl+R history search)
   */
  private handleKeypress(ch: string, key: readline.Key): void {
    // Ignore if not TTY or no key info
    if (!key) {
      return;
    }

    // Ctrl+R - Reverse history search
    if (key.ctrl && key.name === 'r') {
      if (!this.historySearchMode) {
        // Enter history search mode
        this.enterHistorySearch();
      } else {
        // Cycle to next match
        this.nextHistoryMatch();
      }
      return;
    }

    // ESC - Exit history search mode
    if (key.name === 'escape' && this.historySearchMode) {
      this.exitHistorySearch(false);
      return;
    }

    // Enter - Accept history search match
    if (key.name === 'return' && this.historySearchMode) {
      this.exitHistorySearch(true);
      return;
    }

    // Backspace in history search mode
    if (key.name === 'backspace' && this.historySearchMode) {
      if (this.historySearchQuery.length > 0) {
        this.historySearchQuery = this.historySearchQuery.slice(0, -1);
        this.updateHistorySearch();
      }
      return;
    }

    // Printable character in history search mode
    if (this.historySearchMode && ch && ch.length === 1 && !key.ctrl && !key.meta) {
      this.historySearchQuery += ch;
      this.updateHistorySearch();
      return;
    }
  }

  /**
   * Enter history search mode
   */
  private enterHistorySearch(): void {
    this.historySearchMode = true;
    this.historySearchQuery = '';
    this.historySearchIndex = 0;
    this.historySearchMatches = [];

    // Update prompt
    this.updateHistorySearchPrompt();
  }

  /**
   * Exit history search mode
   */
  private exitHistorySearch(acceptMatch: boolean): void {
    if (acceptMatch && this.historySearchMatches.length > 0) {
      // Get current match
      const match = this.historySearchMatches[this.historySearchIndex];

      // Clear line and insert match
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(this.options.prompt + match);

      // Set readline line buffer
      (this.rl as any).line = match;
      (this.rl as any).cursor = match.length;
    } else {
      // Restore normal prompt
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(this.options.prompt);

      // Clear readline line buffer
      (this.rl as any).line = '';
      (this.rl as any).cursor = 0;
    }

    // Reset state
    this.historySearchMode = false;
    this.historySearchQuery = '';
    this.historySearchIndex = 0;
    this.historySearchMatches = [];
  }

  /**
   * Update history search with current query
   */
  private updateHistorySearch(): void {
    // Get history from readline
    const history = (this.rl as any).history || [];

    // Filter history by query (case-insensitive)
    this.historySearchMatches = history.filter((line: string) =>
      line.toLowerCase().includes(this.historySearchQuery.toLowerCase())
    );

    // Reset index
    this.historySearchIndex = 0;

    // Update prompt
    this.updateHistorySearchPrompt();
  }

  /**
   * Cycle to next history match
   */
  private nextHistoryMatch(): void {
    if (this.historySearchMatches.length === 0) {
      return;
    }

    // Increment index (wrap around)
    this.historySearchIndex = (this.historySearchIndex + 1) % this.historySearchMatches.length;

    // Update prompt
    this.updateHistorySearchPrompt();
  }

  /**
   * Update history search prompt display
   */
  private updateHistorySearchPrompt(): void {
    // Build prompt
    let prompt = chalk.cyan('(reverse-i-search)');
    prompt += chalk.yellow(`'${this.historySearchQuery}': `);
    prompt += '';

    // Add current match if available
    if (this.historySearchMatches.length > 0) {
      const match = this.historySearchMatches[this.historySearchIndex];
      prompt += chalk.white(match);
    } else if (this.historySearchQuery.length > 0) {
      prompt += chalk.gray('(no matches)');
    }

    // Clear line and write prompt
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(prompt);
  }
}
