/**
 * Message Formatter - Standardized CLI messages
 *
 * Provides consistent success/failure/info message formatting
 */

import chalk from 'chalk';

export interface MessageOptions {
  /**
   * Use colors
   */
  colors?: boolean;

  /**
   * Prefix with icon
   */
  icon?: boolean;
}

/**
 * Format success message
 */
export function formatSuccess(message: string, options: MessageOptions = {}): string {
  const { colors = true, icon = true } = options;

  const iconStr = icon ? '✓ ' : '';

  return colors
    ? chalk.green(`${iconStr}${message}`)
    : `${iconStr}${message}`;
}

/**
 * Format failure message
 */
export function formatFailure(message: string, options: MessageOptions = {}): string {
  const { colors = true, icon = true } = options;

  const iconStr = icon ? '✗ ' : '';

  return colors
    ? chalk.red(`${iconStr}${message}`)
    : `${iconStr}${message}`;
}

/**
 * Format warning message
 */
export function formatWarning(message: string, options: MessageOptions = {}): string {
  const { colors = true, icon = true } = options;

  const iconStr = icon ? '⚠ ' : '';

  return colors
    ? chalk.yellow(`${iconStr}${message}`)
    : `${iconStr}${message}`;
}

/**
 * Format info message
 */
export function formatInfo(message: string, options: MessageOptions = {}): string {
  const { colors = true, icon = true } = options;

  const iconStr = icon ? 'ℹ ' : '';

  return colors
    ? chalk.blue(`${iconStr}${message}`)
    : `${iconStr}${message}`;
}

/**
 * Print success message
 */
export function printSuccess(message: string, options: MessageOptions = {}): void {
  console.log(formatSuccess(message, options));
}

/**
 * Print failure message
 */
export function printFailure(message: string, options: MessageOptions = {}): void {
  console.log(formatFailure(message, options));
}

/**
 * Print warning message
 */
export function printWarning(message: string, options: MessageOptions = {}): void {
  console.log(formatWarning(message, options));
}

/**
 * Print info message
 */
export function printInfo(message: string, options: MessageOptions = {}): void {
  console.log(formatInfo(message, options));
}

/**
 * Format step message (for multi-step operations)
 */
export function formatStep(step: string, options: MessageOptions = {}): string {
  const { colors = true } = options;

  return colors
    ? chalk.gray(`   ${step}`)
    : `   ${step}`;
}

/**
 * Format section header
 */
export function formatHeader(header: string, options: MessageOptions = {}): string {
  const { colors = true } = options;

  return colors
    ? chalk.bold.cyan(`\n${header}`)
    : `\n${header}`;
}

/**
 * Format key-value pair
 */
export function formatKeyValue(key: string, value: string, options: MessageOptions = {}): string {
  const { colors = true } = options;

  const formattedKey = colors ? chalk.gray(`${key}:`) : `${key}:`;
  const formattedValue = colors ? chalk.white(value) : value;

  return `${formattedKey} ${formattedValue}`;
}

/**
 * Print completion message with stats
 */
export function printCompletion(
  message: string,
  stats: Record<string, string | number>,
  options: MessageOptions = {}
): void {
  printSuccess(message, options);

  Object.entries(stats).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
}
