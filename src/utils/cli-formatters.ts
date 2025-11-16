/**
 * CLI output formatting utilities
 * Shared utilities for consistent CLI output formatting
 */

import chalk from 'chalk';

/**
 * Constants for CLI formatting
 */
const SEPARATOR_WIDTH = 80;

/**
 * Format options for list output
 */
export type OutputFormat = 'table' | 'json' | 'list';

/**
 * Output array as JSON
 */
export function outputAsJson(data: any[]): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Output array as simple list
 */
export function outputAsList(data: string[]): void {
  data.forEach(item => console.log(item));
}

/**
 * Show empty results message
 */
export function showEmptyMessage(resourceType: string, setupCommand?: string): void {
  console.log(chalk.yellow(`\nNo ${resourceType} found\n`));
  if (setupCommand) {
    console.log(chalk.gray(`Run: ${setupCommand}\n`));
  }
}

/**
 * Show section header
 */
export function showSectionHeader(title: string): void {
  console.log(chalk.bold(`\n${title}\n`));
  console.log('─'.repeat(SEPARATOR_WIDTH));
}

/**
 * Show section footer with total count
 */
export function showSectionFooter(count: number, resourceType: string): void {
  console.log('\n' + '─'.repeat(SEPARATOR_WIDTH));
  console.log(chalk.gray(`Total: ${count} ${resourceType}\n`));
}

/**
 * Handle standard output format selection
 */
export async function handleOutputFormat<T>(
  data: T[],
  format: OutputFormat | undefined,
  defaultFormatter: () => void | Promise<void>
): Promise<void> {
  if (format === 'json') {
    outputAsJson(data);
    return;
  }

  if (format === 'list' && data.length > 0 && typeof data[0] === 'string') {
    outputAsList(data as string[]);
    return;
  }

  // Use default table/custom formatter (may be async)
  await defaultFormatter();
}
