/**
 * Agent Executor Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor, type ExecuteOptions, type ExecutionResult } from './executor.js';
import type { AgentProfile, ExecutionResponse, Session } from '@ax/schemas';

// Mock implementations
const mockSession: Session = {
  id: 'session-123',
  name: 'Test Session',
  state: 'active',
  agents: ['backend'],
  tasks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
};

const mockTask = {
  id: 'task-123',
  description: 'Test task',
  agentId: 'backend',
  status: 'pending' as const,
};

const mockAgent: AgentProfile = {
  name: 'backend',
  displayName: 'Bob Backend',
  role: 'Backend Developer',
  description: 'Backend expert',
  systemPrompt: 'You are a backend developer.',
  abilities: ['code-generation', 'api-design'],
  personality: {
    traits: ['analytical'],
    communicationStyle: 'technical',
  },
  orchestration: {
    maxDelegationDepth: 2,
    delegationTargets: ['frontend'],
  },
};

const mockFrontendAgent: AgentProfile = {
  name: 'frontend',
  displayName: 'Frank Frontend',
  role: 'Frontend Developer',
  description: 'Frontend expert',
  systemPrompt: 'You are a frontend developer.',
  abilities: ['ui-design', 'react'],
};

const mockResponse: ExecutionResponse = {
  success: true,
  output: 'Task completed successfully',
  provider: 'claude',
  metadata: {
    duration: 1000,
    tokens: 100,
    model: 'claude-3',
  },
};

// Create mock objects
const createMockRouter = () => ({
  route: vi.fn().mockResolvedValue(mockResponse),
});

const createMockSessionManager = () => ({
  create: vi.fn().mockResolvedValue({ ...mockSession }),
  get: vi.fn().mockResolvedValue({ ...mockSession }),
  getOrThrow: vi.fn().mockResolvedValue({ ...mockSession, tasks: [mockTask] }),
  addTask: vi.fn().mockResolvedValue({ ...mockTask }),
  startTask: vi.fn().mockResolvedValue({ ...mockTask, status: 'running' }),
  completeTask: vi.fn().mockResolvedValue({ ...mockTask, status: 'completed', result: 'Done' }),
  failTask: vi.fn().mockResolvedValue({ ...mockTask, status: 'failed', error: 'Error' }),
});

const createMockAgentRegistry = () => ({
  get: vi.fn((id: string) => {
    if (id === 'backend') return mockAgent;
    if (id === 'frontend') return mockFrontendAgent;
    if (id === 'standard') return { ...mockAgent, name: 'standard' };
    return undefined;
  }),
  findForTask: vi.fn().mockReturnValue([mockAgent]),
  getAll: vi.fn().mockReturnValue([mockAgent, mockFrontendAgent]),
});

const createMockMemoryManager = () => ({
  add: vi.fn().mockReturnValue(1),
});

describe('AgentExecutor', () => {
  let executor: AgentExecutor;
  let mockRouter: ReturnType<typeof createMockRouter>;
  let mockSessionManager: ReturnType<typeof createMockSessionManager>;
  let mockAgentRegistry: ReturnType<typeof createMockAgentRegistry>;
  let mockMemoryManager: ReturnType<typeof createMockMemoryManager>;

  beforeEach(() => {
    mockRouter = createMockRouter();
    mockSessionManager = createMockSessionManager();
    mockAgentRegistry = createMockAgentRegistry();
    mockMemoryManager = createMockMemoryManager();

    executor = new AgentExecutor({
      router: mockRouter as any,
      sessionManager: mockSessionManager as any,
      agentRegistry: mockAgentRegistry as any,
      memoryManager: mockMemoryManager as any,
      defaultTimeout: 60000,
    });
  });

  describe('execute()', () => {
    it('should execute task with specified agent', async () => {
      const result = await executor.execute('backend', 'Create an API endpoint');

      expect(result.agentId).toBe('backend');
      expect(result.response.success).toBe(true);
      expect(mockRouter.route).toHaveBeenCalled();
    });

    it('should create session if not provided', async () => {
      await executor.execute('backend', 'Test task');

      expect(mockSessionManager.create).toHaveBeenCalled();
    });

    it('should use existing session if provided', async () => {
      await executor.execute('backend', 'Test task', { sessionId: 'existing-session' });

      expect(mockSessionManager.getOrThrow).toHaveBeenCalledWith('existing-session');
      expect(mockSessionManager.create).not.toHaveBeenCalled();
    });

    it('should fall back to default agent if specified agent not found', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await executor.execute('non-existent', 'Test task');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw if agent not found and no default', async () => {
      mockAgentRegistry.get.mockReturnValue(undefined);

      await expect(executor.execute('non-existent', 'Test task')).rejects.toThrow(/Agent.*not found/);
    });

    it('should add task to session', async () => {
      await executor.execute('backend', 'Test task');

      expect(mockSessionManager.addTask).toHaveBeenCalled();
    });

    it('should start task before execution', async () => {
      await executor.execute('backend', 'Test task');

      expect(mockSessionManager.startTask).toHaveBeenCalled();
    });

    it('should complete task on success', async () => {
      await executor.execute('backend', 'Test task');

      expect(mockSessionManager.completeTask).toHaveBeenCalled();
    });

    it('should fail task on error', async () => {
      mockRouter.route.mockResolvedValue({
        ...mockResponse,
        success: false,
        error: 'Execution failed',
      });

      await executor.execute('backend', 'Test task');

      expect(mockSessionManager.failTask).toHaveBeenCalled();
    });

    it('should save to memory on success', async () => {
      await executor.execute('backend', 'Test task', { saveToMemory: true });

      expect(mockMemoryManager.add).toHaveBeenCalled();
    });

    it('should not save to memory when disabled', async () => {
      await executor.execute('backend', 'Test task', { saveToMemory: false });

      expect(mockMemoryManager.add).not.toHaveBeenCalled();
    });

    it('should include agent context in request', async () => {
      await executor.execute('backend', 'Test task');

      const routeCall = mockRouter.route.mock.calls[0]![0];
      expect(routeCall.context.systemPrompt).toBe('You are a backend developer.');
      expect(routeCall.context.abilities).toContain('code-generation');
    });

    it('should use custom timeout', async () => {
      await executor.execute('backend', 'Test task', { timeout: 30000 });

      const routeCall = mockRouter.route.mock.calls[0]![0];
      expect(routeCall.timeout).toBe(30000);
    });

    it('should track delegation chain', async () => {
      await executor.execute('backend', 'Test task', {
        delegationChain: ['frontend'],
      });

      const routeCall = mockRouter.route.mock.calls[0]![0];
      expect(routeCall.context.delegationChain).toContain('frontend');
    });
  });

  describe('executeAuto()', () => {
    it('should select agent based on task type', async () => {
      await executor.executeAuto('Write some code');

      expect(mockAgentRegistry.findForTask).toHaveBeenCalled();
    });

    it('should fall back to default for no matches', async () => {
      mockAgentRegistry.findForTask.mockReturnValue([]);

      await executor.executeAuto('Unknown task');

      expect(mockAgentRegistry.get).toHaveBeenCalledWith('standard');
    });
  });

  describe('delegate()', () => {
    it('should delegate task to target agent', async () => {
      const result = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI component',
        context: {
          delegationChain: [],
          sharedData: {},
        },
        options: {},
      });

      expect(result.success).toBe(true);
      expect(result.completedBy).toBe('frontend');
    });

    it('should reject if max delegation depth exceeded', async () => {
      const result = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Test task',
        context: {
          delegationChain: ['a', 'b', 'c'], // Already at max depth
          sharedData: {},
        },
        options: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum delegation depth');
    });

    it('should reject if target agent not found', async () => {
      mockAgentRegistry.get.mockImplementation((id: string) => {
        if (id === 'backend') return mockAgent;
        return undefined;
      });

      const result = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'non-existent',
        task: 'Test task',
        context: {
          delegationChain: [],
          sharedData: {},
        },
        options: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target agent not found');
    });

    it('should reject if source agent cannot delegate', async () => {
      mockAgentRegistry.get.mockImplementation((id: string) => {
        if (id === 'backend') return { ...mockAgent, orchestration: { maxDelegationDepth: 0 } };
        if (id === 'frontend') return mockFrontendAgent;
        return undefined;
      });

      const result = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Test task',
        context: {
          delegationChain: [],
          sharedData: {},
        },
        options: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed to delegate');
    });

    it('should pass shared data in context', async () => {
      await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Test task',
        context: {
          delegationChain: [],
          sharedData: { key: 'value' },
        },
        options: {},
      });

      // The delegate method calls execute internally
      expect(mockRouter.route).toHaveBeenCalled();
    });

    it('should track delegation duration', async () => {
      const result = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Test task',
        context: {
          delegationChain: [],
          sharedData: {},
        },
        options: {},
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('events', () => {
    it('should emit onExecutionStart', async () => {
      let emitted = false;
      executor.setEvents({
        onExecutionStart: () => { emitted = true; },
      });

      await executor.execute('backend', 'Test task');

      expect(emitted).toBe(true);
    });

    it('should emit onExecutionEnd', async () => {
      let result: ExecutionResult | null = null;
      executor.setEvents({
        onExecutionEnd: (r) => { result = r; },
      });

      await executor.execute('backend', 'Test task');

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe('backend');
    });

    it('should emit onDelegation', async () => {
      let delegationInfo: { from: string; to: string } | null = null;
      executor.setEvents({
        onDelegation: (from, to) => { delegationInfo = { from, to }; },
      });

      await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Test task',
        context: {
          delegationChain: [],
          sharedData: {},
        },
        options: {},
      });

      expect(delegationInfo).not.toBeNull();
      expect(delegationInfo!.from).toBe('backend');
      expect(delegationInfo!.to).toBe('frontend');
    });

    it('should emit onError', async () => {
      mockRouter.route.mockRejectedValue(new Error('Execution error'));

      let errorInfo: { agentId: string; error: Error } | null = null;
      executor.setEvents({
        onError: (agentId, error) => { errorInfo = { agentId, error }; },
      });

      await expect(executor.execute('backend', 'Test task')).rejects.toThrow();

      expect(errorInfo).not.toBeNull();
      expect(errorInfo!.agentId).toBe('backend');
    });
  });
});
