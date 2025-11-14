/**
 * Benchmark Harness Tests
 * Sprint 5 Day 41: Performance benchmarking tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BenchmarkHarness, createBenchmarkHarness, } from '../../performance/BenchmarkHarness.js';
describe('BenchmarkHarness', () => {
    let harness;
    beforeEach(() => {
        harness = createBenchmarkHarness();
    });
    describe('Single Benchmark', () => {
        it('should run benchmark with specified iterations', async () => {
            const workload = {
                name: 'test-benchmark',
                iterations: 10,
                fn: () => {
                    // Simulate work
                    let sum = 0;
                    for (let i = 0; i < 1000; i++) {
                        sum += i;
                    }
                    return sum;
                },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.name).toBe('test-benchmark');
            expect(result.iterations).toBe(10);
            expect(result.durations).toHaveLength(10);
        });
        it('should calculate mean duration correctly', async () => {
            const workload = {
                name: 'mean-test',
                iterations: 5,
                fn: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.meanDuration).toBeGreaterThan(9);
            expect(result.meanDuration).toBeLessThan(20);
        });
        it('should calculate median correctly', async () => {
            const workload = {
                name: 'median-test',
                iterations: 10,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.medianDuration).toBeDefined();
            expect(result.medianDuration).toBeGreaterThanOrEqual(0);
        });
        it('should calculate P95 correctly', async () => {
            const workload = {
                name: 'p95-test',
                iterations: 100,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.p95Duration).toBeDefined();
            expect(result.p95Duration).toBeGreaterThanOrEqual(result.medianDuration);
        });
        it('should calculate P99 correctly', async () => {
            const workload = {
                name: 'p99-test',
                iterations: 100,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.p99Duration).toBeDefined();
            expect(result.p99Duration).toBeGreaterThanOrEqual(result.p95Duration);
        });
        it('should track min and max duration', async () => {
            const workload = {
                name: 'minmax-test',
                iterations: 10,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.minDuration).toBeDefined();
            expect(result.maxDuration).toBeDefined();
            expect(result.maxDuration).toBeGreaterThanOrEqual(result.minDuration);
        });
        it('should calculate standard deviation', async () => {
            const workload = {
                name: 'stddev-test',
                iterations: 10,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.stdDev).toBeDefined();
            expect(result.stdDev).toBeGreaterThanOrEqual(0);
        });
        it('should calculate throughput', async () => {
            const workload = {
                name: 'throughput-test',
                iterations: 10,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.throughput).toBeGreaterThan(0);
        });
        it('should run warmup iterations before measurement', async () => {
            let count = 0;
            const workload = {
                name: 'warmup-test',
                iterations: 5,
                warmupIterations: 3,
                fn: () => {
                    count++;
                },
            };
            await harness.runBenchmark(workload);
            // 3 warmup + 5 measured = 8 total
            expect(count).toBe(8);
        });
        it('should call setup before benchmark', async () => {
            let setupCalled = false;
            const workload = {
                name: 'setup-test',
                iterations: 1,
                setup: () => {
                    setupCalled = true;
                },
                fn: () => {
                    expect(setupCalled).toBe(true);
                },
            };
            await harness.runBenchmark(workload);
            expect(setupCalled).toBe(true);
        });
        it('should call teardown after benchmark', async () => {
            let teardownCalled = false;
            const workload = {
                name: 'teardown-test',
                iterations: 1,
                fn: () => { },
                teardown: () => {
                    teardownCalled = true;
                },
            };
            await harness.runBenchmark(workload);
            expect(teardownCalled).toBe(true);
        });
        it('should handle async functions', async () => {
            const workload = {
                name: 'async-test',
                iterations: 5,
                fn: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                },
            };
            const result = await harness.runBenchmark(workload);
            expect(result.meanDuration).toBeGreaterThan(9);
        });
    });
    describe('Benchmark Suite', () => {
        it('should run multiple benchmarks in suite', async () => {
            const workloads = [
                {
                    name: 'benchmark-1',
                    iterations: 5,
                    fn: () => { },
                },
                {
                    name: 'benchmark-2',
                    iterations: 5,
                    fn: () => { },
                },
                {
                    name: 'benchmark-3',
                    iterations: 5,
                    fn: () => { },
                },
            ];
            const suite = await harness.runSuite('test-suite', workloads);
            expect(suite.results).toHaveLength(3);
            expect(suite.results[0].name).toBe('benchmark-1');
            expect(suite.results[1].name).toBe('benchmark-2');
            expect(suite.results[2].name).toBe('benchmark-3');
        });
        it('should include suite metadata', async () => {
            const workloads = [
                {
                    name: 'test',
                    iterations: 1,
                    fn: () => { },
                },
            ];
            const suite = await harness.runSuite('metadata-suite', workloads);
            expect(suite.suiteName).toBe('metadata-suite');
            expect(suite.timestamp).toBeDefined();
            expect(suite.platform).toBeDefined();
            expect(suite.nodeVersion).toBeDefined();
            expect(suite.cpuModel).toBeDefined();
            expect(suite.totalMemory).toBeGreaterThan(0);
        });
        it('should track total suite duration', async () => {
            const workloads = [
                {
                    name: 'test-1',
                    iterations: 5,
                    fn: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 5));
                    },
                },
                {
                    name: 'test-2',
                    iterations: 5,
                    fn: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 5));
                    },
                },
            ];
            const suite = await harness.runSuite('duration-suite', workloads);
            expect(suite.totalDuration).toBeGreaterThan(0);
        });
    });
    describe('Events', () => {
        it('should emit benchmark-start event', async () => {
            const spy = vi.fn();
            harness.on('benchmark-start', spy);
            const workload = {
                name: 'event-test',
                iterations: 1,
                fn: () => { },
            };
            await harness.runBenchmark(workload);
            expect(spy).toHaveBeenCalledWith({ name: 'event-test' });
        });
        it('should emit benchmark-complete event', async () => {
            const spy = vi.fn();
            harness.on('benchmark-complete', spy);
            const workload = {
                name: 'complete-test',
                iterations: 1,
                fn: () => { },
            };
            await harness.runBenchmark(workload);
            expect(spy).toHaveBeenCalled();
            expect(spy.mock.calls[0][0].name).toBe('complete-test');
        });
        it('should emit iteration-complete events', async () => {
            const spy = vi.fn();
            harness.on('iteration-complete', spy);
            const workload = {
                name: 'iteration-test',
                iterations: 3,
                fn: () => { },
            };
            await harness.runBenchmark(workload);
            expect(spy).toHaveBeenCalledTimes(3);
        });
        it('should emit suite-start event', async () => {
            const spy = vi.fn();
            harness.on('suite-start', spy);
            await harness.runSuite('suite-test', []);
            expect(spy).toHaveBeenCalledWith({ name: 'suite-test' });
        });
        it('should emit suite-complete event', async () => {
            const spy = vi.fn();
            harness.on('suite-complete', spy);
            await harness.runSuite('suite-complete-test', [
                { name: 'test', iterations: 1, fn: () => { } },
            ]);
            expect(spy).toHaveBeenCalled();
        });
    });
    describe('Comparison', () => {
        it('should compare two benchmark results', () => {
            const baseline = {
                name: 'test',
                iterations: 10,
                totalDuration: 1000,
                meanDuration: 100,
                medianDuration: 95,
                p95Duration: 110,
                p99Duration: 115,
                minDuration: 90,
                maxDuration: 120,
                stdDev: 10,
                throughput: 10,
                durations: [],
            };
            const current = {
                ...baseline,
                meanDuration: 80, // 20% faster
                p95Duration: 90,
                throughput: 12.5,
            };
            const comparison = BenchmarkHarness.compare(baseline, current);
            expect(comparison.meanImprovement).toBe(20);
            expect(comparison.p95Improvement).toBeCloseTo(18.18, 1);
            expect(comparison.throughputImprovement).toBe(25);
            expect(comparison.regression).toBe(false);
        });
        it('should detect regression', () => {
            const baseline = {
                name: 'test',
                iterations: 10,
                totalDuration: 1000,
                meanDuration: 100,
                medianDuration: 95,
                p95Duration: 110,
                p99Duration: 115,
                minDuration: 90,
                maxDuration: 120,
                stdDev: 10,
                throughput: 10,
                durations: [],
            };
            const current = {
                ...baseline,
                meanDuration: 120, // 20% slower (regression)
                throughput: 8.33,
            };
            const comparison = BenchmarkHarness.compare(baseline, current);
            expect(comparison.regression).toBe(true);
        });
        it('should not flag regression for <5% slowdown', () => {
            const baseline = {
                name: 'test',
                iterations: 10,
                totalDuration: 1000,
                meanDuration: 100,
                medianDuration: 95,
                p95Duration: 110,
                p99Duration: 115,
                minDuration: 90,
                maxDuration: 120,
                stdDev: 10,
                throughput: 10,
                durations: [],
            };
            const current = {
                ...baseline,
                meanDuration: 104, // 4% slower (acceptable)
            };
            const comparison = BenchmarkHarness.compare(baseline, current);
            expect(comparison.regression).toBe(false);
        });
    });
    describe('Formatting', () => {
        it('should format result as text', async () => {
            const workload = {
                name: 'format-test',
                iterations: 10,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            const formatted = BenchmarkHarness.formatResult(result);
            expect(formatted).toContain('Benchmark: format-test');
            expect(formatted).toContain('Iterations: 10');
            expect(formatted).toContain('Mean:');
            expect(formatted).toContain('P95:');
        });
        it('should format suite as text', async () => {
            const workloads = [
                { name: 'test', iterations: 5, fn: () => { } },
            ];
            const suite = await harness.runSuite('format-suite', workloads);
            const formatted = BenchmarkHarness.formatSuiteResult(suite);
            expect(formatted).toContain('Benchmark Suite: format-suite');
            expect(formatted).toContain('Platform:');
            expect(formatted).toContain('Node:');
        });
        it('should export result as JSON', async () => {
            const workload = {
                name: 'json-test',
                iterations: 5,
                fn: () => { },
            };
            const result = await harness.runBenchmark(workload);
            const json = BenchmarkHarness.exportJSON(result);
            const parsed = JSON.parse(json);
            expect(parsed.name).toBe('json-test');
            expect(parsed.iterations).toBe(5);
        });
    });
    describe('Factory Function', () => {
        it('should create harness via factory', () => {
            const harness = createBenchmarkHarness();
            expect(harness).toBeInstanceOf(BenchmarkHarness);
        });
        it('should accept configuration', () => {
            const harness = createBenchmarkHarness({
                warmupIterations: 5,
                minIterations: 20,
                maxDuration: 10000,
            });
            expect(harness).toBeInstanceOf(BenchmarkHarness);
        });
    });
});
//# sourceMappingURL=BenchmarkHarness.test.js.map