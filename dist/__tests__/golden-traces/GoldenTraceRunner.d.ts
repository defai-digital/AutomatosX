/**
 * Golden trace input structure
 */
export interface GoldenTraceInput {
    command: string;
    args: Record<string, any>;
    environment?: Record<string, string>;
}
/**
 * Golden trace expected behavior
 */
export interface GoldenTraceExpected {
    agentSelected?: string;
    providerCalls?: any[];
    toolCalls?: any[];
    memoryQueries?: any[];
    output?: any;
    error?: any;
    exitCode?: number;
}
/**
 * Golden trace specification
 */
export interface GoldenTrace {
    id: string;
    name: string;
    priority: 'P0' | 'P1' | 'P2';
    category: 'cli' | 'agent' | 'provider' | 'memory';
    description: string;
    deterministicSeed: number;
    input: GoldenTraceInput;
    expectedBehavior: GoldenTraceExpected;
    assertions: string[];
    fixtures?: string[];
}
/**
 * Trace execution result
 */
export interface TraceExecutionResult {
    traceId: string;
    success: boolean;
    actualOutput: any;
    diffs: TraceDiff[];
    executionTime: number;
    errors: string[];
}
/**
 * Diff between expected and actual
 */
export interface TraceDiff {
    path: string;
    expected: any;
    actual: any;
    critical: boolean;
    reason?: string;
}
/**
 * Trace runner options
 */
export interface TraceRunnerOptions {
    fixturesDir?: string;
    mockProviders?: boolean;
    captureOutput?: boolean;
    failOnFirstDiff?: boolean;
}
/**
 * Golden Trace Runner
 *
 * Replays v1 transcripts through v2 to validate behavioral parity
 *
 * @example
 * ```typescript
 * const runner = new GoldenTraceRunner({
 *   fixturesDir: './fixtures',
 *   mockProviders: true
 * })
 *
 * const result = await runner.runTrace(trace)
 * expect(result.success).toBe(true)
 * expect(result.diffs.filter(d => d.critical)).toHaveLength(0)
 * ```
 */
export declare class GoldenTraceRunner {
    private options;
    private env?;
    private cleanup?;
    constructor(options?: TraceRunnerOptions);
    /**
     * Run a single golden trace
     */
    runTrace(trace: GoldenTrace): Promise<TraceExecutionResult>;
    /**
     * Run multiple traces
     */
    runTraces(traces: GoldenTrace[]): Promise<TraceExecutionResult[]>;
    /**
     * Load traces from directory
     */
    loadTracesFromDirectory(dir: string): Promise<GoldenTrace[]>;
    /**
     * Setup deterministic environment for trace
     */
    private setupEnvironment;
    /**
     * Cleanup environment after trace
     */
    private cleanupEnvironment;
    /**
     * Load fixture files for trace
     */
    private loadFixtures;
    /**
     * Execute trace (mock implementation)
     * TODO: Replace with actual CLI command execution
     */
    private executeTrace;
    /**
     * Compare expected vs actual outputs
     */
    private compareOutputs;
    /**
     * Determine if a diff at this path is critical
     */
    private isCriticalDiff;
    /**
     * Run custom assertions for trace
     */
    private runAssertions;
    /**
     * Evaluate assertion (simplified)
     */
    private evaluateAssertion;
    /**
     * Generate diff report
     */
    generateDiffReport(results: TraceExecutionResult[]): string;
}
//# sourceMappingURL=GoldenTraceRunner.d.ts.map