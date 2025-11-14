/**
 * Benchmark Harness
 * Sprint 5 Day 41: Performance benchmarking infrastructure
 */
import { EventEmitter } from 'events';
/**
 * Benchmark workload specification
 */
export interface BenchmarkWorkload {
    name: string;
    description?: string;
    iterations: number;
    warmupIterations?: number;
    fn: () => Promise<void> | void;
    setup?: () => Promise<void> | void;
    teardown?: () => Promise<void> | void;
}
/**
 * Benchmark result
 */
export interface BenchmarkResult {
    name: string;
    iterations: number;
    totalDuration: number;
    meanDuration: number;
    medianDuration: number;
    p95Duration: number;
    p99Duration: number;
    minDuration: number;
    maxDuration: number;
    stdDev: number;
    throughput: number;
    durations: number[];
}
/**
 * Benchmark suite result
 */
export interface BenchmarkSuiteResult {
    suiteName: string;
    timestamp: string;
    platform: string;
    nodeVersion: string;
    cpuModel: string;
    totalMemory: number;
    results: BenchmarkResult[];
    totalDuration: number;
}
/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
    warmupIterations?: number;
    minIterations?: number;
    maxDuration?: number;
}
/**
 * Benchmark Harness
 */
export declare class BenchmarkHarness extends EventEmitter {
    private config;
    private results;
    constructor(config?: BenchmarkConfig);
    /**
     * Run a single benchmark
     */
    runBenchmark(workload: BenchmarkWorkload): Promise<BenchmarkResult>;
    /**
     * Run a suite of benchmarks
     */
    runSuite(suiteName: string, workloads: BenchmarkWorkload[]): Promise<BenchmarkSuiteResult>;
    /**
     * Calculate statistics from durations
     */
    private calculateStatistics;
    /**
     * Compare two benchmark results
     */
    static compare(baseline: BenchmarkResult, current: BenchmarkResult): {
        name: string;
        meanImprovement: number;
        p95Improvement: number;
        throughputImprovement: number;
        regression: boolean;
    };
    /**
     * Format result as text
     */
    static formatResult(result: BenchmarkResult): string;
    /**
     * Format suite result as text
     */
    static formatSuiteResult(suite: BenchmarkSuiteResult): string;
    /**
     * Export result as JSON
     */
    static exportJSON(result: BenchmarkResult | BenchmarkSuiteResult): string;
}
/**
 * Create benchmark harness
 */
export declare function createBenchmarkHarness(config?: BenchmarkConfig): BenchmarkHarness;
//# sourceMappingURL=BenchmarkHarness.d.ts.map