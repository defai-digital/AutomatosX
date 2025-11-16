/**
 * Simple logger shim for CLI commands
 * Provides consistent colored logging across AutomatosX commands
 */

import chalk from 'chalk';

export const logger = {
  /**
   * Log informational message (blue)
   */
  info: (message: string, metadata?: unknown): void => {
    console.log(chalk.blue('ℹ'), message);
    if (metadata && (process.env.DEBUG || process.env.AUTOMATOSX_DEBUG)) {
      console.log(chalk.gray('  Metadata:'), metadata);
    }
  },

  /**
   * Log success message (green)
   */
  success: (message: string, metadata?: unknown): void => {
    console.log(chalk.green('✓'), message);
    if (metadata && (process.env.DEBUG || process.env.AUTOMATOSX_DEBUG)) {
      console.log(chalk.gray('  Metadata:'), metadata);
    }
  },

  /**
   * Log warning message (yellow)
   */
  warn: (message: string, metadata?: unknown): void => {
    console.warn(chalk.yellow('⚠'), message);
    if (metadata && (process.env.DEBUG || process.env.AUTOMATOSX_DEBUG)) {
      console.warn(chalk.gray('  Metadata:'), metadata);
    }
  },

  /**
   * Log error message (red)
   */
  error: (message: string, metadata?: unknown): void => {
    console.error(chalk.red('✗'), message);
    if (metadata && (process.env.DEBUG || process.env.AUTOMATOSX_DEBUG)) {
      console.error(chalk.gray('  Metadata:'), metadata);
    }
  },

  /**
   * Log debug message (gray, only if DEBUG env var set)
   */
  debug: (message: string, metadata?: unknown): void => {
    if (process.env.DEBUG || process.env.AUTOMATOSX_DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message);
      if (metadata) {
        console.log(chalk.gray('  Metadata:'), metadata);
      }
    }
  },

  /**
   * Log plain message without icon
   */
  log: (message: string): void => {
    console.log(message);
  },
};
