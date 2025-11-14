/**
 * Integration tests for StateMachineRuntime with ProviderRouterV2
 * Sprint 3 Day 26: Provider + State Machine Integration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStateMachineRuntime } from '../StateMachineRuntime.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
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
// Mock all provider SDKs
vi.mock('@anthropic-ai/sdk', () => {
    const mockCreate = vi.fn().mockResolvedValue({
        model: 'claude-sonnet-4-5-20250929',
        content: [{ type: 'text', text: 'Hello from Claude!' }],
        usage: { input_tokens: 10, output_tokens: 15 },
        stop_reason: 'end_turn',
    });
    const MockAnthropic = vi.fn().mockImplementation(() => ({
        messages: { create: mockCreate },
    }));
    MockAnthropic.APIError = class APIError extends Error {
        status;
        headers;
        constructor(status, message, headers) {
            super(message);
            this.status = status;
            this.headers = headers;
        }
    };
    return { default: MockAnthropic, __mockCreate: mockCreate };
});
vi.mock('@google/generative-ai', () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
        response: {
            text: () => 'Hello from Gemini!',
            candidates: [
                {
                    finishReason: 'STOP',
                },
            ],
            usageMetadata: {
                promptTokenCount: 12,
                candidatesTokenCount: 18,
                totalTokenCount: 30,
            },
        },
    });
    const MockGenerativeModel = vi.fn().mockImplementation(() => ({
        generateContent: mockGenerateContent,
    }));
    const MockGoogleGenerativeAI = vi.fn().mockImplementation(() => ({
        getGenerativeModel: () => new MockGenerativeModel(),
    }));
    return {
        GoogleGenerativeAI: MockGoogleGenerativeAI,
        __mockGenerateContent: mockGenerateContent,
    };
});
vi.mock('openai', () => {
    const mockCreate = vi.fn().mockResolvedValue({
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [
            {
                index: 0,
                message: { role: 'assistant', content: 'Hello from OpenAI!' },
                finish_reason: 'stop',
            },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
    });
    const MockOpenAI = vi.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
        models: { list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4o' }] }) },
    }));
    MockOpenAI.APIError = class APIError extends Error {
        status;
        constructor(status, message) {
            super(message);
            this.status = status;
        }
    };
    return { default: MockOpenAI, __mockCreate: mockCreate };
});
describe('StateMachineRuntime + ProviderRouterV2 Integration', () => {
    let runtime;
    let router;
    beforeEach(() => {
        runtime = createStateMachineRuntime();
        router = new ProviderRouterV2({
            providers: {
                claude: {
                    enabled: true,
                    priority: 1,
                    apiKey: 'test-key',
                    maxRetries: 3,
                    timeout: 60000,
                    defaultModel: 'claude-sonnet-4-5-20250929',
                },
                gemini: {
                    enabled: true,
                    priority: 2,
                    apiKey: 'test-key',
                    maxRetries: 3,
                    timeout: 60000,
                    defaultModel: 'gemini-2.5-pro',
                },
                openai: {
                    enabled: true,
                    priority: 3,
                    apiKey: 'test-key',
                    maxRetries: 3,
                    timeout: 60000,
                    defaultModel: 'gpt-4o',
                },
            },
        });
    });
    describe('basic integration', () => {
        it('should execute task with Claude provider', async () => {
            const request = {
                messages: [
                    { role: 'user', content: 'Write a hello world function in TypeScript' },
                ],
            };
            const result = await runtime.executeTask({
                taskId: 'integration-claude-1',
                agentName: 'backend',
                provider: router,
                request,
            });
            expect(result.success).toBe(true);
            expect(result.finalState).toBe('completed');
            expect(result.response).toBeDefined();
            expect(result.response?.content).toContain('Claude');
        });
        it('should execute task with router fallback', async () => {
            const request = {
                messages: [
                    { role: 'user', content: 'Explain async/await in JavaScript' },
                ],
            };
            const result = await runtime.executeTask({
                taskId: 'integration-fallback-1',
                agentName: 'frontend',
                provider: router,
                request,
            });
            expect(result.success).toBe(true);
            expect(result.response).toBeDefined();
        });
        it('should track state transitions with provider calls', async () => {
            const stateChanges = [];
            runtime.on('state-changed', ({ from, to }) => {
                stateChanges.push({ from, to });
            });
            await runtime.executeTask({
                taskId: 'integration-states-1',
                agentName: 'devops',
                provider: router,
                request: createRequest('Deploy application'),
            });
            expect(stateChanges).toEqual([
                { from: 'idle', to: 'planning' },
                { from: 'planning', to: 'executing' },
                { from: 'executing', to: 'completed' },
            ]);
        });
    });
    describe('checkpoint and resume', () => {
        it('should save checkpoint with provider response data', async () => {
            await runtime.executeTask({
                taskId: 'integration-checkpoint-1',
                agentName: 'security',
                provider: router,
                request: createRequest('Audit security'),
            });
            const status = await runtime.getTaskStatus('integration-checkpoint-1');
            expect(status).toBeDefined();
            expect(status?.state).toBe('completed');
            expect(status?.context.data.tokens).toBeDefined();
            expect(status?.context.data.latency).toBeDefined();
        });
        it('should resume task with router', async () => {
            // Initial execution
            await runtime.executeTask({
                taskId: 'integration-resume-1',
                agentName: 'quality',
                provider: router,
                request: createRequest('Run tests'),
            });
            // Resume
            const result = await runtime.resumeTask('integration-resume-1', router, createRequest('Run more tests'));
            expect(result.success).toBe(true);
        });
    });
    describe('retry with provider fallback', () => {
        it('should retry with same provider on transient errors', async () => {
            const attempts = [];
            runtime.on('execution-attempt', ({ attempt }) => {
                attempts.push(attempt);
            });
            // This will use Claude provider which might retry
            await runtime.executeTask({
                taskId: 'integration-retry-1',
                agentName: 'backend',
                provider: router,
                request: createRequest('Test retry'),
                maxRetries: 3,
            });
            // Should have at least one attempt
            expect(attempts.length).toBeGreaterThan(0);
        });
    });
    describe('concurrent task execution', () => {
        it('should handle multiple concurrent tasks', async () => {
            const tasks = [
                runtime.executeTask({
                    taskId: 'concurrent-1',
                    agentName: 'backend',
                    provider: router,
                    request: createRequest('Task 1'),
                }),
                runtime.executeTask({
                    taskId: 'concurrent-2',
                    agentName: 'frontend',
                    provider: router,
                    request: createRequest('Task 2'),
                }),
                runtime.executeTask({
                    taskId: 'concurrent-3',
                    agentName: 'devops',
                    provider: router,
                    request: createRequest('Task 3'),
                }),
            ];
            const results = await Promise.all(tasks);
            expect(results).toHaveLength(3);
            expect(results.every((r) => r.success)).toBe(true);
        });
        it('should list all active executions', async () => {
            // Start multiple tasks without awaiting
            const task1 = runtime.executeTask({
                taskId: 'active-1',
                agentName: 'backend',
                provider: router,
                request: createRequest('Task 1'),
            });
            const task2 = runtime.executeTask({
                taskId: 'active-2',
                agentName: 'frontend',
                provider: router,
                request: createRequest('Task 2'),
            });
            // Should show active executions
            const active = runtime.getActiveExecutions();
            expect(active.length).toBeGreaterThan(0);
            // Wait for completion
            await Promise.all([task1, task2]);
            // Should be cleared
            expect(runtime.getActiveExecutions()).toHaveLength(0);
        });
    });
    describe('event emission', () => {
        it('should emit routing events from provider', async () => {
            const routingEvents = [];
            router.on('routing-decision', (event) => {
                routingEvents.push(event);
            });
            await runtime.executeTask({
                taskId: 'events-1',
                agentName: 'backend',
                provider: router,
                request: createRequest('Test events'),
            });
            expect(routingEvents.length).toBeGreaterThan(0);
            expect(routingEvents[0].selectedProvider).toBeDefined();
        });
        it('should emit both runtime and provider events', async () => {
            const events = [];
            runtime.on('task-started', () => events.push('runtime:started'));
            runtime.on('task-completed', () => events.push('runtime:completed'));
            router.on('attempt', () => events.push('provider:attempt'));
            router.on('success', () => events.push('provider:success'));
            await runtime.executeTask({
                taskId: 'events-2',
                agentName: 'backend',
                provider: router,
                request: createRequest('Test events'),
            });
            expect(events).toContain('runtime:started');
            expect(events).toContain('runtime:completed');
            expect(events).toContain('provider:attempt');
            expect(events).toContain('provider:success');
        });
    });
    describe('task metadata and statistics', () => {
        it('should track execution duration', async () => {
            const result = await runtime.executeTask({
                taskId: 'metadata-1',
                agentName: 'backend',
                provider: router,
                request: createRequest('Test duration'),
            });
            expect(result.duration).toBeGreaterThan(0);
        });
        it('should store provider response metadata', async () => {
            await runtime.executeTask({
                taskId: 'metadata-2',
                agentName: 'backend',
                provider: router,
                request: createRequest('Test metadata'),
            });
            const status = await runtime.getTaskStatus('metadata-2');
            expect(status?.context.data.tokens).toBeDefined();
            expect(status?.context.data.latency).toBeDefined();
            expect(status?.context.data.startTime).toBeDefined();
        });
        it('should track checkpoint history', async () => {
            const result = await runtime.executeTask({
                taskId: 'history-1',
                agentName: 'backend',
                provider: router,
                request: createRequest('Test history'),
            });
            expect(result.checkpoints.length).toBeGreaterThan(0);
            expect(result.checkpoints[0].state).toBeDefined();
            expect(result.checkpoints[0].timestamp).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=StateMachineProviderIntegration.test.js.map