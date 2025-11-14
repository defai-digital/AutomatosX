/**
 * agent-foundation.test.ts
 *
 * Tests for Agent System Foundation (Day 1)
 * Phase 7: Agent System Implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentBase } from '../../agents/AgentBase.js';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { AgentRuntime } from '../../agents/AgentRuntime.js';
import {
  Task,
  TaskResult,
  AgentContext,
  AgentExecutionOptions,
  AgentMetadata,
} from '../../types/agents.types.js';

/**
 * Mock Agent for testing
 */
class MockAgent extends AgentBase {
  constructor(metadata: AgentMetadata) {
    super(metadata);
  }

  protected async executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      success: true,
      message: `Task completed by ${this.metadata.name}`,
      data: { taskId: task.id, agent: this.metadata.type },
    };
  }
}

/**
 * Mock Agent that fails
 */
class FailingAgent extends AgentBase {
  constructor(metadata: AgentMetadata) {
    super(metadata);
  }

  protected async executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    throw new Error('Simulated failure');
  }
}

/**
 * Mock Agent that times out
 */
class SlowAgent extends AgentBase {
  constructor(metadata: AgentMetadata) {
    super(metadata);
  }

  protected async executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    // Wait longer than default timeout
    await new Promise((resolve) => setTimeout(resolve, 10000));

    return {
      success: true,
      message: 'Should not reach here',
    };
  }
}

/**
 * Create mock context for testing
 */
function createMockContext(task: Task): AgentContext {
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
      call: vi.fn().mockResolvedValue('Mock provider response'),
      stream: vi.fn(async function* () {
        yield 'Mock stream response';
      }),
    } as any,
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
 * Create mock task for testing
 */
