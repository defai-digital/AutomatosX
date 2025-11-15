/**
 * AutomatosX v8.0.0 - Table Formatter
 *
 * Rich ASCII table formatting for CLI output using cli-table3
 */

import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Table column definition
 */
export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  color?: (value: string) => string;
}

/**
 * Table options
 */
export interface TableOptions {
  title?: string;
  compact?: boolean;
  showHeader?: boolean;
}

/**
 * Table Formatter
 *
 * Creates formatted ASCII tables with Unicode box drawing characters
 * Supports colors, alignment, and custom formatting
 */
export class TableFormatter {
  /**
   * Create formatted ASCII table
   * @param columns - Column definitions
   * @param rows - Data rows
   * @param options - Table styling options
   */
  createTable(
    columns: TableColumn[],
    rows: Record<string, unknown>[],
    options: TableOptions = {}
  ): string {
    const table = new Table({
      head: options.showHeader !== false
        ? columns.map(col => chalk.cyan.bold(col.header))
        : undefined,
      colWidths: columns.map(col => col.width ?? null),
      colAligns: columns.map(col => col.align || 'left') as Array<'left' | 'center' | 'right'>,
      chars: this.getTableChars(options.compact || false),
      style: {
        head: [],
        border: []
      }
    });

    // Add rows
    rows.forEach(row => {
      const formattedRow = columns.map(col => {
        const value = String(row[col.key] ?? '');
        return col.color ? col.color(value) : value;
      });
      table.push(formattedRow);
    });

    let output = '';

    if (options.title) {
      output += chalk.bold.white(`\n${options.title}\n`);
    }

    output += table.toString();

    return output;
  }

  /**
   * Create simple two-column key-value table
   */
  createKeyValueTable(data: Record<string, string | number>, options: TableOptions = {}): string {
    const table = new Table({
      chars: this.getTableChars(options.compact || false),
      style: { head: [], border: [] }
    });

    Object.entries(data).forEach(([key, value]) => {
      const row: Record<string, string> = {};
      row[chalk.cyan.bold(key)] = String(value);
      table.push(row);
    });

    let output = '';

    if (options.title) {
      output += chalk.bold.white(`\n${options.title}\n`);
    }

    output += table.toString();

    return output;
  }

  /**
   * Create compact list (for small datasets)
   */
  createList(
    items: string[],
    options: {
      bullet?: string;
      color?: (s: string) => string;
      numbered?: boolean;
    } = {}
  ): string {
    const bullet = options.bullet || '•';
    const color = options.color || ((s: string) => s);

    return items
      .map((item, index) => {
        const prefix = options.numbered
          ? chalk.gray(`${index + 1}. `)
          : chalk.gray(`${bullet} `);
        return `${prefix}${color(item)}`;
      })
      .join('\n');
  }

  /**
   * Create horizontal separator
   */
  createSeparator(length: number = 60, char: string = '─'): string {
    return chalk.gray(char.repeat(length));
  }

  /**
   * Create section header
   */
  createHeader(text: string, level: 1 | 2 | 3 = 1): string {
    switch (level) {
      case 1:
        return chalk.bold.cyan(`\n╔═══ ${text} ═══╗\n`);
      case 2:
        return chalk.bold.white(`\n▸ ${text}\n`);
      case 3:
        return chalk.gray(`\n  ${text}\n`);
    }
  }

  /**
   * Format status indicator
   */
  formatStatus(status: string): string {
    const normalized = status.toLowerCase();

    if (normalized === 'active' || normalized === 'running' || normalized === 'success') {
      return chalk.green('●') + ' ' + chalk.green(status);
    }

    if (normalized === 'inactive' || normalized === 'stopped' || normalized === 'disabled') {
      return chalk.gray('○') + ' ' + chalk.gray(status);
    }

    if (normalized === 'error' || normalized === 'failed') {
      return chalk.red('✖') + ' ' + chalk.red(status);
    }

    if (normalized === 'warning' || normalized === 'pending') {
      return chalk.yellow('▲') + ' ' + chalk.yellow(status);
    }

    return chalk.white('•') + ' ' + chalk.white(status);
  }

  /**
   * Format percentage with color
   */
  formatPercentage(value: number): string {
    const formatted = `${value.toFixed(1)}%`;

    if (value >= 90) {
      return chalk.green(formatted);
    }

    if (value >= 70) {
      return chalk.yellow(formatted);
    }

    return chalk.red(formatted);
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  /**
   * Format duration
   */
  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }

    return `${seconds}s`;
  }

  /**
   * Get table border characters (Unicode box drawing)
   */
  private getTableChars(compact: boolean) {
    if (compact) {
      // Compact style (minimal borders)
      return {
        'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
        'right': '│', 'right-mid': '┤', 'middle': ' '
      };
    } else {
      // Full box drawing
      return {
        'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
        'right': '│', 'right-mid': '┤', 'middle': '│'
      };
    }
  }
}
