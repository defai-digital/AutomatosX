/**
 * CLI Output Utilities
 *
 * Provides consistent formatting for CLI output including
 * tables, JSON, and styled messages.
 *
 * @module @ax/cli/utils/output
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import figures from 'figures';
import {
  formatBytes as formatBytesBase,
  formatDuration as formatDurationBase,
  formatRelativeTime as formatRelativeTimeBase,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
} from '@ax/schemas';

// =============================================================================
// Types
// =============================================================================

export interface TableOptions {
  head: string[];
  colWidths?: number[];
  style?: {
    head?: string[];
    border?: string[];
  };
}

// =============================================================================
// Symbols
// =============================================================================

export const symbols = {
  success: chalk.green(figures.tick),
  error: chalk.red(figures.cross),
  warning: chalk.yellow(figures.warning),
  info: chalk.blue(figures.info),
  arrow: chalk.cyan(figures.arrowRight),
  bullet: chalk.gray(figures.bullet),
  pointer: chalk.cyan(figures.pointer),
};

// =============================================================================
// Message Formatting
// =============================================================================

/**
 * Print success message
 */
export function success(message: string): void {
  console.log(`${symbols.success} ${chalk.green(message)}`);
}

/**
 * Print error message
 */
export function error(message: string, details?: string): void {
  console.error(`${symbols.error} ${chalk.red(message)}`);
  if (details) {
    console.error(chalk.gray(`  ${details}`));
  }
}

/**
 * Print warning message
 */
export function warning(message: string): void {
  console.warn(`${symbols.warning} ${chalk.yellow(message)}`);
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.log(`${symbols.info} ${chalk.blue(message)}`);
}

/**
 * Print a header
 */
export function header(title: string): void {
  console.log();
  console.log(chalk.bold.cyan(title));
  console.log(chalk.gray('─'.repeat(title.length)));
}

/**
 * Print a section header
 */
export function section(title: string): void {
  console.log();
  console.log(chalk.bold(title));
}

/**
 * Print a key-value pair
 */
export function keyValue(key: string, value: string | number | boolean): void {
  console.log(`  ${chalk.gray(key + ':')} ${value}`);
}

/**
 * Print a list item
 */
export function listItem(item: string, indent = 0): void {
  const padding = '  '.repeat(indent);
  console.log(`${padding}${symbols.bullet} ${item}`);
}

// =============================================================================
// Table Formatting
// =============================================================================

/**
 * Create and print a table
 */
export function table(data: string[][], options: TableOptions): void {
  const tableConfig: {
    head: string[];
    colWidths?: (number | null)[];
    style: { head: string[]; border: string[] };
  } = {
    head: options.head.map(h => chalk.cyan(h)),
    style: {
      head: options.style?.head ?? ['cyan'],
      border: options.style?.border ?? ['gray'],
    },
  };
  if (options.colWidths) {
    tableConfig.colWidths = options.colWidths;
  }
  const tableInstance = new Table(tableConfig);

  for (const row of data) {
    tableInstance.push(row);
  }

  console.log(tableInstance.toString());
}

/**
 * Print data as a simple list table
 */
export function simpleTable(headers: string[], rows: string[][]): void {
  const tableInstance = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: {
      head: ['cyan'],
      border: ['gray'],
    },
  });

  for (const row of rows) {
    tableInstance.push(row);
  }

  console.log(tableInstance.toString());
}

// =============================================================================
// JSON Output
// =============================================================================

/**
 * Print data as formatted JSON
 */
export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print data as compact JSON
 */
export function jsonCompact(data: unknown): void {
  console.log(JSON.stringify(data));
}

// =============================================================================
// Status Formatting
// =============================================================================

/**
 * Format a status badge
 */
export function statusBadge(status: string): string {
  const statusMap: Record<string, string> = {
    healthy: chalk.green('HEALTHY'),
    unhealthy: chalk.red('UNHEALTHY'),
    active: chalk.green('ACTIVE'),
    paused: chalk.yellow('PAUSED'),
    completed: chalk.blue('COMPLETED'),
    failed: chalk.red('FAILED'),
    cancelled: chalk.gray('CANCELLED'),
    pending: chalk.yellow('PENDING'),
    running: chalk.cyan('RUNNING'),
    enabled: chalk.green('ENABLED'),
    disabled: chalk.gray('DISABLED'),
  };

  return statusMap[status.toLowerCase()] ?? chalk.gray(status.toUpperCase());
}

/**
 * Format a provider type
 */
export function providerBadge(provider: string): string {
  const providerMap: Record<string, string> = {
    claude: chalk.magenta('Claude'),
    gemini: chalk.blue('Gemini'),
    'ax-cli': chalk.cyan('ax-cli'),
    openai: chalk.green('OpenAI'),
  };

  return providerMap[provider.toLowerCase()] ?? provider;
}

/**
 * Format duration in milliseconds to human readable
 * Uses shared formatter with CLI-specific formatting for longer durations
 */
export function formatDuration(ms: number): string {
  if (ms < MS_PER_MINUTE) return formatDurationBase(ms);
  if (ms < MS_PER_HOUR) {
    const mins = Math.floor(ms / MS_PER_MINUTE);
    const secs = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(ms / MS_PER_HOUR);
  const mins = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  return `${hours}h ${mins}m`;
}

/**
 * Format bytes to human readable
 */
export const formatBytes = formatBytesBase;

/**
 * Format a date to relative time
 */
export const formatRelativeTime = formatRelativeTimeBase;

// =============================================================================
// Progress & Dividers
// =============================================================================

/**
 * Print a divider line
 */
export function divider(char = '─', length = 60): void {
  console.log(chalk.gray(char.repeat(length)));
}

/**
 * Print an empty line
 */
export function newline(): void {
  console.log();
}

/**
 * Print completion message
 */
export function done(message = 'Done!'): void {
  console.log();
  success(message);
}