function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 'test-task-id',
    description: 'Test task for backend development',
    priority: 'medium',
    status: 'pending',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('AgentBase', () => {
  describe('execute()', () => {
    it('should execute task successfully', async () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Test backend agent',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build REST APIs',
            keywords: ['api', 'rest', 'backend'],
          },
        ],
        specializations: ['Node.js', 'TypeScript'],
      };

      const agent = new MockAgent(metadata);
      const task = createMockTask();
      const context = createMockContext(task);

      const result = await agent.execute(task, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Backend Agent');
      expect(result.data).toHaveProperty('taskId', task.id);
      expect(result.data).toHaveProperty('agent', 'backend');
    });

    it('should retry on failure up to maxRetries', async () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Failing Agent',
        description: 'Test failing agent',
        capabilities: [],
        specializations: [],
      };

      const agent = new FailingAgent(metadata);
      const task = createMockTask();
      const context = createMockContext(task);

      const result = await agent.execute(task, context, { maxRetries: 3 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed after 3 attempts');
    }, 10000);

    it('should timeout if task takes too long', async () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Slow Agent',
        description: 'Test slow agent',
        capabilities: [],
        specializations: [],
      };

      const agent = new SlowAgent(metadata);
      const task = createMockTask();
      const context = createMockContext(task);

      const result = await agent.execute(task, context, { timeout: 100, maxRetries: 1 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('timeout');
    });

    it('should emit task.started and task.completed events', async () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Test backend agent',
        capabilities: [],
        specializations: [],
      };

      const agent = new MockAgent(metadata);
      const task = createMockTask();
      const context = createMockContext(task);

      const startedListener = vi.fn();
      const completedListener = vi.fn();

      agent.on('task.started', startedListener);
      agent.on('task.completed', completedListener);

      await agent.execute(task, context);

      expect(startedListener).toHaveBeenCalledWith({
        agent: 'backend',
        task,
      });
      expect(completedListener).toHaveBeenCalled();
    });

    it('should emit task.failed event on failure', async () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Failing Agent',
        description: 'Test failing agent',
        capabilities: [],
        specializations: [],
      };

      const agent = new FailingAgent(metadata);
      const task = createMockTask();
      const context = createMockContext(task);

      const failedListener = vi.fn();
      agent.on('task.failed', failedListener);

      await agent.execute(task, context, { maxRetries: 1 });

      expect(failedListener).toHaveBeenCalled();
    });
  });

  describe('canHandle()', () => {
    it('should return high score for matching keywords', () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build REST APIs',
            keywords: ['api', 'rest', 'backend', 'database'],
          },
        ],
        specializations: ['Node.js', 'TypeScript', 'PostgreSQL'],
      };

      const agent = new MockAgent(metadata);
      const task = createMockTask({
        description: 'Create a REST API with database integration using Node.js',
      });

      const score = agent.canHandle(task);

      expect(score).toBeGreaterThan(0.3);
    });

    it('should return low score for non-matching keywords', () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build REST APIs',
            keywords: ['api', 'rest', 'backend'],
          },
        ],
        specializations: ['Node.js'],
      };

      const agent = new MockAgent(metadata);
      const task = createMockTask({
        description: 'Design a beautiful UI with animations',
      });

      const score = agent.canHandle(task);

      expect(score).toBeLessThan(0.3);
    });
  });
});

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('register()', () => {
    it('should register an agent', () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [],
        specializations: [],
      };

      const agent = new MockAgent(metadata);
      registry.register(agent);

      expect(registry.has('backend')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should throw error if agent already registered', () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [],
        specializations: [],
      };

      const agent1 = new MockAgent(metadata);
      const agent2 = new MockAgent(metadata);

      registry.register(agent1);

      expect(() => registry.register(agent2)).toThrow('already registered');
    });
  });

  describe('get()', () => {
    it('should get agent by type', () => {
      const metadata: AgentMetadata = {
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [],
        specializations: [],
      };

      const agent = new MockAgent(metadata);
      registry.register(agent);

      const retrieved = registry.get('backend');

      expect(retrieved).toBe(agent);
    });

    it('should return undefined for non-existent agent', () => {
      const retrieved = registry.get('backend');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('findBestAgent()', () => {
    it('should find best agent for task', () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build APIs',
            keywords: ['api', 'rest', 'backend'],
          },
        ],
        specializations: ['Node.js'],
      });

      const frontendAgent = new MockAgent({
        type: 'frontend',
        name: 'Frontend Agent',
        description: 'Frontend specialist',
        capabilities: [
          {
            name: 'UI Development',
            description: 'Build UIs',
            keywords: ['ui', 'react', 'frontend'],
          },
        ],
        specializations: ['React'],
      });

      registry.register(backendAgent);
      registry.register(frontendAgent);

      const task = createMockTask({
        description: 'Create a REST API with Node.js',
      });

      const bestAgent = registry.findBestAgent(task);

      expect(bestAgent).toBe(backendAgent);
    });

    it('should return null if no agent meets minimum score', () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build APIs',
            keywords: ['api', 'rest', 'backend'],
          },
        ],
        specializations: [],
      });

      registry.register(backendAgent);

      const task = createMockTask({
        description: 'Design quantum computing algorithm',
      });

      const bestAgent = registry.findBestAgent(task);

      expect(bestAgent).toBeNull();
    });

    it('should use assigned agent if specified', () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [],
        specializations: [],
      });

      const frontendAgent = new MockAgent({
        type: 'frontend',
        name: 'Frontend Agent',
        description: 'Frontend specialist',
        capabilities: [],
        specializations: [],
      });

      registry.register(backendAgent);
      registry.register(frontendAgent);

      const task = createMockTask({
        description: 'Create something',
        assignedAgent: 'frontend',
      });

      const bestAgent = registry.findBestAgent(task);

      expect(bestAgent).toBe(frontendAgent);
    });
  });

  describe('searchAgents()', () => {
    it('should search agents by keywords', () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Specialist',
        description: 'Expert in backend development',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build APIs',
            keywords: ['api', 'rest'],
          },
        ],
        specializations: ['Node.js'],
      });

      registry.register(backendAgent);

      const results = registry.searchAgents(['backend', 'api']);

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(backendAgent);
    });
  });

  describe('validate()', () => {
    it('should validate registry has all required agents', () => {
      // Register all required agents
      const requiredTypes = ['backend', 'frontend', 'security', 'quality', 'devops', 'architecture', 'data', 'product'];

      requiredTypes.forEach((type) => {
        const agent = new MockAgent({
          type: type as any,
          name: `${type} Agent`,
          description: `${type} specialist`,
          capabilities: [],
          specializations: [],
        });
        registry.register(agent);
      });

      const result = registry.validate();

      expect(result.valid).toBe(true);
      expect(result.missingAgents).toHaveLength(0);
    });

    it('should report missing agents', () => {
      const result = registry.validate();

      expect(result.valid).toBe(false);
      expect(result.missingAgents.length).toBeGreaterThan(0);
    });
  });
});

