/**
 * Progress Renderer (v5.3.0)
 *
 * Renders real-time progress updates in the terminal.
 * Displays stage execution progress with spinners and progress bars.
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import type { ProgressEvent } from '../../core/progress-channel.js';

/**
 * Progress Renderer
 *
 * Handles terminal rendering for progress events.
 * Features:
 * - Stage-specific spinners
 * - Progress bars (0-100%)
 * - Success/error indicators
 * - Token streaming (optional)
 */
export class ProgressRenderer {
  private spinner: Ora | null = null;
  private currentStage: string | null = null;
  private currentProgress = 0;
  private quiet = false;

  /**
   * Create ProgressRenderer
   *
   * @param options - Renderer options
   */
  constructor(options: { quiet?: boolean } = {}) {
    this.quiet = options.quiet || false;
  }

  /**
   * Start rendering
   */
  start(): void {
    // Initialize renderer (no-op for now)
  }

  /**
   * Handle progress event
   *
   * Routes events to appropriate handlers based on type.
   *
   * @param event - Progress event to handle
   */
  handleEvent(event: ProgressEvent): void {
    if (this.quiet) return;

    switch (event.type) {
      case 'stage-start':
        this.handleStageStart(event);
        break;

      case 'stage-progress':
        this.handleStageProgress(event);
        break;

      case 'stage-complete':
        this.handleStageComplete(event);
        break;

      case 'stage-error':
        this.handleStageError(event);
        break;

      case 'token-stream':
        this.handleTokenStream(event);
        break;

      case 'checkpoint':
        this.handleCheckpoint(event);
        break;

      case 'user-prompt':
        this.handleUserPrompt(event);
        break;
    }
  }

  /**
   * Stop rendering
   *
   * Cleans up spinner and resets state.
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Handle stage start event
   */
  private handleStageStart(event: ProgressEvent): void {
    if (this.spinner) {
      this.spinner.stop();
    }

    this.currentStage = event.stageName || 'Unknown';
    this.currentProgress = 0;

    this.spinner = ora({
      text: chalk.cyan(`${this.currentStage} (0%)`),
      spinner: 'dots'
    }).start();
  }

  /**
   * Handle stage progress event
   */
  private handleStageProgress(event: ProgressEvent): void {
    if (!this.spinner) return;

    this.currentProgress = event.progress || 0;
    const progressBar = this.buildProgressBar(this.currentProgress);

    this.spinner.text = chalk.cyan(
      `${this.currentStage} ${progressBar} ${Math.round(this.currentProgress)}%`
    );
  }

  /**
   * Handle stage complete event
   */
  private handleStageComplete(event: ProgressEvent): void {
    if (this.spinner) {
      this.spinner.succeed(chalk.green(`✓ ${event.stageName} completed`));
      this.spinner = null;
    }
  }

  /**
   * Handle stage error event
   */
  private handleStageError(event: ProgressEvent): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(`✗ ${event.stageName} failed: ${event.message || 'Unknown error'}`));
      this.spinner = null;
    }
  }

  /**
   * Handle token stream event
   *
   * Displays streaming tokens (optional).
   * Can be enabled/disabled based on verbosity settings.
   */
  private handleTokenStream(event: ProgressEvent): void {
    // Display streaming tokens (optional, can be disabled)
    const token = event.token;
    if (token && !this.quiet) {
      // Display individual tokens (can be disabled with --quiet flag)
      process.stdout.write(token);
    }
  }

  /**
   * Handle checkpoint event
   */
  private handleCheckpoint(event: ProgressEvent): void {
    if (this.spinner) {
      this.spinner.info(chalk.yellow(`⏸ Checkpoint: ${event.message || 'Waiting for user input'}`));
      this.spinner = null;
    }
  }

  /**
   * Handle user prompt event
   */
  private handleUserPrompt(event: ProgressEvent): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    // User prompt will be handled by PromptManager
  }

  /**
   * Build progress bar visualization
   *
   * Creates a visual progress bar using block characters.
   *
   * @param progress - Progress percentage (0-100)
   * @returns Progress bar string
   */
  private buildProgressBar(progress: number): string {
    const total = 20;
    const filled = Math.round((progress / 100) * total);
    const empty = total - filled;

    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }
}
