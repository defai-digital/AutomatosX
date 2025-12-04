/**
 * Progress Indicator - CLI progress display using ora
 *
 * Provides consistent progress feedback for long-running operations
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface ProgressOptions {
  /**
   * Show spinner animation
   */
  spinner?: boolean;

  /**
   * Custom spinner type
   */
  spinnerType?: 'dots' | 'line' | 'arrow' | 'aesthetic';

  /**
   * Use colors
   */
  colors?: boolean;
}

/**
 * Progress Indicator
 *
 * Wrapper around ora for consistent progress display
 */
export class ProgressIndicator {
  private spinner: Ora | null = null;
  private options: ProgressOptions;

  constructor(options: ProgressOptions = {}) {
    this.options = {
      spinner: true,
      spinnerType: 'dots',
      colors: true,
      ...options
    };
  }

  /**
   * Start progress indicator
   */
  start(message: string): void {
    if (!this.options.spinner) {
      console.log(message);
      return;
    }

    this.spinner = ora({
      text: message,
      spinner: this.options.spinnerType,
      color: this.options.colors ? 'cyan' : undefined
    }).start();
  }

  /**
   * Update progress message
   */
  update(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    } else {
      console.log(message);
    }
  }

  /**
   * Mark as success and stop
   */
  succeed(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    } else if (message) {
      const text = this.options.colors
        ? chalk.green(`✓ ${message}`)
        : `✓ ${message}`;
      console.log(text);
    }
  }

  /**
   * Mark as failure and stop
   */
  fail(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    } else if (message) {
      const text = this.options.colors
        ? chalk.red(`✗ ${message}`)
        : `✗ ${message}`;
      console.log(text);
    }
  }

  /**
   * Mark as warning and stop
   */
  warn(message?: string): void {
    if (this.spinner) {
      this.spinner.warn(message);
      this.spinner = null;
    } else if (message) {
      const text = this.options.colors
        ? chalk.yellow(`⚠ ${message}`)
        : `⚠ ${message}`;
      console.log(text);
    }
  }

  /**
   * Mark as info and stop
   */
  info(message?: string): void {
    if (this.spinner) {
      this.spinner.info(message);
      this.spinner = null;
    } else if (message) {
      const text = this.options.colors
        ? chalk.blue(`ℹ ${message}`)
        : `ℹ ${message}`;
      console.log(text);
    }
  }

  /**
   * Stop spinner without status
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Clear spinner
   */
  clear(): void {
    if (this.spinner) {
      this.spinner.clear();
    }
  }

  /**
   * Check if spinner is active
   */
  isSpinning(): boolean {
    return this.spinner !== null && this.spinner.isSpinning;
  }
}

/**
 * Create a simple progress indicator
 */
export function createProgress(message: string, options?: ProgressOptions): ProgressIndicator {
  const progress = new ProgressIndicator(options);
  progress.start(message);
  return progress;
}
