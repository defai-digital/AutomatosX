import { EventEmitter } from 'events';
/**
 * Timeline entry
 */
export interface TimelineEntry {
    id: string;
    label: string;
    startTime: number;
    endTime?: number;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    duration?: number;
    metadata?: Record<string, unknown>;
    children?: TimelineEntry[];
}
/**
 * Timeline options
 */
export interface TimelineOptions {
    showDuration?: boolean;
    showTimestamps?: boolean;
    showProgress?: boolean;
    maxWidth?: number;
    enableColors?: boolean;
    stream?: NodeJS.WriteStream;
}
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
export declare class TimelineView extends EventEmitter {
    private entries;
    private options;
    private rootEntries;
    private startTimestamp;
    constructor(options?: TimelineOptions);
    /**
     * Start a timeline entry
     */
    start(label: string, parentId?: string, metadata?: Record<string, unknown>): string;
    /**
     * Complete a timeline entry
     */
    complete(id: string, message?: string): void;
    /**
     * Fail a timeline entry
     */
    fail(id: string, error?: string): void;
    /**
     * Skip a timeline entry
     */
    skip(id: string, reason?: string): void;
    /**
     * Update entry label
     */
    updateLabel(id: string, label: string): void;
    /**
     * Render timeline to console
     */
    render(): void;
    /**
     * Get timeline as string
     */
    toString(): string;
    /**
     * Generate timeline output
     */
    private generateOutput;
    /**
     * Render single entry
     */
    private renderEntry;
    /**
     * Get status symbol
     */
    private getStatusSymbol;
    /**
     * Format duration
     */
    private formatDuration;
    /**
     * Colorize text
     */
    private colorize;
    /**
     * Get all entries
     */
    getEntries(): TimelineEntry[];
    /**
     * Get entry by ID
     */
    getEntry(id: string): TimelineEntry | undefined;
    /**
     * Get completed entries
     */
    getCompletedEntries(): TimelineEntry[];
    /**
     * Get failed entries
     */
    getFailedEntries(): TimelineEntry[];
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        completed: number;
        failed: number;
        skipped: number;
        running: number;
        totalDuration: number;
        averageDuration: number;
    };
    /**
     * Clear timeline
     */
    clear(): void;
    /**
     * Export timeline as JSON
     */
    export(): string;
}
/**
 * Create timeline with auto-render
 */
export declare function createAutoRenderTimeline(options?: TimelineOptions): TimelineView;
//# sourceMappingURL=TimelineView.d.ts.map