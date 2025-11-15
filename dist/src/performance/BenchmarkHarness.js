/**
 * Benchmark Harness
 * Sprint 5 Day 41: Performance benchmarking infrastructure
 */
import { EventEmitter } from 'events';
import * as os from 'os';
/**
 * Benchmark Harness
 */
export class BenchmarkHarness extends EventEmitter {
    config;
    results = [];
    constructor(config = {}) {
        super();
        this.config = {
            warmupIterations: config.warmupIterations ?? 3,
            minIterations: config.minIterations ?? 10,
            maxDuration: config.maxDuration ?? 5000,
        };
    }
    /**
     * Run a single benchmark
     */
    async runBenchmark(workload) {
        this.emit('benchmark-start', { name: workload.name });
        // Setup
        if (workload.setup) {
            await workload.setup();
        }
        // Warmup iterations
        const warmupIters = workload.warmupIterations ?? this.config.warmupIterations;
        for (let i = 0; i < warmupIters; i++) {
            await workload.fn();
        }
        // Measured iterations
        const durations = [];
        const iterations = workload.iterations;
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await workload.fn();
            const end = performance.now();
            const duration = end - start;
            durations.push(duration);
            this.emit('iteration-complete', {
                name: workload.name,
                iteration: i + 1,
                duration,
            });
        }
        // Teardown
        if (workload.teardown) {
            await workload.teardown();
        }
        // Calculate statistics
        const result = this.calculateStatistics(workload.name, iterations, durations);
        this.results.push(result);
        this.emit('benchmark-complete', result);
        return result;
    }
    /**
     * Run a suite of benchmarks
     */
    async runSuite(suiteName, workloads) {
        this.emit('suite-start', { name: suiteName });
        const startTime = performance.now();
        this.results = [];
        for (const workload of workloads) {
            await this.runBenchmark(workload);
        }
        const endTime = performance.now();
        const totalDuration = endTime - startTime;
        const suiteResult = {
            suiteName,
            timestamp: new Date().toISOString(),
            platform: os.platform(),
            nodeVersion: process.version,
            cpuModel: os.cpus()[0].model,
            totalMemory: os.totalmem(),
            results: this.results,
            totalDuration,
        };
        this.emit('suite-complete', suiteResult);
        return suiteResult;
    }
    /**
     * Calculate statistics from durations
     */
    calculateStatistics(name, iterations, durations) {
        const sorted = [...durations].sort((a, b) => a - b);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const meanDuration = totalDuration / iterations;
        const p95Index = Math.floor(iterations * 0.95);
        const p99Index = Math.floor(iterations * 0.99);
        const medianIndex = Math.floor(iterations * 0.5);
        const p95Duration = sorted[p95Index];
        const p99Duration = sorted[p99Index];
        const medianDuration = sorted[medianIndex];
        const minDuration = sorted[0];
        const maxDuration = sorted[iterations - 1];
        // Calculate standard deviation
        const variance = durations.reduce((sum, d) => sum + Math.pow(d - meanDuration, 2), 0) /
            iterations;
        const stdDev = Math.sqrt(variance);
        // Calculate throughput (ops/sec)
        const throughput = (1000 / meanDuration) * 1;
        return {
            name,
            iterations,
            totalDuration,
            meanDuration,
            medianDuration,
            p95Duration,
            p99Duration,
            minDuration,
            maxDuration,
            stdDev,
            throughput,
            durations,
        };
    }
    /**
     * Compare two benchmark results
     */
    static compare(baseline, current) {
        const meanImprovement = ((baseline.meanDuration - current.meanDuration) / baseline.meanDuration) * 100;
        const p95Improvement = ((baseline.p95Duration - current.p95Duration) / baseline.p95Duration) * 100;
        const throughputImprovement = ((current.throughput - baseline.throughput) / baseline.throughput) * 100;
        // Consider it a regression if mean is >5% slower
        const regression = meanImprovement < -5;
        return {
            name: current.name,
            meanImprovement,
            p95Improvement,
            throughputImprovement,
            regression,
        };
    }
    /**
     * Format result as text
     */
    static formatResult(result) {
        return `
Benchmark: ${result.name}
Iterations: ${result.iterations}
Mean: ${result.meanDuration.toFixed(2)}ms
Median: ${result.medianDuration.toFixed(2)}ms
P95: ${result.p95Duration.toFixed(2)}ms
P99: ${result.p99Duration.toFixed(2)}ms
Min: ${result.minDuration.toFixed(2)}ms
Max: ${result.maxDuration.toFixed(2)}ms
StdDev: ${result.stdDev.toFixed(2)}ms
Throughput: ${result.throughput.toFixed(2)} ops/sec
`.trim();
    }
    /**
     * Format suite result as text
     */
    static formatSuiteResult(suite) {
        const header = `
Benchmark Suite: ${suite.suiteName}
Timestamp: ${suite.timestamp}
Platform: ${suite.platform}
Node: ${suite.nodeVersion}
CPU: ${suite.cpuModel}
Memory: ${(suite.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB
Total Duration: ${suite.totalDuration.toFixed(2)}ms
`.trim();
        const results = suite.results
            .map((r) => this.formatResult(r))
            .join('\n\n---\n\n');
        return `${header}\n\n${results}`;
    }
    /**
     * Export result as JSON
     */
    static exportJSON(result) {
        return JSON.stringify(result, null, 2);
    }
}
/**
 * Create benchmark harness
 */
export function createBenchmarkHarness(config) {
    return new BenchmarkHarness(config);
}
//# sourceMappingURL=BenchmarkHarness.js.map