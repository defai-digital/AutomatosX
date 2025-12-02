/**
 * Iterate Status Renderer (v8.6.0)
 *
 * Renders real-time status updates for iterate mode execution.
 * Displays classification results, safety checks, budget usage, and actions taken.
 *
 * @module cli/renderers/iterate-status-renderer
 * @since v8.6.0
 */

import chalk from 'chalk';
import type { Classification, IterateStats, IterateAction } from '../../types/iterate.js';
import type { ExecutionResponse } from '../../types/provider.js';

/**
 * Status Event Types
 */
export type IterateStatusEvent =
  | { type: 'classification'; classification: Classification; response: ExecutionResponse }
  | { type: 'action'; action: IterateAction; stats: IterateStats }
  | { type: 'budget-warning'; budgetType: 'time' | 'tokens' | 'iterations'; percentUsed: number }
  | { type: 'iteration-complete'; stats: IterateStats };

/**
 * Iterate Status Renderer
 *
 * Handles terminal rendering for iterate mode status updates.
 *
 * Features:
 * - Classification display with confidence scores
 * - Action taken (continue/pause/stop/retry)
 * - Budget usage indicators (time, tokens, iterations)
 * - Color-coded output based on status
 * - Compact, single-line updates for minimal noise
 *
 * @example
 * ```typescript
 * const renderer = new IterateStatusRenderer({ quiet: false });
 *
 * renderer.handleEvent({
 *   type: 'classification',
 *   classification: { type: 'confirmation_prompt', confidence: 0.95 },
 *   response: { ... }
 * });
 *
 * renderer.handleEvent({
 *   type: 'action',
 *   action: { type: 'continue', reason: 'Auto-responding' },
 *   stats: { ... }
 * });
 * ```
 */
export class IterateStatusRenderer {
  private quiet = false;
  private verbose = false;

  /**
   * Create IterateStatusRenderer
   *
   * @param options - Renderer options
   */
  constructor(options: { quiet?: boolean; verbose?: boolean } = {}) {
    this.quiet = options.quiet || false;
    this.verbose = options.verbose || false;
  }

  /**
   * Handle status event
   *
   * Routes events to appropriate handlers based on type.
   *
   * @param event - Status event to handle
   */
  handleEvent(event: IterateStatusEvent): void {
    if (this.quiet) return;

    switch (event.type) {
      case 'classification':
        this.handleClassification(event.classification, event.response);
        break;

      case 'action':
        this.handleAction(event.action, event.stats);
        break;

      case 'budget-warning':
        this.handleBudgetWarning(event.budgetType, event.percentUsed);
        break;

      case 'iteration-complete':
        this.handleIterationComplete(event.stats);
        break;
    }
  }

  /**
   * Handle classification event
   *
   * Displays classification result with confidence score.
   *
   * @param classification - Classification result
   * @param response - Provider response
   * @private
   */
  private handleClassification(classification: Classification, response: ExecutionResponse): void {
    const { type, confidence, method } = classification;

    // Color based on confidence
    let confidenceColor = chalk.gray;
    if (confidence >= 0.90) confidenceColor = chalk.green;
    else if (confidence >= 0.75) confidenceColor = chalk.yellow;
    else confidenceColor = chalk.red;

    // Format classification type
    const typeLabel = this.formatClassificationType(type);
    const confidenceStr = confidenceColor(`${(confidence * 100).toFixed(0)}%`);
    const methodStr = method === 'cache' ? chalk.cyan('[cached]') : chalk.gray(`[${method}]`);

    // Compact output
    console.log(
      chalk.dim('[Iterate]') +
      ' ' +
      chalk.bold(typeLabel) +
      ' ' +
      confidenceStr +
      ' ' +
      methodStr
    );

    // Verbose: show response preview
    if (this.verbose && response.content) {
      const preview = response.content.substring(0, 80).replace(/\n/g, ' ');
      console.log(chalk.dim(`  └─ "${preview}${response.content.length > 80 ? '...' : ''}"`));
    }
  }

  /**
   * Handle action event
   *
   * Displays action taken and budget status.
   *
   * @param action - Action taken
   * @param stats - Current iterate stats
   * @private
   */
  private handleAction(action: IterateAction, stats: IterateStats): void {
    // Action label with color
    let actionLabel: string;
    switch (action.type) {
      case 'continue':
        actionLabel = chalk.green('✓ Continue');
        break;
      case 'pause':
        actionLabel = chalk.yellow('⏸ Pause');
        break;
      case 'stop':
        actionLabel = chalk.red('⏹ Stop');
        break;
      case 'retry':
        actionLabel = chalk.blue('↻ Retry');
        break;
      case 'no_op':
        actionLabel = chalk.dim('○ No Action');
        break;
      default:
        actionLabel = chalk.gray(`? ${action.type}`);
    }

    // Budget display
    const budgetStr = this.formatBudget(stats);

    // Compact output
    console.log(
      chalk.dim('[Iterate]') +
      ' ' +
      actionLabel +
      ' ' +
      chalk.dim('│') +
      ' ' +
      budgetStr
    );

    // Show reason if verbose or if paused/stopped
    if ((this.verbose || action.type === 'pause' || action.type === 'stop') && action.reason) {
      console.log(chalk.dim(`  └─ ${action.reason}`));
    }
  }

