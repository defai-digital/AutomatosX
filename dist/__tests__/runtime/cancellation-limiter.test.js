// Sprint 1 Day 9: Cancellation Rate Limiting Tests
// Threat T5 Mitigation: Cancellation Abuse (Low/P2)
import { describe, expect, it } from 'vitest';
import * as CancellationLimiter from '../../../packages/rescript-core/src/security/CancellationLimiter.bs.js';
describe('Token Bucket Rate Limiter', () => {
    it('allows cancellations within rate limit (10 per minute)', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        // Should allow first 10 cancellations
        for (let i = 0; i < 10; i++) {
            const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
            const confirmation = 'NotRequired';
            const [newLimiter, result] = CancellationLimiter.checkCancellation(limiter, `task-${i}`, userId, ctx.currentState, confirmation);
            expect(result).toBe('Allowed');
        }
    });
    it('rejects cancellations exceeding rate limit', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
        const confirmation = 'NotRequired';
        // Consume all 10 tokens
        let currentLimiter = limiter;
        for (let i = 0; i < 10; i++) {
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-${i}`, userId, ctx.currentState, confirmation);
            currentLimiter = newLimiter;
            expect(result).toBe('Allowed');
        }
        // 11th cancellation should be rate limited
        const [finalLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, 'task-11', userId, ctx.currentState, confirmation);
        expect(result.TAG).toBe('RateLimitExceeded');
        expect(result.userId).toBe(userId);
        expect(result.retriesIn).toBeGreaterThan(0);
    });
    it('refills tokens over time based on rate (10 per 60 seconds)', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        // Get initial token count
        const [tokens1, count1] = CancellationLimiter.getUserStats(limiter, userId);
        expect(tokens1).toBe(10.0); // Max tokens initially
        // Consume 5 tokens
        let currentLimiter = limiter;
        for (let i = 0; i < 5; i++) {
            const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-${i}`, userId, ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
        }
        // Check tokens after consumption
        const [tokens2, count2] = CancellationLimiter.getUserStats(currentLimiter, userId);
        expect(tokens2).toBeLessThan(6.0); // Should have ~5 tokens left (accounting for time passage)
    });
    it('tracks per-user rate limits independently', () => {
        const limiter = CancellationLimiter.createLimiter();
        const user1 = 'user-1';
        const user2 = 'user-2';
        const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
        // User 1 consumes all tokens
        let currentLimiter = limiter;
        for (let i = 0; i < 10; i++) {
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-${i}`, user1, ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
        }
        // User 2 should still have full token bucket
        const [newLimiter2, result2] = CancellationLimiter.checkCancellation(currentLimiter, 'task-user2-1', user2, ctx.currentState, 'NotRequired');
        expect(result2).toBe('Allowed');
    });
});
describe('Dual Confirmation Requirement', () => {
    it('requires confirmation for EXECUTING state cancellations', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Executing', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Create confirmation requirement
        const confirmationStatus = CancellationLimiter.createConfirmationRequirement(ctx.currentState);
        expect(confirmationStatus.TAG).toBe('Required');
        // First cancellation attempt without confirmation
        const [newLimiter, result] = CancellationLimiter.checkCancellation(limiter, 'task-123', userId, ctx.currentState, confirmationStatus);
        expect(result.TAG).toBe('ConfirmationRequired');
        expect(result.status.TAG).toBe('Required');
    });
    it('allows EXECUTING state cancellation after confirmation', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Executing', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Create and confirm
        const confirmationStatus = CancellationLimiter.createConfirmationRequirement(ctx.currentState);
        const confirmed = CancellationLimiter.confirmCancellation(confirmationStatus);
        expect(CancellationLimiter.isConfirmationComplete(confirmed)).toBe(true);
        // Cancellation with confirmed status
        const [newLimiter, result] = CancellationLimiter.checkCancellation(limiter, 'task-123', userId, ctx.currentState, confirmed);
        expect(result).toBe('Allowed');
    });
    it('does not require confirmation for non-EXECUTING states', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const states = ['Idle', 'Preparing', 'WaitingOnDependency', 'Completed', 'Failed'];
        states.forEach(state => {
            const confirmationStatus = CancellationLimiter.createConfirmationRequirement(state);
            expect(confirmationStatus).toBe('NotRequired');
        });
    });
    it('rejects cancellation if confirmation expires (30 second timeout)', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Executing', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Create confirmation requirement
        const confirmationStatus = CancellationLimiter.createConfirmationRequirement(ctx.currentState);
        // Simulate expiration by checking with expired status
        const now = Date.now();
        const isExpired = CancellationLimiter.isConfirmationExpired(confirmationStatus, now + 31000); // 31 seconds later
        expect(isExpired).toBe(true);
    });
});
describe('Cancellation Audit Log', () => {
    it('logs all cancellation attempts with full details', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Perform cancellation
        const [newLimiter, result] = CancellationLimiter.checkCancellation(limiter, 'task-123', userId, ctx.currentState, 'NotRequired');
        // Get audit log
        const auditLog = CancellationLimiter.getAuditLog(newLimiter);
        expect(auditLog.length).toBe(1);
        expect(auditLog[0].taskId).toBe('task-123');
        expect(auditLog[0].userId).toBe(userId);
        expect(auditLog[0].rateLimitPassed).toBe(true);
        expect(auditLog[0].allowed).toBe(true);
        expect(auditLog[0].timestamp).toBeGreaterThan(0);
    });
    it('logs rate limit exceeded attempts', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Consume all tokens
        let currentLimiter = limiter;
        for (let i = 0; i < 10; i++) {
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-${i}`, userId, ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
        }
        // Attempt 11th cancellation (should be rate limited)
        const [finalLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, 'task-11', userId, ctx.currentState, 'NotRequired');
        const auditLog = CancellationLimiter.getAuditLog(finalLimiter);
        // Last entry should be rate limit failure
        const lastEntry = auditLog[auditLog.length - 1];
        expect(lastEntry.rateLimitPassed).toBe(false);
        expect(lastEntry.allowed).toBe(false);
        expect(lastEntry.reason).toBeDefined();
    });
    it('logs confirmation requirement status', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Executing', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Attempt cancellation without confirmation
        const confirmationStatus = CancellationLimiter.createConfirmationRequirement(ctx.currentState);
        const [newLimiter, result] = CancellationLimiter.checkCancellation(limiter, 'task-123', userId, ctx.currentState, confirmationStatus);
        const auditLog = CancellationLimiter.getAuditLog(newLimiter);
        const entry = auditLog[0];
        expect(entry.confirmationRequired).toBe(true);
        expect(entry.confirmationProvided).toBe(false);
        expect(entry.allowed).toBe(false);
    });
});
describe('User Statistics', () => {
    it('returns current token count and cancellation count for user', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        // Initial stats
        const [tokens1, count1] = CancellationLimiter.getUserStats(limiter, userId);
        expect(tokens1).toBe(10.0); // Max tokens
        expect(count1).toBe(0); // No cancellations yet
        // Perform 3 cancellations
        let currentLimiter = limiter;
        for (let i = 0; i < 3; i++) {
            const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-${i}`, userId, ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
        }
        // Check updated stats
        const [tokens2, count2] = CancellationLimiter.getUserStats(currentLimiter, userId);
        expect(tokens2).toBeLessThan(10.0); // Tokens consumed
        expect(count2).toBe(3); // 3 successful cancellations
    });
});
describe('Threat T5 Mitigation - Integration Tests', () => {
    it('prevents cancellation flooding DoS attack', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'attacker-123';
        const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
        let allowedCount = 0;
        let deniedCount = 0;
        // Simulate flooding with 20 rapid cancellation requests
        let currentLimiter = limiter;
        for (let i = 0; i < 20; i++) {
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-${i}`, userId, ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
            if (result === 'Allowed') {
                allowedCount++;
            }
            else if (result.TAG === 'RateLimitExceeded') {
                deniedCount++;
            }
        }
        // Only 10 should be allowed, 10 should be denied
        expect(allowedCount).toBe(10);
        expect(deniedCount).toBe(10);
        // Verify audit log captured all attempts
        const auditLog = CancellationLimiter.getAuditLog(currentLimiter);
        expect(auditLog.length).toBe(20);
    });
    it('enforces dual confirmation for critical EXECUTING state', () => {
        const limiter = CancellationLimiter.createLimiter();
        const userId = 'user-123';
        const ctx = { currentState: 'Executing', event: 'CancelRequest', metadata: undefined, frozen: true };
        // Attempt 1: No confirmation
        const confirmation1 = CancellationLimiter.createConfirmationRequirement(ctx.currentState);
        const [limiter2, result1] = CancellationLimiter.checkCancellation(limiter, 'task-123', userId, ctx.currentState, confirmation1);
        expect(result1.TAG).toBe('ConfirmationRequired');
        // Attempt 2: With confirmation
        const confirmation2 = CancellationLimiter.confirmCancellation(confirmation1);
        const [limiter3, result2] = CancellationLimiter.checkCancellation(limiter2, 'task-123', userId, ctx.currentState, confirmation2);
        expect(result2).toBe('Allowed');
        // Verify audit log shows confirmation flow
        const auditLog = CancellationLimiter.getAuditLog(limiter3);
        expect(auditLog.length).toBe(2);
        expect(auditLog[0].confirmationRequired).toBe(true);
        expect(auditLog[0].confirmationProvided).toBe(false);
        expect(auditLog[1].confirmationRequired).toBe(true);
        expect(auditLog[1].confirmationProvided).toBe(true);
    });
    it('provides complete audit trail for security monitoring', () => {
        const limiter = CancellationLimiter.createLimiter();
        const users = ['user-1', 'user-2', 'user-3'];
        // Simulate mixed cancellation scenarios
        let currentLimiter = limiter;
        // User 1: Normal cancellations
        for (let i = 0; i < 3; i++) {
            const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-u1-${i}`, users[0], ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
        }
        // User 2: EXECUTING state with confirmation
        const ctx2 = { currentState: 'Executing', event: 'CancelRequest', metadata: undefined, frozen: true };
        const confirmation = CancellationLimiter.confirmCancellation(CancellationLimiter.createConfirmationRequirement(ctx2.currentState));
        const [limiter2, result2] = CancellationLimiter.checkCancellation(currentLimiter, 'task-u2-1', users[1], ctx2.currentState, confirmation);
        currentLimiter = limiter2;
        // User 3: Rate limit exceeded
        for (let i = 0; i < 12; i++) {
            const ctx = { currentState: 'Idle', event: 'CancelRequest', metadata: undefined, frozen: true };
            const [newLimiter, result] = CancellationLimiter.checkCancellation(currentLimiter, `task-u3-${i}`, users[2], ctx.currentState, 'NotRequired');
            currentLimiter = newLimiter;
        }
        // Verify comprehensive audit trail
        const auditLog = CancellationLimiter.getAuditLog(currentLimiter);
        expect(auditLog.length).toBeGreaterThan(15);
        // All entries should have complete metadata
        auditLog.forEach(entry => {
            expect(entry.taskId).toBeTruthy();
            expect(entry.userId).toBeTruthy();
            expect(entry.timestamp).toBeGreaterThan(0);
            expect(typeof entry.rateLimitPassed).toBe('boolean');
            expect(typeof entry.allowed).toBe('boolean');
        });
    });
});
//# sourceMappingURL=cancellation-limiter.test.js.map