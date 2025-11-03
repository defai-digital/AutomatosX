/**
 * REPL Manager
 *
 * Main interactive loop - handles user input, AI responses, agent delegation
 * Based on Gemini CLI patterns, adapted for AutomatosX
 */

import readline from 'readline';
import ora from 'ora';
import { ConversationManager } from './conversation.js';
import { OutputRenderer } from './renderer.js';
import { routeCommand } from './commands.js';
import { getProvider } from './provider-bridge.js';
import { getAgentExecutor } from './agent-bridge.js';
import type { AgentDelegation, REPLConfig, StreamEvent } from './types.js';
import type { InteractiveProvider } from './provider-bridge.js';
import type { AgentExecutorBridge } from './agent-bridge.js';

export class REPLManager {
  private rl: readline.Interface;
  private conversation: ConversationManager;
  private renderer: OutputRenderer;
  private config: REPLConfig;
  private currentProvider: string;
  private isProcessing: boolean = false;
  private provider: InteractiveProvider | null = null;
  private agentExecutor: AgentExecutorBridge | null = null;
  private isShuttingDown: boolean = false;

  constructor(config?: Partial<REPLConfig>) {
    // Default config
    this.config = {
      welcomeMessage: true,
      colors: true,
      spinner: true,
      autoSave: true,
      autoSaveInterval: 30000,
      historyPath: '.automatosx/.cli-history',
      conversationsPath: '.automatosx/conversations',
      ...config
    };

    // Initialize components
    this.conversation = new ConversationManager({
      autoSaveInterval: this.config.autoSaveInterval,
      maxMessages: 100
    });

    this.renderer = new OutputRenderer({
      colors: this.config.colors
    });

    // Default to Gemini for MVP
    this.currentProvider = 'Gemini 2.5 Flash';

    // Initialize readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.colors ? '\x1b[34max> \x1b[0m' : 'ax> ',
      completer: this.completer.bind(this)
    });
  }

  /**
   * Start the REPL loop
   */
  async start(): Promise<void> {
    // Initialize provider and agent executor
    try {
      this.provider = await getProvider();
      this.agentExecutor = getAgentExecutor();
      this.currentProvider = this.provider.name;
    } catch (error) {
      this.renderer.displayError(`Failed to initialize: ${(error as Error).message}`);
      this.renderer.displayInfo('Falling back to mock mode...');
      // Provider and agent executor will remain null, will use simulated mode
    }

    // Display welcome message
    if (this.config.welcomeMessage) {
      this.renderer.displayWelcome(this.currentProvider);
    }

    // Set up event handlers
    this.setupHandlers();

    // Show prompt
    this.rl.prompt();

    // Return a promise that never resolves (REPL runs until exit)
    return new Promise(() => {});
  }

  /**
   * Set up readline event handlers
   */
  private setupHandlers(): void {
    // Handle line input
    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();

      // Skip empty input
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      // Route to appropriate handler
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
      } else {
        await this.handlePrompt(trimmed);
      }

      // Show prompt for next input
      this.rl.prompt();
    });

    // Handle Ctrl+C (SIGINT)
    this.rl.on('SIGINT', () => {
      if (this.isProcessing) {
        // Cancel current operation
        this.renderer.displayInfo('\nCancelling current operation...');
        this.isProcessing = false;
        this.rl.prompt();
      } else {
        // Confirm exit
        this.rl.question('\nExit ax-cli? (y/n) ', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            this.shutdown();
          } else {
            this.rl.prompt();
          }
        });
      }
    });

    // Handle close (Ctrl+D or /exit)
    this.rl.on('close', () => {
      this.shutdown();
    });
  }

  /**
   * Handle user prompt (natural language input)
   */
  private async handlePrompt(input: string): Promise<void> {
    this.isProcessing = true;

    // Add user message to conversation
    this.conversation.addMessage('user', input);

    // Check for agent delegation
    const delegation = this.parseAgentDelegation(input);

    if (delegation) {
      await this.handleAgentDelegation(delegation);
    } else {
      await this.handleAIResponse(input);
    }

    this.isProcessing = false;
  }

  /**
   * Handle AI response with streaming
   */
  private async handleAIResponse(input: string): Promise<void> {
    const spinner = this.config.spinner ? ora('Thinking...').start() : null;

    try {
      // Get conversation context
      const context = this.conversation.getContext();

      // Use real provider if available, otherwise fall back to simulation
      if (this.provider) {
        spinner?.stop();
        this.renderer.displayAIPrefix();

        let fullResponse = '';

        // Bug #6 fix: Build full prompt with conversation context
        // The provider interface only accepts a single prompt string, so we need to
        // combine the conversation history with the current input
        let fullPrompt = input;

        if (context.length > 0) {
          // Build conversation history
          const historyLines = context.map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.content}`;
          });

          // Combine history with current input
          fullPrompt = historyLines.join('\n\n') + `\n\nUser: ${input}`;
        }

        // Stream response from provider with full context
        for await (const event of this.provider.streamResponse(fullPrompt)) {
          this.renderer.renderStreamEvent(event);

          if (event.type === 'token') {
            fullResponse += event.data;
          } else if (event.type === 'error') {
            throw new Error(event.data.message || 'Provider error');
          }
        }

        console.log('\n');

        // Add assistant response to conversation
        this.conversation.addMessage('assistant', fullResponse);
      } else {
        // Fallback to simulated streaming
        spinner?.stop();
        this.renderer.displayAIPrefix();
        await this.simulateStreaming(input);
        this.conversation.addMessage('assistant', '[Simulated response]');
      }

    } catch (error) {
      spinner?.stop();
      this.renderer.displayError(`Failed to get AI response: ${(error as Error).message}`);
    }
  }

  /**
   * Handle agent delegation
   */
  private async handleAgentDelegation(delegation: AgentDelegation): Promise<void> {
    const spinner = this.config.spinner ? ora(`Delegating to ${delegation.agent}...`).start() : null;

    try {
      // Use real agent executor if available
      if (this.agentExecutor) {
        // Check if agent is available
        const isAvailable = await this.agentExecutor.isAgentAvailable(delegation.agent);

        if (!isAvailable) {
          spinner?.stop();
          this.renderer.displayError(`Agent "${delegation.agent}" not found`);
          this.renderer.displayInfo('Use /agents to see available agents');
          return;
        }

        spinner?.stop();
        this.renderer.displayInfo(`[@${delegation.agent}] Starting task: ${delegation.task}\n`);

        // Execute agent task
        const result = await this.agentExecutor.execute(delegation);

        if (result.success) {
          console.log(result.output);
          console.log('\n');
          this.conversation.addMessage('assistant', result.output);
        } else {
          this.renderer.displayError(`Agent execution failed: ${result.error?.message || 'Unknown error'}`);
        }
      } else {
        // Fallback to regular AI response
        spinner?.stop();
        this.renderer.displayInfo(`[@${delegation.agent}] Agent executor not available, using AI response`);
        await this.handleAIResponse(delegation.task);
      }

    } catch (error) {
      spinner?.stop();
      this.renderer.displayError(`Agent delegation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parse agent delegation from input
   */
  private parseAgentDelegation(input: string): AgentDelegation | null {
    // Pattern 1: @agent task
    const pattern1 = /^@(\w+)\s+(.+)$/;
    const match1 = input.match(pattern1);
    if (match1 && match1[1] && match1[2]) {
      return {
        agent: match1[1],
        task: match1[2]
      };
    }

    // Pattern 2: DELEGATE TO agent: task
    const pattern2 = /^DELEGATE TO (\w+):\s*(.+)$/i;
    const match2 = input.match(pattern2);
    if (match2 && match2[1] && match2[2]) {
      return {
        agent: match2[1],
        task: match2[2]
      };
    }

    return null;
  }

  /**
   * Handle slash command
   */
  private async handleCommand(input: string): Promise<void> {
    // Parse command and args
    const parts = input.slice(1).split(' ');
    const command = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    // Special REPL-level commands (not routed through command system)
    if (command === 'exit' || command === 'quit' || command === 'q') {
      this.shutdown();
      return;
    }

    if (command === 'new') {
      this.conversation.clear();
      this.renderer.displaySuccess('Started new conversation');
      return;
    }

    // Route to command handler
    // Bug #7 fix: process.cwd() can throw if directory was deleted
    let workspaceRoot: string | undefined;
    try {
      workspaceRoot = process.cwd();
    } catch (error) {
      // If CWD was deleted (e.g., git checkout), fall back to undefined
      workspaceRoot = undefined;
    }

    await routeCommand(command, args, {
      conversation: this.conversation.getConversation(),
      currentProvider: this.currentProvider,
      workspaceRoot,
      agentExecutor: this.agentExecutor || undefined,
      conversationManager: this.conversation
    });
  }

  /**
   * Auto-completion for commands
   */
  private completer(line: string): [string[], string] {
    const commands = [
      '/help', '/exit', '/clear', '/provider', '/history', '/stats',
      '/save', '/list', '/load', '/export', '/delete', '/new',
      '/agents', '/memory'
    ];

    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commands, line];
  }

  /**
   * Simulate streaming response (temporary for MVP testing)
   * Will be replaced with real Gemini integration
   */
  private async simulateStreaming(_input: string): Promise<void> {
    const response = `I understand your request.\n\nThis is a simulated response for MVP testing. ` +
      `Real Gemini streaming integration will be added in Week 1, Day 2-3.\n\n` +
      `For now, you can test:\n` +
      `- Slash commands like /help, /agents, /history\n` +
      `- Agent delegation syntax: @backend implement auth\n` +
      `- Basic REPL functionality\n`;

    // Simulate token-by-token streaming
    for (const char of response) {
      process.stdout.write(char);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log('\n');
  }

  /**
   * Shutdown and cleanup
   * Idempotent - can be called multiple times safely
   */
  private shutdown(): void {
    // Guard against multiple shutdown calls
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    // Stop auto-save
    this.conversation.stopAutoSave();

    // Display goodbye
    this.renderer.displayGoodbye();

    // Close readline (this triggers 'close' event, but isShuttingDown prevents recursion)
    this.rl.close();

    // Exit process
    process.exit(0);
  }
}
