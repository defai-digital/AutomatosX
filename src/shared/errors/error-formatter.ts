/**
 * Error Formatter - Format errors for CLI display
 *
 * Provides consistent, user-friendly error formatting with:
 * - Color-coded output
 * - Error code display
 * - Actionable suggestions
 * - Context information (in debug mode)
 */

import chalk from 'chalk';
import type { BaseError } from './errors.js';
import { toBaseError } from './errors.js';

export interface FormatOptions {
  /**
   * Show verbose error details (stack trace, context)
   */
  verbose?: boolean;

  /**
   * Show error code
   */
  showCode?: boolean;

  /**
   * Show suggestions
   */
  showSuggestions?: boolean;

  /**
   * Use colors in output
   */
  colors?: boolean;
}

/**
 * Format error for CLI display
 */
export function formatError(error: unknown, options: FormatOptions = {}): string {
  const {
    verbose = false,
    showCode = true,
    showSuggestions = true,
    colors = true
  } = options;

  const baseError = toBaseError(error);
  const lines: string[] = [];

  // Header
  const header = colors
    ? chalk.red.bold('\n❌ Error')
    : '\n✗ Error';
  lines.push(header);

  // Error code
  if (showCode) {
    const codeText = colors
      ? chalk.gray(`[${baseError.code}]`)
      : `[${baseError.code}]`;
    lines.push(codeText);
  }

  // Error message
  const message = colors
    ? chalk.red(baseError.message)
    : baseError.message;
  lines.push('\n' + message);

  // Suggestions
  if (showSuggestions && baseError.suggestions.length > 0) {
    lines.push('');
    const suggestionsHeader = colors
      ? chalk.cyan('💡 Suggestions:')
      : 'Suggestions:';
    lines.push(suggestionsHeader);

    baseError.suggestions.forEach((suggestion, i) => {
      const bullet = colors
        ? chalk.gray(`  ${i + 1}.`)
        : `  ${i + 1}.`;
      lines.push(`${bullet} ${suggestion}`);
    });
  }

  // Context (verbose mode)
  if (verbose && baseError.context) {
    lines.push('');
    const contextHeader = colors
      ? chalk.gray('📋 Context:')
      : 'Context:';
    lines.push(contextHeader);

    const contextStr = JSON.stringify(baseError.context, null, 2);
    const formatted = colors
      ? chalk.gray(contextStr.split('\n').map(line => '  ' + line).join('\n'))
      : contextStr.split('\n').map(line => '  ' + line).join('\n');
    lines.push(formatted);
  }

  // Stack trace (verbose mode)
  if (verbose && baseError.stack) {
    lines.push('');
    const stackHeader = colors
      ? chalk.gray('🔍 Stack Trace:')
      : 'Stack Trace:';
    lines.push(stackHeader);

    // Safely handle stack trace - ensure it exists and is a string
    const stackStr = baseError.stack && typeof baseError.stack === 'string' ? baseError.stack : '';
    const stack = stackStr.split('\n').slice(1); // Skip first line (message)
    const formatted = colors
      ? chalk.gray(stack.map(line => '  ' + line).join('\n'))
      : stack.map(line => '  ' + line).join('\n');
    lines.push(formatted);
  }

  // Footer
  lines.push('');

  return lines.join('\n');
}

/**
 * Format error for JSON output
 */
export function formatErrorJSON(error: unknown): string {
  const baseError = toBaseError(error);
  return JSON.stringify(baseError.toJSON(), null, 2);
}

/**
 * Format error summary (one line)
 */
export function formatErrorSummary(error: unknown, options: FormatOptions = {}): string {
  const { colors = true } = options;
  const baseError = toBaseError(error);

  const code = colors
    ? chalk.gray(`[${baseError.code}]`)
    : `[${baseError.code}]`;

  const message = colors
    ? chalk.red(baseError.message)
    : baseError.message;

  return `${code} ${message}`;
}

/**
 * Format multiple errors as a list
 */
export function formatErrorList(errors: unknown[], options: FormatOptions = {}): string {
  const { colors = true } = options;
  const lines: string[] = [];

  const header = colors
    ? chalk.red.bold(`\n❌ ${errors.length} Error(s) Occurred\n`)
    : `\n✗ ${errors.length} Error(s) Occurred\n`;
  lines.push(header);

  errors.forEach((error, i) => {
    const baseError = toBaseError(error);
    const num = colors
      ? chalk.gray(`${i + 1}.`)
      : `${i + 1}.`;
    const summary = formatErrorSummary(baseError, { colors });
    lines.push(`${num} ${summary}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Print error to console
 */
export function printError(error: unknown, options: FormatOptions = {}): void {
  const formatted = formatError(error, options);
  console.error(formatted);
}

/**
 * Print error summary to console
 */
export function printErrorSummary(error: unknown, options: FormatOptions = {}): void {
  const formatted = formatErrorSummary(error, options);
  console.error(formatted);
}

/**
 * Print multiple errors to console
 */
export function printErrorList(errors: unknown[], options: FormatOptions = {}): void {
  const formatted = formatErrorList(errors, options);
  console.error(formatted);
}
