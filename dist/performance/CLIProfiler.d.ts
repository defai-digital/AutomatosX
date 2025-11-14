/**
 * CLI Profiler
 * Sprint 5 Day 41: CLI startup and command profiling
 */
/**
 * Profiling phase
 */
export interface ProfilingPhase {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}
/**
 * Profiling result
 */
export interface ProfilingResult {
    command: string;
    startTime: number;
    endTime: number;
    totalDuration: number;
    phases: ProfilingPhase[];
    peakMemory: number;
    metadata: Record<string, any>;
}
/**
 * CLI Profiler
 */
export declare class CLIProfiler {
    private static instance;
    private enabled;
    private command;
    private startTime;
    private phases;
    private peakMemory;
    private observer;
    private metadata;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): CLIProfiler;
    /**
     * Enable profiling
     */
    enable(): void;
    /**
     * Disable profiling
     */
    disable(): void;
    /**
     * Check if profiling is enabled
     */
    isEnabled(): boolean;
    /**
     * Start profiling a command
     */
    startCommand(command: string, metadata?: Record<string, any>): void;
    /**
     * Start a phase
     */
    startPhase(name: string, metadata?: Record<string, any>): void;
    /**
     * End a phase
     */
    endPhase(name: string): void;
    /**
     * End command profiling
     */
    endCommand(): ProfilingResult | null;
    /**
     * Track memory usage
     */
    private trackMemory;
    /**
     * Setup performance observer
     */
    private setupObserver;
    /**
     * Add metadata
     */
    addMetadata(key: string, value: any): void;
    /**
     * Format profiling result
     */
    static formatResult(result: ProfilingResult): string;
    /**
     * Export as JSON
     */
    static exportJSON(result: ProfilingResult): string;
    /**
     * Analyze startup performance
     */
    static analyzeStartup(result: ProfilingResult): {
        isOptimal: boolean;
        issues: string[];
        recommendations: string[];
    };
}
/**
 * Get CLI profiler instance
 */
export declare function getProfiler(): CLIProfiler;
/**
 * Profiling decorator for async functions
 */
export declare function profile(phaseName: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=CLIProfiler.d.ts.map