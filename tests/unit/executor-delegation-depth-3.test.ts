/**
 * Agent Executor - 3-Layer Delegation Depth Tests (v5.3.4 Phase 2 Pilot)
 *
 * Tests for increased delegation depth for coordinator agents (CTO, DevOps, Data Scientist).
 * Verifies that 3-layer delegation works correctly while 4-layer is rejected.
 *
 * @group unit
 * @group core
 * @group delegation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { DelegationRequest } from '../../src/types/orchestration.js';
import { DelegationError } from '../../src/types/orchestration.js';
import type { SessionManager } from '../../src/core/session/manager.js';
import type { WorkspaceManager } from '../../src/core/workspace-manager.js';
import type { ContextManager } from '../../src/agents/context-manager.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../src/types/agent.js';
import type { Session } from '../../src/types/orchestration.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';

describe('AgentExecutor - 3-Layer Delegation Depth (v5.3.4)', () => {
  let executor: AgentExecutor;
  let mockSessionManager: SessionManager;
  let mockWorkspaceManager: WorkspaceManager;
  let mockContextManager: ContextManager;
  let mockProfileLoader: ProfileLoader;

  // v5.3.4: Coordinator agents with depth 3
  const ctoProfile: AgentProfile = {
    name: 'cto',
    displayName: 'Tony',
    role: 'Chief Technology Officer',
    description: 'CTO agent',
    systemPrompt: 'You are a CTO',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 3 // v5.3.4: Increased from 1 to 3
    }
  };

  const devopsProfile: AgentProfile = {
    name: 'devops',
    displayName: 'Oliver',
    role: 'DevOps Engineer',
    description: 'DevOps agent',
    systemPrompt: 'You are a DevOps engineer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 3 // v5.3.4: Increased from 0 to 3
    }
  };

  const dataScientistProfile: AgentProfile = {
    name: 'data-scientist',
    displayName: 'Dana',
    role: 'Data Scientist',
    description: 'Data scientist agent',
    systemPrompt: 'You are a data scientist',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 3 // v5.3.4: Increased from 1 to 3
    }
  };

  // Implementer agents with depth 1
  const backendProfile: AgentProfile = {
    name: 'backend',
    displayName: 'Bob',
    role: 'Backend Developer',
    description: 'Backend developer agent',
    systemPrompt: 'You are a backend developer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 1 // v5.0.12: Implementers have depth 1
    }
  };

  const frontendProfile: AgentProfile = {
    name: 'frontend',
    displayName: 'Frank',
    role: 'Frontend Developer',
    description: 'Frontend developer agent',
    systemPrompt: 'You are a frontend developer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 1
    }
  };

  const securityProfile: AgentProfile = {
    name: 'security',
    displayName: 'Steve',
    role: 'Security Engineer',
    description: 'Security engineer agent',
    systemPrompt: 'You are a security engineer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 1
    }
  };

  const qualityProfile: AgentProfile = {
    name: 'quality',
    displayName: 'Queenie',
    role: 'QA Specialist',
    description: 'QA specialist agent',
    systemPrompt: 'You are a QA specialist',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 1
    }
  };

  beforeEach(() => {
    // Mock SessionManager
    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({
        id: 'session-123',
        initiator: 'cto',
        task: 'Test task',
        agents: ['cto'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as Session),
      getSession: vi.fn().mockResolvedValue({
        id: 'session-123',
        initiator: 'cto',
        task: 'Test task',
        agents: ['cto'],
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
      listPRD: vi.fn().mockResolvedValue([]),
      writeTmp: vi.fn().mockResolvedValue(undefined),
      readTmp: vi.fn().mockResolvedValue(''),
      listTmp: vi.fn().mockResolvedValue([]),
      cleanupTmp: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue({
        prdFiles: 0,
        tmpFiles: 0,
        totalSizeBytes: 0,
        prdSizeBytes: 0,
        tmpSizeBytes: 0
      })
    } as unknown as WorkspaceManager;

    // Mock ProfileLoader
    mockProfileLoader = {
      loadProfile: vi.fn().mockImplementation(async (agentName: string) => {
        const profiles: Record<string, AgentProfile> = {
          'cto': ctoProfile,
          'devops': devopsProfile,
          'data-scientist': dataScientistProfile,
          'backend': backendProfile,
          'frontend': frontendProfile,
          'security': securityProfile,
          'quality': qualityProfile
        };
        const profile = profiles[agentName];
        if (!profile) {
          throw new Error(`Profile not found: ${agentName}`);
        }
        return profile;
      }),
      listAgents: vi.fn().mockResolvedValue([
        'cto', 'devops', 'data-scientist', 'backend', 'frontend', 'security', 'quality'
      ])
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
        content: 'Mock response',
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
        agent: backendProfile,
        task: 'Delegated task',
        memory: [],
        projectDir: '/test/project',
        workingDir: '/test/project',
        agentWorkspace: '/test/project/.automatosx/workspaces/backend',
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
        content: 'Mock response',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'mock-model',
        finishReason: 'stop'
      },
      duration: 150,
      context: {
        agent: backendProfile,
        task: 'Delegated task',
        memory: [],
        projectDir: '/test/project',
        workingDir: '/test/project',
        agentWorkspace: '/test/project/.automatosx/workspaces/backend',
        provider: {} as any,
        abilities: '# Test abilities',
        createdAt: new Date()
      }
    });
  });

  describe('3-Layer Delegation Success Scenarios', () => {
    it('should allow 3-layer delegation: CTO → Backend → Frontend', async () => {
      // Layer 1: CTO delegates to Backend
      const request: DelegationRequest = {
        fromAgent: 'cto',
        toAgent: 'backend',
        task: 'Layer 1 task',
        context: {
          sessionId: 'session-123',
          delegationChain: [], // Empty - first delegation
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
      expect(result.fromAgent).toBe('cto');
      expect(result.toAgent).toBe('backend');
    });

    it('should allow 3-layer delegation: CTO → Backend → Frontend → Done', async () => {
      // Simulate 3-layer delegation chain
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Layer 3 task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'backend'], // 2 agents already in chain
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
      expect(result.fromAgent).toBe('backend');
      expect(result.toAgent).toBe('frontend');
    });

    it('should allow 3-layer delegation: DevOps → Backend → Quality → Done', async () => {
      // DevOps (depth 3) coordinates infrastructure workflow
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'quality',
        task: 'Validate deployment',
        context: {
          sessionId: 'session-123',
          delegationChain: ['devops', 'backend'], // DevOps → Backend → Quality
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
    });

    it('should allow 3-layer delegation: Data Scientist → Backend → Security → Done', async () => {
      // Data Scientist coordinates ML pipeline with security validation
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'security',
        task: 'Security review ML model',
        context: {
          sessionId: 'session-123',
          delegationChain: ['data-scientist', 'backend'], // Dana → Backend → Security
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
    });

    it('should allow cross-coordinator 3-layer delegation: CTO → DevOps → Backend → Done', async () => {
      // CTO delegates to DevOps (another coordinator), who then delegates to Backend
      const request: DelegationRequest = {
        fromAgent: 'devops',
        toAgent: 'backend',
        task: 'Infrastructure setup',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'devops'], // CTO → DevOps → Backend
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
    });
  });

  describe('4-Layer Delegation Rejection', () => {
    it('should reject 4-layer delegation from CTO: CTO → Backend → Frontend → Security', async () => {
      // CTO has maxDelegationDepth: 3, so 4th layer should be rejected
      const request: DelegationRequest = {
        fromAgent: 'frontend',
        toAgent: 'security',
        task: 'Layer 4 task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'backend', 'frontend'], // 3 agents in chain - at max
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(DelegationError);
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Max delegation depth (3) exceeded'
      );
    });

    it('should reject 4-layer delegation from DevOps: DevOps → Backend → Quality → Frontend', async () => {
      // DevOps has maxDelegationDepth: 3, attempting 4 layers should fail
      const request: DelegationRequest = {
        fromAgent: 'quality',
        toAgent: 'frontend',
        task: 'Layer 4 task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['devops', 'backend', 'quality'], // 3 agents in chain
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(DelegationError);
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Max delegation depth (3) exceeded'
      );
    });

    it('should provide clear error message when 4-layer delegation rejected', async () => {
      const request: DelegationRequest = {
        fromAgent: 'security',
        toAgent: 'quality',
        task: 'Layer 4 task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['data-scientist', 'backend', 'security'], // 3 agents
          sharedData: {}
        }
      };

      try {
        await executor.delegateToAgent(request);
        expect.fail('Should have thrown DelegationError');
      } catch (error) {
        expect(error).toBeInstanceOf(DelegationError);
        const delegationError = error as DelegationError;
        expect(delegationError.message).toContain('Max delegation depth');
        expect(delegationError.message).toContain('3');
        expect(delegationError.reason).toBe('max_depth'); // v5.3.4: reason is 'max_depth'
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain depth 1 restriction for implementer agents', async () => {
      // Backend (depth 1) should not be able to delegate beyond 1 layer
      const request: DelegationRequest = {
        fromAgent: 'frontend',
        toAgent: 'security',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['backend', 'frontend'], // Backend delegated to Frontend (1 layer used)
          sharedData: {}
        }
      };

      // Frontend trying to delegate would be 2nd layer from Backend's perspective
      // Since Backend has depth 1, this should fail
      await expect(executor.delegateToAgent(request)).rejects.toThrow(DelegationError);
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Max delegation depth (1) exceeded'
      );
    });

    it('should respect default depth of 2 for agents without orchestration config', async () => {
      // Create agent without orchestration config
      const noConfigProfile: AgentProfile = {
        name: 'no-config',
        role: 'Test Agent',
        description: 'Agent without orchestration',
        systemPrompt: 'Test',
        abilities: []
        // No orchestration field - should default to maxDelegationDepth: 2
      };

      (mockProfileLoader.loadProfile as any).mockImplementation(async (name: string) => {
        if (name === 'no-config') return noConfigProfile;
        if (name === 'backend') return backendProfile;
        if (name === 'frontend') return frontendProfile;
        throw new Error(`Profile not found: ${name}`);
      });

      // Attempt 3-layer delegation - should fail with default depth 2
      const request: DelegationRequest = {
        fromAgent: 'frontend',
        toAgent: 'backend',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['no-config', 'frontend'], // 2 agents in chain
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Max delegation depth (2) exceeded'
      );
    });

    it('should allow agents with depth 0 to have depth updated to 3 (DevOps case)', async () => {
      // DevOps was previously depth 0 (v5.0.12), now depth 3 (v5.3.4)
      // Verify it can now delegate 3 layers
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'quality',
        task: 'Infrastructure task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['devops', 'backend'], // DevOps → Backend → Quality (3 layers)
          sharedData: {}
        }
      };

      const result = await executor.delegateToAgent(request);
      expect(result.status).toBe('success');
      expect(result.fromAgent).toBe('backend');
      expect(result.toAgent).toBe('quality');
    });
  });

  describe('Cycle Detection with 3-Layer Depth', () => {
    it('should detect cycles at any depth level', async () => {
      // CTO → Backend → Frontend → CTO (cycle at 3rd layer)
      const request: DelegationRequest = {
        fromAgent: 'frontend',
        toAgent: 'cto',
        task: 'Some task',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'backend', 'frontend'], // Attempting to delegate back to CTO
          sharedData: {}
        }
      };

      await expect(executor.delegateToAgent(request)).rejects.toThrow(DelegationError);
      await expect(executor.delegateToAgent(request)).rejects.toThrow(
        'Delegation cycle detected'
      );
    });

    it('should allow same agent in different delegation branches (no cycle)', async () => {
      // CTO → Backend → Frontend is valid
      // Later, CTO → DevOps → Backend is also valid (Backend appears twice but no cycle)
      const request1: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'Task 1',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'backend'],
          sharedData: {}
        }
      };

      const result1 = await executor.delegateToAgent(request1);
      expect(result1.status).toBe('success');

      // Different delegation chain - no cycle
      const request2: DelegationRequest = {
        fromAgent: 'devops',
        toAgent: 'backend',
        task: 'Task 2',
        context: {
          sessionId: 'session-456', // Different session
          delegationChain: ['cto', 'devops'],
          sharedData: {}
        }
      };

      const result2 = await executor.delegateToAgent(request2);
      expect(result2.status).toBe('success');
    });
  });

  describe('Delegation Chain Tracking', () => {
    it('should correctly track 3-layer delegation chain', async () => {
      const request: DelegationRequest = {
        fromAgent: 'backend',
        toAgent: 'frontend',
        task: 'UI implementation',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'backend'],
          sharedData: {}
        }
      };

      await executor.delegateToAgent(request);

      // Verify context created with correct delegation chain
      expect(mockContextManager.createContext).toHaveBeenCalledWith(
        'frontend',
        'UI implementation',
        expect.objectContaining({
          delegationChain: ['cto', 'backend', 'backend'] // Chain should include fromAgent
        })
      );
    });

    it('should validate delegation chain length matches depth limit', async () => {
      // Chain with 3 agents = at max depth for depth-3 agents
      const request: DelegationRequest = {
        fromAgent: 'frontend',
        toAgent: 'security',
        task: 'Security review',
        context: {
          sessionId: 'session-123',
          delegationChain: ['cto', 'backend', 'frontend'], // 3 agents in chain
          sharedData: {}
        }
      };

      // This should fail because chain already has 3 agents (at max for CTO's depth 3)
      await expect(executor.delegateToAgent(request)).rejects.toThrow(DelegationError);
    });
  });
});
