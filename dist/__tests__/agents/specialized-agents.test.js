/**
 * specialized-agents.test.ts
 * Test suite for 12 specialized agents
 * Phase 7: Agent System Implementation - Day 3
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataScienceAgent } from '../../agents/DataScienceAgent.js';
import { DatabaseAgent } from '../../agents/DatabaseAgent.js';
import { APIAgent } from '../../agents/APIAgent.js';
import { PerformanceAgent } from '../../agents/PerformanceAgent.js';
import { MobileAgent } from '../../agents/MobileAgent.js';
import { InfrastructureAgent } from '../../agents/InfrastructureAgent.js';
import { TestingAgent } from '../../agents/TestingAgent.js';
import { CTOAgent } from '../../agents/CTOAgent.js';
import { CEOAgent } from '../../agents/CEOAgent.js';
import { WriterAgent } from '../../agents/WriterAgent.js';
import { ResearcherAgent } from '../../agents/ResearcherAgent.js';
import { StandardsAgent } from '../../agents/StandardsAgent.js';
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
            call: vi.fn().mockResolvedValue('Mock AI response with code'),
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
describe('DataScienceAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new DataScienceAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('datascience');
        expect(metadata.name).toBe('Data Science Specialist (Dana)');
        expect(metadata.specializations).toContain('TensorFlow');
        expect(metadata.specializations).toContain('PyTorch');
    });
    it('should handle ML tasks', () => {
        const task = createMockTask('Train a neural network model', ['ml', 'machine learning', 'model', 'training']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute ML task successfully', async () => {
        const task = createMockTask('Build a classification model', ['machine learning', 'model', 'training']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(context.memory.store).toHaveBeenCalled();
    });
});
describe('DatabaseAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new DatabaseAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('database');
        expect(metadata.name).toBe('Database Specialist (Derek)');
        expect(metadata.specializations).toContain('PostgreSQL');
        expect(metadata.specializations).toContain('SQL');
    });
    it('should handle database tasks', () => {
        const task = createMockTask('Optimize database queries', ['database', 'query', 'optimization', 'sql']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute database task successfully', async () => {
        const task = createMockTask('Design a database schema', ['database', 'schema', 'table']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('APIAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new APIAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('api');
        expect(metadata.name).toBe('API Specialist (Alex)');
        expect(metadata.specializations).toContain('REST');
        expect(metadata.specializations).toContain('GraphQL');
    });
    it('should handle API tasks', () => {
        const task = createMockTask('Design a REST API', ['api', 'rest', 'endpoint', 'http']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute API task successfully', async () => {
        const task = createMockTask('Create GraphQL schema', ['graphql', 'schema', 'api']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('PerformanceAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new PerformanceAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('performance');
        expect(metadata.name).toBe('Performance Specialist (Percy)');
        expect(metadata.specializations).toContain('Profiling');
        expect(metadata.specializations).toContain('Caching');
    });
    it('should handle performance tasks', () => {
        const task = createMockTask('Optimize application performance', ['performance', 'optimization', 'profiling', 'bottleneck']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute performance task successfully', async () => {
        const task = createMockTask('Profile and optimize code', ['performance', 'profiling', 'optimization']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('MobileAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new MobileAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('mobile');
        expect(metadata.name).toBe('Mobile Specialist (Maya)');
        expect(metadata.specializations).toContain('Swift');
        expect(metadata.specializations).toContain('Kotlin');
        expect(metadata.specializations).toContain('Flutter');
    });
    it('should handle mobile tasks', () => {
        const task = createMockTask('Build an iOS app', ['ios', 'swift', 'mobile', 'swiftui']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute mobile task successfully', async () => {
        const task = createMockTask('Create React Native component', ['react native', 'mobile', 'cross-platform']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('InfrastructureAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new InfrastructureAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('infrastructure');
        expect(metadata.name).toBe('Infrastructure Specialist (Iris)');
        expect(metadata.specializations).toContain('AWS');
        expect(metadata.specializations).toContain('Kubernetes');
    });
    it('should handle infrastructure tasks', () => {
        const task = createMockTask('Set up Kubernetes cluster', ['kubernetes', 'k8s', 'infrastructure', 'cloud']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute infrastructure task successfully', async () => {
        const task = createMockTask('Create Terraform config', ['terraform', 'infrastructure', 'iac']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('TestingAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new TestingAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('testing');
        expect(metadata.name).toBe('Testing Specialist (Tessa)');
        expect(metadata.specializations).toContain('Jest');
        expect(metadata.specializations).toContain('Vitest');
    });
    it('should handle testing tasks', () => {
        const task = createMockTask('Design test strategy', ['testing', 'test strategy', 'coverage', 'test plan']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute testing task successfully', async () => {
        const task = createMockTask('Write comprehensive tests', ['testing', 'test', 'coverage']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('CTOAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new CTOAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('cto');
        expect(metadata.name).toBe('CTO (Tony)');
        expect(metadata.specializations).toContain('Technical Strategy');
        expect(metadata.specializations).toContain('System Architecture');
    });
    it('should handle technical strategy tasks', () => {
        const task = createMockTask('Define technical roadmap', ['strategy', 'technical vision', 'roadmap', 'technology stack']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute CTO task successfully', async () => {
        const task = createMockTask('Make architecture decisions', ['architecture', 'technical strategy', 'system design']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('CEOAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new CEOAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('ceo');
        expect(metadata.name).toBe('CEO (Eric)');
        expect(metadata.specializations).toContain('Business Strategy');
        expect(metadata.specializations).toContain('Market Analysis');
    });
    it('should handle business strategy tasks', () => {
        const task = createMockTask('Define business vision', ['business strategy', 'vision', 'growth', 'mission']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute CEO task successfully', async () => {
        const task = createMockTask('Create growth strategy', ['growth', 'business strategy', 'expansion']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('WriterAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new WriterAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('writer');
        expect(metadata.name).toBe('Technical Writer (Wendy)');
        expect(metadata.specializations).toContain('Technical Writing');
        expect(metadata.specializations).toContain('API Documentation');
    });
    it('should handle documentation tasks', () => {
        const task = createMockTask('Write API documentation', ['documentation', 'api docs', 'technical writing']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute writing task successfully', async () => {
        const task = createMockTask('Create user guide', ['user guide', 'documentation', 'tutorial']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('ResearcherAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new ResearcherAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('researcher');
        expect(metadata.name).toBe('Researcher (Rodman)');
        expect(metadata.specializations).toContain('Research Methods');
        expect(metadata.specializations).toContain('Data Analysis');
    });
    it('should handle research tasks', () => {
        const task = createMockTask('Conduct research analysis', ['research', 'analysis', 'insights', 'study']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThanOrEqual(0.3);
    });
    it('should execute research task successfully', async () => {
        const task = createMockTask('Literature review', ['research', 'literature', 'review']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
describe('StandardsAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new StandardsAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('standards');
        expect(metadata.name).toBe('Standards Specialist (Stan)');
        expect(metadata.specializations).toContain('WCAG');
        expect(metadata.specializations).toContain('GDPR');
    });
    it('should handle compliance tasks', () => {
        const task = createMockTask('Ensure WCAG compliance', ['compliance', 'wcag', 'accessibility']);
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute standards task successfully', async () => {
        const task = createMockTask('Apply best practices', ['best practices', 'standards', 'compliance']);
        const context = createMockContext();
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
    });
});
// Integration tests
describe('All Specialized Agents Integration', () => {
    it('should create all 12 specialized agents', () => {
        const agents = [
            new DataScienceAgent(),
            new DatabaseAgent(),
            new APIAgent(),
            new PerformanceAgent(),
            new MobileAgent(),
            new InfrastructureAgent(),
            new TestingAgent(),
            new CTOAgent(),
            new CEOAgent(),
            new WriterAgent(),
            new ResearcherAgent(),
            new StandardsAgent(),
        ];
        expect(agents).toHaveLength(12);
        agents.forEach(agent => {
            expect(agent.getMetadata()).toBeDefined();
            expect(agent.getMetadata().type).toBeDefined();
            expect(agent.getMetadata().capabilities.length).toBeGreaterThan(0);
        });
    });
    it('should have unique agent types', () => {
        const agents = [
            new DataScienceAgent(),
            new DatabaseAgent(),
            new APIAgent(),
            new PerformanceAgent(),
            new MobileAgent(),
            new InfrastructureAgent(),
            new TestingAgent(),
            new CTOAgent(),
            new CEOAgent(),
            new WriterAgent(),
            new ResearcherAgent(),
            new StandardsAgent(),
        ];
        const types = agents.map(a => a.getMetadata().type);
        const uniqueTypes = new Set(types);
        expect(uniqueTypes.size).toBe(12);
    });
    it('should all inherit from AgentBase', () => {
        const agents = [
            new DataScienceAgent(),
            new DatabaseAgent(),
            new APIAgent(),
            new PerformanceAgent(),
            new MobileAgent(),
            new InfrastructureAgent(),
            new TestingAgent(),
            new CTOAgent(),
            new CEOAgent(),
            new WriterAgent(),
            new ResearcherAgent(),
            new StandardsAgent(),
        ];
        agents.forEach(agent => {
            expect(typeof agent.canHandle).toBe('function');
            expect(typeof agent.execute).toBe('function');
            expect(typeof agent.getMetadata).toBe('function');
        });
    });
});
//# sourceMappingURL=specialized-agents.test.js.map