describe('AgentRuntime', () => {
  let runtime: AgentRuntime;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();

    // Mock dependencies
    const mockMemoryService = {
      search: vi.fn().mockResolvedValue([]),
      getConversation: vi.fn().mockResolvedValue({}),
      createEntry: vi.fn().mockResolvedValue(undefined),
    } as any;

    const mockFileService = {
      findSymbol: vi.fn().mockResolvedValue([]),
      getCallGraph: vi.fn().mockResolvedValue({}),
      search: vi.fn().mockResolvedValue([]),
      analyzeQuality: vi.fn().mockResolvedValue({}),
    } as any;

    const mockProviders = {
      claude: {
        request: vi.fn().mockResolvedValue({
          content: 'Claude response',
          model: 'claude-3-5-sonnet',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          latency: 100,
          provider: 'claude'
        })
      },
      gemini: {
        request: vi.fn().mockResolvedValue({
          content: 'Gemini response',
          model: 'gemini-pro',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          latency: 100,
          provider: 'gemini'
        })
      },
      openai: {
        request: vi.fn().mockResolvedValue({
          content: 'OpenAI response',
          model: 'gpt-4',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          latency: 100,
          provider: 'openai'
        })
      },
    } as any;

    const mockMonitoring = {
      metrics: { recordMetric: vi.fn() },
      logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
      tracer: {
        startTrace: vi.fn().mockReturnValue('trace-id'),
        startSpan: vi.fn().mockReturnValue('span-id'),
        completeSpan: vi.fn(),
      },
    } as any;

    runtime = new AgentRuntime(
      registry,
      mockMemoryService,
      mockFileService,
      mockProviders,
      mockMonitoring
    );
  });

  describe('executeTask()', () => {
    it('should execute task with selected agent', async () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build APIs',
            keywords: ['api', 'backend'],
          },
        ],
        specializations: ['Node.js'],
      });

      registry.register(backendAgent);

      const task = createMockTask({
        description: 'Create a backend API',
      });

      const result = await runtime.executeTask(task);

      expect(result.success).toBe(true);
      expect(task.status).toBe('completed');
      expect(task.completedAt).toBeDefined();
    });

    it('should fail if no suitable agent found', async () => {
      const task = createMockTask({
        description: 'Do something',
      });

      const result = await runtime.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No suitable agent');
    });

    it('should use assigned agent if specified', async () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [],
        specializations: [],
      });

      registry.register(backendAgent);

      const task = createMockTask({
        description: 'Do something',
        assignedAgent: 'backend',
      });

      const result = await runtime.executeTask(task);

      expect(result.success).toBe(true);
    });

    it('should emit task.completed event', async () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [
          {
            name: 'API Development',
            description: 'Build APIs',
            keywords: ['api', 'backend'],
          },
        ],
        specializations: [],
      });

      registry.register(backendAgent);

      const listener = vi.fn();
      runtime.on('task.completed', listener);

      const task = createMockTask({
        description: 'Create a backend API',
      });

      await runtime.executeTask(task);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getActiveTasks()', () => {
    it('should return active tasks during execution', async () => {
      const slowAgent = new SlowAgent({
        type: 'backend',
        name: 'Slow Agent',
        description: 'Slow agent for testing',
        capabilities: [
          {
            name: 'Test',
            description: 'Test',
            keywords: ['test'],
          },
        ],
        specializations: [],
      });

      registry.register(slowAgent);

      const task = createMockTask({
        description: 'Test task',
      });

      // Start task execution (don't await)
      const promise = runtime.executeTask(task, { timeout: 100 });

      // Check active tasks before completion
      await new Promise((resolve) => setTimeout(resolve, 10));
      const activeTasks = runtime.getActiveTasks();

      expect(activeTasks.length).toBeGreaterThan(0);

      // Wait for completion
      await promise;

      // Check active tasks after completion
      const activeTasksAfter = runtime.getActiveTasks();
      expect(activeTasksAfter).toHaveLength(0);
    });
  });

  describe('cancelTask()', () => {
    it('should cancel running task', async () => {
      const slowAgent = new SlowAgent({
        type: 'backend',
        name: 'Slow Agent',
        description: 'Slow agent for testing',
        capabilities: [
          {
            name: 'Test',
            description: 'Test',
            keywords: ['test'],
          },
        ],
        specializations: [],
      });

      registry.register(slowAgent);

      const task = createMockTask({
        description: 'Test task',
      });

      // Start task execution (don't await)
      runtime.executeTask(task, { timeout: 10000 });

      // Wait a bit for task to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Cancel task
      const cancelled = runtime.cancelTask(task.id);

      expect(cancelled).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return runtime statistics', () => {
      const backendAgent = new MockAgent({
        type: 'backend',
        name: 'Backend Agent',
        description: 'Backend specialist',
        capabilities: [],
        specializations: [],
      });

      registry.register(backendAgent);
      registry.markInitialized();

      const stats = runtime.getStats();

      expect(stats.totalAgents).toBe(1);
      expect(stats.registryInitialized).toBe(true);
      expect(stats.activeTasks).toBe(0);
    });
  });
});
