/**
 * Chart Renderer - ASCII Chart Utilities
 *
 * Provides CLI-friendly ASCII chart rendering for monitoring dashboards.
 * Supports line charts, bar charts, sparklines, and tables.
 *
 * @module ChartRenderer
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ChartOptions {
  width?: number;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  showAxis?: boolean;
  colorize?: boolean;
}

export interface BarChartOptions extends ChartOptions {
  maxBarWidth?: number;
  showPercentage?: boolean;
  showValue?: boolean;
}

export interface LineChartOptions extends ChartOptions {
  smooth?: boolean;
  showPoints?: boolean;
  xAxis?: string[];
}

export interface TableOptions {
  headers: string[];
  rows: string[][];
  alignments?: Array<'left' | 'center' | 'right'>;
  maxWidth?: number;
}

// ============================================================================
// Color Utilities
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// ============================================================================
// Chart Renderer Class
// ============================================================================

export class ChartRenderer {
  /**
   * Render a line chart
   */
  static lineChart(
    data: number[],
    options: LineChartOptions = {}
  ): string {
    const {
      width = 60,
      height = 10,
      title,
      xLabel,
      yLabel,
      showAxis = true,
      colorize: useColors = true,
      xAxis = [],
    } = options;

    if (data.length === 0) {
      return 'No data to display';
    }

    const lines: string[] = [];

    // Add title
    if (title) {
      lines.push(colorize(title, 'bold'));
      lines.push(colorize('━'.repeat(width + 10), 'gray'));
    }

    // Find min and max values
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Create y-axis labels
    const yLabels: string[] = [];
    for (let i = 0; i < height; i++) {
      const value = max - (i / (height - 1)) * range;
      yLabels.push(this.formatNumber(value));
    }

    const yLabelWidth = Math.max(...yLabels.map((l) => l.length));

    // Build chart
    const chart: string[][] = Array(height)
      .fill(null)
      .map(() => Array(width).fill(' '));

    // Plot data points
    const step = width / (data.length - 1 || 1);
    for (let i = 0; i < data.length; i++) {
      const x = Math.round(i * step);
      const normalizedValue = (data[i] - min) / range;
      const y = Math.round((1 - normalizedValue) * (height - 1));

      if (x >= 0 && x < width && y >= 0 && y < height) {
        chart[y][x] = '●';

        // Connect points with lines
        if (i > 0) {
          const prevX = Math.round((i - 1) * step);
          const prevNormalizedValue = (data[i - 1] - min) / range;
          const prevY = Math.round((1 - prevNormalizedValue) * (height - 1));

          this.drawLine(chart, prevX, prevY, x, y);
        }
      }
    }

    // Render chart with y-axis
    for (let i = 0; i < height; i++) {
      const yLabel = yLabels[i].padStart(yLabelWidth);
      const row = chart[i].join('');
      const axis = showAxis ? '┤' : ' ';

      if (useColors) {
        lines.push(`${colorize(yLabel, 'cyan')} ${colorize(axis, 'gray')} ${row}`);
      } else {
        lines.push(`${yLabel} ${axis} ${row}`);
      }
    }

    // Add x-axis
    if (showAxis) {
      const xAxisLine = ' '.repeat(yLabelWidth + 1) + '└' + '─'.repeat(width);
      lines.push(useColors ? colorize(xAxisLine, 'gray') : xAxisLine);

      // Add x-axis labels if provided
      if (xAxis.length > 0) {
        const labelStep = Math.max(1, Math.floor(xAxis.length / 4));
        const labelPositions: string[] = Array(width + yLabelWidth + 2).fill(' ');

        for (let i = 0; i < xAxis.length; i += labelStep) {
          const x = Math.round((i / (xAxis.length - 1 || 1)) * width) + yLabelWidth + 2;
          const label = xAxis[i];
          for (let j = 0; j < label.length && x + j < labelPositions.length; j++) {
            labelPositions[x + j] = label[j];
          }
        }

        lines.push(useColors ? colorize(labelPositions.join(''), 'gray') : labelPositions.join(''));
      }
    }

    // Add labels
    if (xLabel) {
      lines.push('');
      lines.push(
        ' '.repeat(yLabelWidth + width / 2 - xLabel.length / 2) +
          (useColors ? colorize(xLabel, 'gray') : xLabel)
      );
    }

    return lines.join('\n');
  }

  /**
   * Draw a line between two points using Bresenham's algorithm
   */
  private static drawLine(
    chart: string[][],
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      // Don't overwrite existing points
      if (
        x >= 0 &&
        x < chart[0].length &&
        y >= 0 &&
        y < chart.length &&
        chart[y][x] === ' '
      ) {
        // Use different characters for different line angles
        if (Math.abs(dy) > Math.abs(dx)) {
          chart[y][x] = '│';
        } else if (dx > 0) {
          chart[y][x] = '─';
        } else {
          chart[y][x] = '╌';
        }
      }

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Render a horizontal bar chart
   */
  static barChart(
    data: Array<{ label: string; value: number; color?: string }>,
    options: BarChartOptions = {}
  ): string {
    const {
      width = 60,
      title,
      maxBarWidth = 40,
      showPercentage = true,
      showValue = true,
      colorize: useColors = true,
    } = options;

    if (data.length === 0) {
      return 'No data to display';
    }

    const lines: string[] = [];

    // Add title
    if (title) {
      lines.push(colorize(title, 'bold'));
      lines.push(colorize('━'.repeat(width), 'gray'));
    }

    // Find max value for scaling
    const maxValue = Math.max(...data.map((d) => d.value));
    const total = data.reduce((sum, d) => sum + d.value, 0);

    // Find max label length
    const maxLabelLength = Math.max(...data.map((d) => d.label.length));

    // Render bars
    for (const item of data) {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const barLength = Math.round((item.value / maxValue) * maxBarWidth);
      const bar = '█'.repeat(barLength);

      // Format label and value
      const label = item.label.padEnd(maxLabelLength);
      const valueStr = showValue ? this.formatNumber(item.value) : '';
      const percentStr = showPercentage
        ? `(${percentage.toFixed(1)}%)`
        : '';

      // Colorize bar
      const coloredBar = useColors
        ? colorize(bar, (item.color as any) || 'cyan')
        : bar;

      // Build line
      const line = `  ${label}  ${coloredBar}  ${valueStr}  ${percentStr}`;
      lines.push(line);
    }

    return lines.join('\n');
  }

  /**
   * Render a sparkline (compact line chart)
   */
  static sparkline(data: number[]): string {
    if (data.length === 0) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const ticks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

    return data
      .map((value) => {
        const normalized = (value - min) / range;
        const index = Math.min(
          ticks.length - 1,
          Math.floor(normalized * ticks.length)
        );
        return ticks[index];
      })
      .join('');
  }

  /**
   * Render a table
   */
  static table(options: TableOptions): string {
    const {
      headers,
      rows,
      alignments = headers.map(() => 'left'),
      maxWidth = 100,
    } = options;

    const lines: string[] = [];

    // Calculate column widths
    const columnWidths = headers.map((header, i) => {
      const headerLength = header.length;
      const maxRowLength = Math.max(
        ...rows.map((row) => (row[i] || '').length)
      );
      return Math.max(headerLength, maxRowLength);
    });

    // Adjust widths to fit max width
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + columnWidths.length * 3;
    if (totalWidth > maxWidth) {
      const scale = maxWidth / totalWidth;
      for (let i = 0; i < columnWidths.length; i++) {
        columnWidths[i] = Math.floor(columnWidths[i] * scale);
      }
    }

    // Format cell
    const formatCell = (
      text: string,
      width: number,
      alignment: 'left' | 'center' | 'right'
    ): string => {
      const truncated = text.length > width ? text.substring(0, width - 3) + '...' : text;
      switch (alignment) {
        case 'left':
          return truncated.padEnd(width);
        case 'right':
          return truncated.padStart(width);
        case 'center':
          const leftPad = Math.floor((width - truncated.length) / 2);
          const rightPad = width - truncated.length - leftPad;
          return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);
      }
    };

    // Render header
    const headerLine = headers
      .map((header, i) => formatCell(header, columnWidths[i], alignments[i]))
      .join(' │ ');
    lines.push(colorize('│ ' + headerLine + ' │', 'bold'));

    // Render separator
    const separator = columnWidths.map((w) => '─'.repeat(w)).join('─┼─');
    lines.push(colorize('├─' + separator + '─┤', 'gray'));

    // Render rows
    for (const row of rows) {
      const rowLine = row
        .map((cell, i) => formatCell(cell, columnWidths[i], alignments[i]))
        .join(' │ ');
      lines.push('│ ' + rowLine + ' │');
    }

    // Add bottom border
    const bottomBorder = '─'.repeat(
      columnWidths.reduce((sum, w) => sum + w, 0) + columnWidths.length * 3 + 1
    );
    lines.push(colorize('└' + bottomBorder + '┘', 'gray'));

    return lines.join('\n');
  }

  /**
   * Render a progress bar
   */
  static progressBar(
    current: number,
    total: number,
    options: { width?: number; showPercentage?: boolean; label?: string } = {}
  ): string {
    const { width = 40, showPercentage = true, label } = options;

    const percentage = total > 0 ? (current / total) * 100 : 0;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentStr = showPercentage ? ` ${percentage.toFixed(1)}%` : '';
    const labelStr = label ? `${label}: ` : '';

    let color: keyof typeof colors = 'green';
    if (percentage >= 95) color = 'red';
    else if (percentage >= 80) color = 'yellow';

    return `${labelStr}${colorize(bar, color)}${percentStr}`;
  }

  /**
   * Render a status indicator
   */
  static statusIndicator(
    status: 'ok' | 'warning' | 'error' | 'info',
    text: string
  ): string {
    const icons = {
      ok: '✓',
      warning: '⚠',
      error: '✗',
      info: 'ℹ',
    };

    const statusColors: Record<string, keyof typeof colors> = {
      ok: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'cyan',
    };

    const icon = colorize(icons[status], statusColors[status]);
    return `${icon} ${text}`;
  }

  /**
   * Format a number with appropriate precision and units
   */
  private static formatNumber(value: number): string {
    if (value === 0) return '0';
    if (Math.abs(value) >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + 'M';
    }
    if (Math.abs(value) >= 1_000) {
      return (value / 1_000).toFixed(1) + 'K';
    }
    if (Math.abs(value) >= 100) {
      return value.toFixed(0);
    }
    if (Math.abs(value) >= 1) {
      return value.toFixed(1);
    }
    return value.toFixed(2);
  }

  /**
   * Format currency
   */
  static formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Format duration
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Create a box around text
   */
  static box(text: string, options: { padding?: number; title?: string } = {}): string {
    const { padding = 1, title } = options;
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map((l) => l.length));
    const width = maxLength + padding * 2;

    const topBorder = title
      ? `┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}┐`
      : `┌${'─'.repeat(width)}┐`;

    const bottomBorder = `└${'─'.repeat(width)}┘`;

    const paddedLines = lines.map(
      (line) =>
        `│${' '.repeat(padding)}${line.padEnd(maxLength)}${' '.repeat(padding)}│`
    );

    return [topBorder, ...paddedLines, bottomBorder].join('\n');
  }

  /**
   * Create a divider line
   */
  static divider(width: number = 80, char: string = '─'): string {
    return colorize(char.repeat(width), 'gray');
  }

  /**
   * Render key-value pairs
   */
  static keyValue(
    pairs: Array<{ key: string; value: string }>,
    options: { keyWidth?: number; separator?: string } = {}
  ): string {
    const { keyWidth = 20, separator = ': ' } = options;

    return pairs
      .map(({ key, value }) => {
        const paddedKey = key.padEnd(keyWidth);
        return `${colorize(paddedKey, 'cyan')}${separator}${value}`;
      })
      .join('\n');
  }
}
