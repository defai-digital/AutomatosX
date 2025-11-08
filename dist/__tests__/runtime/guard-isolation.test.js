// Sprint 1 Days 6-7: Guard Isolation & Verdict Signing Tests
// Threat T2 Mitigation: Guard Bypass Exploitation (High/P1)
import { describe, expect, it } from 'vitest';
import * as GuardIsolation from '../../../packages/rescript-core/src/security/GuardIsolation.bs.js';
// Test data factories
const createTestContext = (state, event, metadata) => {
    return GuardIsolation.createContext(state, event, metadata);
};
const mockSecretKey = 'test-secret-key-for-hmac';
describe('Guard Isolation - Context Freezing', () => {
    it('creates frozen context that cannot be modified during guard execution', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        expect(GuardIsolation.isFrozen(ctx)).toBe(true);
    });
    it('creates context with immutable state', () => {
        const metadata = { taskId: 'task-123' };
        const ctx = createTestContext('Preparing', 'TaskSubmitted', metadata);
        expect(ctx.currentState).toBe('Preparing');
        expect(ctx.event).toBe('TaskSubmitted');
        expect(ctx.frozen).toBe(true);
    });
    it('prevents execution if context is not frozen', () => {
        // Create a manually unfrozen context (simulating tampering attempt)
        const ctx = {
            currentState: 'Idle',
            event: 'DependenciesReady',
            metadata: undefined,
            frozen: false // Manually unfrozen
        };
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        expect(result.isolated).toBe(false);
        expect(result.signedVerdict.verdict.TAG).toBe('Fail');
        expect(result.signedVerdict.verdict._0).toContain('frozen');
    });
});
describe('Verdict Signature - HMAC Signing', () => {
    it('signs guard verdict with HMAC signature', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const verdict = 'Pass';
        const signedVerdict = GuardIsolation.signVerdict(verdict, 'test-guard', ctx, mockSecretKey);
        expect(signedVerdict.verdict).toBe('Pass');
        expect(signedVerdict.guardName).toBe('test-guard');
        expect(signedVerdict.signature).toBeTruthy();
        expect(typeof signedVerdict.signature).toBe('string');
        expect(signedVerdict.timestamp).toBeGreaterThan(0);
    });
    it('verifies valid signature successfully', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const verdict = 'Pass';
        const signedVerdict = GuardIsolation.signVerdict(verdict, 'test-guard', ctx, mockSecretKey);
        const isValid = GuardIsolation.verifySignature(signedVerdict, ctx, mockSecretKey);
        expect(isValid).toBe(true);
    });
    it('rejects signature verification with wrong secret key', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const verdict = 'Pass';
        const signedVerdict = GuardIsolation.signVerdict(verdict, 'test-guard', ctx, mockSecretKey);
        const isValid = GuardIsolation.verifySignature(signedVerdict, ctx, 'wrong-secret-key');
        expect(isValid).toBe(false);
    });
    it('rejects signature verification with tampered context', () => {
        const ctx1 = createTestContext('Idle', 'DependenciesReady', undefined);
        const ctx2 = createTestContext('Preparing', 'TaskSubmitted', undefined); // Different context
        const verdict = 'Pass';
        const signedVerdict = GuardIsolation.signVerdict(verdict, 'test-guard', ctx1, mockSecretKey);
        const isValid = GuardIsolation.verifySignature(signedVerdict, ctx2, mockSecretKey); // Verify with different context
        expect(isValid).toBe(false);
    });
    it('detects expired signatures based on max age', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const verdict = 'Pass';
        const signedVerdict = GuardIsolation.signVerdict(verdict, 'test-guard', ctx, mockSecretKey);
        // Check if not expired within 1 hour
        const isExpired1Hour = GuardIsolation.isSignatureExpired(signedVerdict, 3600000); // 1 hour
        expect(isExpired1Hour).toBe(false);
        // Check if expired with 0ms max age (signature created in past)
        const isExpiredImmediate = GuardIsolation.isSignatureExpired(signedVerdict, -1);
        expect(isExpiredImmediate).toBe(true);
    });
});
describe('Isolated Guard Executor', () => {
    it('executes guard in isolated context and returns signed verdict', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        expect(result.isolated).toBe(true);
        expect(result.signedVerdict.verdict).toBe('Pass');
        expect(result.signedVerdict.guardName).toBe('test-guard');
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
    it('captures guard execution time', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => {
            // Simulate some work
            let sum = 0;
            for (let i = 0; i < 1000; i++) {
                sum += i;
            }
            return 'Pass';
        };
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        expect(result.executionTimeMs).toBeGreaterThan(0);
        expect(result.signedVerdict.verdict).toBe('Pass');
    });
    it('handles guard execution failures gracefully', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => {
            throw new Error('Guard execution failed');
        };
        const result = GuardIsolation.executeGuardIsolated(guard, 'failing-guard', ctx, mockSecretKey);
        expect(result.isolated).toBe(true);
        expect(result.signedVerdict.verdict.TAG).toBe('Fail');
        expect(result.signedVerdict.verdict._0).toContain('Guard execution exception');
    });
    it('executes batch of guards with early termination on failure', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard1 = (ctx) => 'Pass';
        const guard2 = (ctx) => ({ TAG: 'Fail', _0: 'Second guard failed' });
        const guard3 = (ctx) => 'Pass'; // Should not execute due to early termination
        const guards = [
            [guard1, 'guard1'],
            [guard2, 'guard2'],
            [guard3, 'guard3']
        ];
        const results = GuardIsolation.executeGuardsBatch(guards, ctx, mockSecretKey);
        // Should stop after second guard (fail-fast)
        expect(results.length).toBe(2);
        expect(results[0].signedVerdict.verdict).toBe('Pass');
        expect(results[1].signedVerdict.verdict.TAG).toBe('Fail');
    });
    it('combines guard verdicts with AND logic', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard1 = (ctx) => 'Pass';
        const guard2 = (ctx) => 'Pass';
        const guards = [
            [guard1, 'guard1'],
            [guard2, 'guard2']
        ];
        const results = GuardIsolation.executeGuardsBatch(guards, ctx, mockSecretKey);
        const combinedVerdict = GuardIsolation.combineGuardVerdicts(results);
        expect(combinedVerdict).toBe('Pass');
    });
    it('combines verdicts with first failure winning', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard1 = (ctx) => 'Pass';
        const guard2 = (ctx) => ({ TAG: 'Fail', _0: 'Critical failure' });
        const guards = [
            [guard1, 'guard1'],
            [guard2, 'guard2']
        ];
        const results = GuardIsolation.executeGuardsBatch(guards, ctx, mockSecretKey);
        const combinedVerdict = GuardIsolation.combineGuardVerdicts(results);
        expect(combinedVerdict).toEqual({ TAG: 'Fail', _0: 'Critical failure' });
    });
});
describe('Audit Log - Immutable Logging', () => {
    it('creates empty audit log', () => {
        const log = GuardIsolation.createAuditLog();
        expect(Array.isArray(log)).toBe(true);
        expect(log.length).toBe(0);
    });
    it('appends guard execution result to audit log', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        let log = GuardIsolation.createAuditLog();
        log = GuardIsolation.appendToAuditLog(log, result);
        expect(log.length).toBe(1);
        expect(log[0].guardName).toBe('test-guard');
        expect(log[0].verdict).toBe('Pass');
        expect(log[0].signature).toBeTruthy();
    });
    it('maintains immutability of audit log (creates new array on append)', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        const log1 = GuardIsolation.createAuditLog();
        const log2 = GuardIsolation.appendToAuditLog(log1, result);
        expect(log1.length).toBe(0); // Original log unchanged
        expect(log2.length).toBe(1); // New log with entry
    });
    it('verifies audit log integrity with valid signatures', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard1 = (ctx) => 'Pass';
        const guard2 = (ctx) => ({ TAG: 'Defer', _0: 'Async check pending' });
        const result1 = GuardIsolation.executeGuardIsolated(guard1, 'guard1', ctx, mockSecretKey);
        const result2 = GuardIsolation.executeGuardIsolated(guard2, 'guard2', ctx, mockSecretKey);
        let log = GuardIsolation.createAuditLog();
        log = GuardIsolation.appendToAuditLog(log, result1);
        log = GuardIsolation.appendToAuditLog(log, result2);
        const isValid = GuardIsolation.verifyAuditLogIntegrity(log, ctx, mockSecretKey);
        expect(isValid).toBe(true);
    });
    it('detects tampered audit log with invalid signatures', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        let log = GuardIsolation.createAuditLog();
        log = GuardIsolation.appendToAuditLog(log, result);
        // Verify with different secret key (simulating tampering)
        const isValid = GuardIsolation.verifyAuditLogIntegrity(log, ctx, 'wrong-secret-key');
        expect(isValid).toBe(false);
    });
    it('records execution time in audit log entries', () => {
        const ctx = createTestContext('Idle', 'DependenciesReady', undefined);
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey);
        let log = GuardIsolation.createAuditLog();
        log = GuardIsolation.appendToAuditLog(log, result);
        expect(log[0].executionTimeMs).toBeGreaterThanOrEqual(0);
    });
});
describe('Threat T2 Mitigation - Integration Tests', () => {
    it('prevents guard verdict tampering through signature verification', () => {
        const ctx = createTestContext('Preparing', 'DependenciesReady', undefined);
        const guard = (ctx) => 'Pass';
        const result = GuardIsolation.executeGuardIsolated(guard, 'auth-guard', ctx, mockSecretKey);
        // Attacker attempts to tamper with verdict
        const tamperedVerdict = {
            ...result.signedVerdict,
            verdict: { TAG: 'Fail', _0: 'Tampered failure' } // Changed from Pass to Fail
        };
        // Signature verification should fail
        const isValid = GuardIsolation.verifySignature(tamperedVerdict, ctx, mockSecretKey);
        expect(isValid).toBe(false);
    });
    it('provides complete audit trail for guard evaluations', () => {
        const ctx = createTestContext('Preparing', 'DependenciesReady', { taskId: 'task-123' });
        const guards = [
            [(ctx) => 'Pass', 'rate-limit-guard'],
            [(ctx) => 'Pass', 'policy-guard'],
            [(ctx) => ({ TAG: 'Defer', _0: 'Dependency check pending' }), 'dependency-guard']
        ];
        let log = GuardIsolation.createAuditLog();
        guards.forEach(([guard, guardName]) => {
            const result = GuardIsolation.executeGuardIsolated(guard, guardName, ctx, mockSecretKey);
            log = GuardIsolation.appendToAuditLog(log, result);
        });
        expect(log.length).toBe(3);
        expect(log[0].guardName).toBe('rate-limit-guard');
        expect(log[1].guardName).toBe('policy-guard');
        expect(log[2].guardName).toBe('dependency-guard');
        // All entries should have valid signatures
        const isValid = GuardIsolation.verifyAuditLogIntegrity(log, ctx, mockSecretKey);
        expect(isValid).toBe(true);
    });
    it('enforces context immutability during guard execution', () => {
        const metadata = { taskId: 'task-123', attempt: 1 };
        const ctx = createTestContext('Preparing', 'DependenciesReady', metadata);
        // Guard that attempts to modify context (should fail)
        const maliciousGuard = (ctx) => {
            try {
                ctx.currentState = 'Executing'; // Attempt to modify frozen context
            }
            catch (e) {
                // Frozen context should prevent modification
            }
            return 'Pass';
        };
        const result = GuardIsolation.executeGuardIsolated(maliciousGuard, 'malicious-guard', ctx, mockSecretKey);
        // Context should remain unchanged
        expect(ctx.currentState).toBe('Preparing');
        expect(result.isolated).toBe(true);
    });
});
//# sourceMappingURL=guard-isolation.test.js.map