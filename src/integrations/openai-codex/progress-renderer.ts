/**
 * Codex Progress Renderer
 *
 * Renders real-time progress from Codex CLI streaming output.
 *
 * Features:
 * - Respects verbosity levels (quiet/normal/verbose)
 * - Displays progress bars and spinners
 * - Shows completion/error states
 * - Integrates with CodexEventParser
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { VerbosityManager } from '../../shared/logging/verbosity-manager.js';
import { CodexEventParser, type CodexEvent } from './event-parser.js';
import { logger } from '../../shared/logging/logger.js';

// ========== Types ==========

export interface ProgressRendererOptions {
  verbosity?: number;
  showTokens?: boolean;
}

export interface ProgressState {
  phase: 'starting' | 'running' | 'completed' | 'error';
  message?: string;
  percentage?: number;
  tokensUsed?: number;
  errors: number;
}

// ========== Renderer ==========

export class CodexProgressRenderer {
  private parser: CodexEventParser;
  private spinner: Ora | null = null;
  private state: ProgressState = {
    phase: 'starting',
    errors: 0
  };
  private verbosity: number;
  private showTokens: boolean;

  constructor(options: ProgressRendererOptions = {}) {
    this.parser = new CodexEventParser();
    this.verbosity = options.verbosity ?? VerbosityManager.getInstance().getLevel();
    this.showTokens = options.showTokens ?? true;

    // Register event handlers
    this.setupEventHandlers();
  }

  /**
   * Start rendering
   */
  start(initialMessage: string = 'Executing Codex...'): void {
    this.state = {
      phase: 'starting',
      errors: 0
    };

    // Quiet mode: no spinner
    if (this.verbosity === 0) {
      return;
    }

    // Normal/Verbose: show spinner
    this.spinner = ora({
      text: initialMessage,
      color: 'cyan',
      spinner: 'dots'
    }).start();
  }

  /**
   * Process a JSONL line from Codex output
   */
  processLine(line: string): void {
    const event = this.parser.parse(line);
    if (!event) {
      return;
    }

    // Event is automatically emitted to handlers via parser
  }

  /**
   * Stop rendering with success
   */
  succeed(message?: string): void {
    this.state.phase = 'completed';

    if (this.verbosity === 0) {
      // Quiet: no output
      return;
    }

    if (this.spinner) {
      this.spinner.succeed(message || 'Codex execution complete');
      this.spinner = null;
    }

    // Verbose: show summary
    if (this.verbosity === 2) {
      this.showSummary();
    }
  }

  /**
   * Stop rendering with error
   */
  fail(message?: string): void {
    this.state.phase = 'error';

    if (this.spinner) {
      this.spinner.fail(message || 'Codex execution failed');
      this.spinner = null;
    } else if (this.verbosity > 0) {
      console.error(chalk.red(`✗ ${message || 'Codex execution failed'}`));
    }

    // Always show errors, even in quiet mode
    if (this.state.errors > 0) {
      console.error(chalk.red(`\n${this.state.errors} error(s) occurred during execution\n`));
    }
  }

  /**
   * Stop rendering without status
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return this.parser.getStatistics();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Progress events
    this.parser.on('progress', (event) => {
      this.handleProgressEvent(event);
    });

    // Completion events
    this.parser.on('completion', (event) => {
      this.handleCompletionEvent(event);
    });

    // Error events
    this.parser.on('error', (event) => {
      this.handleErrorEvent(event);
    });

    // Token usage events
    this.parser.on('token_usage', (event) => {
      this.handleTokenUsageEvent(event);
    });
  }

  /**
   * Handle progress event
   */
  private handleProgressEvent(event: CodexEvent): void {
    if (event.type !== 'progress') return;

    this.state.phase = 'running';

    if ('message' in event) {
      this.state.message = event.message;
    }

    if ('percentage' in event && event.percentage !== undefined) {
      this.state.percentage = event.percentage;
    }

    // Update spinner text
    if (this.spinner && this.verbosity > 0) {
      const text = this.formatProgressText();
      this.spinner.text = text;
    }
  }

  /**
   * Handle completion event
   */
  private handleCompletionEvent(event: CodexEvent): void {
    if (event.type !== 'completion') return;

    this.state.phase = 'completed';

    // Verbose: log completion
    if (this.verbosity === 2 && 'content' in event) {
      logger.debug('Codex completion received', {
        contentLength: event.content.length,
        model: 'model' in event ? event.model : undefined
      });
    }
  }

  /**
   * Handle error event
   */
  private handleErrorEvent(event: CodexEvent): void {
    if (event.type !== 'error') return;

    this.state.errors++;
    this.state.phase = 'error';

    // Always log errors (even in quiet mode, they go to logger)
    if ('error' in event) {
      logger.error('Codex error event', {
        error: event.error,
        code: 'code' in event ? event.code : undefined
      });
    }

    // Show error in spinner/console
    if (this.verbosity > 0 && 'error' in event) {
      if (this.spinner) {
        this.spinner.fail(chalk.red(`Error: ${event.error}`));
        this.spinner = ora({ text: 'Continuing...', color: 'yellow', spinner: 'dots' }).start();
      } else {
        console.error(chalk.red(`✗ Error: ${event.error}`));
      }
    }
  }

  /**
   * Handle token usage event
   */
  private handleTokenUsageEvent(event: CodexEvent): void {
    if (event.type !== 'token_usage') return;

    if ('inputTokens' in event && 'outputTokens' in event) {
      this.state.tokensUsed = event.inputTokens + event.outputTokens;
    }

    // Verbose: log token usage
    if (this.verbosity === 2 && 'inputTokens' in event && 'outputTokens' in event) {
      logger.debug('Token usage', {
        input: event.inputTokens,
        output: event.outputTokens,
        total: event.inputTokens + event.outputTokens
      });
    }
  }

  /**
   * Format progress text for spinner
   */
  private formatProgressText(): string {
    const parts: string[] = [];

    if (this.state.message) {
      parts.push(this.state.message);
    }

    if (this.state.percentage !== undefined) {
      parts.push(`(${this.state.percentage}%)`);
    }

    return parts.length > 0 ? parts.join(' ') : 'Processing...';
  }

  /**
   * Show execution summary (verbose mode)
   */
  private showSummary(): void {
    const stats = this.parser.getStatistics();

    console.log(chalk.gray('\n━━━ Execution Summary ━━━'));
    console.log(chalk.gray(`Events processed: ${stats.totalEvents}`));

    if (this.showTokens && this.state.tokensUsed) {
      console.log(chalk.gray(`Tokens used: ${this.state.tokensUsed.toLocaleString()}`));
    }

    if (stats.errors > 0) {
      console.log(chalk.red(`Errors: ${stats.errors}`));
    }

    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
}
