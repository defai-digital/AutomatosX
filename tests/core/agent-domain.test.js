/**
 * Agent Domain Tests
 *
 * Tests for agent registry and executor functionality.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentRegistry, createAgentExecutor, InMemoryAgentRegistry, AgentRegistryError, DEFAULT_AGENT_DOMAIN_CONFIG, } from '@defai.digital/agent-domain';
describe('Agent Domain', () => {
    describe('InMemoryAgentRegistry', () => {
        let registry;
        beforeEach(() => {
            registry = new InMemoryAgentRegistry();
        });
        describe('register', () => {
            it('should register a valid agent', async () => {
                const profile = {
                    agentId: 'test-agent',
                    description: 'A test agent',
                    enabled: true,
                };
                await registry.register(profile);
                const retrieved = await registry.get('test-agent');
                expect(retrieved).toBeDefined();
                expect(retrieved?.agentId).toBe('test-agent');
                expect(retrieved?.createdAt).toBeDefined();
                expect(retrieved?.updatedAt).toBeDefined();
            });
            it('should reject duplicate agent IDs', async () => {
                const profile = {
                    agentId: 'test-agent',
                    description: 'A test agent',
                    enabled: true,
                };
                await registry.register(profile);
                await expect(registry.register(profile)).rejects.toThrow(AgentRegistryError);
            });
            it('should validate agent profile', async () => {
                const invalidProfile = {
                    agentId: '123-invalid', // Invalid ID format
                    description: 'Test',
                };
                await expect(registry.register(invalidProfile)).rejects.toThrow();
            });
        });
        describe('get', () => {
            it('should return undefined for non-existent agent', async () => {
                const result = await registry.get('non-existent');
                expect(result).toBeUndefined();
            });
        });
        describe('list', () => {
            beforeEach(async () => {
                await registry.register({
                    agentId: 'agent-1',
                    description: 'Agent 1',
                    team: 'quality',
                    tags: ['code', 'review'],
                    capabilities: ['lint'],
                    enabled: true,
                });
                await registry.register({
                    agentId: 'agent-2',
                    description: 'Agent 2',
                    team: 'quality',
                    tags: ['test'],
                    capabilities: ['test'],
                    enabled: true,
                });
                await registry.register({
                    agentId: 'agent-3',
                    description: 'Agent 3',
                    team: 'dev',
                    enabled: false,
                });
            });
            it('should list all agents', async () => {
                const agents = await registry.list();
                expect(agents).toHaveLength(3);
            });
            it('should filter by team', async () => {
                const agents = await registry.list({ team: 'quality' });
                expect(agents).toHaveLength(2);
            });
            it('should filter by tags', async () => {
                const agents = await registry.list({ tags: ['code'] });
                expect(agents).toHaveLength(1);
                expect(agents[0].agentId).toBe('agent-1');
            });
            it('should filter by enabled status', async () => {
                const agents = await registry.list({ enabled: true });
                expect(agents).toHaveLength(2);
            });
            it('should filter by capability', async () => {
                const agents = await registry.list({ capability: 'lint' });
                expect(agents).toHaveLength(1);
                expect(agents[0].agentId).toBe('agent-1');
            });
        });
        describe('update', () => {
            it('should update an existing agent', async () => {
                await registry.register({
                    agentId: 'test-agent',
                    description: 'Original description',
                    enabled: true,
                });
                await registry.update('test-agent', {
                    description: 'Updated description',
                });
                const updated = await registry.get('test-agent');
                expect(updated?.description).toBe('Updated description');
            });
            it('should throw for non-existent agent', async () => {
                await expect(registry.update('non-existent', { description: 'Test' })).rejects.toThrow(AgentRegistryError);
            });
            it('should not allow changing agent ID', async () => {
                await registry.register({
                    agentId: 'test-agent',
                    description: 'Test',
                    enabled: true,
                });
                await registry.update('test-agent', {
                    agentId: 'new-id', // Attempt to change ID
                    description: 'Updated',
                });
                const updated = await registry.get('test-agent');
                expect(updated?.agentId).toBe('test-agent'); // ID unchanged
            });
        });
        describe('remove', () => {
            it('should remove an agent', async () => {
                await registry.register({
                    agentId: 'test-agent',
                    description: 'Test',
                    enabled: true,
                });
                await registry.remove('test-agent');
                const result = await registry.get('test-agent');
                expect(result).toBeUndefined();
            });
            it('should throw for non-existent agent', async () => {
                await expect(registry.remove('non-existent')).rejects.toThrow(AgentRegistryError);
            });
        });
        describe('exists', () => {
            it('should return true for existing agent', async () => {
                await registry.register({
                    agentId: 'test-agent',
                    description: 'Test',
                    enabled: true,
                });
                const exists = await registry.exists('test-agent');
                expect(exists).toBe(true);
            });
            it('should return false for non-existent agent', async () => {
                const exists = await registry.exists('non-existent');
                expect(exists).toBe(false);
            });
        });
        describe('size', () => {
            it('should return correct count', async () => {
                expect(registry.size).toBe(0);
                await registry.register({
                    agentId: 'agent-1',
                    description: 'Test 1',
                    enabled: true,
                });
                expect(registry.size).toBe(1);
                await registry.register({
                    agentId: 'agent-2',
                    description: 'Test 2',
                    enabled: true,
                });
                expect(registry.size).toBe(2);
            });
        });
        describe('clear', () => {
            it('should remove all agents', async () => {
                await registry.register({
                    agentId: 'agent-1',
                    description: 'Test',
                    enabled: true,
                });
                await registry.register({
                    agentId: 'agent-2',
                    description: 'Test',
                    enabled: true,
                });
                registry.clear();
                expect(registry.size).toBe(0);
            });
        });
    });
    describe('DefaultAgentExecutor', () => {
        let registry;
        beforeEach(async () => {
            registry = new InMemoryAgentRegistry();
        });
        it('should execute an agent without workflow', async () => {
            await registry.register({
                agentId: 'simple-agent',
                description: 'Simple agent without workflow',
                enabled: true,
            });
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            const result = await executor.execute('simple-agent', { query: 'test' });
            expect(result.success).toBe(true);
            expect(result.agentId).toBe('simple-agent');
            expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
        });
        it('should execute an agent with workflow', async () => {
            await registry.register({
                agentId: 'workflow-agent',
                description: 'Agent with workflow',
                enabled: true,
                workflow: [
                    {
                        stepId: 'step-1',
                        name: 'First Step',
                        type: 'prompt',
                        config: { prompt: 'Test prompt for step 1' },
                    },
                    {
                        stepId: 'step-2',
                        name: 'Second Step',
                        type: 'tool',
                        config: { tool: 'test' },
                    },
                ],
            });
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            const result = await executor.execute('workflow-agent', {
                query: 'test',
            });
            expect(result.success).toBe(true);
            expect(result.stepResults).toHaveLength(2);
        });
        it('should return error for non-existent agent', async () => {
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            const result = await executor.execute('non-existent', {});
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('AGENT_NOT_FOUND');
        });
        it('should return error for disabled agent', async () => {
            await registry.register({
                agentId: 'disabled-agent',
                description: 'Disabled agent',
                enabled: false,
            });
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            const result = await executor.execute('disabled-agent', {});
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('AGENT_PERMISSION_DENIED');
        });
        it('should handle step dependencies', async () => {
            await registry.register({
                agentId: 'dep-agent',
                description: 'Agent with dependencies',
                enabled: true,
                workflow: [
                    {
                        stepId: 'step-1',
                        name: 'First Step',
                        type: 'prompt',
                        config: { prompt: 'First prompt' },
                    },
                    {
                        stepId: 'step-2',
                        name: 'Second Step',
                        type: 'tool',
                        config: { tool: 'test-tool' },
                        dependencies: ['step-1'],
                    },
                ],
            });
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            const result = await executor.execute('dep-agent', {});
            expect(result.success).toBe(true);
            expect(result.stepResults).toHaveLength(2);
        });
        it('should skip steps when condition is not met', async () => {
            await registry.register({
                agentId: 'conditional-agent',
                description: 'Agent with conditional step',
                enabled: true,
                workflow: [
                    {
                        stepId: 'step-1',
                        name: 'Always Run',
                        type: 'prompt',
                        config: { prompt: 'Always run prompt' },
                    },
                    {
                        stepId: 'step-2',
                        name: 'Conditional Step',
                        type: 'tool',
                        config: { tool: 'conditional-tool' },
                        condition: 'false', // Always skip
                    },
                ],
            });
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            const result = await executor.execute('conditional-agent', {});
            expect(result.success).toBe(true);
            expect(result.stepResults?.find((r) => r.stepId === 'step-2')?.skipped).toBe(true);
        });
        it('should track execution status', async () => {
            await registry.register({
                agentId: 'status-agent',
                description: 'Agent for status tracking',
                enabled: true,
                workflow: [
                    {
                        stepId: 'step-1',
                        name: 'Step 1',
                        type: 'prompt',
                        config: { prompt: 'Status tracking prompt' },
                    },
                ],
            });
            const executor = createAgentExecutor(registry, DEFAULT_AGENT_DOMAIN_CONFIG);
            // Start execution
            const resultPromise = executor.execute('status-agent', {});
            // Wait for completion
            const result = await resultPromise;
            expect(result.success).toBe(true);
        });
    });
    describe('createAgentRegistry', () => {
        it('should create an InMemoryAgentRegistry', () => {
            const registry = createAgentRegistry();
            expect(registry).toBeInstanceOf(InMemoryAgentRegistry);
        });
    });
});
//# sourceMappingURL=agent-domain.test.js.map