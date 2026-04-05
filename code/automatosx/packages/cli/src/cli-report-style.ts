export const REPORT_BOLD = '\x1b[1m';
export const REPORT_RESET = '\x1b[0m';
export const REPORT_DIM = '\x1b[2m';
export const REPORT_GREEN = '\x1b[32m';
export const REPORT_RED = '\x1b[31m';
export const REPORT_YELLOW = '\x1b[33m';
export const REPORT_CYAN = '\x1b[36m';

export const REPORT_CHECK = `${REPORT_GREEN}\u2713${REPORT_RESET}`;
export const REPORT_CROSS = `${REPORT_RED}\u2717${REPORT_RESET}`;
export const REPORT_WARN_ICON = `${REPORT_YELLOW}\u26A0${REPORT_RESET}`;

export function colorizeReport(text: string, color: string): string {
  return `${color}${text}${REPORT_RESET}`;
}
