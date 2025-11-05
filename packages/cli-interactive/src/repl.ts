/**
 * REPL Manager
 *
 * Main interactive loop - handles user input, AI responses, agent delegation
 * Based on Gemini CLI patterns, adapted for AutomatosX
 *
 * v7.2.0 P0 Features:
 * - Natural language intent detection
 * - Conversational command palette
 * - Progressive help system
 * - First-time user onboarding
 */

import readline from 'readline';
import ora from 'ora';
import { ConversationManager } from './conversation.js';
import { OutputRenderer } from './renderer.js';
import { routeCommand, cleanupCommands } from './commands.js';
import { getProvider } from './provider-bridge.js';
import { getAgentExecutor } from './agent-bridge.js';
import type { AgentDelegation, REPLConfig, StreamEvent } from './types.js';
import type { InteractiveProvider } from './provider-bridge.js';
import type { AgentExecutorBridge } from './agent-bridge.js';

// P0 Feature imports
import { classifyIntent, detectConfirmation } from './intent-classifier.js';
import { generateQuickActions, renderQuickActions, detectPaletteContext } from './command-palette.js';
import { getContextualHelp } from './progressive-help.js';
import { runOnboardingWizard, hasCompletedOnboarding, showQuickTipsBanner } from './onboarding.js';

// Phase 3 Feature imports (Claude-style UX)
import { initPhase3Features, showStartupBanner, updateAfterCommand, updateAfterAIResponse, trackAgentDelegation, type Phase3Features } from './phase3-integration.js';

// Phase 4 Feature imports (Batch Approval, Logging, History, Persistence)
import {
  initPhase4Features,
  showPhase4StartupBanner,
  updateAfterPhase4Command,
  updateAfterPhase4AIResponse,
  trackPhase4AgentDelegation,
  executeUndo,
  executeRedo,
  getPhase4SessionSummary,
  renderCommandHistory,
  renderEventTimeline,
  savePhase4Session,
  cleanupPhase4Features,
  type Phase4Features
} from './phase4-integration.js';

