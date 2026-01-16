/**
 * Terminal Utilities
 *
 * Shared ANSI color codes and icons for consistent CLI output.
 */

/**
 * ANSI color codes for terminal output
 */
export const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
} as const;

/**
 * Terminal output icons with color formatting
 */
export const ICONS = {
  check: `${COLORS.green}\u2713${COLORS.reset}`,
  cross: `${COLORS.red}\u2717${COLORS.reset}`,
  warn: `${COLORS.yellow}\u26A0${COLORS.reset}`,
  arrow: `${COLORS.cyan}\u2192${COLORS.reset}`,
  info: `${COLORS.cyan}\u2139${COLORS.reset}`,
  bullet: `${COLORS.dim}\u2022${COLORS.reset}`,
  discuss: `${COLORS.magenta}\u2630${COLORS.reset}`,
} as const;
