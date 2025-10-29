/**
 * Spec Progress Renderer - Phase 2B (v5.11.0)
 *
 * Renders real-time progress updates for spec execution.
 * Displays task lifecycle events with live feedback.
 *
 * @module cli/renderers/spec-progress-renderer
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import type { SpecExecutor } from '../../core/spec/SpecExecutor.js';
import type {
  SpecEvent,
  SpecStartedEvent,
  SpecCompletedEvent,
  SpecFailedEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  LevelStartedEvent,
  LevelCompletedEvent
} from '../../core/spec/SpecEventEmitter.js';

/**
 * Spec Progress Renderer
 *
 * Handles terminal rendering for spec execution events.
 * Features:
 * - Live task progress with status icons
 * - Level-based parallel execution visualization
 * - Success/error indicators with colors
 * - Real-time duration tracking
 * - Error diagnostics display
 */
export class SpecProgressRenderer {
  private executor: SpecExecutor;
  private spinner: Ora | null = null;
  private quiet: boolean;
  private taskCount = 0;
  private completedCount = 0;
  private failedCount = 0;
  private currentLevel = 0;
  private taskStartTimes = new Map<string, number>();

  /**
   * Create SpecProgressRenderer
   *
   * @param executor - SpecExecutor instance to listen to
   * @param options - Renderer options
   */
  constructor(executor: SpecExecutor, options: { quiet?: boolean } = {}) {
    this.executor = executor;
    this.quiet = options.quiet || false;

    // Subscribe to all events
    if (this.executor.events && !this.quiet) {
      this.executor.events.onAny((event: SpecEvent) => {
        this.handleEvent(event);
      });
    }
  }

  /**
   * Handle spec event
   *
   * Routes events to appropriate handlers based on type.
   *
   * @param event - Spec event to handle
   */
  private handleEvent(event: SpecEvent): void {
    switch (event.type) {
      case 'spec:started':
        this.handleSpecStart(event as SpecStartedEvent);
        break;

      case 'spec:completed':
        this.handleSpecComplete(event as SpecCompletedEvent);
        break;

      case 'spec:failed':
        this.handleSpecFailed(event as SpecFailedEvent);
        break;

      case 'task:started':
        this.handleTaskStart(event as TaskStartedEvent);
        break;

      case 'task:completed':
        this.handleTaskComplete(event as TaskCompletedEvent);
        break;

      case 'task:failed':
        this.handleTaskFailed(event as TaskFailedEvent);
        break;

      case 'level:started':
        this.handleLevelStart(event as LevelStartedEvent);
        break;

      case 'level:completed':
        this.handleLevelComplete(event as LevelCompletedEvent);
        break;

      // Other events: task:queued, task:progress, task:log, task:skipped, spec:progress
      // Can be handled here if needed
    }
  }

  /**
   * Handle spec:started event
   */
  private handleSpecStart(event: SpecStartedEvent): void {
    this.taskCount = event.totalTasks;
    this.completedCount = 0;
    this.failedCount = 0;

    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold(`  Running spec: ${event.specId}`));
    console.log(chalk.gray(`  Total tasks: ${event.totalTasks}`));
    console.log(chalk.gray(`  Mode: ${event.parallel ? 'parallel' : 'sequential'}`));
    console.log(chalk.gray(`  Workspace: ${event.workspacePath}`));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  /**
   * Handle spec:completed event
   */
  private handleSpecComplete(event: SpecCompletedEvent): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    const durationSec = (event.duration / 1000).toFixed(1);

    console.log('\n' + chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.green('  ✓ Spec completed successfully'));
    console.log(chalk.gray(`  Duration: ${durationSec}s`));
    console.log(chalk.gray(`  Completed: ${event.completedTasks}/${event.totalTasks}`));
    if (event.failedTasks > 0) {
      console.log(chalk.yellow(`  Failed: ${event.failedTasks}`));
    }
    if (event.skippedTasks > 0) {
      console.log(chalk.gray(`  Skipped: ${event.skippedTasks}`));
    }
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  /**
   * Handle spec:failed event
   */
  private handleSpecFailed(event: SpecFailedEvent): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    const durationSec = event.duration ? (event.duration / 1000).toFixed(1) : '0.0';

    console.log('\n' + chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.red('  ✗ Spec execution failed'));
    console.log(chalk.red(`  Error: ${event.error.message}`));
    if (event.error.taskId) {
      console.log(chalk.gray(`  Failed task: ${event.error.taskId}`));
    }
    console.log(chalk.gray(`  Duration: ${durationSec}s`));
    console.log(chalk.gray(`  Completed: ${event.completedTasks}/${event.failedTasks + event.completedTasks}`));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  /**
   * Handle level:started event
   */
  private handleLevelStart(event: LevelStartedEvent): void {
    this.currentLevel = event.level;

    if (this.spinner) {
      this.spinner.stop();
    }

    console.log(chalk.cyan(`\nLevel ${event.level + 1}/${event.totalLevels}:`));
    console.log(chalk.gray(`  ${event.taskCount} task(s) in parallel`));
  }

  /**
   * Handle level:completed event
   */
  private handleLevelComplete(event: LevelCompletedEvent): void {
    const durationSec = (event.duration / 1000).toFixed(1);
    const status = event.failedTasks > 0
      ? chalk.yellow(`✓ ${event.completedTasks} completed, ${event.failedTasks} failed`)
      : chalk.green(`✓ All ${event.completedTasks} task(s) completed`);

    console.log(chalk.gray(`  ${status} (${durationSec}s)\n`));
  }

  /**
   * Handle task:started event
   */
  private handleTaskStart(event: TaskStartedEvent): void {
    this.taskStartTimes.set(event.taskId, Date.now());

    // Update spinner or log
    const progress = `[${this.completedCount + this.failedCount + 1}/${this.taskCount}]`;
    const text = `${progress} ${event.taskTitle}`;

    if (this.spinner) {
      this.spinner.stop();
    }

    this.spinner = ora({
      text: chalk.blue(text),
      spinner: 'dots'
    }).start();
  }

  /**
   * Handle task:completed event
   */
  private handleTaskComplete(event: TaskCompletedEvent): void {
    this.completedCount++;

    const durationSec = (event.duration / 1000).toFixed(1);
    const progress = `[${this.completedCount + this.failedCount}/${this.taskCount}]`;

    if (this.spinner) {
      this.spinner.succeed(
        chalk.green(`${progress} ${event.taskTitle}`) + chalk.gray(` (${durationSec}s)`)
      );
      this.spinner = null;
    }
  }

  /**
   * Handle task:failed event
   */
  private handleTaskFailed(event: TaskFailedEvent): void {
    this.failedCount++;

    const durationSec = (event.duration / 1000).toFixed(1);
    const progress = `[${this.completedCount + this.failedCount}/${this.taskCount}]`;

    if (this.spinner) {
      this.spinner.fail(
        chalk.red(`${progress} ${event.taskTitle}`) + chalk.gray(` (${durationSec}s)`)
      );
      this.spinner = null;
    }

    // Display error details
    console.log(chalk.red(`  Error: ${event.error.message}`));
    if (event.error.stack && process.env.DEBUG) {
      console.log(chalk.gray(`  Stack: ${event.error.stack.split('\n').slice(0, 3).join('\n')}`));
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
}
