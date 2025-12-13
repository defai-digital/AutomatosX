/**
 * Severity Formatter - Shared severity formatting utilities
 *
 * Consolidates duplicate formatSeverity() functions from:
 * - src/cli/commands/bugfix.ts
 * - src/cli/commands/refactor.ts
 *
 * @since v12.8.5
 */

import chalk from 'chalk';

/**
 * Severity levels used across bugfix and refactor commands
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Format severity level with consistent colors
 *
 * @param severity - Severity level
 * @returns Formatted severity string with color
 */
export function formatSeverity(severity: Severity | string): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white(' CRITICAL ');
    case 'high':
      return chalk.red('[HIGH]');
    case 'medium':
      return chalk.yellow('[MED]');
    case 'low':
      return chalk.gray('[LOW]');
    default: {
      const s = severity as string;
      return `[${s.toUpperCase()}]`;
    }
  }
}

/**
 * Get severity color function for custom formatting
 *
 * @param severity - Severity level
 * @returns Chalk color function
 */
export function getSeverityColor(severity: Severity | string): typeof chalk.red {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white;
    case 'high':
      return chalk.red;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.gray;
    default:
      return chalk.white;
  }
}

/**
 * Get severity numeric weight for sorting
 *
 * @param severity - Severity level
 * @returns Numeric weight (higher = more severe)
 */
export function getSeverityWeight(severity: Severity | string): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}
