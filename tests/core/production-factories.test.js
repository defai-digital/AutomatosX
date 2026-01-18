/**
 * Production Factories Tests
 *
 * Tests for checkpoint, delegation, and parallel execution factories.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckpointStorageFactory, createCheckpointManagerFactory, createDelegationTrackerFactory, createParallelExecutorFactory, createProductionFactories, } from '@defai.digital/agent-domain';
import { createDefaultCheckpointConfig, } from '@defai.digital/contracts';
// Mock storage for testing
function createMockStorage() {
    const checkpoints = new Map();
    return {
        checkpoints,
        async save(checkpoint) {
            checkpoints.set(checkpoint.checkpointId, checkpoint);
        },
        async load(checkpointId) {
            return checkpoints.get(checkpointId) ?? null;
        },
        async loadLatest(agentId, sessionId) {
            const matching = Array.from(checkpoints.values())
                .filter((cp) => cp.agentId === agentId && cp.sessionId === sessionId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return matching[0] ?? null;
        },
        async list(agentId, sessionId) {
            return Array.from(checkpoints.values())
                .filter((cp) => cp.agentId === agentId && cp.sessionId === sessionId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        },
        async delete(checkpointId) {
            return checkpoints.delete(checkpointId);
        },
        async deleteExpired() {
            const now = Date.now();
            const expiredIds = [];
            // Collect expired IDs first to avoid deleting while iterating
            for (const [id, cp] of checkpoints) {
                if (cp.expiresAt && new Date(cp.expiresAt).getTime() < now) {
                    expiredIds.push(id);
                }
            }
            // Delete after iteration completes
            for (const id of expiredIds) {
                checkpoints.delete(id);
            }
            return expiredIds.length;
        },
    };
}
describe('CheckpointStorageFactory', () => {
    it('creates factory that returns storage', () => {
        const storage = createMockStorage();
        const factory = createCheckpointStorageFactory(storage);
        expect(factory()).toBe(storage);
    });
});
describe('CheckpointManagerFactory', () => {
    let storage;
    let manager;
    beforeEach(() => {
        storage = createMockStorage();
        const factory = createCheckpointManagerFactory();
        manager = factory('agent-1', 'session-1', storage, createDefaultCheckpointConfig());
    });
    describe('getConfig', () => {
        it('returns checkpoint config', () => {
            const config = manager.getConfig();
            expect(config.enabled).toBeDefined();
            expect(config.intervalSteps).toBeDefined();
        });
    });
    describe('shouldCheckpoint', () => {
        it('returns true when enabled (default intervalSteps=1 means every step)', () => {
            // Default interval is 1, so every step returns true
            expect(manager.shouldCheckpoint(0)).toBe(true);
            expect(manager.shouldCheckpoint(1)).toBe(true);
            expect(manager.shouldCheckpoint(5)).toBe(true);
        });
        it('returns true only at intervals when intervalSteps > 1', () => {
            const factory = createCheckpointManagerFactory();
            const intervalManager = factory('agent-1', 'session-1', storage, {
                ...createDefaultCheckpointConfig(),
                intervalSteps: 5,
            });
            expect(intervalManager.shouldCheckpoint(0)).toBe(true);
            expect(intervalManager.shouldCheckpoint(1)).toBe(false);
            expect(intervalManager.shouldCheckpoint(3)).toBe(false);
            expect(intervalManager.shouldCheckpoint(5)).toBe(true);
            expect(intervalManager.shouldCheckpoint(10)).toBe(true);
        });
        it('returns false when disabled', () => {
            const factory = createCheckpointManagerFactory();
            const disabledManager = factory('agent-1', 'session-1', storage, {
                ...createDefaultCheckpointConfig(),
                enabled: false,
            });
            expect(disabledManager.shouldCheckpoint(0)).toBe(false);
            expect(disabledManager.shouldCheckpoint(5)).toBe(false);
        });
        it('returns true for every step when intervalSteps is 0', () => {
            const factory = createCheckpointManagerFactory();
            const alwaysManager = factory('agent-1', 'session-1', storage, {
                ...createDefaultCheckpointConfig(),
                intervalSteps: 0,
            });
            expect(alwaysManager.shouldCheckpoint(0)).toBe(true);
            expect(alwaysManager.shouldCheckpoint(1)).toBe(true);
            expect(alwaysManager.shouldCheckpoint(2)).toBe(true);
        });
    });
    // INV-CP-001: Checkpoint contains all data needed to resume
    describe('createCheckpoint', () => {
        it('creates checkpoint with all required data', async () => {
            const outputs = { step1: 'result1', step2: 'result2' };
            const metadata = { custom: 'data' };
            const checkpoint = await manager.createCheckpoint(2, 'step-3', outputs, metadata);
            expect(checkpoint.checkpointId).toBeDefined();
            expect(checkpoint.agentId).toBe('agent-1');
            expect(checkpoint.sessionId).toBe('session-1');
            expect(checkpoint.stepIndex).toBe(2);
            expect(checkpoint.stepId).toBe('step-3');
            expect(checkpoint.previousOutputs).toEqual(outputs);
            expect(checkpoint.metadata).toEqual(metadata);
            expect(checkpoint.createdAt).toBeDefined();
            expect(checkpoint.expiresAt).toBeDefined();
        });
        it('saves checkpoint to storage', async () => {
            await manager.createCheckpoint(0, 'init', {});
            expect(storage.checkpoints.size).toBe(1);
        });
        it('enforces maxCheckpoints limit', async () => {
            const factory = createCheckpointManagerFactory();
            const limitedManager = factory('agent-1', 'session-1', storage, {
                ...createDefaultCheckpointConfig(),
                maxCheckpoints: 2,
            });
            await limitedManager.createCheckpoint(0, 'step-0', {});
            await limitedManager.createCheckpoint(1, 'step-1', {});
            await limitedManager.createCheckpoint(2, 'step-2', {});
            // Should have deleted oldest, keeping only 2
            expect(storage.checkpoints.size).toBe(2);
        });
    });
    describe('getLatestCheckpoint', () => {
        it('returns latest checkpoint', async () => {
            await manager.createCheckpoint(0, 'step-0', { a: 1 });
            // Add small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 5));
            await manager.createCheckpoint(1, 'step-1', { b: 2 });
            const latest = await manager.getLatestCheckpoint();
            expect(latest).not.toBeNull();
            expect(latest.stepIndex).toBe(1);
            expect(latest.previousOutputs).toEqual({ b: 2 });
        });
        it('returns null when no checkpoints', async () => {
            const latest = await manager.getLatestCheckpoint();
            expect(latest).toBeNull();
        });
    });
    // INV-CP-002: Resumed execution starts from step after checkpoint
    describe('getResumeContext', () => {
        it('returns resume context with startFromStep + 1', async () => {
            const checkpoint = await manager.createCheckpoint(2, 'step-2', { output: 'data' });
            const context = await manager.getResumeContext(checkpoint.checkpointId);
            expect(context).not.toBeNull();
            expect(context.startFromStep).toBe(3); // stepIndex + 1
            expect(context.previousOutputs).toEqual({ output: 'data' });
        });
        it('returns null for non-existent checkpoint', async () => {
            const context = await manager.getResumeContext('non-existent');
            expect(context).toBeNull();
        });
        it('returns null and deletes expired checkpoint', async () => {
            const factory = createCheckpointManagerFactory();
            const shortRetentionManager = factory('agent-1', 'session-1', storage, {
                ...createDefaultCheckpointConfig(),
                retentionHours: 0, // Expires immediately
            });
            const checkpoint = await shortRetentionManager.createCheckpoint(0, 'step-0', {});
            // Wait a bit to ensure expiration
            await new Promise((resolve) => setTimeout(resolve, 10));
            const context = await shortRetentionManager.getResumeContext(checkpoint.checkpointId);
            expect(context).toBeNull();
            expect(storage.checkpoints.has(checkpoint.checkpointId)).toBe(false);
        });
    });
    describe('cleanup', () => {
        it('deletes expired checkpoints', async () => {
            const factory = createCheckpointManagerFactory();
            const shortRetentionManager = factory('agent-1', 'session-1', storage, {
                ...createDefaultCheckpointConfig(),
                retentionHours: 0,
            });
            await shortRetentionManager.createCheckpoint(0, 'step-0', {});
            // Wait a bit to ensure expiration
            await new Promise((resolve) => setTimeout(resolve, 10));
            const deleted = await shortRetentionManager.cleanup();
            expect(deleted).toBe(1);
            expect(storage.checkpoints.size).toBe(0);
        });
    });
});
describe('DelegationTrackerFactory', () => {
    let tracker;
    beforeEach(() => {
        const factory = createDelegationTrackerFactory();
        tracker = factory('agent-1', undefined, 5);
    });
    describe('getContext', () => {
        it('returns delegation context', () => {
            const context = tracker.getContext();
            expect(context.initiatorAgentId).toBe('agent-1');
            expect(context.currentDepth).toBe(0);
            expect(context.delegationChain).toEqual(['agent-1']);
            expect(context.maxDepth).toBe(5);
            expect(context.rootTaskId).toBeDefined();
        });
        it('inherits from parent context', () => {
            const parentContext = {
                initiatorAgentId: 'root-agent',
                rootTaskId: crypto.randomUUID(),
                currentDepth: 1,
                delegationChain: ['root-agent', 'agent-1'],
                maxDepth: 5,
            };
            const factory = createDelegationTrackerFactory();
            const childTracker = factory('agent-2', parentContext, 5);
            const context = childTracker.getContext();
            expect(context.initiatorAgentId).toBe('root-agent');
            expect(context.currentDepth).toBe(2);
            expect(context.delegationChain).toEqual(['root-agent', 'agent-1', 'agent-2']);
        });
    });
    // INV-DT-001: Maximum delegation depth enforced
    describe('canDelegate', () => {
        it('allows delegation within depth limit', () => {
            const result = tracker.canDelegate('agent-2');
            expect(result.allowed).toBe(true);
        });
        it('blocks delegation at max depth', () => {
            const factory = createDelegationTrackerFactory();
            const maxDepthTracker = factory('agent-1', undefined, 0); // Max depth = 0
            const result = maxDepthTracker.canDelegate('agent-2');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('MAX_DEPTH_EXCEEDED');
            expect(result.message).toContain('Maximum delegation depth');
        });
        // INV-DT-002: Circular delegations prevented
        it('blocks circular delegation', () => {
            const result = tracker.canDelegate('agent-1'); // Same as current agent
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('CIRCULAR_DELEGATION');
            expect(result.message).toContain('Circular delegation');
        });
        it('blocks delegation to agent in chain', () => {
            const parentContext = {
                initiatorAgentId: 'agent-0',
                rootTaskId: crypto.randomUUID(),
                currentDepth: 1,
                delegationChain: ['agent-0', 'agent-1'],
                maxDepth: 5,
            };
            const factory = createDelegationTrackerFactory();
            const childTracker = factory('agent-2', parentContext, 5);
            const result = childTracker.canDelegate('agent-0');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('CIRCULAR_DELEGATION');
        });
    });
    describe('createDelegationRequest', () => {
        it('creates delegation request when allowed', () => {
            const request = tracker.createDelegationRequest('agent-2', 'Process data', { data: 'input' }, 30000);
            expect(request).not.toBeNull();
            expect(request.fromAgentId).toBe('agent-1');
            expect(request.toAgentId).toBe('agent-2');
            expect(request.task).toBe('Process data');
            expect(request.input).toEqual({ data: 'input' });
            expect(request.timeout).toBe(30000);
            expect(request.context).toBeDefined();
        });
        it('returns null when delegation not allowed', () => {
            const request = tracker.createDelegationRequest('agent-1', 'Task');
            expect(request).toBeNull();
        });
    });
    describe('createChildContext', () => {
        it('creates context for child agent', () => {
            const childContext = tracker.createChildContext('agent-2');
            expect(childContext.initiatorAgentId).toBe('agent-1');
            expect(childContext.currentDepth).toBe(1);
            expect(childContext.delegationChain).toEqual(['agent-1', 'agent-2']);
        });
    });
    describe('history tracking', () => {
        it('records and retrieves delegation results', () => {
            const result1 = {
                success: true,
                handledBy: 'agent-2',
                result: 'Result 1',
                durationMs: 100,
                finalDepth: 1,
            };
            const result2 = {
                success: false,
                handledBy: 'agent-3',
                durationMs: 50,
                finalDepth: 1,
            };
            tracker.recordResult(result1);
            tracker.recordResult(result2);
            const history = tracker.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]).toEqual(result1);
            expect(history[1]).toEqual(result2);
        });
    });
    describe('isRoot', () => {
        it('returns true for root tracker', () => {
            expect(tracker.isRoot()).toBe(true);
        });
        it('returns false for child tracker', () => {
            const factory = createDelegationTrackerFactory();
            const childTracker = factory('agent-2', tracker.getContext(), 5);
            expect(childTracker.isRoot()).toBe(false);
        });
    });
    describe('getRemainingDepth', () => {
        it('calculates remaining depth', () => {
            expect(tracker.getRemainingDepth()).toBe(5);
            const factory = createDelegationTrackerFactory();
            const childTracker = factory('agent-2', tracker.getContext(), 5);
            expect(childTracker.getRemainingDepth()).toBe(4);
        });
    });
});
describe('ParallelExecutorFactory', () => {
    let executor;
    beforeEach(() => {
        const factory = createParallelExecutorFactory();
        executor = factory({ enabled: true, maxConcurrency: 2 });
    });
    describe('getConfig', () => {
        it('returns parallel config', () => {
            const config = executor.getConfig();
            expect(config.enabled).toBe(true);
            expect(config.maxConcurrency).toBe(2);
        });
    });
    describe('buildExecutionLayers', () => {
        it('builds layers based on dependencies', () => {
            const steps = [
                { stepId: 'a', name: 'A', type: 'prompt', config: {} },
                { stepId: 'b', name: 'B', type: 'prompt', config: {}, dependencies: ['a'] },
                { stepId: 'c', name: 'C', type: 'prompt', config: {}, dependencies: ['a'] },
                { stepId: 'd', name: 'D', type: 'prompt', config: {}, dependencies: ['b', 'c'] },
            ];
            const layers = executor.buildExecutionLayers(steps);
            expect(layers).toHaveLength(3);
            expect(layers[0].map((s) => s.stepId)).toEqual(['a']);
            expect(layers[1].map((s) => s.stepId).sort()).toEqual(['b', 'c']);
            expect(layers[2].map((s) => s.stepId)).toEqual(['d']);
        });
        it('handles steps with no dependencies', () => {
            const steps = [
                { stepId: 'a', name: 'A', type: 'prompt', config: {} },
                { stepId: 'b', name: 'B', type: 'prompt', config: {} },
                { stepId: 'c', name: 'C', type: 'prompt', config: {} },
            ];
            const layers = executor.buildExecutionLayers(steps);
            // All can run in parallel
            expect(layers).toHaveLength(1);
            expect(layers[0]).toHaveLength(3);
        });
        it('handles circular dependencies gracefully', () => {
            const steps = [
                { stepId: 'a', name: 'A', type: 'prompt', config: {}, dependencies: ['c'] },
                { stepId: 'b', name: 'B', type: 'prompt', config: {}, dependencies: ['a'] },
                { stepId: 'c', name: 'C', type: 'prompt', config: {}, dependencies: ['b'] },
            ];
            const layers = executor.buildExecutionLayers(steps);
            // Should still produce layers, handling circular deps
            expect(layers.length).toBeGreaterThan(0);
        });
    });
    // INV-PE-001: Independent steps execute concurrently
    // INV-PE-002: Dependencies honored (DAG ordering)
    // INV-PE-003: Concurrency limit respected
    describe('executeGroup', () => {
        it('executes steps and returns results', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
                { stepId: 'step-2', name: 'Step 2', type: 'prompt', config: {} },
            ];
            const executorFn = vi.fn().mockImplementation(async (step) => ({
                result: `output-${step.stepId}`,
            }));
            const result = await executor.executeGroup(steps, executorFn);
            expect(result.stepResults).toHaveLength(2);
            expect(result.allSucceeded).toBe(true);
            expect(result.failedCount).toBe(0);
        });
        it('handles step failures', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
                { stepId: 'step-2', name: 'Step 2', type: 'prompt', config: {} },
            ];
            const executorFn = vi.fn().mockImplementation(async (step) => {
                if (step.stepId === 'step-2') {
                    throw new Error('Step failed');
                }
                return { result: 'ok' };
            });
            const result = await executor.executeGroup(steps, executorFn);
            expect(result.allSucceeded).toBe(false);
            expect(result.failedCount).toBe(1);
            expect(result.stepResults.find((r) => r.stepId === 'step-2')?.error).toBe('Step failed');
        });
        it('respects failFast strategy', async () => {
            const factory = createParallelExecutorFactory();
            const failFastExecutor = factory({ enabled: false, failureStrategy: 'failFast' });
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
                { stepId: 'step-2', name: 'Step 2', type: 'prompt', config: {} },
                { stepId: 'step-3', name: 'Step 3', type: 'prompt', config: {} },
            ];
            const executorFn = vi.fn().mockImplementation(async (step) => {
                if (step.stepId === 'step-2') {
                    throw new Error('Step failed');
                }
                return { result: 'ok' };
            });
            const result = await failFastExecutor.executeGroup(steps, executorFn);
            // Should stop after step-2 fails
            expect(result.stepResults).toHaveLength(2);
        });
        it('collects outputs from previous steps', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
                { stepId: 'step-2', name: 'Step 2', type: 'prompt', config: {}, dependencies: ['step-1'] },
            ];
            const outputs = [];
            const executorFn = vi.fn().mockImplementation(async (step, prevOutputs) => {
                outputs.push({ ...prevOutputs });
                return { data: `from-${step.stepId}` };
            });
            await executor.executeGroup(steps, executorFn);
            // step-2 should have access to step-1's output
            expect(outputs[1]).toHaveProperty('step-1');
        });
        it('passes initial previousOutputs', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
            ];
            let receivedOutputs = {};
            const executorFn = vi.fn().mockImplementation(async (_step, prevOutputs) => {
                receivedOutputs = prevOutputs;
                return {};
            });
            await executor.executeGroup(steps, executorFn, { initial: 'data' });
            expect(receivedOutputs).toHaveProperty('initial', 'data');
        });
    });
    describe('sequential execution', () => {
        it('executes sequentially when disabled', async () => {
            const factory = createParallelExecutorFactory();
            const sequentialExecutor = factory({ enabled: false });
            const executionOrder = [];
            const steps = [
                { stepId: 'a', name: 'A', type: 'prompt', config: {} },
                { stepId: 'b', name: 'B', type: 'prompt', config: {} },
                { stepId: 'c', name: 'C', type: 'prompt', config: {} },
            ];
            const executorFn = vi.fn().mockImplementation(async (step) => {
                executionOrder.push(step.stepId);
                return {};
            });
            await sequentialExecutor.executeGroup(steps, executorFn);
            expect(executionOrder).toEqual(['a', 'b', 'c']);
        });
    });
    describe('cancel', () => {
        it('cancels remaining steps', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
                { stepId: 'step-2', name: 'Step 2', type: 'prompt', config: {}, dependencies: ['step-1'] },
                { stepId: 'step-3', name: 'Step 3', type: 'prompt', config: {}, dependencies: ['step-2'] },
            ];
            const executorFn = vi.fn().mockImplementation(async (step) => {
                if (step.stepId === 'step-1') {
                    executor.cancel();
                }
                return {};
            });
            const result = await executor.executeGroup(steps, executorFn);
            expect(result.cancelledCount).toBeGreaterThan(0);
        });
    });
    describe('duration tracking', () => {
        it('tracks total duration', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
            ];
            const executorFn = vi.fn().mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return {};
            });
            const result = await executor.executeGroup(steps, executorFn);
            // Allow 2ms tolerance for timing precision across different platforms
            expect(result.totalDurationMs).toBeGreaterThanOrEqual(8);
        });
        it('tracks per-step duration', async () => {
            const steps = [
                { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: {} },
            ];
            const executorFn = vi.fn().mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return {};
            });
            const result = await executor.executeGroup(steps, executorFn);
            // Allow for timing variance - setTimeout(10) may complete slightly under 10ms
            expect(result.stepResults[0].durationMs).toBeGreaterThanOrEqual(8);
        });
    });
});
describe('createProductionFactories', () => {
    it('creates all factories', () => {
        const factories = createProductionFactories();
        expect(factories.checkpointManagerFactory).toBeDefined();
        expect(factories.delegationTrackerFactory).toBeDefined();
        expect(factories.parallelExecutorFactory).toBeDefined();
    });
    it('includes checkpoint storage factory when provided', () => {
        const storage = createMockStorage();
        const factories = createProductionFactories({ checkpointStorage: storage });
        expect(factories.checkpointStorageFactory).toBeDefined();
        expect(factories.checkpointStorageFactory()).toBe(storage);
    });
    it('includes config overrides', () => {
        const factories = createProductionFactories({
            checkpointConfig: { intervalSteps: 10 },
            parallelConfig: { maxConcurrency: 4 },
        });
        expect(factories.checkpointConfig).toEqual({ intervalSteps: 10 });
        expect(factories.parallelConfig).toEqual({ maxConcurrency: 4 });
    });
    it('works with EnhancedAgentExecutor config shape', () => {
        const storage = createMockStorage();
        const factories = createProductionFactories({ checkpointStorage: storage });
        // Verify the shape matches what EnhancedAgentExecutor expects
        expect(typeof factories.checkpointManagerFactory).toBe('function');
        expect(typeof factories.delegationTrackerFactory).toBe('function');
        expect(typeof factories.parallelExecutorFactory).toBe('function');
        // Create instances
        const manager = factories.checkpointManagerFactory('agent-1', 'session-1', storage, createDefaultCheckpointConfig());
        expect(manager.getConfig()).toBeDefined();
        const tracker = factories.delegationTrackerFactory('agent-1', undefined, 5);
        expect(tracker.getContext()).toBeDefined();
        const executor = factories.parallelExecutorFactory({});
        expect(executor.getConfig()).toBeDefined();
    });
});
//# sourceMappingURL=production-factories.test.js.map