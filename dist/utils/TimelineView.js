// Sprint 2 Day 18: CLI Progress Timeline View
// Visual timeline for tracking multi-step operations
import { EventEmitter } from 'events';
/**
 * Timeline View
 *
 * Visualizes operation progress as a timeline
 *
 * @example
 * ```typescript
 * const timeline = new TimelineView({
 *   showDuration: true,
 *   showProgress: true
 * })
 *
 * const taskId = timeline.start('Indexing codebase')
 * const subTask1 = timeline.start('Parsing files', taskId)
 * timeline.complete(subTask1, 'Parsed 100 files')
 * const subTask2 = timeline.start('Building index', taskId)
 * timeline.complete(subTask2, 'Index built')
 * timeline.complete(taskId, 'Indexing complete')
 *
 * timeline.render()
 * ```
 */
export class TimelineView extends EventEmitter {
    entries;
    options;
    rootEntries;
    startTimestamp;
    constructor(options = {}) {
        super();
        this.entries = new Map();
        this.options = {
            showDuration: options.showDuration ?? true,
            showTimestamps: options.showTimestamps ?? false,
            showProgress: options.showProgress ?? true,
            maxWidth: options.maxWidth || 80,
            enableColors: options.enableColors ?? true,
            stream: options.stream || process.stderr,
        };
        this.rootEntries = [];
        this.startTimestamp = Date.now();
    }
    /**
     * Start a timeline entry
     */
    start(label, parentId, metadata) {
        const id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const entry = {
            id,
            label,
            startTime: Date.now(),
            status: 'running',
            metadata,
        };
        this.entries.set(id, entry);
        if (parentId) {
            const parent = this.entries.get(parentId);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(entry);
            }
        }
        else {
            this.rootEntries.push(id);
        }
        this.emit('entry-started', { id, label });
        return id;
    }
    /**
     * Complete a timeline entry
     */
    complete(id, message) {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.endTime = Date.now();
        entry.duration = entry.endTime - entry.startTime;
        entry.status = 'completed';
        if (message) {
            entry.label = message;
        }
        this.emit('entry-completed', { id, duration: entry.duration });
    }
    /**
     * Fail a timeline entry
     */
    fail(id, error) {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.endTime = Date.now();
        entry.duration = entry.endTime - entry.startTime;
        entry.status = 'failed';
        if (error) {
            entry.metadata = { ...entry.metadata, error };
        }
        this.emit('entry-failed', { id, error });
    }
    /**
     * Skip a timeline entry
     */
    skip(id, reason) {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.endTime = entry.startTime;
        entry.duration = 0;
        entry.status = 'skipped';
        if (reason) {
            entry.metadata = { ...entry.metadata, reason };
        }
        this.emit('entry-skipped', { id, reason });
    }
    /**
     * Update entry label
     */
    updateLabel(id, label) {
        const entry = this.entries.get(id);
        if (entry) {
            entry.label = label;
        }
    }
    /**
     * Render timeline to console
     */
    render() {
        const output = this.generateOutput();
        this.options.stream.write(output);
    }
    /**
     * Get timeline as string
     */
    toString() {
        return this.generateOutput();
    }
    /**
     * Generate timeline output
     */
    generateOutput() {
        const lines = [];
        // Header
        lines.push(this.colorize('\n╔═══════════════════════════════════════════╗', 'cyan'));
        lines.push(this.colorize('║          Operation Timeline               ║', 'cyan'));
        lines.push(this.colorize('╚═══════════════════════════════════════════╝\n', 'cyan'));
        // Render root entries
        for (const rootId of this.rootEntries) {
            const entry = this.entries.get(rootId);
            if (entry) {
                this.renderEntry(entry, 0, lines);
            }
        }
        // Summary
        if (this.options.showDuration) {
            const totalDuration = Date.now() - this.startTimestamp;
            lines.push('');
            lines.push(this.colorize(`Total Duration: ${this.formatDuration(totalDuration)}`, 'cyan'));
        }
        return lines.join('\n') + '\n';
    }
    /**
     * Render single entry
     */
    renderEntry(entry, depth, lines) {
        const indent = '  '.repeat(depth);
        const symbol = this.getStatusSymbol(entry.status);
        const label = entry.label;
        let line = `${indent}${symbol} ${label}`;
        // Add duration
        if (this.options.showDuration && entry.duration !== undefined) {
            line += this.colorize(` (${this.formatDuration(entry.duration)})`, 'gray');
        }
        // Add timestamp
        if (this.options.showTimestamps && entry.startTime) {
            const elapsed = entry.startTime - this.startTimestamp;
            line += this.colorize(` [+${this.formatDuration(elapsed)}]`, 'gray');
        }
        lines.push(line);
        // Render children
        if (entry.children && entry.children.length > 0) {
            for (const child of entry.children) {
                this.renderEntry(child, depth + 1, lines);
            }
        }
    }
    /**
     * Get status symbol
     */
    getStatusSymbol(status) {
        const symbols = {
            pending: this.colorize('○', 'gray'),
            running: this.colorize('⏵', 'yellow'),
            completed: this.colorize('✓', 'green'),
            failed: this.colorize('✗', 'red'),
            skipped: this.colorize('⊘', 'gray'),
        };
        return symbols[status];
    }
    /**
     * Format duration
     */
    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        }
        else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }
    /**
     * Colorize text
     */
    colorize(text, color) {
        if (!this.options.enableColors) {
            return text;
        }
        const colors = {
            gray: '\x1b[90m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            cyan: '\x1b[36m',
            reset: '\x1b[0m',
        };
        return `${colors[color] || ''}${text}${colors.reset}`;
    }
    /**
     * Get all entries
     */
    getEntries() {
        return Array.from(this.entries.values());
    }
    /**
     * Get entry by ID
     */
    getEntry(id) {
        return this.entries.get(id);
    }
    /**
     * Get completed entries
     */
    getCompletedEntries() {
        return Array.from(this.entries.values()).filter(e => e.status === 'completed');
    }
    /**
     * Get failed entries
     */
    getFailedEntries() {
        return Array.from(this.entries.values()).filter(e => e.status === 'failed');
    }
    /**
     * Get statistics
     */
    getStats() {
        const entries = Array.from(this.entries.values());
        const completed = entries.filter(e => e.status === 'completed');
        const failed = entries.filter(e => e.status === 'failed');
        const skipped = entries.filter(e => e.status === 'skipped');
        const running = entries.filter(e => e.status === 'running');
        const completedDurations = completed
            .filter(e => e.duration !== undefined)
            .map(e => e.duration);
        const totalDuration = completedDurations.length > 0
            ? completedDurations.reduce((a, b) => a + b, 0)
            : 0;
        const averageDuration = completedDurations.length > 0
            ? totalDuration / completedDurations.length
            : 0;
        return {
            total: entries.length,
            completed: completed.length,
            failed: failed.length,
            skipped: skipped.length,
            running: running.length,
            totalDuration,
            averageDuration,
        };
    }
    /**
     * Clear timeline
     */
    clear() {
        this.entries.clear();
        this.rootEntries = [];
        this.startTimestamp = Date.now();
    }
    /**
     * Export timeline as JSON
     */
    export() {
        const data = {
            startTimestamp: this.startTimestamp,
            entries: Array.from(this.entries.values()),
            rootEntries: this.rootEntries,
            stats: this.getStats(),
        };
        return JSON.stringify(data, null, 2);
    }
}
/**
 * Create timeline with auto-render
 */
export function createAutoRenderTimeline(options = {}) {
    const timeline = new TimelineView(options);
    // Auto-render on entry completion
    timeline.on('entry-completed', () => {
        if (options.showProgress) {
            timeline.render();
        }
    });
    timeline.on('entry-failed', () => {
        if (options.showProgress) {
            timeline.render();
        }
    });
    return timeline;
}
//# sourceMappingURL=TimelineView.js.map