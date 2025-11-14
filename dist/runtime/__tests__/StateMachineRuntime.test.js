/**
 * Tests for StateMachineRuntime
 * Sprint 3 Day 26: Runtime integration tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStateMachineRuntime, SQLiteCheckpointStorage, } from '../StateMachineRuntime.js';
import { getDatabase } from '../../database/connection.js';
// Mock provider implementation
class MockProvider {
    name = 'mock';
    config = {
        enabled: true,
        maxRetries: 3,
        timeout: 60000,
        priority: 1,
        defaultModel: 'mock-model',
    };
    shouldFail = false;
    failCount = 0;
    currentAttempt = 0;
    setFailure(shouldFail, failCount = 0) {
        this.shouldFail = shouldFail;
        this.failCount = failCount;
        this.currentAttempt = 0;
    }
    async request(request) {
        this.currentAttempt++;
        if (this.shouldFail && this.currentAttempt <= this.failCount) {
            throw new Error(`Mock provider error (attempt ${this.currentAttempt})`);
        }
        return {
            content: 'Mock response',
            model: 'mock-model',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            finishReason: 'stop',
            latency: 100,
            provider: this.name,
        };
    }
    async streamRequest() {
        return this.request({});
    }
    async healthCheck() {
        return {
            healthy: true,
            available: true,
            latency: 100,
            lastCheckedAt: Date.now(),
            errorRate: 0,
            availability: 1,
            requestsPerMinute: 10,
        };
    }
    async getAvailableModels() {
        return ['mock-model'];
    }
    async validateConfig() {
        return true;
    }
}
// In-memory checkpoint storage for testing
class InMemoryCheckpointStorage {
    checkpoints = new Map();
    async save(taskId, checkpoint) {
        this.checkpoints.set(taskId, checkpoint);
    }
    async load(taskId) {
        return this.checkpoints.get(taskId) || null;
    }
    async list(agentName) {
        const results = [];
        for (const [taskId, checkpoint] of this.checkpoints.entries()) {
            if (!agentName || checkpoint.context.agentName === agentName) {
                results.push({ taskId, timestamp: checkpoint.timestamp });
            }
        }
        return results.sort((a, b) => b.timestamp - a.timestamp);
    }
    async delete(taskId) {
        this.checkpoints.delete(taskId);
    }
    clear() {
        this.checkpoints.clear();
    }
}
// Helper function to create default request
function createRequest(content) {
    return {
        messages: [{ role: 'user', content }],
        maxTokens: 4096,
        temperature: 1.0,
        streaming: false,
        timeout: 60000,
    };
}
describe('StateMachineRuntime', () => {
    let runtime;
    let storage;
    let provider;
    beforeEach(() => {
        storage = new InMemoryCheckpointStorage();
        runtime = createStateMachineRuntime(storage);
        provider = new MockProvider();
    });
    afterEach(() => {
        storage.clear();
    });
    describe('task execution', () => {
        it('should execute task successfully', async () => {
            const context = {
                taskId: 'task-1',
                agentName: 'backend',
                provider,
                request: createRequest('Hello'),
            };
            const result = await runtime.executeTask(context);
            expect(result.success).toBe(true);
            expect(result.finalState).toBe('completed');
            expect(result.response).toBeDefined();
            expect(result.response?.content).toBe('Mock response');
            expect(result.duration).toBeGreaterThan(0);
        });
        it('should transition through states correctly', async () => {
            const stateChanges = [];
            runtime.on('state-changed', ({ from, to }) => {
                stateChanges.push({ from, to });
            });
            await runtime.executeTask({
                taskId: 'task-2',
                agentName: 'frontend',
                provider,
                request: createRequest('Test'),
            });
            expect(stateChanges).toEqual([
                { from: 'idle', to: 'planning' },
                { from: 'planning', to: 'executing' },
                { from: 'executing', to: 'completed' },
            ]);
        });
        it('should emit task lifecycle events', async () => {
            const events = [];
            runtime.on('task-started', () => events.push('started'));
            runtime.on('execution-attempt', () => events.push('attempt'));
            runtime.on('task-completed', () => events.push('completed'));
            await runtime.executeTask({
                taskId: 'task-3',
                agentName: 'devops',
                provider,
                request: createRequest('Test'),
            });
            expect(events).toEqual(['started', 'attempt', 'completed']);
        });
        it('should save final checkpoint on success', async () => {
            const context = {
                taskId: 'task-4',
                agentName: 'security',
                provider,
                request: createRequest('Audit'),
            };
            await runtime.executeTask(context);
            const checkpoint = await storage.load('task-4');
            expect(checkpoint).toBeDefined();
            expect(checkpoint?.state).toBe('completed');
            expect(checkpoint?.context.agentName).toBe('security');
        });
        it('should include execution context in checkpoint', async () => {
            await runtime.executeTask({
                taskId: 'task-5',
                agentName: 'quality',
                provider,
                request: createRequest('Test'),
            });
            const checkpoint = await storage.load('task-5');
            expect(checkpoint?.context.data.tokens).toBe('30');
            expect(checkpoint?.context.data.latency).toBe('100');
            expect(checkpoint?.context.data.startTime).toBeDefined();
        });
    });
    describe('retry and failure handling', () => {
        it('should retry on failure', async () => {
            provider.setFailure(true, 2); // Fail first 2 attempts
            const attempts = [];
            runtime.on('execution-attempt', ({ attempt }) => attempts.push(attempt));
            const result = await runtime.executeTask({
                taskId: 'task-6',
                agentName: 'backend',
                provider,
                request: createRequest('Retry test'),
                maxRetries: 3,
            });
            expect(result.success).toBe(true);
            expect(attempts).toEqual([1, 2, 3]);
        });
        it('should transition to paused during retry', async () => {
            provider.setFailure(true, 1); // Fail first attempt
            const states = [];
            runtime.on('state-changed', ({ to }) => states.push(to));
            await runtime.executeTask({
                taskId: 'task-7',
                agentName: 'backend',
                provider,
                request: createRequest('Pause test'),
                maxRetries: 3,
            });
            expect(states).toContain('paused');
            expect(states).toContain('executing'); // Resume
        });
        it('should fail after max retries', async () => {
            provider.setFailure(true, 5); // Fail all attempts
            const result = await runtime.executeTask({
                taskId: 'task-8',
                agentName: 'backend',
                provider,
                request: createRequest('Fail test'),
                maxRetries: 3,
            });
            expect(result.success).toBe(false);
            expect(result.finalState).toBe('failed');
            expect(result.error).toContain('Mock provider error');
        });
        it('should save checkpoint on failure', async () => {
            provider.setFailure(true, 5);
            await runtime.executeTask({
                taskId: 'task-9',
                agentName: 'backend',
                provider,
                request: createRequest('Fail test'),
                maxRetries: 3,
            });
            const checkpoint = await storage.load('task-9');
            expect(checkpoint).toBeDefined();
            expect(checkpoint?.state).toBe('failed');
            expect(checkpoint?.context.data.lastError).toBeDefined();
        });
        it('should emit task-failed event', async () => {
            provider.setFailure(true, 5);
            let failedEvent = null;
            runtime.on('task-failed', (event) => {
                failedEvent = event;
            });
            await runtime.executeTask({
                taskId: 'task-10',
                agentName: 'backend',
                provider,
                request: createRequest('Fail test'),
                maxRetries: 3,
            });
            expect(failedEvent).toBeDefined();
            expect(failedEvent.taskId).toBe('task-10');
            expect(failedEvent.error).toContain('Mock provider error');
        });
    });
    describe('checkpoint management', () => {
        it('should create periodic checkpoints', async () => {
            // Mock setTimeout to control timing
            vi.useFakeTimers();
            const checkpointEvents = [];
            runtime.on('checkpoint-created', (event) => checkpointEvents.push(event));
            // Start execution (doesn't wait)
            const executionPromise = runtime.executeTask({
                taskId: 'task-11',
                agentName: 'backend',
                provider,
                request: createRequest('Checkpoint test'),
                checkpointInterval: 5, // 5 seconds
            });
            // Advance time to trigger checkpoints
            await vi.advanceTimersByTimeAsync(5000);
            await vi.advanceTimersByTimeAsync(5000);
            // Complete execution
            await vi.runAllTimersAsync();
            await executionPromise;
            vi.useRealTimers();
            // Should have periodic checkpoints
            expect(checkpointEvents.length).toBeGreaterThan(0);
        }, 10000);
        it('should resume from checkpoint', async () => {
            // Create initial execution with checkpoint
            await runtime.executeTask({
                taskId: 'task-12',
                agentName: 'backend',
                provider,
                request: createRequest('First run'),
            });
            let resumeEvent = null;
            runtime.on('task-resumed', (event) => {
                resumeEvent = event;
            });
            // Resume from checkpoint
            const result = await runtime.resumeTask('task-12', provider, {
                messages: [{ role: 'user', content: 'Resumed run' }],
            });
            expect(resumeEvent).toBeDefined();
            expect(resumeEvent.taskId).toBe('task-12');
            expect(result.success).toBe(true);
        });
        it('should throw error when resuming non-existent task', async () => {
            await expect(runtime.resumeTask('non-existent', provider, {
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow('No checkpoint found');
        });
        it('should list checkpoints', async () => {
            await runtime.executeTask({
                taskId: 'task-13',
                agentName: 'backend',
                provider,
                request: createRequest('Test 1'),
            });
            await runtime.executeTask({
                taskId: 'task-14',
                agentName: 'frontend',
                provider,
                request: createRequest('Test 2'),
            });
            const allCheckpoints = await runtime.listCheckpoints();
            expect(allCheckpoints).toHaveLength(2);
            const backendCheckpoints = await runtime.listCheckpoints('backend');
            expect(backendCheckpoints).toHaveLength(1);
            expect(backendCheckpoints[0].taskId).toBe('task-13');
        });
        it('should delete checkpoint', async () => {
            await runtime.executeTask({
                taskId: 'task-15',
                agentName: 'backend',
                provider,
                request: createRequest('Test'),
            });
            await runtime.deleteCheckpoint('task-15');
            const checkpoint = await storage.load('task-15');
            expect(checkpoint).toBeNull();
        });
    });
    describe('task control', () => {
        it('should get task status for active execution', async () => {
            // Start long-running task
            const executionPromise = runtime.executeTask({
                taskId: 'task-16',
                agentName: 'backend',
                provider,
                request: createRequest('Long task'),
            });
            // Check status immediately
            const status = await runtime.getTaskStatus('task-16');
            expect(status).toBeDefined();
            expect(status?.isActive).toBe(true);
            expect(status?.state).toBeDefined();
            expect(status?.duration).toBeGreaterThanOrEqual(0);
            await executionPromise;
        });
        it('should get task status from checkpoint', async () => {
            await runtime.executeTask({
                taskId: 'task-17',
                agentName: 'backend',
                provider,
                request: createRequest('Completed task'),
            });
            const status = await runtime.getTaskStatus('task-17');
            expect(status).toBeDefined();
            expect(status?.isActive).toBe(false);
            expect(status?.state).toBe('completed');
        });
        it('should return null for non-existent task', async () => {
            const status = await runtime.getTaskStatus('non-existent');
            expect(status).toBeNull();
        });
        it('should list active executions', async () => {
            // No active executions initially
            expect(runtime.getActiveExecutions()).toHaveLength(0);
            // Start task and check immediately
            const executionPromise = runtime.executeTask({
                taskId: 'task-18',
                agentName: 'backend',
                provider,
                request: createRequest('Active task'),
            });
            // Should show in active executions
            const active = runtime.getActiveExecutions();
            expect(active.length).toBeGreaterThan(0);
            await executionPromise;
            // Should be removed after completion
            expect(runtime.getActiveExecutions()).toHaveLength(0);
        });
    });
});
describe('SQLiteCheckpointStorage', () => {
    let storage;
    beforeEach(() => {
        storage = new SQLiteCheckpointStorage();
        // Clean up test data
        const db = getDatabase();
        db.exec('DELETE FROM task_checkpoints');
    });
    it('should save and load checkpoint', async () => {
        const checkpoint = {
            state: 'planning',
            context: {
                taskId: 'test-1',
                agentName: 'backend',
                data: { key: 'value' },
                history: ['idle'],
            },
            timestamp: Date.now(),
        };
        await storage.save('test-1', checkpoint);
        const loaded = await storage.load('test-1');
        expect(loaded).toBeDefined();
        expect(loaded?.state).toBe('planning');
        expect(loaded?.context.agentName).toBe('backend');
        expect(loaded?.context.data.key).toBe('value');
    });
    it('should return null for non-existent checkpoint', async () => {
        const loaded = await storage.load('non-existent');
        expect(loaded).toBeNull();
    });
    it('should list all checkpoints', async () => {
        const checkpoint1 = {
            state: 'completed',
            context: {
                taskId: 'test-2',
                agentName: 'backend',
                data: {},
                history: [],
            },
            timestamp: Date.now(),
        };
        const checkpoint2 = {
            state: 'failed',
            context: {
                taskId: 'test-3',
                agentName: 'frontend',
                data: {},
                history: [],
            },
            timestamp: Date.now() + 1000,
        };
        await storage.save('test-2', checkpoint1);
        await storage.save('test-3', checkpoint2);
        const all = await storage.list();
        expect(all).toHaveLength(2);
        // Should be sorted by timestamp descending
        expect(all[0].taskId).toBe('test-3');
    });
    it('should filter checkpoints by agent name', async () => {
        const checkpoint1 = {
            state: 'completed',
            context: {
                taskId: 'test-4',
                agentName: 'backend',
                data: {},
                history: [],
            },
            timestamp: Date.now(),
        };
        const checkpoint2 = {
            state: 'completed',
            context: {
                taskId: 'test-5',
                agentName: 'frontend',
                data: {},
                history: [],
            },
            timestamp: Date.now(),
        };
        await storage.save('test-4', checkpoint1);
        await storage.save('test-5', checkpoint2);
        const backendCheckpoints = await storage.list('backend');
        expect(backendCheckpoints).toHaveLength(1);
        expect(backendCheckpoints[0].taskId).toBe('test-4');
    });
    it('should delete checkpoint', async () => {
        const checkpoint = {
            state: 'completed',
            context: {
                taskId: 'test-6',
                agentName: 'backend',
                data: {},
                history: [],
            },
            timestamp: Date.now(),
        };
        await storage.save('test-6', checkpoint);
        await storage.delete('test-6');
        const loaded = await storage.load('test-6');
        expect(loaded).toBeNull();
    });
    it('should update existing checkpoint', async () => {
        const checkpoint1 = {
            state: 'planning',
            context: {
                taskId: 'test-7',
                agentName: 'backend',
                data: { version: '1' },
                history: [],
            },
            timestamp: Date.now(),
        };
        const checkpoint2 = {
            state: 'executing',
            context: {
                taskId: 'test-7',
                agentName: 'backend',
                data: { version: '2' },
                history: ['idle', 'planning'],
            },
            timestamp: Date.now() + 1000,
        };
        await storage.save('test-7', checkpoint1);
        await storage.save('test-7', checkpoint2);
        const loaded = await storage.load('test-7');
        expect(loaded?.state).toBe('executing');
        expect(loaded?.context.data.version).toBe('2');
        expect(loaded?.context.history).toHaveLength(2);
    });
});
//# sourceMappingURL=StateMachineRuntime.test.js.map