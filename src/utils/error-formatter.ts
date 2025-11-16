/**
 * Error formatter for CLI commands
 * Provides consistent error display with context and stack traces
 */

import chalk from 'chalk';
import type { ErrorEnvelope } from './ErrorEnvelope.js';

/**
 * Type guard to check if error is ErrorEnvelope
 */
function isErrorEnvelope(error: unknown): error is ErrorEnvelope {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as { error: unknown }).error === 'object'
  );
}

/**
 * Print error to console with formatting
 * Handles ErrorEnvelope, Error, and unknown error types
 */
export function printError(error: unknown): void {
  if (isErrorEnvelope(error)) {
    // ErrorEnvelope with structured context
    console.error(chalk.red.bold('\n✗ Error:'), error.error.message);

    if (error.error.details) {
      console.error(chalk.gray('  Details:'), JSON.stringify(error.error.details, null, 2));
    }

    if (error.error.suggestions && error.error.suggestions.length > 0) {
      console.error(chalk.yellow('\n  Suggestions:'));
      error.error.suggestions.forEach((suggestion) => {
        console.error(chalk.yellow('  • '), suggestion);
      });
    }

    // Show stack trace in debug mode
    if ((process.env.DEBUG || process.env.AUTOMATOSX_DEBUG) && error.error.stackTrace) {
      console.error(chalk.gray('\n  Stack trace:'));
      console.error(chalk.gray(error.error.stackTrace));
    }
  } else if (error instanceof Error) {
    // Standard Error object
    console.error(chalk.red.bold('\n✗ Error:'), error.message);

    // Show stack trace in debug mode
    if ((process.env.DEBUG || process.env.AUTOMATOSX_DEBUG) && error.stack) {
      console.error(chalk.gray('\n  Stack trace:'));
      console.error(chalk.gray(error.stack));
    }
  } else {
    // Unknown error type
    console.error(chalk.red.bold('\n✗ Error:'), String(error));
  }

  console.error(); // Empty line for spacing
}

/**
 * Print warning to console with formatting
 */
export function printWarning(message: string): void {
  console.warn(chalk.yellow.bold('\n⚠ Warning:'), message);
  console.warn(); // Empty line for spacing
}

/**
 * Print info message to console with formatting
 */
export function printInfo(message: string): void {
  console.log(chalk.blue.bold('\nℹ Info:'), message);
  console.log(); // Empty line for spacing
}