// Phase 5 Feature imports (Provider Transparency, Memory Suggestions, Agent Preview, Hand-offs)
import {
  initPhase5Features,
  showPhase5StartupBanner,
  trackProviderUsage,
  showMemorySuggestions,
  autoSuggestMemorySearch,
  trackCommand,
  setCurrentTask,
  trackAgentDelegationPhase5,
  showAgentPreview,
  showAgentComparison,
  suggestHandoffIfAppropriate,
  trackHandoff,
  showProviderUsageSummary,
  getPhase5SessionSummary,
  cleanupPhase5Features,
  type Phase5Features
} from './phase5-integration.js';

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
  private currentAbortController: AbortController | null = null; // Bug #8 fix

  // P0 Feature tracking
  private lastCommand?: string;
  private lastError?: string;
  private enableP0Features: boolean = true;

  // Phase 3 Features (Claude-style UX)
  private phase3?: Phase3Features;
  private enablePhase3Features: boolean = true;

  // Phase 4 Features (Batch Approval, Logging, History, Persistence)
  private phase4?: Phase4Features;
  private enablePhase4Features: boolean = true;

  // Phase 5 Features (Provider Transparency, Memory Suggestions, Agent Preview, Hand-offs)
  private phase5?: Phase5Features;
  private enablePhase5Features: boolean = true;

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
    // P0 Feature: Run onboarding for first-time users
    if (this.enableP0Features) {
      if (!hasCompletedOnboarding()) {
        await runOnboardingWizard();
      } else {
        // Show quick tips banner for returning users
        showQuickTipsBanner();
      }
    }

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

    // Phase 3 Feature: Initialize session with workspace context
    if (this.enablePhase3Features) {
      try {
        this.phase3 = initPhase3Features(process.cwd(), 'main', this.currentProvider);
        showStartupBanner(this.phase3);
      } catch (error) {
        // Phase 3 features are optional - continue without them
        console.error('Phase 3 features initialization failed:', error);
      }
    }

    // Phase 4 Feature: Initialize batch approval, logging, history, persistence
    if (this.enablePhase4Features) {
      try {
        this.phase4 = initPhase4Features(
          process.cwd(),
          `cli-${Date.now()}`,
          this.currentProvider,
          {
            enableFileLogging: true,
            autoSaveInterval: this.config.autoSaveInterval || 30000,
            maxHistorySize: 100
          }
        );
        showPhase4StartupBanner(this.phase4);
      } catch (error) {
        // Phase 4 features are optional - continue without them
        console.error('Phase 4 features initialization failed:', error);
      }
    }

    // Phase 5 Feature: Initialize provider transparency, memory suggestions, agent preview, hand-offs
    if (this.enablePhase5Features) {
      try {
        this.phase5 = await initPhase5Features(
          process.cwd(),
          `session-${Date.now()}`,
          this.currentProvider
        );
        showPhase5StartupBanner(this.phase5);
      } catch (error) {
        // Phase 5 features are optional - continue without them
        console.error('Phase 5 features initialization failed:', error);
      }
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
      try {
        const trimmed = input.trim();

        // Skip empty input
        if (!trimmed) {
          this.rl.prompt();
          return;
        }

        // P0 Feature: Intent detection and routing
        let commandExecuted = false;

        // 1. Check for slash commands (traditional mode)
        if (trimmed.startsWith('/')) {
          await this.handleCommand(trimmed);
          commandExecuted = true;
        }
        // 2. P0 Feature: Check for natural language intent
        else if (this.enableP0Features) {
          const intent = classifyIntent(trimmed);

          if (intent) {
            // Display what we detected
            this.renderer.displayInfo(`→ Detected: ${intent.reason}`);
            console.log('');

            // Route to command handler
            const parts = ['/' + intent.command, ...intent.args].join(' ');
            await this.handleCommand(parts);

            this.lastCommand = intent.command;
            commandExecuted = true;
          } else {
            // No intent detected - treat as conversation
            await this.handlePrompt(trimmed);
          }
        }
        // 3. Fallback to normal conversation
        else {
          await this.handlePrompt(trimmed);
        }

        // P0 Feature: Show command palette after responses
        if (this.enableP0Features && commandExecuted) {
          this.showCommandPalette();
        }

        // P0 Feature: Show contextual help
        if (this.enableP0Features) {
          this.showContextualHelpTip();
        }

        // Show prompt for next input
        this.rl.prompt();
      } catch (error) {
        // Bug #47 fix: Catch any unhandled errors to prevent REPL crash
        this.renderer.displayError(`Unexpected error: ${(error as Error).message}`);
        this.isProcessing = false; // Ensure flag is reset
        this.rl.prompt();
      }
    });

    // Handle Ctrl+C (SIGINT)
    this.rl.on('SIGINT', () => {
      if (this.isProcessing) {
        // Bug #8 fix: Cancel current streaming operation
        this.renderer.displayInfo('\nCancelling current operation...');

        // Abort the current stream if one is active
        if (this.currentAbortController) {
          this.currentAbortController.abort();
          this.currentAbortController = null;
        }

        this.isProcessing = false;
        this.rl.prompt();
      } else {
        // Confirm exit
        this.rl.question('\nExit ax-cli? (y/n) ', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            void this.shutdown();
          } else {
            this.rl.prompt();
          }
        });
      }
    });

    // Handle close (Ctrl+D or /exit)
    this.rl.on('close', () => {
      void this.shutdown();
    });
  }

  /**
   * Handle user prompt (natural language input)
   */
  private async handlePrompt(input: string): Promise<void> {
    this.isProcessing = true;

    try {
      // Add user message to conversation
      this.conversation.addMessage('user', input);

      // Check for agent delegation
      const delegation = this.parseAgentDelegation(input);

      if (delegation) {
        await this.handleAgentDelegation(delegation);
      } else {
        await this.handleAIResponse(input);
      }
    } finally {
      // Bug #47 fix: Always reset isProcessing flag, even if error occurs
      this.isProcessing = false;
    }
  }

  /**
   * Handle AI response with streaming
   */
  private async handleAIResponse(input: string): Promise<void> {
    const spinner = this.config.spinner ? ora('Thinking...').start() : null;

    // Bug #8 fix: Create AbortController for this stream
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    try {
      // Get conversation context
      const context = this.conversation.getContext();

      // Use real provider if available, otherwise fall back to simulation
      if (this.provider) {
        spinner?.stop();
        this.renderer.displayAIPrefix();

        let fullResponse = '';
        let wasCancelled = false;

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

        // Bug #8 fix: Pass abort signal to provider for cancellable streaming
        for await (const event of this.provider.streamResponse(fullPrompt, signal)) {
          this.renderer.renderStreamEvent(event);

          if (event.type === 'token') {
            fullResponse += event.data;
          } else if (event.type === 'error') {
            // Check if this was a cancellation
            if (event.data.code === 'STREAM_CANCELLED') {
              wasCancelled = true;
              break;
            }
            throw new Error(event.data.message || 'Provider error');
          }
        }

        console.log('\n');

        // Only add to conversation if not cancelled
        if (!wasCancelled && fullResponse) {
          this.conversation.addMessage('assistant', fullResponse);

          // Phase 4: Track AI response
          if (this.enablePhase4Features && this.phase4) {
            const duration = Date.now() - (Date.now() - fullResponse.length * 10); // Approximate
            updateAfterPhase4AIResponse(
              this.phase4,
              input,
              fullResponse,
              this.currentProvider,
              duration
            );
          }

          // P0 Feature: Show command palette after AI response
          if (this.enableP0Features) {
            this.showCommandPalette();
          }
        }
      } else {
        // Fallback to simulated streaming
        spinner?.stop();
        this.renderer.displayAIPrefix();
        await this.simulateStreaming(input, signal);
        // Only add to conversation if not cancelled
        if (!signal.aborted) {
          this.conversation.addMessage('assistant', '[Simulated response]');

          // P0 Feature: Show command palette after AI response
          if (this.enableP0Features) {
            this.showCommandPalette();
          }
        }
      }

    } catch (error) {
      spinner?.stop();
      this.renderer.displayError(`Failed to get AI response: ${(error as Error).message}`);
      this.lastError = (error as Error).message;
    } finally {
      // Bug #8 fix: Clean up AbortController
      this.currentAbortController = null;
    }
  }

  /**
   * Handle agent delegation
   */
  private async handleAgentDelegation(delegation: AgentDelegation): Promise<void> {
    const spinner = this.config.spinner ? ora(`Delegating to ${delegation.agent}...`).start() : null;
    const startTime = Date.now();

    // Phase 3: Track agent start
    if (this.enablePhase3Features && this.phase3) {
      trackAgentDelegation(this.phase3, delegation.agent, delegation.task, 'starting');
    }

    // Phase 4: Track agent start
    if (this.enablePhase4Features && this.phase4) {
      trackPhase4AgentDelegation(this.phase4, delegation.agent, delegation.task, 'starting');
    }

    // Phase 5: Track agent delegation and show preview
    if (this.enablePhase5Features && this.phase5) {
      trackAgentDelegationPhase5(this.phase5, delegation.agent);
      setCurrentTask(this.phase5, delegation.task);
      // Show inline preview
      const preview = showAgentPreview(this.phase5, delegation.agent, delegation.task);
      console.log(''); // Add spacing
    }

    try {
      // Use real agent executor if available
      if (this.agentExecutor) {
        // Check if agent is available
        const isAvailable = await this.agentExecutor.isAgentAvailable(delegation.agent);

        if (!isAvailable) {
          spinner?.stop();
          this.renderer.displayError(`Agent "${delegation.agent}" not found`);
          this.renderer.displayInfo('Use /agents to see available agents');

          // Phase 3: Track agent error
          if (this.enablePhase3Features && this.phase3) {
            const duration = Date.now() - startTime;
            trackAgentDelegation(this.phase3, delegation.agent, delegation.task, 'error', duration);
          }

          return;
        }

        spinner?.stop();
        this.renderer.displayInfo(`[@${delegation.agent}] Starting task: ${delegation.task}\n`);

        // Execute agent task
        const result = await this.agentExecutor.execute(delegation);

        const duration = Date.now() - startTime;

        if (result.success) {
          console.log(result.output);
          console.log('\n');
          this.conversation.addMessage('assistant', result.output);

          // Phase 3: Track agent completion
          if (this.enablePhase3Features && this.phase3) {
            trackAgentDelegation(this.phase3, delegation.agent, delegation.task, 'complete', duration);
          }

          // Phase 4: Track agent completion
          if (this.enablePhase4Features && this.phase4) {
            trackPhase4AgentDelegation(this.phase4, delegation.agent, delegation.task, 'complete', duration);
          }
        } else {
          this.renderer.displayError(`Agent execution failed: ${result.error?.message || 'Unknown error'}`);

          // Phase 3: Track agent error
          if (this.enablePhase3Features && this.phase3) {
            trackAgentDelegation(this.phase3, delegation.agent, delegation.task, 'error', duration);
          }

          // Phase 4: Track agent error
          if (this.enablePhase4Features && this.phase4) {
            trackPhase4AgentDelegation(this.phase4, delegation.agent, delegation.task, 'error', duration, result.error);
          }
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

      // Phase 3: Track agent error
      if (this.enablePhase3Features && this.phase3) {
        const duration = Date.now() - startTime;
        trackAgentDelegation(this.phase3, delegation.agent, delegation.task, 'error', duration);
      }

      // Phase 4: Track agent error
      if (this.enablePhase4Features && this.phase4) {
        const duration = Date.now() - startTime;
        trackPhase4AgentDelegation(this.phase4, delegation.agent, delegation.task, 'error', duration, error as Error);
      }
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

    // Phase 4: Special commands for history/session management
    if (this.enablePhase4Features && this.phase4) {
      if (command === 'undo') {
        const result = await executeUndo(this.phase4);
        if (result.success) {
          this.renderer.displaySuccess(`Undone: ${result.entry?.description}`);
        } else {
          this.renderer.displayError(result.error || 'Cannot undo');
        }
        return;
      }

      if (command === 'redo') {
        const result = await executeRedo(this.phase4);
        if (result.success) {
          this.renderer.displaySuccess(`Redone: ${result.entry?.description}`);
        } else {
          this.renderer.displayError(result.error || 'Cannot redo');
        }
        return;
      }

      if (command === 'history') {
        const limit = args[0] ? parseInt(args[0], 10) : 10;
        console.log(renderCommandHistory(this.phase4, limit));
        return;
      }

      if (command === 'timeline') {
        const limit = args[0] ? parseInt(args[0], 10) : 20;
        console.log(renderEventTimeline(this.phase4, limit));
        return;
      }

      if (command === 'summary') {
        console.log(getPhase4SessionSummary(this.phase4));
        return;
      }
    }

    // Phase 5: Special commands for transparency, suggestions, previews, handoffs
    if (this.enablePhase5Features && this.phase5) {
      if (command === 'provider-stats') {
        showProviderUsageSummary(this.phase5);
        return;
      }

      if (command === 'suggest-memory') {
        showMemorySuggestions(this.phase5);
        return;
      }

      if (command === 'preview') {
        const agentName = args[0];
        const task = args.slice(1).join(' ');
        if (!agentName || !task) {
          this.renderer.displayError('Usage: /preview <agent> <task>');
          return;
        }
        showAgentPreview(this.phase5, agentName, task);
        return;
      }

      if (command === 'compare-agents') {
        const task = args.join(' ');
        if (!task) {
          this.renderer.displayError('Usage: /compare-agents <task>');
          return;
        }
        const agents = ['backend', 'frontend', 'security', 'quality', 'fullstack'];
        showAgentComparison(this.phase5, task, agents);
        return;
      }

      if (command === 'phase5-summary') {
        console.log(getPhase5SessionSummary(this.phase5));
        return;
      }
    }

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

    const startTime = Date.now();
    let success = true;
    let error: Error | undefined;

    try {
      await routeCommand(command, args, {
        conversation: this.conversation.getConversation(),
        currentProvider: this.currentProvider,
        workspaceRoot,
        agentExecutor: this.agentExecutor || undefined,
        conversationManager: this.conversation
      });
    } catch (err) {
      success = false;
      error = err as Error;
      throw err;
    } finally {
      // Phase 4: Track command execution
      if (this.enablePhase4Features && this.phase4) {
        const duration = Date.now() - startTime;
        updateAfterPhase4Command(this.phase4, command, args, success, duration, error);
      }

      // Phase 5: Track command and auto-suggest memory search
      if (this.enablePhase5Features && this.phase5) {
        trackCommand(this.phase5, command);
        if (!success && error) {
          autoSuggestMemorySearch(this.phase5, command, true);
        }
      }
    }
  }

  /**
   * Auto-completion for commands
   */
  private completer(line: string): [string[], string] {
    const commands = [
      '/help', '/exit', '/clear', '/provider', '/history', '/stats',
      '/save', '/list', '/load', '/export', '/delete', '/new',
      '/agents', '/memory', '/init',
      '/read', '/write', '/edit',  // Phase 1: File operations
      '/exec', '/run', '/processes', '/kill', '/output',  // Phase 2: Code execution
      '/find', '/search', '/tree',  // Phase 2: Search & navigation
      '/git', '/status',  // Phase 2: Git integration
      '/test', '/coverage', '/lint', '/format',  // Phase 3: Testing & linting
      '/install', '/update', '/outdated',  // Phase 3: Package management
      '/build', '/dev', '/env', '/create',  // Phase 4: Build & environment
      '/undo', '/redo', '/timeline', '/summary',  // Phase 4: History & session
      '/provider-stats', '/suggest-memory', '/preview', '/compare-agents', '/phase5-summary'  // Phase 5: Transparency & intelligence
    ];

    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commands, line];
  }

  /**
   * Simulate streaming response (temporary for MVP testing)
   * Will be replaced with real Gemini integration
   */
  private async simulateStreaming(_input: string, signal?: AbortSignal): Promise<void> {
    const response = `I understand your request.\n\nThis is a simulated response for MVP testing. ` +
      `Real Gemini streaming integration will be added in Week 1, Day 2-3.\n\n` +
      `For now, you can test:\n` +
      `- Slash commands like /help, /agents, /history\n` +
      `- Agent delegation syntax: @backend implement auth\n` +
      `- Basic REPL functionality\n`;

    // Simulate token-by-token streaming
    for (const char of response) {
      // Consistency fix: Check for cancellation during simulation
      if (signal?.aborted) {
        console.log('\n[Stream cancelled]\n');
        return;
      }

      process.stdout.write(char);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log('\n');
  }

  /**
   * P0 Feature: Show command palette with contextual suggestions
   */
  private showCommandPalette(): void {
    const paletteContext = detectPaletteContext(this.conversation.getConversation().messages);
    const actions = generateQuickActions(paletteContext);

    if (actions.length > 0) {
      const rendered = renderQuickActions(actions);
      console.log(rendered);
    }
  }

  /**
   * P0 Feature: Show contextual help tip based on recent activity
   */
  private showContextualHelpTip(): void {
    const tip = getContextualHelp({
      lastCommand: this.lastCommand,
      lastError: this.lastError,
      messageCount: this.conversation.getConversation().messages.length
    });

    if (tip) {
      console.log(tip);
    }
  }

  /**
   * Shutdown and cleanup
   * Idempotent - can be called multiple times safely
   */
  private async shutdown(): Promise<void> {
    // Guard against multiple shutdown calls
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    // Phase 4: Cleanup features
    if (this.enablePhase4Features && this.phase4) {
      try {
        await cleanupPhase4Features(this.phase4);
      } catch (error) {
        console.error('Phase 4 cleanup failed:', error);
      }
    }

    // Phase 5: Cleanup features
    if (this.enablePhase5Features && this.phase5) {
      try {
        await cleanupPhase5Features(this.phase5);
      } catch (error) {
        console.error('Phase 5 cleanup failed:', error);
      }
    }

    // Stop auto-save
    this.conversation.stopAutoSave();

    // Cleanup command resources (process manager, etc.)
    cleanupCommands();

    // Display goodbye
    this.renderer.displayGoodbye();

    // Close readline (this triggers 'close' event, but isShuttingDown prevents recursion)
    this.rl.close();

    // Exit process
    process.exit(0);
  }
}
