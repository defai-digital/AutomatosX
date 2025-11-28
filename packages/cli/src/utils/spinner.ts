/**
 * CLI Spinner Utilities
 *
 * Provides loading spinners for long-running operations.
 *
 * @module @ax/cli/utils/spinner
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import ora, { type Ora } from 'ora';
import chalk from 'chalk';

// =============================================================================
// Spinner Management
// =============================================================================

let activeSpinner: Ora | null = null;

/**
 * Start a spinner with a message
 */
export function start(message: string): Ora {
  // Stop any existing spinner
  if (activeSpinner) {
    activeSpinner.stop();
  }

  activeSpinner = ora({
    text: message,
    color: 'cyan',
  }).start();

  return activeSpinner;
}

/**
 * Update spinner text
 */
export function update(message: string): void {
  if (activeSpinner) {
    activeSpinner.text = message;
  }
}

/**
 * Stop spinner with success
 */
export function succeed(message?: string): void {
  if (activeSpinner) {
    activeSpinner.succeed(message);
    activeSpinner = null;
  }
}

/**
 * Stop spinner with failure
 */
export function fail(message?: string): void {
  if (activeSpinner) {
    activeSpinner.fail(message);
    activeSpinner = null;
  }
}

/**
 * Stop spinner with warning
 */
export function warn(message?: string): void {
  if (activeSpinner) {
    activeSpinner.warn(message);
    activeSpinner = null;
  }
}

/**
 * Stop spinner with info
 */
export function info(message?: string): void {
  if (activeSpinner) {
    activeSpinner.info(message);
    activeSpinner = null;
  }
}

/**
 * Stop spinner (neutral)
 */
export function stop(): void {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
}

/**
 * Run an async operation with a spinner
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
  options?: {
    successMessage?: string;
    failMessage?: string;
  }
): Promise<T> {
  const spinner = start(message);

  try {
    const result = await operation();
    spinner.succeed(options?.successMessage);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    spinner.fail(options?.failMessage ?? `Failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Display a progress indicator
 */
export function progress(current: number, total: number, message?: string): void {
  // Prevent division by zero
  if (total <= 0) {
    if (activeSpinner) {
      activeSpinner.text = `${message ?? 'Progress'} ${chalk.cyan('░'.repeat(20))} 0%`;
    }
    return;
  }

  // Clamp percent to 0-100 range to prevent bar overflow
  const percentRaw = (current / total) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(percentRaw)));

  const filledCount = Math.floor(percent / 5);
  const emptyCount = Math.max(0, 20 - filledCount);
  const bar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);

  if (activeSpinner) {
    activeSpinner.text = `${message ?? 'Progress'} ${chalk.cyan(bar)} ${percent}%`;
  }
}
