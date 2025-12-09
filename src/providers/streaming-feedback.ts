/**
 * Streaming Feedback - Enhanced visual feedback for streaming operations
 *
 * Provides real-time visual indicators for:
 * - Streaming status
 * - Token count
 * - Elapsed time
 * - Estimated remaining time
 * - Throughput (tokens/sec)
 *
 * v6.0.7: Phase 2 - Enhanced streaming UX
 */

import chalk from 'chalk';

export interface StreamingMetrics {
  tokensReceived: number;
  startTime: number;
  lastUpdateTime: number;
  estimatedTotal?: number;
}

export class StreamingFeedback {
  private metrics: StreamingMetrics;
  private displayInterval: NodeJS.Timeout | null = null;
  private animationFrame: number = 0;
  private isActive: boolean = false;

  constructor(estimatedTotalTokens?: number) {
    this.metrics = {
      tokensReceived: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      estimatedTotal: estimatedTotalTokens
    };
  }

  /**
   * Start streaming feedback display
   */
  start(): void {
    if (this.isActive) return;
    if (process.env.AUTOMATOSX_QUIET === 'true') return;

    this.isActive = true;
    this.showInitialMessage();

    // Update display every second
    this.displayInterval = setInterval(() => {
      this.updateDisplay();
    }, 1000);
    // v12.5.3: Prevent blocking process exit
    if (this.displayInterval.unref) this.displayInterval.unref();
  }

  /**
   * Record a token received
   */
  onToken(token: string): void {
    // Rough token count (1 token ≈ 4 chars)
    const tokenCount = Math.max(1, Math.ceil(token.length / 4));
    this.metrics.tokensReceived += tokenCount;
    this.metrics.lastUpdateTime = Date.now();
  }

  /**
   * Update progress (if estimated total known)
   */
  updateProgress(tokensReceived: number): void {
    this.metrics.tokensReceived = tokensReceived;
    this.metrics.lastUpdateTime = Date.now();
  }

  /**
   * Stop streaming feedback
   */
  stop(finalTokenCount?: number): void {
    if (!this.isActive) return;

    if (this.displayInterval) {
      clearInterval(this.displayInterval);
      this.displayInterval = null;
    }

    if (finalTokenCount !== undefined) {
      this.metrics.tokensReceived = finalTokenCount;
    }

    this.showCompletionMessage();
    this.isActive = false;
  }

