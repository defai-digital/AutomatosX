import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as Guards from '../../../packages/rescript-core/src/runtime/Guards.bs.js';
import { runtimeStates, runtimeEvents } from './runtimeTestUtils';
// Sprint 1 Day 2: Comprehensive guard scenarios covering Pass/Fail/Defer verdicts
describe('Guard Helper Library - GuardVerdict Types', () => {
    it('converts Pass verdict to string correctly', () => {
        const verdict = Guards.verdictToString('Pass');
        expect(verdict).toBe('Pass');
    });
    it('converts Fail verdict to string with message', () => {
        const verdict = Guards.verdictToString({ TAG: 'Fail', _0: 'rate limit exceeded' });
        expect(verdict).toBe('Fail(rate limit exceeded)');
    });
    it('converts Defer verdict to string with message', () => {
        const verdict = Guards.verdictToString({ TAG: 'Defer', _0: 'async check pending' });
        expect(verdict).toBe('Defer(async check pending)');
    });
    it('identifies Pass verdict correctly', () => {
        expect(Guards.isPass('Pass')).toBe(true);
        expect(Guards.isPass({ TAG: 'Fail', _0: 'error' })).toBe(false);
        expect(Guards.isPass({ TAG: 'Defer', _0: 'pending' })).toBe(false);
    });
    it('identifies Fail verdict correctly', () => {
        expect(Guards.isFail({ TAG: 'Fail', _0: 'error' })).toBe(true);
        expect(Guards.isFail('Pass')).toBe(false);
        expect(Guards.isFail({ TAG: 'Defer', _0: 'pending' })).toBe(false);
    });
    it('identifies Defer verdict correctly', () => {
        expect(Guards.isDefer({ TAG: 'Defer', _0: 'pending' })).toBe(true);
        expect(Guards.isDefer('Pass')).toBe(false);
        expect(Guards.isDefer({ TAG: 'Fail', _0: 'error' })).toBe(false);
    });
});
describe('State-Based Guard', () => {
    it('allows transition when current state is in allowed states list', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.stateBasedGuard([runtimeStates.idle, runtimeStates.preparing], ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('blocks transition when current state is not in allowed states list', () => {
        const ctx = Guards.createGuardContext(runtimeStates.executing, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.stateBasedGuard([runtimeStates.idle, runtimeStates.preparing], ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Transition not allowed');
        expect(Guards.verdictToString(verdict)).toContain('EXECUTING');
    });
    it('provides clear error message with allowed states list', () => {
        const ctx = Guards.createGuardContext(runtimeStates.completed, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.stateBasedGuard([runtimeStates.idle], ctx);
        const verdictStr = Guards.verdictToString(verdict);
        expect(verdictStr).toContain('Allowed states: IDLE');
    });
});
describe('Event-Based Guard', () => {
    it('allows transition when event is in allowed events list', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.eventBasedGuard([runtimeEvents.dependenciesReady, runtimeEvents.retryTrigger], ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('blocks transition when event is not in allowed events list', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.telemetryFlushed, undefined);
        const verdict = Guards.eventBasedGuard([runtimeEvents.dependenciesReady], ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Event');
        expect(Guards.verdictToString(verdict)).toContain('not allowed');
    });
});
describe('Guard Combinators - AND', () => {
    it('passes when all guards pass', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guard1 = Guards.alwaysPassGuard;
        const guard2 = Guards.alwaysPassGuard;
        const verdict = Guards.andGuard([guard1, guard2], ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('fails when any guard fails', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guard1 = Guards.alwaysPassGuard;
        const guard2 = (ctx) => Guards.alwaysFailGuard('second guard failed', ctx);
        const verdict = Guards.andGuard([guard1, guard2], ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('second guard failed');
    });
    it('defers when any guard defers and no guards fail', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guard1 = Guards.alwaysPassGuard;
        const guard2 = (_ctx) => ({ TAG: 'Defer', _0: 'async check pending' });
        const verdict = Guards.andGuard([guard1, guard2], ctx);
        expect(Guards.isDefer(verdict)).toBe(true);
    });
    it('returns first failure when multiple guards fail', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guard1 = (ctx) => Guards.alwaysFailGuard('first failure', ctx);
        const guard2 = (ctx) => Guards.alwaysFailGuard('second failure', ctx);
        const verdict = Guards.andGuard([guard1, guard2], ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('first failure');
    });
});
describe('Guard Combinators - OR', () => {
    it('passes when at least one guard passes', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guard1 = (ctx) => Guards.alwaysFailGuard('first failed', ctx);
        const guard2 = Guards.alwaysPassGuard;
        const verdict = Guards.orGuard([guard1, guard2], ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('fails when all guards fail', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guard1 = (ctx) => Guards.alwaysFailGuard('first failed', ctx);
        const guard2 = (ctx) => Guards.alwaysFailGuard('second failed', ctx);
        const verdict = Guards.orGuard([guard1, guard2], ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('All guards failed');
        expect(Guards.verdictToString(verdict)).toContain('first failed');
        expect(Guards.verdictToString(verdict)).toContain('second failed');
    });
});
describe('Guard Combinators - NOT', () => {
    it('inverts Pass to Fail', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.notGuard(Guards.alwaysPassGuard, ctx);
        expect(Guards.isFail(verdict)).toBe(true);
    });
    it('inverts Fail to Pass', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const failGuard = (ctx) => Guards.alwaysFailGuard('should be inverted', ctx);
        const verdict = Guards.notGuard(failGuard, ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('preserves Defer verdicts', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const deferGuard = (_ctx) => ({ TAG: 'Defer', _0: 'async pending' });
        const verdict = Guards.notGuard(deferGuard, ctx);
        expect(Guards.isDefer(verdict)).toBe(true);
    });
});
describe('Metadata Field Guard', () => {
    it('passes when required field exists in metadata', () => {
        const metadata = {};
        const dict = Object.assign(Object.create(null), metadata);
        dict['taskId'] = '123';
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, dict);
        const verdict = Guards.metadataFieldGuard('taskId', ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('fails when required field is missing from metadata', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, Object.create(null));
        const verdict = Guards.metadataFieldGuard('taskId', ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Required metadata field missing: taskId');
    });
    it('fails when no metadata is provided', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.metadataFieldGuard('taskId', ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('No metadata provided');
    });
});
describe('Rate Limit Guard', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    it('allows first check within rate limit', () => {
        const state = Guards.createRateLimitState(1000, 3);
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        const verdict = Guards.rateLimitGuard(state, ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('allows checks within rate limit threshold', () => {
        const state = Guards.createRateLimitState(1000, 3);
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        Guards.rateLimitGuard(state, ctx); // 1st check
        Guards.rateLimitGuard(state, ctx); // 2nd check
        const verdict = Guards.rateLimitGuard(state, ctx); // 3rd check
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('blocks checks exceeding rate limit', () => {
        const state = Guards.createRateLimitState(1000, 2);
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        Guards.rateLimitGuard(state, ctx); // 1st check
        Guards.rateLimitGuard(state, ctx); // 2nd check
        const verdict = Guards.rateLimitGuard(state, ctx); // 3rd check - should fail
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Rate limit exceeded');
    });
    it('resets counter after time window expires', () => {
        const state = Guards.createRateLimitState(1000, 2);
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        Guards.rateLimitGuard(state, ctx); // 1st check
        Guards.rateLimitGuard(state, ctx); // 2nd check
        // Advance time beyond window
        vi.setSystemTime(new Date('2024-01-01T00:00:02Z')); // 2000ms later
        const verdict = Guards.rateLimitGuard(state, ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    afterEach(() => {
        vi.useRealTimers();
    });
});
describe('Dependency Check Guard', () => {
    it('passes when dependency is available', () => {
        const checker = () => 'Available';
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.dependencyCheckGuard(checker, ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('fails when dependency is missing', () => {
        const checker = () => ({ TAG: 'Missing', _0: 'module-xyz' });
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.dependencyCheckGuard(checker, ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Required dependency missing: module-xyz');
    });
    it('fails when dependency version mismatches', () => {
        const checker = () => ({ TAG: 'VersionMismatch', _0: 'expected v2.0, found v1.0' });
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.dependencyCheckGuard(checker, ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Dependency version mismatch');
    });
});
describe('Schema Validation Guard', () => {
    it('passes when schema validation succeeds', () => {
        const validator = (_payload) => 'Valid';
        const metadata = Object.create(null);
        metadata['field'] = 'value';
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, metadata);
        const verdict = Guards.schemaValidationGuard(validator, ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('fails when schema validation fails', () => {
        const validator = (_payload) => ({ TAG: 'Invalid', _0: 'field "name" is required' });
        const metadata = Object.create(null);
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, metadata);
        const verdict = Guards.schemaValidationGuard(validator, ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('Schema validation failed');
        expect(Guards.verdictToString(verdict)).toContain('field "name" is required');
    });
    it('fails when no metadata is provided for validation', () => {
        const validator = (_payload) => ({ TAG: 'Valid' });
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const verdict = Guards.schemaValidationGuard(validator, ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('No metadata provided');
    });
});
describe('Execute Guards - Batch Execution', () => {
    it('executes multiple guards and returns combined verdict', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guards = [
            [Guards.alwaysPassGuard, 'guard1'],
            [Guards.alwaysPassGuard, 'guard2'],
        ];
        const verdict = Guards.executeGuards(guards, ctx);
        expect(Guards.isPass(verdict)).toBe(true);
    });
    it('stops at first guard failure', () => {
        const ctx = Guards.createGuardContext(runtimeStates.idle, runtimeEvents.dependenciesReady, undefined);
        const guards = [
            [Guards.alwaysPassGuard, 'guard1'],
            [(ctx) => Guards.alwaysFailGuard('guard2 failed', ctx), 'guard2'],
            [Guards.alwaysPassGuard, 'guard3'],
        ];
        const verdict = Guards.executeGuards(guards, ctx);
        expect(Guards.isFail(verdict)).toBe(true);
        expect(Guards.verdictToString(verdict)).toContain('guard2 failed');
    });
});
//# sourceMappingURL=guards.test.js.map