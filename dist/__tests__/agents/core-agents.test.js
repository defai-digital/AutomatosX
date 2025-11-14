/**
 * core-agents.test.ts
 *
 * Tests for 8 core agents
 * Phase 7: Agent System Implementation - Day 2
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackendAgent } from '../../agents/BackendAgent.js';
import { FrontendAgent } from '../../agents/FrontendAgent.js';
import { SecurityAgent } from '../../agents/SecurityAgent.js';
import { QualityAgent } from '../../agents/QualityAgent.js';
import { DevOpsAgent } from '../../agents/DevOpsAgent.js';
import { ArchitectAgent } from '../../agents/ArchitectAgent.js';
import { DataAgent } from '../../agents/DataAgent.js';
import { ProductAgent } from '../../agents/ProductAgent.js';
/**
 * Create mock context for testing
 */
function createMockContext(task) {
    return {
        task,
        memory: {
            search: vi.fn().mockResolvedValue([]),
            recall: vi.fn().mockResolvedValue({}),
            store: vi.fn().mockResolvedValue(undefined),
        },
        codeIntelligence: {
            findSymbol: vi.fn().mockResolvedValue([]),
            getCallGraph: vi.fn().mockResolvedValue({}),
            searchCode: vi.fn().mockResolvedValue([]),
            analyzeQuality: vi.fn().mockResolvedValue({}),
        },
        provider: {
            call: vi.fn().mockResolvedValue('Mock AI response with ```typescript\nconst example = "test";\n```'),
            stream: vi.fn(async function* () {
                yield 'Mock stream response';
            }),
        },
        delegate: vi.fn().mockResolvedValue({ success: true }),
        monitoring: {
            recordMetric: vi.fn(),
            startTrace: vi.fn().mockReturnValue('trace-id'),
            startSpan: vi.fn().mockReturnValue('span-id'),
            completeSpan: vi.fn(),
            log: vi.fn(),
        },
    };
}
/**
 * Create mock task
 */
