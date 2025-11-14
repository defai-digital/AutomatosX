/**
 * UX Helpers
 * Sprint 6 Day 56: CLI/TUI user experience improvements
 */
import { EventEmitter } from 'events';
/**
 * Progress bar configuration
 */
export interface ProgressBarConfig {
    total: number;
    width?: number;
    format?: string;
    clear?: boolean;
}
/**
 * Progress bar
 */
export declare class ProgressBar extends EventEmitter {
    private current;
    private total;
    private width;
    private format;
    private clear;
    private startTime;
    constructor(config: ProgressBarConfig);
    /**
     * Update progress
     */
    update(current: number): void;
    /**
     * Increment progress
     */
    tick(amount?: number): void;
    /**
     * Get progress percentage
     */
    getPercent(): number;
    /**
     * Get ETA in seconds
     */
    getETA(): number;
    /**
     * Render progress bar
     */
    render(): string;
    /**
     * Reset progress
     */
    reset(): void;
}
/**
 * Spinner
 */
export declare class Spinner extends EventEmitter {
    private interval;
    private frameIndex;
    private text;
    private running;
    constructor(text?: string);
    /**
     * Start spinner
     */
    start(): void;
    /**
     * Stop spinner
     */
    stop(finalText?: string): void;
    /**
     * Update spinner text
     */
    setText(text: string): void;
    /**
     * Get current frame
     */
    getFrame(): string;
    /**
     * Render spinner
     */
    render(): string;
    /**
     * Is spinner running
     */
    isRunning(): boolean;
}
/**
 * Format helpers
 */
export declare class FormatHelpers {
    /**
     * Format bytes to human-readable size
     */
    static formatBytes(bytes: number): string;
    /**
     * Format duration to human-readable time
     */
    static formatDuration(ms: number): string;
    /**
     * Format number with commas
     */
    static formatNumber(num: number): string;
    /**
     * Format percentage
     */
    static formatPercent(value: number, total: number): string;
    /**
     * Truncate text with ellipsis
     */
    static truncate(text: string, maxLength: number): string;
    /**
     * Pad string to length
     */
    static pad(text: string, length: number, char?: string): string;
    /**
     * Center text in width
     */
    static center(text: string, width: number): string;
}
/**
 * Table builder
 */
export declare class Table {
    private headers;
    private rows;
    private columnWidths;
    /**
     * Set table headers
     */
    setHeaders(headers: string[]): void;
    /**
     * Add table row
     */
    addRow(row: string[]): void;
    /**
     * Add multiple rows
     */
    addRows(rows: string[][]): void;
    /**
     * Calculate column widths
     */
    private calculateColumnWidths;
    /**
     * Render table
     */
    render(): string;
    /**
     * Clear table
     */
    clear(): void;
    /**
     * Get row count
     */
    getRowCount(): number;
}
/**
 * Confirmation prompt result
 */
export interface ConfirmationResult {
    confirmed: boolean;
    value?: string;
}
/**
 * Interactive prompt helpers
 */
export declare class PromptHelpers {
    /**
     * Simulate confirmation (in tests, returns true by default)
     */
    static confirm(message: string, defaultValue?: boolean): Promise<boolean>;
    /**
     * Simulate input prompt
     */
    static input(message: string, defaultValue?: string): Promise<string>;
    /**
     * Simulate choice prompt
     */
    static choice(message: string, choices: string[], defaultIndex?: number): Promise<string>;
}
//# sourceMappingURL=UXHelpers.d.ts.map