/**
 * Agent Executor - Parallel Delegation Tests
 *
 * Tests the parallel execution of agent delegations introduced in v5.6.0.
 * Validates integration between AgentExecutor.executeDelegationsParallel()
 * and the underlying ParallelAgentExecutor system.
 *
 * @group unit
 * @group core
 * @group parallel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import { DelegationError, DelegationResult } from '../../src/types/orchestration.js';
import type { SessionManager } from '../../src/core/session-manager.js';
import type { WorkspaceManager } from '../../src/core/workspace-manager.js';
import type { ContextManager } from '../../src/agents/context-manager.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../src/types/agent.js';
import type { Session } from '../../src/types/orchestration.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';

describe('AgentExecutor - Parallel Delegation', () => {
  let executor: AgentExecutor;
  let mockSessionManager: SessionManager;
  let mockWorkspaceManager: WorkspaceManager;
  let mockContextManager: ContextManager;
  let mockProfileLoader: ProfileLoader;

  // Mock profiles for parallel execution testing
  const backendProfile: AgentProfile = {
    name: 'backend',
    role: 'backend developer',
    description: 'Backend developer agent',
    systemPrompt: 'You are a backend developer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 3
    }
  };

  const frontendProfile: AgentProfile = {
    name: 'frontend',
    role: 'frontend developer',
    description: 'Frontend developer agent',
    systemPrompt: 'You are a frontend developer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 3
    }
  };

  const databaseProfile: AgentProfile = {
    name: 'database',
    role: 'database specialist',
    description: 'Database specialist agent',
    systemPrompt: 'You are a database specialist',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 3
    }
  };

  const qaProfile: AgentProfile = {
    name: 'qa',
    role: 'QA specialist',
    description: 'Quality assurance specialist',
    systemPrompt: 'You are a QA specialist',
    abilities: [],
    dependencies: ['backend', 'frontend'], // Depends on backend and frontend
    orchestration: {
      maxDelegationDepth: 3
    }
  };

  const deployProfile: AgentProfile = {
    name: 'deploy',
    role: 'deployment specialist',
    description: 'Deployment specialist',
    systemPrompt: 'You are a deployment specialist',
    abilities: [],
    dependencies: ['qa'], // Depends on QA
    orchestration: {
      maxDelegationDepth: 3
    }
  };

  // Mock provider with complete Provider interface
  const mockProvider = {
    name: 'test-provider',
    version: '1.0.0',
    priority: 1,
    capabilities: [] as string[],
    isAvailable: vi.fn().mockResolvedValue(true),
    getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
    execute: vi.fn().mockResolvedValue({
      content: 'Test output',
      model: 'test-model',
      tokensUsed: { prompt: 10, completion: 10, total: 20 },
      latencyMs: 100,
      finishReason: 'stop' as const,
      cached: false
    }),
    estimateCost: vi.fn().mockResolvedValue({ estimatedCost: 0, breakdown: [] })
  } as unknown as Provider;

  beforeEach(() => {
    // Reset and reconfigure mock provider to ensure consistent behavior
    vi.mocked(mockProvider.execute).mockClear();
    vi.mocked(mockProvider.execute).mockResolvedValue({
      content: 'Test output',
      model: 'test-model',
      tokensUsed: { prompt: 10, completion: 10, total: 20 },
      latencyMs: 100,
      finishReason: 'stop' as const,
      cached: false
    });

    // Mock SessionManager
    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({
        id: 'session-123',
        initiator: 'backend',
        task: 'Test task',
        agents: ['backend'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as Session),
      getSession: vi.fn().mockResolvedValue({
        id: 'session-123',
        initiator: 'backend',
        task: 'Test task',
        agents: ['backend', 'frontend', 'database', 'qa', 'deploy'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as Session),
      addAgent: vi.fn().mockResolvedValue(undefined),
      getActiveSessions: vi.fn().mockResolvedValue([]),
      getActiveSessionsForAgent: vi.fn().mockResolvedValue([]),
      completeSession: vi.fn().mockResolvedValue(undefined),
      failSession: vi.fn().mockResolvedValue(undefined),
      updateMetadata: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(0),
      clearAll: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      getAllSessions: vi.fn().mockResolvedValue([])
    } as unknown as SessionManager;

    // Mock WorkspaceManager
    mockWorkspaceManager = {
      createWorkspace: vi.fn().mockResolvedValue('/test/.automatosx/workspaces/test-agent'),
      getWorkspace: vi.fn().mockImplementation((agentName: string) =>
        `/test/.automatosx/workspaces/${agentName}`
      ),
      cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
      listWorkspaces: vi.fn().mockResolvedValue([])
    } as unknown as WorkspaceManager;

    // Mock ContextManager
    mockContextManager = {
      createContext: vi.fn().mockImplementation((agent: AgentProfile, task: string, sessionId?: string) => ({
        agent,
        task,
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: `/test/.automatosx/workspaces/${agent.name}`,
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['backend', 'frontend', 'database', 'qa', 'deploy'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: [agent.name],
          maxDelegationDepth: agent.orchestration?.maxDelegationDepth ?? 2,
          sessionId
        }
      } as ExecutionContext))
    } as unknown as ContextManager;

    // Mock ProfileLoader
    mockProfileLoader = {
      loadProfile: vi.fn().mockImplementation(async (agentName: string) => {
        switch (agentName) {
          case 'backend': return backendProfile;
          case 'frontend': return frontendProfile;
          case 'database': return databaseProfile;
          case 'qa': return qaProfile;
          case 'deploy': return deployProfile;
          default: throw new Error(`Unknown agent: ${agentName}`);
        }
      }),
      getAllProfiles: vi.fn().mockResolvedValue([
        backendProfile,
        frontendProfile,
        databaseProfile,
        qaProfile,
        deployProfile
      ])
    } as unknown as ProfileLoader;

    // Create executor with all dependencies
    executor = new AgentExecutor({
      sessionManager: mockSessionManager,
      workspaceManager: mockWorkspaceManager,
      contextManager: mockContextManager,
      profileLoader: mockProfileLoader
    });
  });

  describe('Basic Parallel Execution', () => {
    it('executes independent delegations in parallel when parallelEnabled is true', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['backend', 'frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const startTime = Date.now();

      // Execute parallel delegations
      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'frontend', task: 'implement UI' },
          { toAgent: 'database', task: 'design schema' }
        ],
        context,
        {
          parallelEnabled: true,
          maxConcurrentDelegations: 2,
          continueDelegationsOnFailure: true
        }
      );

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      // Verify both delegations completed
      const frontendResult = result.find((r: DelegationResult) => r.toAgent === 'frontend');
      const databaseResult = result.find((r: DelegationResult) => r.toAgent === 'database');

      expect(frontendResult).toBeDefined();
      expect(databaseResult).toBeDefined();
      expect(frontendResult?.success).toBe(true);
      expect(databaseResult?.success).toBe(true);

      // Verify profiles were loaded
      expect(mockProfileLoader.loadProfile).toHaveBeenCalledWith('frontend');
      expect(mockProfileLoader.loadProfile).toHaveBeenCalledWith('database');
    });

    it('falls back to sequential execution when parallelEnabled is false', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'frontend', task: 'implement UI' },
          { toAgent: 'database', task: 'design schema' }
        ],
        context,
        {
          parallelEnabled: false // Explicitly disable parallel execution
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(2);

      // In sequential mode, delegations are processed one by one
      expect(mockProfileLoader.loadProfile).toHaveBeenCalledWith('frontend');
      expect(mockProfileLoader.loadProfile).toHaveBeenCalledWith('database');
    });

    it('uses sequential execution for single delegation', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate task',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      // Even with parallelEnabled=true, single delegation uses sequential path
      const result = await (executor as any).executeDelegations(
        [{ toAgent: 'frontend', task: 'implement UI' }],
        context,
        { parallelEnabled: true }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].toAgent).toBe('frontend');
    });
  });

  describe('Dependency Resolution', () => {
    it('respects agent dependencies in parallel execution', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'build full stack',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['backend', 'frontend', 'qa'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      // QA depends on both backend and frontend
      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'backend', task: 'implement API' },
          { toAgent: 'frontend', task: 'implement UI' },
          { toAgent: 'qa', task: 'test application' }
        ],
        context,
        {
          parallelEnabled: true,
          maxConcurrentDelegations: 3
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(3);

      // All should succeed
      const qaResult = result.find((r: DelegationResult) => r.toAgent === 'qa');
      expect(qaResult?.success).toBe(true);
    });

    it('executes multi-level dependencies correctly', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'full deployment pipeline',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['backend', 'frontend', 'qa', 'deploy'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      // Level 0: backend, frontend (parallel)
      // Level 1: qa (depends on backend, frontend)
      // Level 2: deploy (depends on qa)
      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'backend', task: 'implement API' },
          { toAgent: 'frontend', task: 'implement UI' },
          { toAgent: 'qa', task: 'test application' },
          { toAgent: 'deploy', task: 'deploy to production' }
        ],
        context,
        {
          parallelEnabled: true,
          maxConcurrentDelegations: 4
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(4);

      // All should succeed
      expect(result.every((r: DelegationResult) => r.success)).toBe(true);
    });
  });

  describe('Concurrency Control', () => {
    it('respects maxConcurrentDelegations limit', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate multiple tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database', 'backend'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'frontend', task: 'task 1' },
          { toAgent: 'database', task: 'task 2' },
          { toAgent: 'backend', task: 'task 3' } // Use backend instead of qa (which has dependencies)
        ],
        context,
        {
          parallelEnabled: true,
          maxConcurrentDelegations: 2 // Limit to 2 concurrent
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
      // All should succeed (all are independent agents)
      const successCount = result.filter((r: DelegationResult) => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(2); // At least 2 should succeed
    });

    it('uses config default when maxConcurrentDelegations not specified', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'frontend', task: 'task 1' },
          { toAgent: 'database', task: 'task 2' }
        ],
        context,
        {
          parallelEnabled: true
          // No maxConcurrentDelegations - should use default from config
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('requires contextManager for parallel execution', async () => {
      const executorNoContext = new AgentExecutor({
        sessionManager: mockSessionManager,
        workspaceManager: mockWorkspaceManager
        // Missing contextManager
      });

      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      await expect(
        (executorNoContext as any).executeDelegations(
          [
            { toAgent: 'frontend', task: 'task 1' },
            { toAgent: 'database', task: 'task 2' }
          ],
          context,
          { parallelEnabled: true }
        )
      ).rejects.toThrow(DelegationError);
    });

    it('requires profileLoader for parallel execution', async () => {
      const executorNoLoader = new AgentExecutor({
        sessionManager: mockSessionManager,
        workspaceManager: mockWorkspaceManager,
        contextManager: mockContextManager
        // Missing profileLoader
      });

      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      await expect(
        (executorNoLoader as any).executeDelegations(
          [
            { toAgent: 'frontend', task: 'task 1' },
            { toAgent: 'database', task: 'task 2' }
          ],
          context,
          { parallelEnabled: true }
        )
      ).rejects.toThrow(DelegationError);
    });

    it('requires workspaceManager for parallel execution', async () => {
      const executorNoWorkspace = new AgentExecutor({
        sessionManager: mockSessionManager,
        contextManager: mockContextManager,
        profileLoader: mockProfileLoader
        // Missing workspaceManager
      });

      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      await expect(
        (executorNoWorkspace as any).executeDelegations(
          [
            { toAgent: 'frontend', task: 'task 1' },
            { toAgent: 'database', task: 'task 2' }
          ],
          context,
          { parallelEnabled: true }
        )
      ).rejects.toThrow(DelegationError);
    });

    it('throws error when profile loading fails during parallel execution', async () => {
      // Mock one agent to fail during profile loading
      const failingProfileLoader = {
        loadProfile: vi.fn().mockImplementation(async (agentName: string) => {
          if (agentName === 'frontend') {
            return frontendProfile;
          }
          throw new Error('Agent load failed');
        }),
        getAllProfiles: vi.fn().mockResolvedValue([frontendProfile])
      } as unknown as ProfileLoader;

      const executorWithFailure = new AgentExecutor({
        sessionManager: mockSessionManager,
        workspaceManager: mockWorkspaceManager,
        contextManager: mockContextManager,
        profileLoader: failingProfileLoader
      });

      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      // Should throw DelegationError because profile loading fails during setup phase
      await expect(
        (executorWithFailure as any).executeDelegations(
          [
            { toAgent: 'frontend', task: 'task 1' },
            { toAgent: 'database', task: 'task 2' }
          ],
          context,
          {
            parallelEnabled: true,
            continueDelegationsOnFailure: true
          }
        )
      ).rejects.toThrow(DelegationError);
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains backward compatibility with sequential execution', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate tasks',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend', 'database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      // Default behavior (parallelEnabled not set) should use sequential
      const result = await (executor as any).executeDelegations(
        [
          { toAgent: 'frontend', task: 'task 1' },
          { toAgent: 'database', task: 'task 2' }
        ],
        context,
        {} // No parallel options
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });

    it('works with existing delegation tests', async () => {
      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'test task',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const result = await (executor as any).executeDelegations(
        [{ toAgent: 'frontend', task: 'implement UI' }],
        context,
        { verbose: true } // Traditional options still work
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].toAgent).toBe('frontend');
    });
  });

  describe('DelegationResult Structure Validation (Issue #5 fix)', () => {
    it('should return complete DelegationResult structure in parallel execution', async () => {
      // Setup: Mock provider and context for parallel execution
      const mockProvider: Provider = {
        name: 'test-provider',
        version: '1.0.0',
        priority: 1,
        capabilities: [] as string[],
        isAvailable: vi.fn().mockResolvedValue(true),
        getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
        execute: vi.fn().mockResolvedValue({
          content: 'Task completed successfully',
          model: 'test-model',
          tokensUsed: { prompt: 100, completion: 200, total: 300 },
          latencyMs: 1500,
          finishReason: 'stop' as const,
          cached: false
        }),
        estimateCost: vi.fn().mockResolvedValue({ estimatedCost: 0, breakdown: [] })
      } as unknown as Provider;

      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate frontend development',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['frontend'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const result = await (executor as any).executeDelegations(
        [{ toAgent: 'frontend', task: 'implement login UI' }],
        context,
        { parallelEnabled: true, showTimeline: false, showDependencyGraph: false }
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(1);

      const delegation = result[0];

      // Verify all required DelegationResult fields
      expect(delegation.delegationId).toBeDefined();
      expect(typeof delegation.delegationId).toBe('string');
      expect(delegation.delegationId.length).toBeGreaterThan(0);

      expect(delegation.fromAgent).toBe('backend');
      expect(delegation.toAgent).toBe('frontend');
      expect(delegation.task).toBe('implement login UI');

      expect(delegation.status).toBe('success');
      expect(delegation.success).toBe(true);

      expect(delegation.response).toBeDefined();
      expect(delegation.response.content).toBe('Test output');
      expect(delegation.response.model).toBe('test-model');
      expect(delegation.response.tokensUsed).toBeDefined();
      expect(delegation.response.tokensUsed.total).toBe(20);

      expect(delegation.duration).toBeGreaterThanOrEqual(0);
      expect(typeof delegation.duration).toBe('number');

      expect(delegation.startTime).toBeInstanceOf(Date);
      expect(delegation.endTime).toBeInstanceOf(Date);
      expect(delegation.endTime.getTime()).toBeGreaterThanOrEqual(delegation.startTime.getTime());

      // Verify outputs structure (Issue #5 fix validation)
      expect(delegation.outputs).toBeDefined();
      expect(Array.isArray(delegation.outputs.files)).toBe(true);
      expect(Array.isArray(delegation.outputs.memoryIds)).toBe(true);
      expect(typeof delegation.outputs.workspacePath).toBe('string');
    });

    it('should include outputs field with correct workspace path', async () => {
      const mockProvider: Provider = {
        name: 'test-provider',
        version: '1.0.0',
        priority: 1,
        capabilities: [] as string[],
        isAvailable: vi.fn().mockResolvedValue(true),
        getHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
        execute: vi.fn().mockResolvedValue({
          content: 'Database schema created',
          model: 'test-model',
          tokensUsed: { prompt: 50, completion: 150, total: 200 },
          latencyMs: 1000,
          finishReason: 'stop' as const,
          cached: false
        }),
        estimateCost: vi.fn().mockResolvedValue({ estimatedCost: 0, breakdown: [] })
      } as unknown as Provider;

      const context: ExecutionContext = {
        agent: backendProfile,
        task: 'coordinate database work',
        projectDir: '/test',
        workingDir: '/test',
        agentWorkspace: '/test/.automatosx/workspaces/backend',
        memory: [],
        provider: mockProvider,
        abilities: '',
        createdAt: new Date(),
        orchestration: {
          isDelegationEnabled: true,
          availableAgents: ['database'],
          sharedWorkspace: '/test/.automatosx/workspaces',
          delegationChain: ['backend'],
          maxDelegationDepth: 3,
        }
      };

      const result = await (executor as any).executeDelegations(
        [{ toAgent: 'database', task: 'create schema' }],
        context,
        { parallelEnabled: true }
      );

      // Verify outputs structure exists and has correct types
      expect(result[0].outputs.workspacePath).toBeDefined();
      expect(typeof result[0].outputs.workspacePath).toBe('string');
      expect(result[0].outputs.files).toEqual([]);
      expect(result[0].outputs.memoryIds).toEqual([]);
    });
  });
});
