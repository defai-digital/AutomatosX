/**
 * Iterate Domain Tests
 *
 * Tests for iterate mode functionality.
 *
 * Invariants tested:
 * - INV-ITR-001: Budget limits must be enforced
 * - INV-ITR-002: Safety guards must pause on dangerous patterns
 * - INV-ITR-003: Intent classification drives action decisions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetTracker, createBudgetTracker, SafetyGuard, createSafetyGuard, isContentSafe, IterateController, createIterateController, DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_TIME_MS, DEFAULT_MAX_CONSECUTIVE_ERRORS, } from '@defai.digital/iterate-domain';
describe('Iterate Domain', () => {
    describe('BudgetTracker', () => {
        let tracker;
        beforeEach(() => {
            tracker = new BudgetTracker();
            tracker.start();
        });
        describe('start', () => {
            it('should initialize consumption to zero', () => {
                const consumed = tracker.getConsumed();
                expect(consumed.iterations).toBe(0);
                expect(consumed.tokens).toBe(0);
            });
        });
        describe('recordIteration', () => {
            it('should increment iteration count', () => {
                tracker.recordIteration();
                tracker.recordIteration();
                const consumed = tracker.getConsumed();
                expect(consumed.iterations).toBe(2);
            });
            it('should track tokens when provided', () => {
                tracker.recordIteration(100);
                tracker.recordIteration(200);
                const consumed = tracker.getConsumed();
                expect(consumed.tokens).toBe(300);
            });
        });
        describe('check', () => {
            it('should return not exceeded when under limits', () => {
                tracker.recordIteration();
                const status = tracker.check();
                expect(status.exceeded).toBe(false);
                expect(status.remaining.iterations).toBe(DEFAULT_MAX_ITERATIONS - 1);
            });
            it('should return exceeded when iterations hit limit', () => {
                const smallBudget = new BudgetTracker({ maxIterations: 2 });
                smallBudget.start();
                smallBudget.recordIteration();
                smallBudget.recordIteration();
                const status = smallBudget.check();
                expect(status.exceeded).toBe(true);
                expect(status.reason).toContain('iterations exceeded');
            });
            it('should return exceeded when tokens hit limit', () => {
                const tokenBudget = new BudgetTracker({ maxTokens: 100 });
                tokenBudget.start();
                tokenBudget.recordIteration(150);
                const status = tokenBudget.check();
                expect(status.exceeded).toBe(true);
                expect(status.reason).toContain('tokens exceeded');
            });
        });
        describe('isExceeded', () => {
            it('should return false when under budget', () => {
                expect(tracker.isExceeded()).toBe(false);
            });
            it('should return true when over budget', () => {
                const smallBudget = new BudgetTracker({ maxIterations: 1 });
                smallBudget.start();
                smallBudget.recordIteration();
                expect(smallBudget.isExceeded()).toBe(true);
            });
        });
        describe('getBudget', () => {
            it('should return budget limits', () => {
                const budget = tracker.getBudget();
                expect(budget.maxIterations).toBe(DEFAULT_MAX_ITERATIONS);
                expect(budget.maxTimeMs).toBe(DEFAULT_MAX_TIME_MS);
            });
            it('should return custom budget limits', () => {
                const custom = new BudgetTracker({
                    maxIterations: 50,
                    maxTimeMs: 60000,
                    maxTokens: 10000,
                });
                const budget = custom.getBudget();
                expect(budget.maxIterations).toBe(50);
                expect(budget.maxTimeMs).toBe(60000);
                expect(budget.maxTokens).toBe(10000);
            });
        });
    });
    describe('SafetyGuard', () => {
        let guard;
        beforeEach(() => {
            guard = new SafetyGuard();
        });
        describe('INV-ITR-002: Dangerous pattern detection', () => {
            it('should detect rm -rf /', () => {
                const result = guard.checkContent('Running rm -rf /');
                expect(result.safe).toBe(false);
                expect(result.severity).toBe('critical');
            });
            it('should detect DROP TABLE', () => {
                const result = guard.checkContent('DROP TABLE users;');
                expect(result.safe).toBe(false);
                expect(result.severity).toBe('danger');
            });
            it('should detect DELETE FROM', () => {
                const result = guard.checkContent('DELETE FROM users;');
                expect(result.safe).toBe(false);
            });
            it('should detect git push --force', () => {
                const result = guard.checkContent('git push origin main --force');
                expect(result.safe).toBe(false);
            });
            it('should allow safe content', () => {
                const result = guard.checkContent('console.log("Hello World");');
                expect(result.safe).toBe(true);
            });
            it('should allow normal delete operations', () => {
                const result = guard.checkContent('Delete the unused file');
                expect(result.safe).toBe(true);
            });
        });
        describe('checkErrors', () => {
            it('should return safe when under error limit', () => {
                const result = guard.checkErrors(1);
                expect(result.safe).toBe(true);
            });
            it('should return unsafe when at error limit', () => {
                const result = guard.checkErrors(DEFAULT_MAX_CONSECUTIVE_ERRORS);
                expect(result.safe).toBe(false);
                expect(result.reason).toContain('consecutive errors');
            });
        });
        describe('custom patterns', () => {
            it('should detect custom dangerous patterns', () => {
                const customGuard = createSafetyGuard({
                    customDangerousPatterns: ['DANGER_COMMAND'],
                });
                const result = customGuard.checkContent('Run DANGER_COMMAND now');
                expect(result.safe).toBe(false);
            });
        });
        describe('disabled detection', () => {
            it('should skip pattern detection when disabled', () => {
                const disabledGuard = createSafetyGuard({
                    enableDangerousPatternDetection: false,
                });
                const result = disabledGuard.checkContent('rm -rf /');
                expect(result.safe).toBe(true);
            });
        });
    });
    describe('isContentSafe utility', () => {
        it('should return true for safe content', () => {
            expect(isContentSafe('Hello world')).toBe(true);
        });
        it('should return false for dangerous content', () => {
            expect(isContentSafe('rm -rf /')).toBe(false);
        });
    });
    describe('IterateController', () => {
        let controller;
        beforeEach(() => {
            controller = new IterateController();
        });
        describe('start', () => {
            it('should create initial state', () => {
                const state = controller.start({ task: 'Test task' });
                expect(state.sessionId).toBeDefined();
                expect(state.status).toBe('running');
                expect(state.iteration).toBe(0);
                expect(state.consecutiveErrors).toBe(0);
                expect(state.budget.maxIterations).toBe(DEFAULT_MAX_ITERATIONS);
            });
            it('should use provided session ID', () => {
                const state = controller.start({
                    task: 'Test',
                    sessionId: 'my-session',
                });
                expect(state.sessionId).toBe('my-session');
            });
            it('should use custom budget', () => {
                const state = controller.start({
                    task: 'Test',
                    budget: { maxIterations: 50, maxTimeMs: 60000 },
                });
                expect(state.budget.maxIterations).toBe(50);
            });
        });
        describe('INV-ITR-003: Intent to action mapping', () => {
            let state;
            beforeEach(() => {
                state = controller.start({ task: 'Test' });
            });
            it('should CONTINUE on continue intent', () => {
                const response = controller.handleResponse(state, 'continue');
                expect(response.action.type).toBe('CONTINUE');
                expect(response.newState.status).toBe('running');
                expect(response.autoResponse).toBeDefined();
            });
            it('should PAUSE on question intent', () => {
                const response = controller.handleResponse(state, 'question');
                expect(response.action.type).toBe('PAUSE');
                expect(response.action.requiresInput).toBe(true);
                expect(response.newState.status).toBe('paused');
            });
            it('should PAUSE on blocked intent', () => {
                const response = controller.handleResponse(state, 'blocked');
                expect(response.action.type).toBe('PAUSE');
                expect(response.action.requiresInput).toBe(true);
            });
            it('should STOP on complete intent', () => {
                const response = controller.handleResponse(state, 'complete');
                expect(response.action.type).toBe('STOP');
                expect(response.newState.status).toBe('completed');
            });
            it('should PAUSE on error intent', () => {
                const response = controller.handleResponse(state, 'error');
                expect(response.action.type).toBe('PAUSE');
                expect(response.newState.consecutiveErrors).toBe(1);
            });
        });
        describe('INV-ITR-001: Budget enforcement', () => {
            it('should STOP when budget exceeded', () => {
                const state = controller.start({
                    task: 'Test',
                    budget: { maxIterations: 2, maxTimeMs: 60000 },
                });
                // First iteration
                let response = controller.handleResponse(state, 'continue');
                // Second iteration
                response = controller.handleResponse(response.newState, 'continue');
                expect(response.action.type).toBe('STOP');
                expect(response.newState.status).toBe('budget_exceeded');
            });
        });
        describe('INV-ITR-002: Safety check on content', () => {
            it('should PAUSE when dangerous content detected', () => {
                const state = controller.start({ task: 'Test' });
                const response = controller.handleResponse(state, 'continue', 'rm -rf /');
                expect(response.action.type).toBe('PAUSE');
                expect(response.action.reason).toContain('Dangerous pattern detected');
            });
        });
        describe('error tracking', () => {
            it('should reset consecutive errors on non-error intent', () => {
                const state = controller.start({ task: 'Test' });
                // Error increases count
                let response = controller.handleResponse(state, 'error');
                expect(response.newState.consecutiveErrors).toBe(1);
                // Continue resets count
                response = controller.handleResponse(response.newState, 'continue');
                expect(response.newState.consecutiveErrors).toBe(0);
            });
            it('should PAUSE when max consecutive errors reached', () => {
                let state = controller.start({
                    task: 'Test',
                    safety: {
                        maxConsecutiveErrors: 2,
                        enableDangerousPatternDetection: true,
                        dangerousPatterns: [],
                    },
                });
                // First error
                let response = controller.handleResponse(state, 'error');
                state = response.newState;
                // Second error - should trigger safety
                response = controller.handleResponse(state, 'error');
                expect(response.action.type).toBe('PAUSE');
                expect(response.action.reason).toContain('consecutive errors');
            });
        });
        describe('history tracking', () => {
            it('should record history of iterations', () => {
                const state = controller.start({ task: 'Test' });
                const response = controller.handleResponse(state, 'continue');
                expect(response.newState.history).toHaveLength(1);
                expect(response.newState.history[0].intent).toBe('continue');
                expect(response.newState.history[0].action).toBe('CONTINUE');
            });
        });
        describe('getAutoResponse', () => {
            it('should return auto response for continue', () => {
                const response = controller.getAutoResponse('continue');
                expect(response).toBe('Continue.');
            });
            it('should return empty for question', () => {
                const response = controller.getAutoResponse('question');
                expect(response).toBe('');
            });
        });
    });
    describe('Factory Functions', () => {
        describe('createBudgetTracker', () => {
            it('should create tracker with defaults', () => {
                const tracker = createBudgetTracker();
                expect(tracker.getBudget().maxIterations).toBe(DEFAULT_MAX_ITERATIONS);
            });
        });
        describe('createSafetyGuard', () => {
            it('should create guard with defaults', () => {
                const guard = createSafetyGuard();
                expect(guard.getConfig().maxConsecutiveErrors).toBe(DEFAULT_MAX_CONSECUTIVE_ERRORS);
            });
        });
        describe('createIterateController', () => {
            it('should create controller', () => {
                const controller = createIterateController();
                const state = controller.start({ task: 'Test' });
                expect(state.status).toBe('running');
            });
        });
    });
    describe('Constants', () => {
        it('should export correct defaults', () => {
            expect(DEFAULT_MAX_ITERATIONS).toBe(20);
            expect(DEFAULT_MAX_TIME_MS).toBe(300000);
            expect(DEFAULT_MAX_CONSECUTIVE_ERRORS).toBe(3);
        });
    });
});
//# sourceMappingURL=iterate-domain.test.js.map