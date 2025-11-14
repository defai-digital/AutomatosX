/**
 * UX Helpers
 * Sprint 6 Day 56: CLI/TUI user experience improvements
 */
import { EventEmitter } from 'events';
/**
 * Progress bar
 */
export class ProgressBar extends EventEmitter {
    current = 0;
    total;
    width;
    format;
    clear;
    startTime = Date.now();
    constructor(config) {
        super();
        this.total = config.total;
        this.width = config.width ?? 40;
        this.format = config.format ?? '[:bar] :percent :current/:total :eta';
        this.clear = config.clear ?? false;
    }
    /**
     * Update progress
     */
    update(current) {
        this.current = Math.min(current, this.total);
        const percent = Math.round((this.current / this.total) * 100);
        const elapsed = Date.now() - this.startTime;
        const rate = this.current / (elapsed / 1000);
        const remaining = this.total - this.current;
        const eta = remaining > 0 ? Math.round(remaining / rate) : 0;
        this.emit('progress', {
            current: this.current,
            total: this.total,
            percent,
            elapsed,
            eta,
        });
        if (this.current === this.total) {
            this.emit('complete', { elapsed });
        }
    }
    /**
     * Increment progress
     */
    tick(amount = 1) {
        this.update(this.current + amount);
    }
    /**
     * Get progress percentage
     */
    getPercent() {
        return Math.round((this.current / this.total) * 100);
    }
    /**
     * Get ETA in seconds
     */
    getETA() {
        const elapsed = Date.now() - this.startTime;
        const rate = this.current / (elapsed / 1000);
        const remaining = this.total - this.current;
        return remaining > 0 ? Math.round(remaining / rate) : 0;
    }
    /**
     * Render progress bar
     */
    render() {
        const percent = this.getPercent();
        const filled = Math.round((this.width * this.current) / this.total);
        const empty = this.width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const eta = this.getETA();
        return this.format
            .replace(':bar', bar)
            .replace(':percent', `${percent}%`)
            .replace(':current', String(this.current))
            .replace(':total', String(this.total))
            .replace(':eta', eta > 0 ? `${eta}s remaining` : 'complete');
    }
    /**
     * Reset progress
     */
    reset() {
        this.current = 0;
        this.startTime = Date.now();
        this.emit('reset');
    }
}
/**
 * Spinner frames
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/**
 * Spinner
 */
export class Spinner extends EventEmitter {
    interval = null;
    frameIndex = 0;
    text;
    running = false;
    constructor(text = 'Loading...') {
        super();
        this.text = text;
    }
    /**
     * Start spinner
     */
    start() {
        if (this.running)
            return;
        this.running = true;
        this.frameIndex = 0;
        this.interval = setInterval(() => {
            this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
            this.emit('tick', { frame: this.getFrame(), text: this.text });
        }, 80);
        this.emit('start');
    }
    /**
     * Stop spinner
     */
    stop(finalText) {
        if (!this.running)
            return;
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.emit('stop', { text: finalText ?? this.text });
    }
    /**
     * Update spinner text
     */
    setText(text) {
        this.text = text;
        this.emit('text-updated', { text });
    }
    /**
     * Get current frame
     */
    getFrame() {
        return SPINNER_FRAMES[this.frameIndex];
    }
    /**
     * Render spinner
     */
    render() {
        return `${this.getFrame()} ${this.text}`;
    }
    /**
     * Is spinner running
     */
    isRunning() {
        return this.running;
    }
}
/**
 * Format helpers
 */
export class FormatHelpers {
    /**
     * Format bytes to human-readable size
     */
    static formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(2)} ${units[i]}`;
    }
    /**
     * Format duration to human-readable time
     */
    static formatDuration(ms) {
        if (ms < 1000)
            return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        }
        if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    }
    /**
     * Format number with commas
     */
    static formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    /**
     * Format percentage
     */
    static formatPercent(value, total) {
        const percent = (value / total) * 100;
        return `${percent.toFixed(1)}%`;
    }
    /**
     * Truncate text with ellipsis
     */
    static truncate(text, maxLength) {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    /**
     * Pad string to length
     */
    static pad(text, length, char = ' ') {
        return text.padEnd(length, char);
    }
    /**
     * Center text in width
     */
    static center(text, width) {
        const padding = Math.max(0, width - text.length);
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    }
}
/**
 * Table builder
 */
export class Table {
    headers = [];
    rows = [];
    columnWidths = [];
    /**
     * Set table headers
     */
    setHeaders(headers) {
        this.headers = headers;
        this.calculateColumnWidths();
    }
    /**
     * Add table row
     */
    addRow(row) {
        this.rows.push(row);
        this.calculateColumnWidths();
    }
    /**
     * Add multiple rows
     */
    addRows(rows) {
        this.rows.push(...rows);
        this.calculateColumnWidths();
    }
    /**
     * Calculate column widths
     */
    calculateColumnWidths() {
        this.columnWidths = [];
        // Check headers
        for (let i = 0; i < this.headers.length; i++) {
            this.columnWidths[i] = this.headers[i].length;
        }
        // Check rows
        for (const row of this.rows) {
            for (let i = 0; i < row.length; i++) {
                this.columnWidths[i] = Math.max(this.columnWidths[i] || 0, row[i].length);
            }
        }
    }
    /**
     * Render table
     */
    render() {
        const lines = [];
        // Render headers
        if (this.headers.length > 0) {
            const headerRow = this.headers
                .map((header, i) => FormatHelpers.pad(header, this.columnWidths[i]))
                .join(' | ');
            lines.push(headerRow);
            lines.push('-'.repeat(headerRow.length));
        }
        // Render rows
        for (const row of this.rows) {
            const rowStr = row
                .map((cell, i) => FormatHelpers.pad(cell, this.columnWidths[i]))
                .join(' | ');
            lines.push(rowStr);
        }
        return lines.join('\n');
    }
    /**
     * Clear table
     */
    clear() {
        this.headers = [];
        this.rows = [];
        this.columnWidths = [];
    }
    /**
     * Get row count
     */
    getRowCount() {
        return this.rows.length;
    }
}
/**
 * Interactive prompt helpers
 */
export class PromptHelpers {
    /**
     * Simulate confirmation (in tests, returns true by default)
     */
    static async confirm(message, defaultValue = false) {
        // In production, this would use actual stdin/readline
        // For testing, return defaultValue
        return defaultValue;
    }
    /**
     * Simulate input prompt
     */
    static async input(message, defaultValue = '') {
        // In production, this would use actual stdin/readline
        // For testing, return defaultValue
        return defaultValue;
    }
    /**
     * Simulate choice prompt
     */
    static async choice(message, choices, defaultIndex = 0) {
        // In production, this would use actual stdin/readline
        // For testing, return default choice
        return choices[defaultIndex];
    }
}
//# sourceMappingURL=UXHelpers.js.map