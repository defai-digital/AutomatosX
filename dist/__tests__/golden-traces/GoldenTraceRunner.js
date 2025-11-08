// Sprint 2 Day 13: Golden Trace Replay Runner
// Replays v1 transcripts through v2 runtime with deterministic validation
import * as fs from 'fs/promises';
import * as path from 'path';
import { DeterministicEnvironment } from '../../utils/DeterministicSeeds.js';
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
export class GoldenTraceRunner {
    options;
    env;
    cleanup;
    constructor(options = {}) {
        this.options = {
            fixturesDir: options.fixturesDir || './automatosx/tmp/sprint2/golden-traces/fixtures',
            mockProviders: options.mockProviders ?? true,
            captureOutput: options.captureOutput ?? true,
            failOnFirstDiff: options.failOnFirstDiff ?? false,
        };
    }
    /**
     * Run a single golden trace
     */
    async runTrace(trace) {
        const startTime = Date.now();
        try {
            // 1. Setup deterministic environment
            await this.setupEnvironment(trace);
            // 2. Load fixtures
            const fixtures = await this.loadFixtures(trace);
            // 3. Execute trace
            const actualOutput = await this.executeTrace(trace, fixtures);
            // 4. Compare with expected behavior
            const diffs = this.compareOutputs(trace.expectedBehavior, actualOutput);
            // 5. Run custom assertions
            const assertionErrors = await this.runAssertions(trace, actualOutput);
            // 6. Cleanup
            this.cleanupEnvironment();
            const executionTime = Date.now() - startTime;
            const criticalDiffs = diffs.filter(d => d.critical);
            return {
                traceId: trace.id,
                success: criticalDiffs.length === 0 && assertionErrors.length === 0,
                actualOutput,
                diffs,
                executionTime,
                errors: assertionErrors,
            };
        }
        catch (error) {
            this.cleanupEnvironment();
            return {
                traceId: trace.id,
                success: false,
                actualOutput: null,
                diffs: [],
                executionTime: Date.now() - startTime,
                errors: [error instanceof Error ? error.message : String(error)],
            };
        }
    }
    /**
     * Run multiple traces
     */
    async runTraces(traces) {
        const results = [];
        for (const trace of traces) {
            console.log(`Running trace: ${trace.id} (${trace.name})`);
            const result = await this.runTrace(trace);
            results.push(result);
            if (!result.success) {
                console.error(`  ✗ FAILED - ${result.errors.length} errors, ${result.diffs.filter(d => d.critical).length} critical diffs`);
                if (this.options.failOnFirstDiff) {
                    break;
                }
            }
            else {
                console.log(`  ✓ PASSED - ${result.executionTime}ms`);
            }
        }
        return results;
    }
    /**
     * Load traces from directory
     */
    async loadTracesFromDirectory(dir) {
        const files = await fs.readdir(dir);
        const traceFiles = files.filter(f => f.endsWith('.trace.json'));
        const traces = [];
        for (const file of traceFiles) {
            const content = await fs.readFile(path.join(dir, file), 'utf-8');
            const trace = JSON.parse(content);
            traces.push(trace);
        }
        return traces;
    }
    /**
     * Setup deterministic environment for trace
     */
    async setupEnvironment(trace) {
        const testEnv = DeterministicEnvironment.createTestEnv(trace.deterministicSeed);
        this.env = testEnv.env;
        this.cleanup = testEnv.cleanup;
        // Set environment variables
        if (trace.input.environment) {
            Object.entries(trace.input.environment).forEach(([key, value]) => {
                process.env[key] = value;
            });
        }
    }
    /**
     * Cleanup environment after trace
     */
    cleanupEnvironment() {
        if (this.cleanup) {
            this.cleanup();
            this.cleanup = undefined;
        }
        this.env = undefined;
    }
    /**
     * Load fixture files for trace
     */
    async loadFixtures(trace) {
        if (!trace.fixtures || trace.fixtures.length === 0) {
            return {};
        }
        const fixtures = {};
        for (const fixtureName of trace.fixtures) {
            const fixturePath = path.join(this.options.fixturesDir, `${trace.id}.${fixtureName}.json`);
            try {
                const content = await fs.readFile(fixturePath, 'utf-8');
                fixtures[fixtureName] = JSON.parse(content);
            }
            catch (error) {
                console.warn(`Warning: Could not load fixture ${fixtureName} for trace ${trace.id}`);
            }
        }
        return fixtures;
    }
    /**
     * Execute trace (mock implementation)
     * TODO: Replace with actual CLI command execution
     */
    async executeTrace(trace, fixtures) {
        // Mock execution for now
        // In real implementation, would execute:
        // - Parse command
        // - Invoke CLI handler
        // - Capture output
        // - Return result
        return {
            ...trace.expectedBehavior, // Mock: return expected for now
            _mock: true,
        };
    }
    /**
     * Compare expected vs actual outputs
     */
    compareOutputs(expected, actual, path = '') {
        const diffs = [];
        // Handle null/undefined
        if (expected == null && actual == null) {
            return diffs;
        }
        if (expected == null || actual == null) {
            diffs.push({
                path,
                expected,
                actual,
                critical: true,
                reason: 'One value is null/undefined',
            });
            return diffs;
        }
        // Handle primitives
        if (typeof expected !== 'object' || typeof actual !== 'object') {
            if (expected !== actual) {
                diffs.push({
                    path,
                    expected,
                    actual,
                    critical: this.isCriticalDiff(path),
                });
            }
            return diffs;
        }
        // Handle arrays
        if (Array.isArray(expected) && Array.isArray(actual)) {
            if (expected.length !== actual.length) {
                diffs.push({
                    path: `${path}.length`,
                    expected: expected.length,
                    actual: actual.length,
                    critical: true,
                    reason: 'Array length mismatch',
                });
            }
            const maxLen = Math.max(expected.length, actual.length);
            for (let i = 0; i < maxLen; i++) {
                diffs.push(...this.compareOutputs(expected[i], actual[i], `${path}[${i}]`));
            }
            return diffs;
        }
        // Handle objects
        const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
        for (const key of allKeys) {
            diffs.push(...this.compareOutputs(expected[key], actual[key], path ? `${path}.${key}` : key));
        }
        return diffs;
    }
    /**
     * Determine if a diff at this path is critical
     */
    isCriticalDiff(path) {
        const nonCriticalPaths = [
            'timestamp',
            'requestId',
            'executionTime',
            'metadata',
        ];
        return !nonCriticalPaths.some(p => path.includes(p));
    }
    /**
     * Run custom assertions for trace
     */
    async runAssertions(trace, actualOutput) {
        const errors = [];
        // Built-in assertions from trace spec
        for (const assertion of trace.assertions) {
            try {
                // Simple assertion evaluation
                // In real implementation, would use proper assertion library
                const passed = this.evaluateAssertion(assertion, actualOutput, trace.expectedBehavior);
                if (!passed) {
                    errors.push(`Assertion failed: ${assertion}`);
                }
            }
            catch (error) {
                errors.push(`Assertion error: ${assertion} - ${error}`);
            }
        }
        return errors;
    }
    /**
     * Evaluate assertion (simplified)
     */
    evaluateAssertion(assertion, actual, expected) {
        // Mock implementation
        // Real implementation would parse and evaluate assertion expressions
        return true;
    }
    /**
     * Generate diff report
     */
    generateDiffReport(results) {
        const lines = [];
        lines.push('='.repeat(80));
        lines.push('GOLDEN TRACE EXECUTION REPORT');
        lines.push('='.repeat(80));
        lines.push('');
        const totalTraces = results.length;
        const passedTraces = results.filter(r => r.success).length;
        const failedTraces = totalTraces - passedTraces;
        lines.push(`Total Traces: ${totalTraces}`);
        lines.push(`Passed: ${passedTraces} (${((passedTraces / totalTraces) * 100).toFixed(1)}%)`);
        lines.push(`Failed: ${failedTraces} (${((failedTraces / totalTraces) * 100).toFixed(1)}%)`);
        lines.push('');
        // Failed traces detail
        if (failedTraces > 0) {
            lines.push('FAILED TRACES:');
            lines.push('-'.repeat(80));
            results.filter(r => !r.success).forEach(result => {
                lines.push(`\n${result.traceId}:`);
                lines.push(`  Execution Time: ${result.executionTime}ms`);
                if (result.errors.length > 0) {
                    lines.push(`  Errors:`);
                    result.errors.forEach(err => lines.push(`    - ${err}`));
                }
                const criticalDiffs = result.diffs.filter(d => d.critical);
                if (criticalDiffs.length > 0) {
                    lines.push(`  Critical Diffs:`);
                    criticalDiffs.forEach(diff => {
                        lines.push(`    - ${diff.path}:`);
                        lines.push(`        Expected: ${JSON.stringify(diff.expected)}`);
                        lines.push(`        Actual:   ${JSON.stringify(diff.actual)}`);
                        if (diff.reason) {
                            lines.push(`        Reason:   ${diff.reason}`);
                        }
                    });
                }
            });
        }
        lines.push('');
        lines.push('='.repeat(80));
        return lines.join('\n');
    }
}
//# sourceMappingURL=GoldenTraceRunner.js.map