  /**
   * Cleanup resources without showing completion message
   *
   * BUG FIX: Added destroy() method for cleanup when stop() may not be called
   * (e.g., due to an error during streaming). This prevents the displayInterval
   * timer from running indefinitely, causing a resource leak.
   */
  destroy(): void {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
      this.displayInterval = null;
    }
    this.isActive = false;
  }

  /**
   * Get current throughput (tokens/sec)
   */
  private getThroughput(): number {
    const elapsedMs = Date.now() - this.metrics.startTime;
    if (elapsedMs === 0) return 0;
    return (this.metrics.tokensReceived / elapsedMs) * 1000;
  }

  /**
   * Get elapsed time in seconds
   */
  private getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.metrics.startTime) / 1000);
  }

  /**
   * Get estimated remaining time
   */
  private getEstimatedRemaining(): number | null {
    if (!this.metrics.estimatedTotal) return null;

    const throughput = this.getThroughput();
    if (throughput === 0) return null;

    const remaining = this.metrics.estimatedTotal - this.metrics.tokensReceived;
    if (remaining <= 0) return 0;

    return Math.round(remaining / throughput);
  }

  /**
   * Get progress percentage
   *
   * BUG FIX: Handle case where estimatedTotal is 0 or negative.
   * Previously only checked for falsy (!estimatedTotal) which would allow 0 to pass,
   * causing division by zero and returning NaN. Now explicitly check for <= 0.
   */
  private getProgress(): number {
    if (!this.metrics.estimatedTotal || this.metrics.estimatedTotal <= 0) return 0;
    return Math.min(95, Math.round((this.metrics.tokensReceived / this.metrics.estimatedTotal) * 100));
  }

  /**
   * Show initial streaming message
   */
  private showInitialMessage(): void {
    process.stderr.write(chalk.cyan('\n🔄 Streaming response...\n'));
  }

  /**
   * Update display with current metrics
   */
  private updateDisplay(): void {
    if (!this.isActive) return;

    const elapsed = this.getElapsedSeconds();
    const throughput = Math.round(this.getThroughput());
    const animation = this.getSpinnerFrame();

    let display = `${animation} `;

    // Tokens received
    display += chalk.bold(`${this.metrics.tokensReceived} tokens`);

    // Throughput
    if (throughput > 0) {
      display += chalk.dim(` • ${throughput} tok/s`);
    }

    // Elapsed time
    display += chalk.dim(` • ${elapsed}s`);

    // Progress bar if estimated total known
    if (this.metrics.estimatedTotal) {
      const progress = this.getProgress();
      const remaining = this.getEstimatedRemaining();

      display += ` ${this.createProgressBar(progress)}`;

      if (remaining !== null && remaining > 0) {
        display += chalk.dim(` • ~${remaining}s left`);
      }
    }

    // Overwrite previous line
    process.stderr.write('\r' + display + ' '.repeat(20));
  }

  /**
   * Show completion message
   */
  private showCompletionMessage(): void {
    const elapsed = this.getElapsedSeconds();
    const throughput = Math.round(this.getThroughput());

    // Clear the streaming line
    process.stderr.write('\r' + ' '.repeat(100) + '\r');

    // Show summary
    const summary = chalk.green('✓ Streaming complete') +
      chalk.dim(` • ${this.metrics.tokensReceived} tokens in ${elapsed}s (${throughput} tok/s)`);

    process.stderr.write(summary + '\n');
  }

  /**
   * Get spinner animation frame
   */
  private getSpinnerFrame(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.animationFrame = (this.animationFrame + 1) % frames.length;
    return chalk.cyan(frames[this.animationFrame]);
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(progress: number): string {
    const width = 15;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    return chalk.cyan('[') +
      chalk.green('█'.repeat(filled)) +
      chalk.dim('░'.repeat(empty)) +
      chalk.cyan(']') +
      chalk.bold(` ${progress}%`);
  }
}

/**
 * Simple streaming indicator (lightweight alternative)
 */
export class SimpleStreamingIndicator {
  private dotCount: number = 0;
  private interval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  start(): void {
    if (this.isActive) return;
    if (process.env.AUTOMATOSX_QUIET === 'true') return;

    this.isActive = true;
    process.stderr.write(chalk.cyan('\n🔄 Streaming'));

    this.interval = setInterval(() => {
      this.dotCount = (this.dotCount + 1) % 4;
      const dots = '.'.repeat(this.dotCount);
      const spaces = ' '.repeat(3 - this.dotCount);
      process.stderr.write(`\r🔄 Streaming${dots}${spaces}`);
    }, 500);
    // v12.5.3: Prevent blocking process exit
    if (this.interval.unref) this.interval.unref();
  }

  stop(): void {
    if (!this.isActive) return;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    process.stderr.write('\r' + ' '.repeat(20) + '\r');
    process.stderr.write(chalk.green('✓ Complete!\n'));
    this.isActive = false;
  }

  /**
   * Cleanup resources without showing completion message
   *
   * BUG FIX: Added destroy() method for cleanup when stop() may not be called
   * (e.g., due to an error during streaming). This prevents the interval
   * timer from running indefinitely, causing a resource leak.
   */
  destroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isActive = false;
  }
}

/**
 * Create appropriate feedback based on environment
 */
export function createStreamingFeedback(
  estimatedTotalTokens?: number,
  useSimple: boolean = false
): StreamingFeedback | SimpleStreamingIndicator {
  // Use simple indicator if quiet mode or explicitly requested
  if (useSimple || process.env.AUTOMATOSX_QUIET === 'true') {
    return new SimpleStreamingIndicator();
  }

  return new StreamingFeedback(estimatedTotalTokens);
}
