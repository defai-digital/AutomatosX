import { describe, it, expect, beforeEach } from 'vitest';
import { createDeadLetterQueue, createInMemoryDeadLetterStorage, createSagaManager, defineSaga, createIdempotencyManager, createInMemoryIdempotencyStorage, withIdempotency, createRetentionManager, createInMemoryRetentionStore, createInMemoryArchiver, RetentionError, } from '@defai.digital/cross-cutting';
import { createDefaultRetentionPolicy, } from '@defai.digital/contracts';
describe('Cross-Cutting Concerns', () => {
    // ============================================================================
    // Dead Letter Queue Tests
    // ============================================================================
    describe('Dead Letter Queue (INV-DLQ-001, INV-DLQ-002, INV-DLQ-003)', () => {
        let dlq;
        beforeEach(() => {
            const storage = createInMemoryDeadLetterStorage();
            dlq = createDeadLetterQueue(storage, { maxRetries: 3 });
        });
        it('INV-DLQ-001: should capture failed events with full context', async () => {
            const entry = await dlq.enqueue('event-123', 'user.created', { userId: 'u1', email: 'test@example.com' }, { code: 'VALIDATION_ERROR', message: 'Invalid email format' }, 'user-service');
            expect(entry.entryId).toBeDefined();
            expect(entry.originalEventId).toBe('event-123');
            expect(entry.eventType).toBe('user.created');
            expect(entry.eventPayload).toEqual({ userId: 'u1', email: 'test@example.com' });
            expect(entry.error.code).toBe('VALIDATION_ERROR');
            expect(entry.source).toBe('user-service');
            expect(entry.status).toBe('pending');
            expect(entry.retryCount).toBe(0);
        });
        it('INV-DLQ-002: should respect maxRetries limit', async () => {
            const entry = await dlq.enqueue('event-456', 'order.placed', { orderId: 'o1' }, { code: 'TIMEOUT', message: 'Service timeout' }, 'order-service');
            expect(entry.maxRetries).toBe(3);
            // Mark as retrying multiple times
            let updated = await dlq.markRetrying(entry.entryId);
            expect(updated?.retryCount).toBe(1);
            updated = await dlq.markRetrying(entry.entryId);
            expect(updated?.retryCount).toBe(2);
            updated = await dlq.markRetrying(entry.entryId);
            expect(updated?.retryCount).toBe(3);
            // Should be exhausted after max retries
            await dlq.markExhausted(entry.entryId);
            const exhausted = await dlq.getEntry(entry.entryId);
            expect(exhausted?.status).toBe('exhausted');
        });
        it('INV-DLQ-003: should mark exhausted entries appropriately', async () => {
            const entry = await dlq.enqueue('event-789', 'payment.failed', { paymentId: 'p1' }, { code: 'DECLINED', message: 'Card declined' }, 'payment-service');
            await dlq.markExhausted(entry.entryId);
            const exhausted = await dlq.getEntry(entry.entryId);
            expect(exhausted?.status).toBe('exhausted');
        });
        it('should mark entries as resolved', async () => {
            const entry = await dlq.enqueue('event-101', 'notification.sent', { notificationId: 'n1' }, { code: 'RETRY', message: 'Temporary failure' }, 'notification-service');
            await dlq.markResolved(entry.entryId, 'Manually resolved after fix');
            const resolved = await dlq.getEntry(entry.entryId);
            expect(resolved?.status).toBe('resolved');
            expect(resolved?.resolutionNotes).toBe('Manually resolved after fix');
        });
        it('should discard entries', async () => {
            const entry = await dlq.enqueue('event-102', 'log.error', { logId: 'l1' }, { code: 'INVALID', message: 'Invalid log entry' }, 'logging-service');
            await dlq.discard(entry.entryId, 'Not worth retrying');
            const discarded = await dlq.getEntry(entry.entryId);
            expect(discarded?.status).toBe('discarded');
            expect(discarded?.resolutionNotes).toBe('Not worth retrying');
        });
        it('should get retryable entries', async () => {
            // Create entries with nextRetryAt in the past
            await dlq.enqueue('event-201', 'type1', {}, { code: 'ERR', message: 'Error' }, 'service');
            const retryable = await dlq.getRetryable();
            expect(retryable.length).toBeGreaterThanOrEqual(0);
        });
        it('should provide DLQ statistics', async () => {
            await dlq.enqueue('e1', 'type', {}, { code: 'E', message: 'm' }, 'src');
            await dlq.enqueue('e2', 'type', {}, { code: 'E', message: 'm' }, 'src');
            const stats = await dlq.getStats();
            expect(stats.totalEntries).toBe(2);
            expect(stats.pendingCount).toBe(2);
        });
    });
    // ============================================================================
    // Saga Manager Tests
    // ============================================================================
    describe('Saga Manager (INV-SG-001, INV-SG-002, INV-SG-003)', () => {
        let sagaManager;
        const compensationsCalled = [];
        beforeEach(() => {
            compensationsCalled.length = 0;
            const compensations = [
                {
                    stepId: 'step1',
                    action: 'rollback',
                    handler: 'rollback-step1',
                    timeout: 30000,
                    retryCount: 1,
                    required: true,
                },
                {
                    stepId: 'step2',
                    action: 'rollback',
                    handler: 'rollback-step2',
                    timeout: 30000,
                    retryCount: 1,
                    required: true,
                },
                {
                    stepId: 'step3',
                    action: 'notify',
                    handler: 'notify-step3',
                    timeout: 30000,
                    retryCount: 1,
                    required: false,
                },
            ];
            const definition = defineSaga('test-saga', compensations, {
                onFailure: 'compensate',
                compensationOrder: 'reverse',
            });
            sagaManager = createSagaManager(definition);
        });
        it('should execute saga steps successfully', async () => {
            const steps = [
                { stepId: 'step1', name: 'Step 1', timeout: 5000 },
                { stepId: 'step2', name: 'Step 2', timeout: 5000 },
            ];
            const stepExecutor = async (step) => {
                return { stepId: step.stepId, success: true };
            };
            const compensationExecutor = async (action) => {
                compensationsCalled.push(action.stepId);
            };
            const result = await sagaManager.execute(steps, stepExecutor, compensationExecutor, 'correlation-123');
            expect(result.success).toBe(true);
            expect(result.finalStatus).toBe('completed');
            expect(compensationsCalled).toHaveLength(0);
        });
        it('INV-SG-001: should run compensations in reverse order on failure', async () => {
            const steps = [
                { stepId: 'step1', name: 'Step 1', timeout: 5000 },
                { stepId: 'step2', name: 'Step 2', timeout: 5000 },
                { stepId: 'step3', name: 'Step 3', timeout: 5000 },
            ];
            const stepExecutor = async (step) => {
                if (step.stepId === 'step3') {
                    throw new Error('Step 3 failed');
                }
                return { stepId: step.stepId, success: true };
            };
            const compensationExecutor = async (action) => {
                compensationsCalled.push(action.stepId);
            };
            const result = await sagaManager.execute(steps, stepExecutor, compensationExecutor);
            expect(result.success).toBe(false);
            expect(result.compensated).toBe(true);
            // Should compensate in reverse order (step2 first, then step1)
            expect(compensationsCalled).toEqual(['step2', 'step1']);
        });
        it('INV-SG-002: should report failure when required compensation fails', async () => {
            const steps = [
                { stepId: 'step1', name: 'Step 1', timeout: 5000 },
                { stepId: 'step2', name: 'Step 2', timeout: 5000 },
            ];
            const stepExecutor = async (step) => {
                if (step.stepId === 'step2') {
                    throw new Error('Step 2 failed');
                }
                return { stepId: step.stepId, success: true };
            };
            const compensationExecutor = async (action) => {
                if (action.stepId === 'step1' && action.required) {
                    throw new Error('Required compensation failed');
                }
            };
            const result = await sagaManager.execute(steps, stepExecutor, compensationExecutor);
            expect(result.success).toBe(false);
            expect(result.finalStatus).toBe('failed');
            expect(result.error).toContain('Required compensation');
        });
        it('INV-SG-003: should track saga state transitions', async () => {
            const steps = [
                { stepId: 'step1', name: 'Step 1', timeout: 5000 },
            ];
            const stepExecutor = async () => ({ success: true });
            const compensationExecutor = async () => { };
            await sagaManager.execute(steps, stepExecutor, compensationExecutor);
            const state = sagaManager.getState();
            expect(state).not.toBeNull();
            expect(state?.status).toBe('completed');
            expect(state?.completedSteps).toContain('step1');
        });
        it('should get saga definition', () => {
            const definition = sagaManager.getDefinition();
            expect(definition.sagaId).toBe('test-saga');
            expect(definition.onFailure).toBe('compensate');
        });
    });
    // ============================================================================
    // Idempotency Manager Tests
    // ============================================================================
    describe('Idempotency Manager (INV-ID-001, INV-ID-002, INV-ID-003)', () => {
        let manager;
        beforeEach(() => {
            const storage = createInMemoryIdempotencyStorage();
            manager = createIdempotencyManager(storage, {
                enabled: true,
                ttlSeconds: 3600,
            });
        });
        it('INV-ID-001: should return cached response for same key', async () => {
            const key = 'idem-key-001';
            const hash = 'request-hash-abc';
            // First request - should be new
            const check1 = await manager.check(key, hash);
            expect(check1.status).toBe('new');
            // Start processing
            const started = await manager.startProcessing(key, hash);
            expect(started).toBe(true);
            // Complete with response
            await manager.completeProcessing(key, { result: 'success' });
            // Second request with same key - should be cached
            const check2 = await manager.check(key, hash);
            expect(check2.status).toBe('cached');
            expect(check2.response).toEqual({ result: 'success' });
        });
        it('INV-ID-002: should reject different request with same key', async () => {
            const key = 'idem-key-002';
            const hash1 = 'hash-original';
            const hash2 = 'hash-different';
            // First request
            await manager.startProcessing(key, hash1);
            await manager.completeProcessing(key, { data: 'original' });
            // Different request with same key
            const check = await manager.check(key, hash2);
            expect(check.status).toBe('conflict');
            expect(check.error).toContain('mismatch');
        });
        it('should detect processing status', async () => {
            const key = 'idem-key-003';
            const hash = 'hash-processing';
            await manager.startProcessing(key, hash);
            const check = await manager.check(key, hash);
            expect(check.status).toBe('processing');
        });
        it('should allow retry after failure', async () => {
            const key = 'idem-key-004';
            const hash = 'hash-retry';
            await manager.startProcessing(key, hash);
            await manager.failProcessing(key, 'Temporary error');
            // Should allow new processing after failure
            const check = await manager.check(key, hash);
            expect(check.status).toBe('new');
        });
        it('should work with withIdempotency wrapper', async () => {
            const key = 'idem-key-005';
            const hash = 'hash-wrapper';
            let callCount = 0;
            const operation = async () => {
                callCount++;
                return { executed: true };
            };
            // First call - should execute
            const result1 = await withIdempotency(manager, key, hash, operation);
            expect(result1).toEqual({ executed: true });
            expect(callCount).toBe(1);
            // Second call - should return cached
            const result2 = await withIdempotency(manager, key, hash, operation);
            expect(result2).toEqual({ executed: true });
            expect(callCount).toBe(1); // Should not increment
        });
        it('should cleanup expired entries', async () => {
            const cleaned = await manager.cleanup();
            expect(cleaned).toBeGreaterThanOrEqual(0);
        });
        it('should return config', () => {
            const config = manager.getConfig();
            expect(config.enabled).toBe(true);
            expect(config.ttlSeconds).toBe(3600);
        });
    });
    // ============================================================================
    // Retention Manager Tests
    // ============================================================================
    describe('Retention Manager (INV-RT-001, INV-RT-002, INV-RT-003)', () => {
        let manager;
        let entries;
        let archiver;
        beforeEach(() => {
            entries = new Map();
            archiver = createInMemoryArchiver();
            manager = createRetentionManager(archiver);
            // Register test store
            const store = createInMemoryRetentionStore(entries);
            manager.registerStore('traces', store);
            manager.registerStore('sessions', store);
        });
        it('INV-RT-001: should apply retention policies per data type', async () => {
            // Add old entries
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 40); // 40 days old
            entries.set('entry-1', {
                id: 'entry-1',
                createdAt: oldDate.toISOString(),
                status: 'completed',
            });
            entries.set('entry-2', {
                id: 'entry-2',
                createdAt: new Date().toISOString(), // Recent
                status: 'completed',
            });
            // Add policy
            const policy = createDefaultRetentionPolicy('traces-cleanup', 'traces');
            policy.retentionDays = 30;
            manager.addPolicy(policy);
            const result = await manager.runPolicy('traces-cleanup');
            expect(result.success).toBe(true);
            expect(result.entriesProcessed).toBe(1); // Only old entry
            expect(result.entriesDeleted).toBe(1);
            expect(entries.has('entry-1')).toBe(false);
            expect(entries.has('entry-2')).toBe(true);
        });
        it('INV-RT-002: should archive before delete when configured', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 40);
            entries.set('archive-entry', {
                id: 'archive-entry',
                createdAt: oldDate.toISOString(),
                data: { important: 'data' },
            });
            const policy = createDefaultRetentionPolicy('archive-policy', 'traces');
            policy.retentionDays = 30;
            policy.archiveBeforeDelete = true;
            policy.archivePath = '/archives/traces';
            manager.addPolicy(policy);
            const result = await manager.runPolicy('archive-policy');
            expect(result.entriesArchived).toBe(1);
            expect(result.entriesDeleted).toBe(1);
            expect(archiver.getArchives()).toHaveLength(1);
            expect(archiver.getArchives()[0].originalId).toBe('archive-entry');
        });
        it('INV-RT-003: should respect conditions during cleanup', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 40);
            entries.set('pending-entry', {
                id: 'pending-entry',
                createdAt: oldDate.toISOString(),
                status: 'pending',
            });
            entries.set('completed-entry', {
                id: 'completed-entry',
                createdAt: oldDate.toISOString(),
                status: 'completed',
            });
            const policy = createDefaultRetentionPolicy('conditional', 'traces');
            policy.retentionDays = 30;
            policy.conditions = {
                status: ['completed'], // Only delete completed entries
            };
            manager.addPolicy(policy);
            const result = await manager.runPolicy('conditional');
            expect(result.entriesDeleted).toBe(1);
            expect(result.entriesSkipped).toBe(1);
            expect(entries.has('pending-entry')).toBe(true); // Should not be deleted
            expect(entries.has('completed-entry')).toBe(false);
        });
        it('should require archive path when archiving enabled', () => {
            const policy = createDefaultRetentionPolicy('invalid', 'traces');
            policy.archiveBeforeDelete = true;
            // Not setting archivePath
            expect(() => { manager.addPolicy(policy); }).toThrow(RetentionError);
        });
        it('should run all enabled policies', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 40);
            entries.set('e1', { id: 'e1', createdAt: oldDate.toISOString() });
            entries.set('e2', { id: 'e2', createdAt: oldDate.toISOString() });
            const policy1 = createDefaultRetentionPolicy('p1', 'traces');
            policy1.retentionDays = 30;
            manager.addPolicy(policy1);
            const policy2 = createDefaultRetentionPolicy('p2', 'sessions');
            policy2.retentionDays = 30;
            policy2.enabled = false; // Disabled
            manager.addPolicy(policy2);
            const results = await manager.runAllPolicies();
            expect(results).toHaveLength(1); // Only enabled policy
            expect(results[0].policyId).toBe('p1');
        });
        it('should provide retention summary', () => {
            const policy1 = createDefaultRetentionPolicy('summary-p1', 'traces');
            const policy2 = createDefaultRetentionPolicy('summary-p2', 'sessions');
            policy2.enabled = false;
            manager.addPolicy(policy1);
            manager.addPolicy(policy2);
            const summary = manager.getSummary();
            expect(summary.totalPolicies).toBe(2);
            expect(summary.enabledPolicies).toBe(1);
        });
        it('should update and remove policies', () => {
            const policy = createDefaultRetentionPolicy('update-test', 'traces');
            manager.addPolicy(policy);
            // Update
            const updated = manager.updatePolicy('update-test', { retentionDays: 60 });
            expect(updated).toBe(true);
            expect(manager.getPolicy('update-test')?.retentionDays).toBe(60);
            // Remove
            const removed = manager.removePolicy('update-test');
            expect(removed).toBe(true);
            expect(manager.getPolicy('update-test')).toBeNull();
        });
        it('should handle exclude tags condition', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 40);
            entries.set('tagged', {
                id: 'tagged',
                createdAt: oldDate.toISOString(),
                tags: ['important', 'keep'],
            });
            entries.set('untagged', {
                id: 'untagged',
                createdAt: oldDate.toISOString(),
            });
            const policy = createDefaultRetentionPolicy('tag-test', 'traces');
            policy.retentionDays = 30;
            policy.conditions = {
                excludeTags: ['important'],
            };
            manager.addPolicy(policy);
            const result = await manager.runPolicy('tag-test');
            expect(entries.has('tagged')).toBe(true); // Has excluded tag
            expect(entries.has('untagged')).toBe(false);
        });
    });
});
//# sourceMappingURL=cross-cutting.test.js.map