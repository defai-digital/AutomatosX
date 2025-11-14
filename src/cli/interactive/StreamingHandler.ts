/**
 * Streaming Handler
 *
 * Week 1 Implementation - Interactive CLI Mode
 * Handles token-by-token streaming, loading indicators, and formatted output
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class StreamingHandler {
  private spinner?: Ora;
  private currentLine: string = '';

  /**
   * Start loading indicator
   */
  startThinking(message: string = 'Thinking...'): void {
    this.spinner = ora({
      text: message,
      color: 'cyan',
    }).start();
  }

  /**
   * Stop loading indicator
   */
  stopThinking(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = undefined;
    }
  }

  /**
   * Stream a single token without newline
   */
  streamToken(token: string): void {
    // Stop spinner if still active
    this.stopThinking();

    // Write token without newline
    process.stdout.write(chalk.white(token));
    this.currentLine += token;

    // Track line breaks
    if (token.includes('\n')) {
      this.currentLine = '';
    }
  }

  /**
   * Finish streaming and ensure newline
   */
  finishStream(): void {
    if (this.currentLine && !this.currentLine.endsWith('\n')) {
      process.stdout.write('\n');
    }
    this.currentLine = '';
  }

  /**
   * Display error message
   */
  displayError(error: Error): void {
    this.stopThinking();
    console.log(chalk.red('\n❌ Error: ') + error.message);
    console.log();
  }

  /**
   * Display success message
   */
  displaySuccess(message: string): void {
    this.stopThinking();
    console.log(chalk.green('\n✅ ' + message + '\n'));
  }

  /**
   * Display info message
   */
  displayInfo(message: string): void {
    console.log(chalk.cyan('\nℹ️  ' + message + '\n'));
  }

  /**
   * Display warning message
   */
  displayWarning(message: string): void {
    console.log(chalk.yellow('\n⚠️  ' + message + '\n'));
  }

  /**
   * Display system message
   */
  displaySystem(message: string): void {
    console.log(chalk.gray('\n[System] ' + message + '\n'));
  }

  /**
   * Clear current line (for progress updates)
   */
  clearLine(): void {
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  /**
   * Display progress bar
   */
  displayProgress(current: number, total: number, label: string = 'Progress'): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((current / total) * barLength);
    const empty = barLength - filled;

    this.clearLine();
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(
      chalk.cyan(`${label}: [${bar}] ${percentage}% (${current}/${total})`)
    );

    if (current >= total) {
      process.stdout.write('\n');
    }
  }
}
