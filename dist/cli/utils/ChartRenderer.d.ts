/**
 * Chart Renderer - ASCII Chart Utilities
 *
 * Provides CLI-friendly ASCII chart rendering for monitoring dashboards.
 * Supports line charts, bar charts, sparklines, and tables.
 *
 * @module ChartRenderer
 */
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
export declare class ChartRenderer {
    /**
     * Render a line chart
     */
    static lineChart(data: number[], options?: LineChartOptions): string;
    /**
     * Draw a line between two points using Bresenham's algorithm
     */
    private static drawLine;
    /**
     * Render a horizontal bar chart
     */
    static barChart(data: Array<{
        label: string;
        value: number;
        color?: string;
    }>, options?: BarChartOptions): string;
    /**
     * Render a sparkline (compact line chart)
     */
    static sparkline(data: number[]): string;
    /**
     * Render a table
     */
    static table(options: TableOptions): string;
    /**
     * Render a progress bar
     */
    static progressBar(current: number, total: number, options?: {
        width?: number;
        showPercentage?: boolean;
        label?: string;
    }): string;
    /**
     * Render a status indicator
     */
    static statusIndicator(status: 'ok' | 'warning' | 'error' | 'info', text: string): string;
    /**
     * Format a number with appropriate precision and units
     */
    private static formatNumber;
    /**
     * Format currency
     */
    static formatCurrency(value: number): string;
    /**
     * Format percentage
     */
    static formatPercentage(value: number): string;
    /**
     * Format duration
     */
    static formatDuration(ms: number): string;
    /**
     * Create a box around text
     */
    static box(text: string, options?: {
        padding?: number;
        title?: string;
    }): string;
    /**
     * Create a divider line
     */
    static divider(width?: number, char?: string): string;
    /**
     * Render key-value pairs
     */
    static keyValue(pairs: Array<{
        key: string;
        value: string;
    }>, options?: {
        keyWidth?: number;
        separator?: string;
    }): string;
}
//# sourceMappingURL=ChartRenderer.d.ts.map