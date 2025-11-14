/**
 * agent-collaboration.test.ts
 * Integration tests for AgentCollaborator and TaskRouter
 * Phase 7: Agent System Implementation - Day 4
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { AgentCollaborator } from '../../agents/AgentCollaborator.js';
import { TaskRouter } from '../../agents/TaskRouter.js';
import { BackendAgent } from '../../agents/BackendAgent.js';
import { SecurityAgent } from '../../agents/SecurityAgent.js';
import { DatabaseAgent } from '../../agents/DatabaseAgent.js';
import { APIAgent } from '../../agents/APIAgent.js';
import { QualityAgent } from '../../agents/QualityAgent.js';
import { WriterAgent } from '../../agents/WriterAgent.js';
// Helper function to create mock tasks
function createMockTask(description, keywords) {
    return {
        id: `task-${Date.now()}`,
        description,
        status: 'pending',
        priority: 'medium',
        context: { keywords: keywords || [] },
        createdAt: Date.now(),
    };
}
// Helper function to create mock context
function createMockContext() {
    return {
        task: createMockTask('test task'),
        memory: {
            search: vi.fn().mockResolvedValue([]),
            recall: vi.fn().mockResolvedValue(null),
            store: vi.fn().mockResolvedValue(undefined),
        },
        codeIntelligence: {
            findSymbol: vi.fn().mockResolvedValue([]),
            getCallGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
            searchCode: vi.fn().mockResolvedValue([]),
            analyzeQuality: vi.fn().mockResolvedValue({ score: 0.8, issues: [] }),
        },
        provider: {
            call: vi.fn().mockResolvedValue('Mock AI response with implementation'),
            stream: vi.fn(),
        },
        delegate: vi.fn(),
        monitoring: {
            recordMetric: vi.fn(),
            startTrace: vi.fn().mockReturnValue('trace-id'),
            startSpan: vi.fn().mockReturnValue('span-id'),
            completeSpan: vi.fn(),
            log: vi.fn(),
        },
    };
}
// Helper function to initialize registry with test agents
function createTestRegistry() {
    const registry = new AgentRegistry();
    registry.register(new BackendAgent());
    registry.register(new SecurityAgent());
    registry.register(new DatabaseAgent());
    registry.register(new APIAgent());
    registry.register(new QualityAgent());
    registry.register(new WriterAgent());
    return registry;
}
describe('TaskRouter', () => {
    let router;
    let registry;
    beforeEach(() => {
        registry = createTestRegistry();
        router = new TaskRouter(registry);
    });
    describe('Intent Detection', () => {
        it('should detect backend-dev intent', () => {
            const task = createMockTask('Create a REST API service');
            const parsed = router.parseTask(task.description);
            expect(parsed.intent).toBe('backend-dev');
            expect(parsed.keywords).toContain('api');
        });
        it('should detect security-audit intent', () => {
            const task = createMockTask('Audit the authentication code for vulnerabilities');
            const parsed = router.parseTask(task.description);
            expect(parsed.intent).toBe('security-audit');
            expect(parsed.keywords).toContain('security');
        });
        it('should detect database-design intent', () => {
            const task = createMockTask('Design a schema for user data');
            const parsed = router.parseTask(task.description);
            expect(parsed.intent).toBe('database-design');
            expect(parsed.keywords).toContain('database');
        });
        it('should detect api-design intent', () => {
            const task = createMockTask('Design REST API endpoints for users');
            const parsed = router.parseTask(task.description);
            expect(parsed.intent).toBe('api-design');
            expect(parsed.keywords).toContain('api');
        });
        it('should detect testing intent', () => {
            const task = createMockTask('Write comprehensive tests for the API');
            const parsed = router.parseTask(task.description);
            expect(parsed.intent).toBe('testing');
            expect(parsed.keywords).toContain('test');
        });
    });
    describe('@Mention Support', () => {
        it('should extract @backend mention', () => {
            const task = createMockTask('@backend implement user service');
            const parsed = router.parseTask(task.description);
            expect(parsed.mentionedAgent).toBe('backend');
        });
        it('should extract @security mention', () => {
            const task = createMockTask('@security audit this code');
            const parsed = router.parseTask(task.description);
            expect(parsed.mentionedAgent).toBe('security');
        });
        it('should give @mention highest priority', () => {
            const task = createMockTask('@backend write tests'); // "tests" might suggest quality agent
            const agent = router.routeToAgent(task);
            expect(agent?.getMetadata().type).toBe('backend');
        });
    });
    describe('Agent Routing', () => {
        it('should route to backend agent for backend tasks', () => {
            const task = createMockTask('Create a microservice');
            const agent = router.routeToAgent(task);
            expect(agent).toBeDefined();
            expect(agent?.getMetadata().type).toBe('backend');
        });
        it('should route to security agent for security tasks', () => {
            const task = createMockTask('Find security vulnerabilities');
            const agent = router.routeToAgent(task);
            expect(agent).toBeDefined();
            expect(agent?.getMetadata().type).toBe('security');
        });
        it('should route to database agent for database tasks', () => {
            const task = createMockTask('Optimize database queries');
            const agent = router.routeToAgent(task);
            expect(agent).toBeDefined();
            expect(agent?.getMetadata().type).toBe('database');
        });
        it('should route to api agent for API tasks', () => {
            const task = createMockTask('Design GraphQL schema');
            const agent = router.routeToAgent(task);
            expect(agent).toBeDefined();
            expect(agent?.getMetadata().type).toBe('api');
        });
    });
    describe('Confidence Scoring', () => {
        it('should have high confidence with @mention', () => {
            const task = createMockTask('@backend create service');
            const confidence = router.getRoutingConfidence(task);
            expect(confidence).toBeGreaterThan(0.5);
        });
        it('should have moderate confidence with intent match', () => {
            const task = createMockTask('Design database schema');
            const confidence = router.getRoutingConfidence(task);
            expect(confidence).toBeGreaterThan(0.2);
        });
        it('should have low confidence with no matches', () => {
            const task = createMockTask('Do something');
            const confidence = router.getRoutingConfidence(task);
            expect(confidence).toBeLessThan(0.3);
        });
    });
    describe('Suggested Agents', () => {
        it('should suggest multiple agents for ambiguous tasks', () => {
            const task = createMockTask('Build authentication system');
            const suggestions = router.getSuggestedAgents(task, 3);
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions.length).toBeLessThanOrEqual(3);
            expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.3);
        });
        it('should order suggestions by confidence', () => {
            const task = createMockTask('Create API with database and security');
            const suggestions = router.getSuggestedAgents(task, 5);
            for (let i = 1; i < suggestions.length; i++) {
                expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
            }
        });
    });
});
describe('AgentCollaborator', () => {
    let collaborator;
    let registry;
    let context;
    beforeEach(() => {
        registry = createTestRegistry();
        collaborator = new AgentCollaborator(registry);
        context = createMockContext();
    });
    describe('Task Decomposition', () => {
        it('should decompose database task', async () => {
            const task = createMockTask('Design database schema for users');
            const subtasks = await collaborator.decomposeTask(task, context);
            expect(subtasks.length).toBeGreaterThan(0);
            const dbTask = subtasks.find(st => st.agentType === 'database');
            expect(dbTask).toBeDefined();
        });
        it('should decompose API task', async () => {
            const task = createMockTask('Create REST API endpoints');
            const subtasks = await collaborator.decomposeTask(task, context);
            expect(subtasks.length).toBeGreaterThan(0);
            const apiTask = subtasks.find(st => st.agentType === 'api');
            expect(apiTask).toBeDefined();
        });
        it('should decompose security task', async () => {
            const task = createMockTask('Implement secure authentication');
            const subtasks = await collaborator.decomposeTask(task, context);
            expect(subtasks.length).toBeGreaterThan(0);
            const secTask = subtasks.find(st => st.agentType === 'security');
            expect(secTask).toBeDefined();
        });
        it('should decompose testing task', async () => {
            const task = createMockTask('Write comprehensive tests');
            const subtasks = await collaborator.decomposeTask(task, context);
            expect(subtasks.length).toBeGreaterThan(0);
            const testTask = subtasks.find(st => st.agentType === 'quality');
            expect(testTask).toBeDefined();
        });
        it('should create dependencies between subtasks', async () => {
            const task = createMockTask('Build API with database and security');
            const subtasks = await collaborator.decomposeTask(task, context);
            // Check that later tasks depend on earlier ones
            const dependentTasks = subtasks.filter(st => st.dependsOn && st.dependsOn.length > 0);
            expect(dependentTasks.length).toBeGreaterThan(0);
        });
        it('should handle single-agent tasks', async () => {
            const task = createMockTask('Refactor code'); // No specific keywords
            const subtasks = await collaborator.decomposeTask(task, context);
            expect(subtasks.length).toBe(1);
            expect(subtasks[0].description).toBe(task.description);
        });
    });
    describe('Workflow Execution', () => {
        it('should execute simple single-agent workflow', async () => {
            const task = createMockTask('Create service');
            const result = await collaborator.collaborate(task, context, 'auto');
            expect(result.success).toBe(true);
            expect(result.subtasks.length).toBeGreaterThan(0);
            expect(result.aggregatedResult).toBeDefined();
            expect(result.executionTime).toBeGreaterThan(0);
        });
        it('should execute parallel workflow when no dependencies', async () => {
            const task = createMockTask('Write documentation'); // Single task, no dependencies
            const result = await collaborator.collaborate(task, context, 'parallel');
            expect(result.success).toBe(true);
            expect(result.strategy).toBe('parallel');
        });
        it('should execute sequential workflow with dependencies', async () => {
            const task = createMockTask('Build database API with security');
            const result = await collaborator.collaborate(task, context, 'auto');
            expect(result.success).toBe(true);
            // Should choose sequential due to dependencies
            expect(['sequential', 'parallel']).toContain(result.strategy);
        });
        it('should aggregate results from multiple agents', async () => {
            const task = createMockTask('Build API with database');
            const result = await collaborator.collaborate(task, context, 'auto');
            expect(result.aggregatedResult).toBeDefined();
            expect(result.aggregatedResult.success).toBe(true);
            if (result.aggregatedResult.metadata) {
                expect(result.aggregatedResult.metadata.subtasks).toBeDefined();
            }
        });
    });
    describe('Event Emissions', () => {
        it('should emit collaboration:start event', async () => {
            const startSpy = vi.fn();
            collaborator.on('collaboration:start', startSpy);
            const task = createMockTask('Test task');
            await collaborator.collaborate(task, context, 'auto');
            expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ task, strategy: 'auto' }));
        });
        it('should emit collaboration:complete event', async () => {
            const completeSpy = vi.fn();
            collaborator.on('collaboration:complete', completeSpy);
            const task = createMockTask('Test task');
            await collaborator.collaborate(task, context, 'auto');
            expect(completeSpy).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });
        it('should emit subtask events', async () => {
            const subtaskStartSpy = vi.fn();
            const subtaskCompleteSpy = vi.fn();
            collaborator.on('subtask:start', subtaskStartSpy);
            collaborator.on('subtask:complete', subtaskCompleteSpy);
            const task = createMockTask('Test task');
            await collaborator.collaborate(task, context, 'auto');
            expect(subtaskStartSpy).toHaveBeenCalled();
            expect(subtaskCompleteSpy).toHaveBeenCalled();
        });
    });
    describe('Error Handling', () => {
        it('should handle agent not found', async () => {
            const task = createMockTask('Test with invalid agent type');
            // Force a subtask with non-existent agent
            vi.spyOn(collaborator, 'decomposeTask').mockResolvedValue([
                {
                    id: 'test-1',
                    description: 'Test',
                    agentType: 'nonexistent',
                    priority: 10,
                    status: 'pending',
                },
            ]);
            const result = await collaborator.collaborate(task, context, 'auto');
            // Should still return a result even if subtasks fail
            expect(result).toBeDefined();
            expect(result.subtasks[0].status).toBe('failed');
        });
    });
});
describe('End-to-End Integration', () => {
    let registry;
    let router;
    let collaborator;
    let context;
    beforeEach(() => {
        registry = createTestRegistry();
        router = new TaskRouter(registry);
        collaborator = new AgentCollaborator(registry);
        context = createMockContext();
    });
    it('should route and execute simple task end-to-end', async () => {
        const task = createMockTask('Create backend service');
        // Route to agent
        const agent = router.routeToAgent(task);
        expect(agent).toBeDefined();
        expect(agent?.getMetadata().type).toBe('backend');
        // Execute task
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
    it('should collaborate and execute complex task end-to-end', async () => {
        const task = createMockTask('Build authentication system with database, API, and security');
        // Collaborate
        const result = await collaborator.collaborate(task, context, 'auto');
        expect(result.success).toBe(true);
        expect(result.subtasks.length).toBeGreaterThan(1);
        expect(result.aggregatedResult).toBeDefined();
    });
    it('should use @mention routing in collaboration workflow', async () => {
        const task = createMockTask('@database design user schema');
        // Route to agent
        const agent = router.routeToAgent(task);
        expect(agent?.getMetadata().type).toBe('database');
        // Execute
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
//# sourceMappingURL=agent-collaboration.test.js.map