  /**
   * Handle budget warning event
   *
   * Displays warning when budget thresholds are reached.
   *
   * @param budgetType - Type of budget (time/tokens/iterations)
   * @param percentUsed - Percentage of budget used
   * @private
   */
  private handleBudgetWarning(budgetType: 'time' | 'tokens' | 'iterations', percentUsed: number): void {
    const percent = Math.round(percentUsed);
    const icon = percent >= 90 ? '⚠️ ' : '⚡';
    const color = percent >= 90 ? chalk.red : chalk.yellow;

    console.log(
      chalk.dim('[Iterate]') +
      ' ' +
      color(`${icon} ${budgetType.toUpperCase()} budget at ${percent}%`)
    );
  }

  /**
   * Handle iteration complete event
   *
   * Displays iteration complete with summary.
   *
   * @param stats - Final iterate stats
   * @private
   */
  private handleIterationComplete(stats: IterateStats): void {
    const { totalIterations, totalAutoResponses, totalTokens, durationMs } = stats;
    const durationMin = (durationMs / 1000 / 60).toFixed(1);

    console.log(
      chalk.dim('[Iterate]') +
      ' ' +
      chalk.green('✓ Complete') +
      ' ' +
      chalk.dim('│') +
      ' ' +
      chalk.white(`${totalIterations} iterations`) +
      ' ' +
      chalk.dim('│') +
      ' ' +
      chalk.white(`${totalAutoResponses} auto-responses`) +
      ' ' +
      chalk.dim('│') +
      ' ' +
      chalk.white(`${(totalTokens / 1000).toFixed(1)}k tokens`) +
      ' ' +
      chalk.dim('│') +
      ' ' +
      chalk.white(`${durationMin}min`)
    );
  }

  /**
   * Format classification type for display
   *
   * @param type - Classification type
   * @returns Formatted type label
   * @private
   */
  private formatClassificationType(type: string): string {
    switch (type) {
      case 'confirmation_prompt':
        return chalk.blue('Confirmation');
      case 'status_update':
        return chalk.cyan('Status Update');
      case 'genuine_question':
        return chalk.magenta('Question');
      case 'blocking_request':
        return chalk.yellow('Blocking Request');
      case 'error_signal':
        return chalk.red('Error');
      case 'completion_signal':
        return chalk.green('Complete');
      case 'rate_limit_or_context':
        return chalk.yellow('Rate Limit');
      default:
        return chalk.gray(type.replace(/_/g, ' '));
    }
  }

  /**
   * Format budget status for display
   *
   * @param stats - Current iterate stats
   * @returns Formatted budget string
   * @private
   */
  private formatBudget(stats: IterateStats): string {
    const parts: string[] = [];

    // Tokens (v9.0.0)
    const tokensStr = chalk.white(`${(stats.totalTokens / 1000).toFixed(1)}k`);
    parts.push(tokensStr);

    // Iterations
    const iterStr = chalk.white(`${stats.totalIterations}it`);
    parts.push(iterStr);

    // Duration
    const durationMin = (stats.durationMs / 1000 / 60).toFixed(1);
    const timeStr = chalk.white(`${durationMin}m`);
    parts.push(timeStr);

    return parts.join(chalk.dim(' · '));
  }

  /**
   * Render summary at end of execution
   *
   * Displays final statistics with classification breakdown.
   *
   * @param stats - Final iterate stats
   */
  renderSummary(stats: IterateStats): void {
    if (this.quiet) return;

    console.log(''); // Blank line
    console.log(chalk.bold.white('━━━ Iterate Mode Summary ━━━'));
    console.log('');

    // Overview
    console.log(chalk.dim('Total Iterations:    ') + chalk.white(stats.totalIterations.toString()));
    console.log(chalk.dim('Auto-Responses:      ') + chalk.white(stats.totalAutoResponses.toString()));
    console.log(chalk.dim('User Interventions:  ') + chalk.white(stats.totalUserInterventions.toString()));
    console.log(chalk.dim('Success Rate:        ') + chalk.white((stats.successRate * 100).toFixed(1) + '%'));
    console.log('');

    // Budget
    console.log(chalk.dim('Total Tokens:        ') + chalk.white((stats.totalTokens / 1000).toFixed(1) + 'k tokens'));
    const durationMin = (stats.durationMs / 1000 / 60).toFixed(1);
    console.log(chalk.dim('Duration:            ') + chalk.white(durationMin + ' minutes'));
    console.log(chalk.dim('Avg Classification:  ') + chalk.white(stats.avgClassificationLatencyMs + 'ms'));
    console.log('');

    // Classification breakdown
    if (Object.keys(stats.classificationBreakdown).length > 0) {
      console.log(chalk.bold('Classification Breakdown:'));
      for (const [type, count] of Object.entries(stats.classificationBreakdown)) {
        if (count > 0) {
          const percent = ((count / stats.totalIterations) * 100).toFixed(0);
          const label = this.formatClassificationType(type);
          console.log(chalk.dim('  • ') + label + chalk.dim(` (${count}, ${percent}%)`));
        }
      }
      console.log('');
    }

    // Stop reason
    const stopReasonLabel = this.formatStopReason(stats.stopReason);
    console.log(chalk.dim('Stop Reason:         ') + stopReasonLabel);
    console.log('');
  }

  /**
   * Format stop reason for display
   *
   * @param reason - Stop reason
   * @returns Formatted stop reason
   * @private
   */
  private formatStopReason(reason: string): string {
    switch (reason) {
      case 'completion':
        return chalk.green('Task Completed');
      case 'timeout':
        return chalk.yellow('Time Limit Exceeded');
      case 'token_limit':
        return chalk.yellow('Token Limit Exceeded');
      case 'user_interrupt':
        return chalk.blue('User Interrupted');
      case 'error':
        return chalk.red('Error Occurred');
      default:
        return chalk.gray(reason);
    }
  }
}
