import { EventEmitter } from 'events';
/**
 * Spinner frame types
 */
export type SpinnerType = 'dots' | 'line' | 'arrow' | 'circle' | 'box';
/**
 * Spinner state
 */
export type SpinnerState = 'spinning' | 'success' | 'error' | 'warning' | 'info' | 'stopped';
/**
 * Spinner options
 */
export interface SpinnerOptions {
    type?: SpinnerType;
    text?: string;
    color?: 'green' | 'red' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
    interval?: number;
    stream?: NodeJS.WriteStream;
}
/**
 * Spinner Logger
 *
 * Visual progress indicator for CLI operations
 *
 * @example
 * ```typescript
 * const spinner = new SpinnerLogger({ text: 'Loading...', type: 'dots' })
 *
 * spinner.start()
 * await doWork()
 * spinner.success('Complete!')
 * ```
 */
export declare class SpinnerLogger extends EventEmitter {
    private type;
    private text;
    private color;
    private interval;
    private stream;
    private frameIndex;
    private timer;
    private state;
    private isEnabled;
    constructor(options?: SpinnerOptions);
    /**
     * Start the spinner
     */
    start(text?: string): this;
    /**
     * Stop the spinner
     */
    stop(): this;
    /**
     * Stop with success
     */
    success(text?: string): this;
    /**
     * Stop with error
     */
    error(text?: string): this;
    /**
     * Stop with warning
     */
    warn(text?: string): this;
    /**
     * Stop with info
     */
    info(text?: string): this;
    /**
     * Update spinner text
     */
    updateText(text: string): this;
    /**
     * Change spinner type
     */
    setType(type: SpinnerType): this;
    /**
     * Change spinner color
     */
    setColor(color: 'green' | 'red' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'): this;
    /**
     * Check if spinning
     */
    isSpinning(): boolean;
    /**
     * Get current state
     */
    getState(): SpinnerState;
    /**
     * Render current frame
     */
    private render;
    /**
     * Get frames for current type
     */
    private getFrames;
}
/**
 * Multi-step progress tracker
 */
export interface ProgressStep {
    name: string;
    status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
    message?: string;
}
/**
 * Progress tracker for multi-step operations
 *
 * @example
 * ```typescript
 * const progress = new ProgressTracker([
 *   { name: 'Validate input', status: 'pending' },
 *   { name: 'Process data', status: 'pending' },
 *   { name: 'Save results', status: 'pending' },
 * ])
 *
 * progress.start('Validate input')
 * await validate()
 * progress.complete('Validate input', 'Input valid')
 *
 * progress.start('Process data')
 * await process()
 * progress.complete('Process data', 'Processed 100 items')
 * ```
 */
export declare class ProgressTracker extends EventEmitter {
    private steps;
    private currentStep;
    private spinner;
    private stream;
    constructor(steps: ProgressStep[], stream?: NodeJS.WriteStream);
    /**
     * Start a step
     */
    start(stepName: string, message?: string): this;
    /**
     * Complete current step with success
     */
    complete(stepName: string, message?: string): this;
    /**
     * Fail current step
     */
    fail(stepName: string, message?: string): this;
    /**
     * Skip a step
     */
    skip(stepName: string, message?: string): this;
    /**
     * Update current step message
     */
    updateMessage(message: string): this;
    /**
     * Get all steps
     */
    getSteps(): ProgressStep[];
    /**
     * Get step by name
     */
    getStep(name: string): ProgressStep | undefined;
    /**
     * Check if all steps complete
     */
    isComplete(): boolean;
    /**
     * Check if any step failed
     */
    hasFailed(): boolean;
    /**
     * Get completion percentage
     */
    getProgress(): number;
    /**
     * Stop all spinners
     */
    stopAll(): this;
}
//# sourceMappingURL=SpinnerLogger.d.ts.map