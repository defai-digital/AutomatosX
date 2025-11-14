/**
 * SafetyEvaluator Tests
 *
 * Comprehensive test suite for safety evaluation logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyEvaluator } from '../SafetyEvaluator.js';
describe('SafetyEvaluator', () => {
    let evaluator;
    let defaultStrategy;
    beforeEach(() => {
        evaluator = new SafetyEvaluator();
        defaultStrategy = {
            name: 'default',
            description: 'Default strategy',
            config: {
                timeout: 300000,
                retryBackoff: 'exponential',
                parallelism: 5,
                useCache: true
            },
            priority: 10,
            applicableErrors: []
        };
    });
    describe('Cost Limit Checks', () => {
        it('should pass when cost is under normal limit', async () => {
            const history = [
                createIteration(1, true, 10.0),
                createIteration(2, true, 10.0)
            ]; // Total: $20
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
            expect(evaluation.costSoFar).toBe(20.0);
        });
        it('should fail when cost exceeds normal limit', async () => {
            const history = [
                createIteration(1, true, 30.0),
                createIteration(2, true, 25.0)
            ]; // Total: $55 (normal limit: $50)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Cost limit exceeded');
            expect(evaluation.costSoFar).toBe(55.0);
        });
        it('should warn when approaching cost limit', async () => {
            const history = [
                createIteration(1, true, 20.0),
                createIteration(2, true, 22.0)
            ]; // Total: $42 (80% of $50 normal limit)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
            expect(evaluation.warnings).toContainEqual(expect.stringContaining('Cost approaching limit'));
        });
        it('should enforce paranoid cost limit', async () => {
            const history = [
                createIteration(1, true, 6.0),
                createIteration(2, true, 5.0)
            ]; // Total: $11 (paranoid limit: $10)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'paranoid', history);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Cost limit exceeded');
        });
        it('should allow higher cost in permissive mode', async () => {
            const history = [
                createIteration(1, true, 40.0),
                createIteration(2, true, 40.0)
            ]; // Total: $80 (permissive limit: $100)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'permissive', history);
            expect(evaluation.safe).toBe(true);
            expect(evaluation.costSoFar).toBe(80.0);
        });
    });
    describe('Duration Limit Checks', () => {
        it('should pass when duration is under normal limit', async () => {
            const history = [
                createIteration(1, true, 1.0, 300000), // 5 minutes
                createIteration(2, true, 1.0, 300000) // 5 minutes
            ]; // Total: 10 minutes (normal limit: 30 minutes)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
            expect(evaluation.durationSoFar).toBe(600000);
        });
        it('should fail when duration exceeds normal limit', async () => {
            const history = [
                createIteration(1, true, 1.0, 1000000), // ~16.7 minutes
                createIteration(2, true, 1.0, 1000000) // ~16.7 minutes
            ]; // Total: ~33.3 minutes (normal limit: 30 minutes)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Duration limit exceeded');
        });
        it('should warn when approaching duration limit', async () => {
            const history = [
                createIteration(1, true, 1.0, 800000), // ~13.3 minutes
                createIteration(2, true, 1.0, 700000) // ~11.7 minutes
            ]; // Total: ~25 minutes (83% of 30 minute normal limit)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
            expect(evaluation.warnings).toContainEqual(expect.stringContaining('Duration approaching limit'));
        });
        it('should enforce paranoid duration limit', async () => {
            const history = [
                createIteration(1, true, 1.0, 400000), // 6.7 minutes
                createIteration(2, true, 1.0, 300000) // 5 minutes
            ]; // Total: 11.7 minutes (paranoid limit: 10 minutes)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'paranoid', history);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Duration limit exceeded');
        });
    });
    describe('Consecutive Failure Checks', () => {
        it('should pass with few consecutive failures in normal mode', async () => {
            const history = [
                createIteration(1, false, 1.0),
                createIteration(2, false, 1.0),
                createIteration(3, false, 1.0)
            ]; // 3 consecutive failures (normal limit: 5)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
        });
        it('should fail when consecutive failures exceed normal limit', async () => {
            const history = [
                createIteration(1, false, 1.0),
                createIteration(2, false, 1.0),
                createIteration(3, false, 1.0),
                createIteration(4, false, 1.0),
                createIteration(5, false, 1.0),
                createIteration(6, false, 1.0)
            ]; // 6 consecutive failures (normal limit: 5)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Too many consecutive failures');
        });
        it('should reset consecutive failure count after success', async () => {
            const history = [
                createIteration(1, false, 1.0),
                createIteration(2, false, 1.0),
                createIteration(3, true, 1.0), // Success resets count
                createIteration(4, false, 1.0),
                createIteration(5, false, 1.0)
            ]; // Only 2 consecutive failures at end
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
        });
        it('should warn when approaching consecutive failure limit', async () => {
            const history = [
                createIteration(1, false, 1.0),
                createIteration(2, false, 1.0),
                createIteration(3, false, 1.0),
                createIteration(4, false, 1.0)
            ]; // 4 failures (80% of 5 normal limit)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(true);
            expect(evaluation.warnings).toContainEqual(expect.stringContaining('Many consecutive failures'));
        });
        it('should enforce paranoid consecutive failure limit', async () => {
            const history = [
                createIteration(1, false, 1.0),
                createIteration(2, false, 1.0),
                createIteration(3, false, 1.0),
                createIteration(4, false, 1.0)
            ]; // 4 consecutive failures (paranoid limit: 3)
            const evaluation = await evaluator.evaluate(defaultStrategy, 'paranoid', history);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Too many consecutive failures');
        });
    });
    describe('Risk Score Calculation', () => {
        it('should have low risk with minimal cost and duration', async () => {
            const history = [
                createIteration(1, true, 1.0, 10000)
            ];
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.riskScore).toBeLessThan(0.1);
            expect(evaluation.safe).toBe(true);
        });
        it('should increase risk with high cost', async () => {
            const history = [
                createIteration(1, true, 40.0, 10000) // 80% of normal $50 limit
            ];
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.riskScore).toBeGreaterThan(0.2);
            expect(evaluation.riskScore).toBeLessThan(0.5);
        });
        it('should increase risk with high duration', async () => {
            const history = [
                createIteration(1, true, 1.0, 1400000) // ~77% of normal 30min limit
            ];
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.riskScore).toBeGreaterThan(0.2);
            expect(evaluation.riskScore).toBeLessThan(0.5);
        });
        it('should increase risk with high failure rate', async () => {
            const history = [
                createIteration(1, false, 1.0),
                createIteration(2, false, 1.0),
                createIteration(3, false, 1.0),
                createIteration(4, true, 1.0)
            ]; // 75% failure rate
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.riskScore).toBeGreaterThan(0.2);
            expect(evaluation.riskScore).toBeLessThan(0.5);
        });
        it('should have high risk when approaching multiple limits', async () => {
            const history = [
                createIteration(1, false, 20.0, 700000), // High cost, duration, failure
                createIteration(2, false, 20.0, 700000)
            ]; // Total: $40, ~23min, 100% failure
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.riskScore).toBeGreaterThan(0.5);
        });
        it('should fail when risk exceeds paranoid tolerance', async () => {
            const history = [
                createIteration(1, false, 5.0, 300000),
                createIteration(2, false, 3.0, 200000)
            ]; // Moderate cost, failures
            const evaluation = await evaluator.evaluate(defaultStrategy, 'paranoid', history);
            // Paranoid risk tolerance is 0.2 - should be exceeded
            expect(evaluation.riskScore).toBeGreaterThan(0.2);
            expect(evaluation.safe).toBe(false);
            expect(evaluation.reason).toContain('Risk score');
        });
    });
    describe('Safety Level Thresholds', () => {
        it('should return correct thresholds for permissive level', () => {
            const thresholds = evaluator.getSafetyThresholds('permissive');
            expect(thresholds.maxTotalCost).toBe(100.0);
            expect(thresholds.maxTotalDuration).toBe(3600000); // 1 hour
            expect(thresholds.maxConsecutiveFailures).toBe(10);
            expect(thresholds.riskTolerance).toBe(0.8);
        });
        it('should return correct thresholds for normal level', () => {
            const thresholds = evaluator.getSafetyThresholds('normal');
            expect(thresholds.maxTotalCost).toBe(50.0);
            expect(thresholds.maxTotalDuration).toBe(1800000); // 30 minutes
            expect(thresholds.maxConsecutiveFailures).toBe(5);
            expect(thresholds.riskTolerance).toBe(0.5);
        });
        it('should return correct thresholds for paranoid level', () => {
            const thresholds = evaluator.getSafetyThresholds('paranoid');
            expect(thresholds.maxTotalCost).toBe(10.0);
            expect(thresholds.maxTotalDuration).toBe(600000); // 10 minutes
            expect(thresholds.maxConsecutiveFailures).toBe(3);
            expect(thresholds.riskTolerance).toBe(0.2);
        });
    });
    describe('Multiple Constraint Violations', () => {
        it('should fail on first violation encountered', async () => {
            const history = [
                createIteration(1, false, 60.0, 2000000), // Exceeds cost AND duration
                createIteration(2, false, 10.0, 100000)
            ]; // Total: $70, ~35min, 2 consecutive failures
            const evaluation = await evaluator.evaluate(defaultStrategy, 'normal', history);
            expect(evaluation.safe).toBe(false);
            // Should fail on cost limit (checked first)
            expect(evaluation.reason).toContain('Cost limit exceeded');
        });
    });
});
// Helper functions
function createIteration(iteration, success, cost = 0, duration = 1000) {
    return {
        iteration,
        success,
        complete: success,
        strategy: {
            name: 'default',
            description: 'Default strategy',
            config: {},
            priority: 10,
            applicableErrors: []
        },
        progress: {
            totalSteps: 5,
            completedSteps: success ? 5 : 3,
            failedSteps: success ? 0 : 1,
            completionPercent: success ? 100 : 60
        },
        duration,
        cost,
        metadata: {},
        ...(success ? {} : { error: new Error('Test error') })
    };
}
//# sourceMappingURL=SafetyEvaluator.test.js.map