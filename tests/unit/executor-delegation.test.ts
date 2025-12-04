/**
 * Agent Executor - Delegation Tests
 *
 * @group unit
 * @group core
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { DelegationRequest, DelegationResult } from '../../src/types/orchestration.js';
import { DelegationError } from '../../src/types/orchestration.js';
import type { SessionManager } from '../../src/core/session/manager.js';
import type { WorkspaceManager } from '../../src/core/workspace-manager.js';
import type { ContextManager } from '../../src/agents/context-manager.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../src/types/agent.js';
import type { Session } from '../../src/types/orchestration.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';

describe('AgentExecutor - Delegation', () => {
  let executor: AgentExecutor;
  let mockSessionManager: SessionManager;
  let mockWorkspaceManager: WorkspaceManager;
  let mockContextManager: ContextManager;
  let mockProfileLoader: ProfileLoader;

  // Mock profiles
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

  const unauthorizedProfile: AgentProfile = {
    name: 'unauthorized',
    role: 'unauthorized agent',
    description: 'Agent without delegation permission',
    systemPrompt: 'You are an unauthorized agent',
    abilities: []
    // No orchestration config
  };

  beforeEach(() => {
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
        agents: ['backend', 'frontend'],
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
      cleanupOldSessions: vi.fn().mockResolvedValue(0),
      clearAll: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue({
        total: 1,
        active: 1,
        completed: 0,
        failed: 0
      })
    } as unknown as SessionManager;

    // Mock WorkspaceManager (v5.2.0: Simplified API)
    mockWorkspaceManager = {
      writePRD: vi.fn().mockResolvedValue(undefined),
      readPRD: vi.fn().mockResolvedValue(''),
      listPRD: vi.fn().mockResolvedValue(['design.md']),
      writeTmp: vi.fn().mockResolvedValue(undefined),
      readTmp: vi.fn().mockResolvedValue(''),
      listTmp: vi.fn().mockResolvedValue(['test.sh']),
      cleanupTmp: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue({
        prdFiles: 1,
        tmpFiles: 1,
        totalSizeBytes: 2048,
        prdSizeBytes: 1024,
        tmpSizeBytes: 1024
      })
    } as unknown as WorkspaceManager;

    // Mock ProfileLoader
    mockProfileLoader = {
      loadProfile: vi.fn().mockImplementation(async (agentName: string) => {
        if (agentName === 'backend') return backendProfile;
        if (agentName === 'frontend') return frontendProfile;
        if (agentName === 'database') return databaseProfile;
        if (agentName === 'unauthorized') return unauthorizedProfile;
        // v5.3.4: Support generic test agents (agent1, agent2, etc.) for delegation chain tests
        // These agents have depth 3 to match backend/frontend/database profiles
        if (agentName.startsWith('agent') || ['a', 'b'].includes(agentName)) {
          return {
            name: agentName,
            role: 'test agent',
            description: 'Test agent for delegation',
            systemPrompt: 'Test',
            abilities: [],
            orchestration: {
              maxDelegationDepth: 3
            }
          };
        }
        throw new Error(`Profile not found: ${agentName}`);
      }),
      listAgents: vi.fn().mockResolvedValue(['backend', 'frontend', 'database'])
    } as unknown as ProfileLoader;

    // Mock Provider
    const mockProvider: Provider = {
      name: 'mock',
      version: '1.0.0',
      priority: 1,
      capabilities: {
        supportsStreaming: true,
        supportsEmbedding: false,
        supportsVision: false,
        maxContextTokens: 4096,
        supportedModels: ['mock-model']
      },
      execute: vi.fn().mockResolvedValue({
        content: 'Mock delegated response',
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        latencyMs: 100,
        model: 'mock-model',
        finishReason: 'stop'
      } as ExecutionResponse),
      supportsStreaming: vi.fn().mockReturnValue(false),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      isAvailable: vi.fn().mockResolvedValue(true),
      getHealth: vi.fn().mockResolvedValue({
        available: true,
        latencyMs: 100,
        errorRate: 0,
        consecutiveFailures: 0
      }),
      checkRateLimit: vi.fn().mockResolvedValue({
        hasCapacity: true,
        requestsRemaining: 100,
        tokensRemaining: 10000,
        resetAtMs: Date.now() + 60000
      }),
      waitForCapacity: vi.fn().mockResolvedValue(undefined),
      estimateCost: vi.fn().mockResolvedValue({
        estimatedUsd: 0.01,
        tokensUsed: 30
      }),
      getUsageStats: vi.fn().mockResolvedValue({
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatencyMs: 0,
        errorCount: 0
      }),
      shouldRetry: vi.fn().mockReturnValue(false),
      getRetryDelay: vi.fn().mockReturnValue(1000),
      getCacheMetrics: vi.fn().mockReturnValue({
        availability: { hits: 0, misses: 0, hitRate: 0, avgAge: 0, maxAge: 60000 },
        version: { hits: 0, misses: 0, hitRate: 0, size: 0, avgAge: 0, maxAge: 300000 },
        health: { consecutiveFailures: 0, consecutiveSuccesses: 0, lastCheckDuration: 0, uptime: 100 }
      }),
      clearCaches: vi.fn()
    } as Provider;

    // Mock ContextManager
    mockContextManager = {
      createContext: vi.fn().mockResolvedValue({
        agent: frontendProfile,
        task: 'Delegated task',
        memory: [],
        projectDir: '/test/project',
        workingDir: '/test/project',
        agentWorkspace: '/test/project/.automatosx/workspaces/frontend',
        provider: mockProvider,
        abilities: '# Test abilities',
        createdAt: new Date()
      } as ExecutionContext)
    } as unknown as ContextManager;

    // Create AgentExecutor with mocked dependencies
    executor = new AgentExecutor({
      sessionManager: mockSessionManager,
      workspaceManager: mockWorkspaceManager,
      contextManager: mockContextManager,
      profileLoader: mockProfileLoader
    });

    // Mock execute method to avoid actual execution
    vi.spyOn(executor, 'execute').mockResolvedValue({
      response: {
        content: 'Mock delegated response',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'mock-model',
        finishReason: 'stop'
      },
      duration: 150,
      context: {
        agent: frontendProfile,
        task: 'Delegated task',
        memory: [],
        projectDir: '/test/project',
        workingDir: '/test/project',
        agentWorkspace: '/test/project/.automatosx/workspaces/frontend',
        provider: {} as any,
        abilities: '# Test abilities',
        createdAt: new Date()
      }
    });
  });

  describe('Basic Delegation', () => {
    it('should successfully delegate task to authorized agent', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create user interface'
      };

      const result = await executor.delegateToAgent(request);

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.fromAgent).toBe('backend');
      expect(result.toAgent).toBe('frontend');
      expect(result.response.content).toBe('Mock delegated response');
      expect(result.delegationId).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should create new session when no sessionId provided', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create user interface'
      };

      await executor.delegateToAgent(request);

      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'Create user interface',
        'backend'
      );
      // v5.2.0: No more createSessionWorkspace - workspaces are shared
    });

    it('should join existing session when sessionId provided', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create user interface',
        context: {
          sessionId: 'session-123',
          delegationChain: [],
          sharedData: {}
        }
      };

      await executor.delegateToAgent(request);

      expect(mockSessionManager.getSession).toHaveBeenCalledWith('session-123');
      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
      // v5.2.0: No more createSessionWorkspace
    });

    it('should add toAgent to session', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create user interface'
      };

      await executor.delegateToAgent(request);

      expect(mockSessionManager.addAgent).toHaveBeenCalledWith(
        'session-123',
        'frontend'
      );
    });

    it('should return delegation outputs structure', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create user interface'
      };

      const result = await executor.delegateToAgent(request);

      // v5.2.0: Files are managed directly by agents in automatosx/PRD and automatosx/tmp
      // Output files are not collected automatically anymore
      expect(result.outputs.files).toEqual([]);
      expect(result.outputs.memoryIds).toEqual([]);
      expect(result.outputs.workspacePath).toBe(
        'sessions/session-123/outputs/frontend'
      );
    });
  });

  describe('Permission Checks', () => {
    it('should allow delegation for all agents (v4.9.0+)', async () => {
      // v4.9.0+: All agents can delegate by default
      const request: DelegationRequest = {
        fromAgent: 'database',
        toAgent: 'backend',
        task: 'Some task'
      };

      const result = await executor.delegateToAgent(request);

      expect(result).toBeDefined();
      expect(result.fromAgent).toBe('database');
      expect(result.toAgent).toBe('backend');
    });

    it('should allow delegation even when fromAgent has no orchestration config (v4.9.0+)', async () => {
      // v4.9.0+: Agents without orchestration config can still delegate
      const request: DelegationRequest = {
        fromAgent: 'unauthorized',
        toAgent: 'backend',
        task: 'Some task'
      };

      const result = await executor.delegateToAgent(request);

      expect(result).toBeDefined();
      expect(result.fromAgent).toBe('unauthorized');
      expect(result.toAgent).toBe('backend');
    });

    it('should allow delegation to any agent (autonomous collaboration)', async () => {
      // Agents can delegate to any other agent for autonomous collaboration
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task'
      };

      const result = await executor.delegateToAgent(request);
      expect(result).toBeDefined();
      expect(result.fromAgent).toBe('backend');
      expect(result.toAgent).toBe('frontend');
      expect(result.status).toBe('success');
    });
  });

  describe('Cycle Detection', () => {
    it('should detect direct cycle (A -> B -> A)', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['frontend', 'backend'],
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Delegation cycle detected'
      );
    });

    it('should detect longer cycle (A -> B -> C -> A)', async () => {
      const request: DelegationRequest = {
        fromAgent: 'database',
        toAgent: 'backend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['backend', 'frontend', 'database'],
          sharedData: {}
        }
      };

      // Override mock implementation for cycle detection test
      (mockProfileLoader.loadProfile as any).mockImplementation(async (name: string) => {
        if (name === 'database') {
          return {
            ...databaseProfile,
            orchestration: {
              maxDelegationDepth: 3
            }
          };
        }
        if (name === 'backend') return backendProfile;
        throw new Error(`Profile not found: ${name}`);
      });

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Delegation cycle detected'
      );
    });

    it('should allow linear delegation chain without cycles', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['database'], // No cycle: database -> backend -> frontend
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
    });
  });

  describe('Max Depth Enforcement', () => {
    it('should reject delegation when max depth exceeded', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['agent1', 'agent2', 'agent3'], // Length = 3 (at max)
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Max delegation depth (3) exceeded'
      );
    });

    it('should allow delegation when under max depth', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['agent1', 'agent2'], // Length = 2 (under max 3)
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
    });

    it('should use default max depth of 2 when not specified', async () => {
      // Create profile without maxDelegationDepth
      const noDepthProfile: AgentProfile = {
        name: 'no-depth',
        role: 'test',
        description: 'Test',
        systemPrompt: 'Test',
        abilities: [],
        orchestration: {
          // maxDelegationDepth not specified - should default to 2
        }
      };

      (mockProfileLoader.loadProfile as any).mockImplementation(async (name: string) => {
        if (name === 'no-depth') return noDepthProfile;
        if (name === 'frontend') return frontendProfile;
        // v5.3.4: Support generic test agents for delegation chain
        if (['a', 'b'].includes(name)) {
          return {
            name: name,
            role: 'test agent',
            description: 'Test agent',
            systemPrompt: 'Test',
            abilities: [],
            orchestration: {
              maxDelegationDepth: 2 // Match default depth
            }
          };
        }
        throw new Error(`Profile not found: ${name}`);
      });

      const request: DelegationRequest = {
        fromAgent: 'no-depth',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['a', 'b'], // Length = 2
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Max delegation depth (2) exceeded'
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when delegation not configured', async () => {
      // Create executor without dependencies
      const unconfiguredExecutor = new AgentExecutor();

      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task'
      };

      await expect(unconfiguredExecutor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(unconfiguredExecutor.delegateToAgent(request)).rejects.toThrow(
        'Delegation not configured - missing required managers'
      );
    });

    it('should throw error when session not found', async () => {
      (mockSessionManager.getSession as any).mockResolvedValue(null);

      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'non-existent',
          delegationChain: [],
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Session not found: non-existent'
      );
    });

    it('should throw error when session is completed', async () => {
      (mockSessionManager.getSession as any).mockResolvedValue({
        id: 'session-123',
        initiator: 'backend',
        task: 'Test task',
        agents: ['backend'],
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      });

      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: [],
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Cannot delegate to completed session'
      );
    });

    it('should throw error when session is failed', async () => {
      (mockSessionManager.getSession as any).mockResolvedValue({
        id: 'session-123',
        initiator: 'backend',
        task: 'Test task',
        agents: ['backend'],
        status: 'failed',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      });

      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: [],
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Cannot delegate to failed session'
      );
    });

    it('should wrap execution errors in DelegationError', async () => {
      (executor.execute as any).mockRejectedValue(
        new Error('Execution failed')
      );

      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task'
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        DelegationError
      );
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Delegation execution failed: Execution failed'
      );
    });

    it('should preserve DelegationError when already thrown', async () => {
      const originalError = new DelegationError(
        'Original delegation error',
        'backend',
        'frontend',
        'unauthorized'
      );

      (executor.execute as any).mockRejectedValue(originalError);

      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Some task'
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        originalError
      );
    });

    it('should throw error when profile not found', async () => {
      (mockProfileLoader.loadProfile as any).mockRejectedValue(
        new Error('Profile not found: nonexistent')
      );

      const request: DelegationRequest = {
        fromAgent: 'nonexistent',
        toAgent: 'frontend',
        task: 'Some task'
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow();
    });
  });

  describe('Context Creation', () => {
    it('should create context with delegation chain', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI',
        context: {
          sessionId: 'session-123',
          delegationChain: ['database'],
          sharedData: { foo: 'bar' }
        }
      };

      await executor.delegateToAgent(request);

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'frontend',
        'Create UI',
        {
          sessionId: 'session-123',
          delegationChain: ['database', 'backend'], // fromAgent appended
          sharedData: { foo: 'bar' }
        }
      );
    });

    it('should create context with empty chain for first delegation', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI'
      };

      await executor.delegateToAgent(request);

      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'frontend',
        'Create UI',
        expect.objectContaining({
          delegationChain: ['backend'] // Only fromAgent
        })
      );
    });
  });

  describe('Response Structure', () => {
    it('should return complete DelegationResult', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI'
      };

      const result = await executor.delegateToAgent(request);

      // Verify all required fields
      expect(result).toMatchObject({
        delegationId: expect.any(String),
        fromAgent: 'backend',
        toAgent: 'frontend',
        status: 'success',
        response: expect.objectContaining({
          content: expect.any(String),
          tokensUsed: expect.any(Object),
          latencyMs: expect.any(Number),
          model: expect.any(String)
        }),
        duration: expect.any(Number),
        outputs: expect.objectContaining({
          files: expect.any(Array),
          memoryIds: expect.any(Array),
          workspacePath: expect.any(String)
        }),
        startTime: expect.any(Date),
        endTime: expect.any(Date)
      });
    });

    it('should generate unique delegation IDs', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI'
      };

      const result1 = await executor.delegateToAgent(request);
      const result2 = await executor.delegateToAgent(request);

      expect(result1.delegationId).not.toBe(result2.delegationId);
    });

    it('should calculate duration accurately', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Create UI'
      };

      const result = await executor.delegateToAgent(request);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.endTime.getTime() - result.startTime.getTime()).toBe(
        result.duration
      );
    });
  });
});