function createMockTask(description, overrides) {
    return {
        id: 'test-task-id',
        description,
        priority: 'medium',
        status: 'pending',
        createdAt: Date.now(),
        ...overrides,
    };
}
describe('BackendAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new BackendAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('backend');
        expect(metadata.name).toContain('Backend');
        expect(metadata.capabilities.length).toBeGreaterThan(0);
        expect(metadata.specializations).toContain('Node.js');
    });
    it('should handle backend tasks', () => {
        const task = createMockTask('Create a REST API for user management');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute backend task successfully', async () => {
        const task = createMockTask('Build an authentication API with JWT');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(context.memory.store).toHaveBeenCalled();
    });
    it('should suggest delegation for non-backend tasks', async () => {
        const task = createMockTask('Design a beautiful UI with animations');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(false);
        expect(result.message).toContain('outside');
    });
});
describe('FrontendAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new FrontendAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('frontend');
        expect(metadata.name).toContain('Frontend');
        expect(metadata.specializations).toContain('React');
    });
    it('should handle frontend tasks', () => {
        const task = createMockTask('Create a responsive dashboard component in React');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute frontend task successfully', async () => {
        const task = createMockTask('Build a React component with Tailwind CSS');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });
});
describe('SecurityAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new SecurityAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('security');
        expect(metadata.name).toContain('Security');
        expect(metadata.temperature).toBe(0.5); // Lower temperature for precision
    });
    it('should handle security tasks', () => {
        const task = createMockTask('Audit authentication system for vulnerabilities');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute security audit successfully', async () => {
        const task = createMockTask('Check for SQL injection vulnerabilities');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.metadata?.auditType).toBe('security');
    });
});
describe('QualityAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new QualityAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('quality');
        expect(metadata.name).toContain('Quality');
        expect(metadata.specializations).toContain('Jest');
    });
    it('should handle testing tasks', () => {
        const task = createMockTask('Write unit tests for the user service');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute test writing successfully', async () => {
        const task = createMockTask('Create integration tests for API endpoints');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.metadata?.testType).toBeDefined();
    });
});
describe('DevOpsAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new DevOpsAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('devops');
        expect(metadata.name).toContain('DevOps');
        expect(metadata.specializations).toContain('Docker');
    });
    it('should handle DevOps tasks', () => {
        const task = createMockTask('Set up CI/CD pipeline with GitHub Actions');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute DevOps task successfully', async () => {
        const task = createMockTask('Create Kubernetes deployment configuration');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.metadata?.category).toBe('infrastructure');
    });
});
describe('ArchitectAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new ArchitectAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('architecture');
        expect(metadata.name).toContain('Architecture');
        expect(metadata.specializations).toContain('System Design');
    });
    it('should handle architecture tasks', () => {
        const task = createMockTask('Design system architecture for microservices');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute architecture task successfully', async () => {
        const task = createMockTask('Create ADR for database selection');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.metadata?.category).toBe('architecture');
    });
});
describe('DataAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new DataAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('data');
        expect(metadata.name).toContain('Data');
        expect(metadata.specializations).toContain('Apache Airflow');
    });
    it('should handle data engineering tasks', () => {
        const task = createMockTask('Design ETL pipeline for data warehouse');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute data task successfully', async () => {
        const task = createMockTask('Create data transformation pipeline with Spark');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.metadata?.category).toBe('data-engineering');
    });
});
describe('ProductAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new ProductAgent();
    });
    it('should have correct metadata', () => {
        const metadata = agent.getMetadata();
        expect(metadata.type).toBe('product');
        expect(metadata.name).toContain('Product');
        expect(metadata.specializations).toContain('PRDs');
    });
    it('should handle product management tasks', () => {
        const task = createMockTask('Write PRD for new authentication feature');
        const score = agent.canHandle(task);
        expect(score).toBeGreaterThan(0.3);
    });
    it('should execute product task successfully', async () => {
        const task = createMockTask('Create user stories for checkout flow');
        const context = createMockContext(task);
        const result = await agent.execute(task, context);
        expect(result.success).toBe(true);
        expect(result.metadata?.category).toBe('product-management');
    });
});
describe('Agent Integration', () => {
    it('should create all 8 core agents', () => {
        const agents = [
            new BackendAgent(),
            new FrontendAgent(),
            new SecurityAgent(),
            new QualityAgent(),
            new DevOpsAgent(),
            new ArchitectAgent(),
            new DataAgent(),
            new ProductAgent(),
        ];
        expect(agents).toHaveLength(8);
        agents.forEach((agent) => {
            const metadata = agent.getMetadata();
            expect(metadata.type).toBeDefined();
            expect(metadata.name).toBeDefined();
            expect(metadata.capabilities.length).toBeGreaterThan(0);
        });
    });
    it('should have unique agent types', () => {
        const agents = [
            new BackendAgent(),
            new FrontendAgent(),
            new SecurityAgent(),
            new QualityAgent(),
            new DevOpsAgent(),
            new ArchitectAgent(),
            new DataAgent(),
            new ProductAgent(),
        ];
        const types = agents.map((agent) => agent.getMetadata().type);
        const uniqueTypes = new Set(types);
        expect(uniqueTypes.size).toBe(8);
    });
    it('should all agents extend AgentBase', () => {
        const agents = [
            new BackendAgent(),
            new FrontendAgent(),
            new SecurityAgent(),
            new QualityAgent(),
            new DevOpsAgent(),
            new ArchitectAgent(),
            new DataAgent(),
            new ProductAgent(),
        ];
        agents.forEach((agent) => {
            expect(typeof agent.execute).toBe('function');
            expect(typeof agent.canHandle).toBe('function');
            expect(typeof agent.getMetadata).toBe('function');
        });
    });
});
//# sourceMappingURL=core-agents.test.js.map