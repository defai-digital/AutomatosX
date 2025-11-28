/**
 * Multi-Agent Workflow Integration Tests
 *
 * Tests complex multi-agent scenarios including:
 * - Agent delegation chains
 * - Session sharing between agents
 * - Memory persistence across agent executions
 * - Concurrent agent execution
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { AgentExecutor, type ExecuteOptions } from '../../agent/executor.js';
import { AgentRegistry } from '../../agent/registry.js';
import { AgentLoader } from '../../agent/loader.js';
import { SessionManager } from '../../session/manager.js';
import { MemoryManager } from '../../memory/manager.js';
import type { AgentProfile, ExecutionResponse } from '@ax/schemas';

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestAgents = (): AgentProfile[] => [
  {
    name: 'product',
    displayName: 'Paris Product',
    role: 'Product Manager',
    description: 'Product strategy and requirements',
    systemPrompt: 'You are a product manager. Define requirements and coordinate features.',
    abilities: ['requirements', 'roadmap', 'prioritization'],
    personality: {
      traits: ['strategic', 'collaborative'],
      communicationStyle: 'business',
    },
    orchestration: {
      maxDelegationDepth: 2,
      delegationTargets: ['backend', 'frontend', 'design'],
    },
  },
  {
    name: 'backend',
    displayName: 'Bob Backend',
    role: 'Backend Developer',
    description: 'Backend API and database development',
    systemPrompt: 'You are a backend developer specializing in APIs and databases.',
    abilities: ['code-generation', 'api-design', 'database'],
    personality: {
      traits: ['analytical', 'systematic'],
      communicationStyle: 'technical',
    },
    orchestration: {
      maxDelegationDepth: 1,
      delegationTargets: ['security'],
    },
  },
  {
    name: 'frontend',
    displayName: 'Frank Frontend',
    role: 'Frontend Developer',
    description: 'UI/UX implementation',
    systemPrompt: 'You are a frontend developer specializing in React and UI.',
    abilities: ['ui-design', 'react', 'css'],
    personality: {
      traits: ['creative', 'detail-oriented'],
      communicationStyle: 'visual',
    },
    orchestration: {
      maxDelegationDepth: 1,
      delegationTargets: ['design'],
    },
  },
  {
    name: 'security',
    displayName: 'Steve Security',
    role: 'Security Engineer',
    description: 'Security auditing and threat modeling',
    systemPrompt: 'You are a security engineer. Review code for vulnerabilities.',
    abilities: ['security-audit', 'threat-modeling', 'penetration-testing'],
    personality: {
      traits: ['cautious', 'thorough'],
      communicationStyle: 'formal',
    },
    orchestration: {
      maxDelegationDepth: 0, // Cannot delegate
    },
  },
  {
    name: 'design',
    displayName: 'Debbee Design',
    role: 'UX Designer',
    description: 'User experience design',
    systemPrompt: 'You are a UX designer. Create intuitive user experiences.',
    abilities: ['ux-design', 'wireframing', 'prototyping'],
    personality: {
      traits: ['creative', 'empathetic'],
      communicationStyle: 'visual',
    },
    orchestration: {
      maxDelegationDepth: 0,
    },
  },
  {
    name: 'standard',
    displayName: 'Stan Standard',
    role: 'General Assistant',
    description: 'Default agent for general tasks',
    systemPrompt: 'You are a helpful assistant.',
    abilities: ['general'],
    orchestration: {
      maxDelegationDepth: 1,
    },
  },
];

// =============================================================================
// Mock Router
// =============================================================================

const createMockRouter = () => {
  const executionHistory: Array<{ agent: string; task: string }> = [];

  return {
    route: vi.fn(async (request: any): Promise<ExecutionResponse> => {
      executionHistory.push({
        agent: request.agent,
        task: request.task.substring(0, 100),
      });

      // Simulate different responses based on agent
      const agentResponses: Record<string, string> = {
        product: 'Requirements: User authentication with OAuth2, JWT tokens, role-based access',
        backend: 'API Implementation: POST /auth/login, GET /auth/me, POST /auth/refresh',
        frontend: 'UI Components: LoginForm, AuthProvider, ProtectedRoute',
        security: 'Security Review: Passed. Recommendations: Add rate limiting, use bcrypt',
        design: 'Design Spec: Login page wireframe with email/password fields',
        standard: 'Task completed successfully',
      };

      return {
        success: true,
        output: agentResponses[request.agent] ?? 'Task completed',
        provider: 'mock',
        metadata: {
          duration: 100 + Math.random() * 200,
          tokens: 50 + Math.floor(Math.random() * 100),
          model: 'mock-model',
        },
      };
    }),
    getExecutionHistory: () => executionHistory,
    clearHistory: () => { executionHistory.length = 0; },
  };
};

// =============================================================================
// Test Suite
// =============================================================================

describe('Multi-Agent Workflow Integration', () => {
  let executor: AgentExecutor;
  let registry: AgentRegistry;
  let sessionManager: SessionManager;
  let memoryManager: MemoryManager;
  let mockRouter: ReturnType<typeof createMockRouter>;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for session storage
    tempDir = await mkdtemp(join(tmpdir(), 'ax-test-'));

    // Initialize components
    mockRouter = createMockRouter();

    // Create loader and registry
    const loader = new AgentLoader({ basePath: tempDir });
    registry = new AgentRegistry({ loader });
    createTestAgents().forEach(agent => registry.registerAgent(agent));

    sessionManager = new SessionManager({ storagePath: tempDir });
    await sessionManager.initialize();

    memoryManager = new MemoryManager({
      dbPath: ':memory:',
      maxEntries: 1000,
    });
    await memoryManager.initialize();

    executor = new AgentExecutor({
      router: mockRouter as any,
      sessionManager,
      agentRegistry: registry,
      memoryManager,
      defaultTimeout: 30000,
    });
  });

  afterEach(async () => {
    await memoryManager.close();
    await sessionManager.cleanup();
    mockRouter.clearHistory();
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Basic Execution Tests
  // ===========================================================================

  describe('basic execution', () => {
    it('should execute task with single agent', async () => {
      const result = await executor.execute('backend', 'Create a REST API');

      expect(result.response.success).toBe(true);
      expect(result.agentId).toBe('backend');
      expect(result.session).toBeDefined();
      expect(result.task).toBeDefined();
    });

    it('should create session automatically', async () => {
      const result = await executor.execute('backend', 'Create a REST API');

      expect(result.session.id).toBeDefined();
      expect(result.session.agents).toContain('backend');
    });

    it('should save execution to memory', async () => {
      await executor.execute('backend', 'Create a REST API', { saveToMemory: true });

      const result = memoryManager.search({ query: 'REST API' });
      expect(result.entries.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Delegation Tests
  // ===========================================================================

  describe('agent delegation', () => {
    it('should delegate task from one agent to another', async () => {
      const result = await executor.delegate({
        fromAgent: 'product',
        toAgent: 'backend',
        task: 'Implement user authentication API',
        context: {
          delegationChain: [],
          sharedData: { priority: 'high' },
        },
        options: { timeout: 30000 },
      });

      expect(result.success).toBe(true);
      expect(result.completedBy).toBe('backend');
      expect(result.result).toContain('API');
    });

    it('should track delegation chain', async () => {
      // Product -> Backend
      const result1 = await executor.delegate({
        fromAgent: 'product',
        toAgent: 'backend',
        task: 'Create auth API',
        context: {
          delegationChain: [],
          sharedData: {},
        },
        options: {},
      });

      expect(result1.success).toBe(true);

      // Backend -> Security (from backend's execution)
      const result2 = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'security',
        task: 'Review auth API security',
        context: {
          delegationChain: ['product'], // Previous delegation
          sharedData: {},
        },
        options: {},
      });

      expect(result2.success).toBe(true);
      expect(result2.completedBy).toBe('security');
    });

    it('should enforce max delegation depth', async () => {
      const result = await executor.delegate({
        fromAgent: 'product',
        toAgent: 'backend',
        task: 'Test task',
        context: {
          delegationChain: ['agent1', 'agent2', 'agent3'], // Already at max
          sharedData: {},
        },
        options: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum delegation depth');
    });

    it('should prevent delegation when agent cannot delegate', async () => {
      const result = await executor.delegate({
        fromAgent: 'security',
        toAgent: 'backend',
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

    it('should pass shared data through delegation', async () => {
      await executor.delegate({
        fromAgent: 'product',
        toAgent: 'backend',
        task: 'Create API',
        context: {
          delegationChain: [],
          sharedData: { requirements: 'OAuth2', deadline: '2024-12-01' },
        },
        options: {},
      });

      const routeCall = mockRouter.route.mock.calls[0]![0];
      expect(routeCall.context.requirements).toBe('OAuth2');
      expect(routeCall.context.deadline).toBe('2024-12-01');
    });
  });

  // ===========================================================================
  // Session Management Tests
  // ===========================================================================

  describe('session management', () => {
    it('should share session across multiple agent executions', async () => {
      // First execution creates session
      const result1 = await executor.execute('product', 'Define authentication requirements');
      const sessionId = result1.session.id;

      // Second execution uses same session
      const result2 = await executor.execute('backend', 'Implement auth API', {
        sessionId,
      });

      expect(result2.session.id).toBe(sessionId);
      expect(result2.session.agents).toContain('product');
      expect(result2.session.agents).toContain('backend');
    });

    it('should track all tasks in session', async () => {
      const result1 = await executor.execute('product', 'Task 1');
      const sessionId = result1.session.id;

      await executor.execute('backend', 'Task 2', { sessionId });
      await executor.execute('frontend', 'Task 3', { sessionId });

      const session = await sessionManager.get(sessionId);
      expect(session?.tasks.length).toBe(3);
    });

    it('should handle concurrent executions in same session', async () => {
      const result1 = await executor.execute('product', 'Initial task');
      const sessionId = result1.session.id;

      // Execute multiple tasks concurrently
      const results = await Promise.all([
        executor.execute('backend', 'Backend task', { sessionId }),
        executor.execute('frontend', 'Frontend task', { sessionId }),
        executor.execute('design', 'Design task', { sessionId }),
      ]);

      // All should succeed
      results.forEach(result => {
        expect(result.response.success).toBe(true);
        expect(result.session.id).toBe(sessionId);
      });

      // Session should have all tasks
      const session = await sessionManager.get(sessionId);
      expect(session?.tasks.length).toBe(4); // 1 initial + 3 concurrent
    });
  });

  // ===========================================================================
  // Memory Integration Tests
  // ===========================================================================

  describe('memory integration', () => {
    it('should persist execution results to memory', async () => {
      await executor.execute('backend', 'Create user authentication API', {
        saveToMemory: true,
      });

      const results = memoryManager.search({ query: 'authentication' });
      expect(results.entries.length).toBeGreaterThan(0);
      expect(results.entries[0]!.content).toContain('authentication');
    });

    it('should tag memories with agent and session info', async () => {
      const result = await executor.execute('backend', 'Create API', {
        saveToMemory: true,
      });

      const memories = memoryManager.search({ query: 'API' });
      expect(memories.entries.length).toBeGreaterThan(0);

      const memory = memories.entries[0]!;
      expect(memory.metadata.agentId).toBe('backend');
      expect(memory.metadata.sessionId).toBe(result.session.id);
    });

    it('should accumulate memories across workflow', async () => {
      const result1 = await executor.execute('product', 'Define requirements', {
        saveToMemory: true,
      });
      const sessionId = result1.session.id;

      await executor.execute('backend', 'Implement backend', {
        sessionId,
        saveToMemory: true,
      });

      await executor.execute('frontend', 'Implement frontend', {
        sessionId,
        saveToMemory: true,
      });

      // Search for each task type individually and verify all are saved
      const reqMemories = memoryManager.search({ query: 'requirements' });
      const backendMemories = memoryManager.search({ query: 'backend' });
      const frontendMemories = memoryManager.search({ query: 'frontend' });

      // Each execution should have saved to memory
      expect(reqMemories.entries.length).toBeGreaterThanOrEqual(1);
      expect(backendMemories.entries.length).toBeGreaterThanOrEqual(1);
      expect(frontendMemories.entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Auto-Selection Tests
  // ===========================================================================

  describe('automatic agent selection', () => {
    it('should select appropriate agent for coding tasks', async () => {
      const result = await executor.executeAuto('Write code to implement user login');

      // Should find a coding-capable agent
      expect(['backend', 'frontend', 'standard']).toContain(result.agentId);
    });

    it('should select appropriate agent for design tasks', async () => {
      registry.findForTask = vi.fn().mockReturnValue([
        createTestAgents().find(a => a.name === 'design')!,
      ]);

      const result = await executor.executeAuto('Design the user interface');
      expect(result.response.success).toBe(true);
    });

    it('should fall back to standard agent when no match', async () => {
      registry.findForTask = vi.fn().mockReturnValue([]);

      const result = await executor.executeAuto('Unknown task type xyz');
      expect(result.agentId).toBe('standard');
    });
  });

  // ===========================================================================
  // Event System Tests
  // ===========================================================================

  describe('event system', () => {
    it('should emit events throughout workflow', async () => {
      const events: string[] = [];

      executor.setEvents({
        onExecutionStart: (agentId) => events.push(`start:${agentId}`),
        onExecutionEnd: (result) => events.push(`end:${result.agentId}`),
        onDelegation: (from, to) => events.push(`delegate:${from}->${to}`),
        onError: (agentId) => events.push(`error:${agentId}`),
      });

      await executor.execute('backend', 'Test task');

      expect(events).toContain('start:backend');
      expect(events).toContain('end:backend');
    });

    it('should emit delegation events', async () => {
      const delegations: Array<{ from: string; to: string }> = [];

      executor.setEvents({
        onDelegation: (from, to) => delegations.push({ from, to }),
      });

      await executor.delegate({
        fromAgent: 'product',
        toAgent: 'backend',
        task: 'Test',
        context: { delegationChain: [], sharedData: {} },
        options: {},
      });

      expect(delegations).toContainEqual({ from: 'product', to: 'backend' });
    });

    it('should emit error events on failure', async () => {
      mockRouter.route.mockRejectedValueOnce(new Error('Execution failed'));

      const errors: string[] = [];
      executor.setEvents({
        onError: (agentId) => errors.push(agentId),
      });

      await expect(executor.execute('backend', 'Test')).rejects.toThrow();
      expect(errors).toContain('backend');
    });
  });

  // ===========================================================================
  // Complex Workflow Tests
  // ===========================================================================

  describe('complex workflows', () => {
    it('should handle full feature development workflow', async () => {
      // Step 1: Product defines requirements
      const step1 = await executor.execute(
        'product',
        'Define requirements for user authentication feature',
        { saveToMemory: true }
      );
      const sessionId = step1.session.id;

      // Step 2: Design creates UX
      const step2 = await executor.execute(
        'design',
        'Create login page wireframes',
        { sessionId, saveToMemory: true }
      );

      // Step 3: Backend implements API
      const step3 = await executor.execute(
        'backend',
        'Implement authentication API',
        { sessionId, saveToMemory: true }
      );

      // Step 4: Frontend implements UI
      const step4 = await executor.execute(
        'frontend',
        'Implement login UI components',
        { sessionId, saveToMemory: true }
      );

      // Step 5: Security reviews
      const step5 = await executor.execute(
        'security',
        'Review authentication implementation',
        { sessionId, saveToMemory: true }
      );

      // Verify all steps completed
      [step1, step2, step3, step4, step5].forEach(step => {
        expect(step.response.success).toBe(true);
      });

      // Verify session contains all tasks
      const finalSession = await sessionManager.get(sessionId);
      expect(finalSession?.tasks.length).toBe(5);

      // Verify execution history
      const history = mockRouter.getExecutionHistory();
      expect(history.length).toBe(5);
      expect(history.map(h => h.agent)).toEqual([
        'product', 'design', 'backend', 'frontend', 'security'
      ]);
    });

    it('should handle delegation chain workflow', async () => {
      // Product delegates to backend, which could delegate to security
      const result = await executor.delegate({
        fromAgent: 'product',
        toAgent: 'backend',
        task: 'Implement and secure the payment API',
        context: {
          delegationChain: [],
          sharedData: { feature: 'payments' },
        },
        options: {},
      });

      expect(result.success).toBe(true);

      // Backend can then delegate to security
      const securityResult = await executor.delegate({
        fromAgent: 'backend',
        toAgent: 'security',
        task: 'Security review of payment API',
        context: {
          delegationChain: ['product'],
          sharedData: { feature: 'payments' },
        },
        options: {},
      });

      expect(securityResult.success).toBe(true);
      expect(securityResult.completedBy).toBe('security');
    });

    it('should handle parallel agent execution', async () => {
      const startTime = Date.now();

      // Execute multiple independent tasks in parallel
      const results = await Promise.all([
        executor.execute('backend', 'Create user service'),
        executor.execute('backend', 'Create auth service'),
        executor.execute('backend', 'Create notification service'),
      ]);

      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach(r => expect(r.response.success).toBe(true));

      // Parallel execution should be faster than sequential
      // (In real scenario with actual providers, this would be more apparent)
      expect(duration).toBeLessThan(5000);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should handle provider failures gracefully', async () => {
      mockRouter.route.mockRejectedValueOnce(new Error('Provider unavailable'));

      await expect(executor.execute('backend', 'Test')).rejects.toThrow('Provider unavailable');

      // Session task should be marked as failed
      const history = mockRouter.getExecutionHistory();
      expect(history.length).toBe(0); // Router threw before recording
    });

    it('should handle missing agent gracefully', async () => {
      // When agent is not found, executor falls back to 'standard' agent if it exists
      // Since we have a 'standard' agent registered, it should use that
      const result = await executor.execute('non-existent-agent', 'Test task');
      expect(result.agentId).toBe('standard');
      expect(result.response.success).toBe(true);
    });

    it('should handle delegation to missing agent', async () => {
      const result = await executor.delegate({
        fromAgent: 'product',
        toAgent: 'non-existent',
        task: 'Test',
        context: { delegationChain: [], sharedData: {} },
        options: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target agent not found');
    });

    it('should handle timeout gracefully', async () => {
      mockRouter.route.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: false,
          output: '',
          error: 'Timeout exceeded',
          provider: 'mock',
          metadata: { duration: 100, tokens: 0, model: 'mock' },
        };
      });

      const result = await executor.execute('backend', 'Long task', {
        timeout: 50,
      });

      expect(result.response.success).toBe(false);
    });
  });
});
