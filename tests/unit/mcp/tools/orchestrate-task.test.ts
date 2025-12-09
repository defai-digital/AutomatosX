/**
 * Tests for orchestrate_task MCP tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOrchestrateTaskHandler,
  type OrchestrateTaskInput,
  type OrchestrateTaskOutput
} from '../../../../src/mcp/tools/orchestrate-task.js';
import type { ProfileLoader } from '../../../../src/agents/profile-loader.js';
import type { IMemoryManager } from '../../../../src/types/memory.js';
import type { ContextManager } from '../../../../src/agents/context-manager.js';
import type { SessionManager } from '../../../../src/core/session/manager.js';
import type { AgentProfile, ExecutionContext } from '../../../../src/types/agent.js';

describe('orchestrate_task MCP tool', () => {
  let mockProfileLoader: ProfileLoader;
  let mockMemoryManager: IMemoryManager;
  let mockContextManager: ContextManager;
  let mockSessionManager: SessionManager;

  const mockProfiles: Record<string, AgentProfile> = {
    backend: {
      name: 'backend',
      displayName: 'Benny',
      role: 'Backend Developer',
      description: 'Backend development specialist',
      systemPrompt: 'You are a backend developer',
      abilities: ['api-design', 'database'],
      selectionMetadata: {
        primaryIntents: ['implement API', 'backend service'],
        secondarySignals: ['api', 'server', 'endpoint']
      }
    },
    frontend: {
      name: 'frontend',
      displayName: 'Frankie',
      role: 'Frontend Developer',
      description: 'Frontend development specialist',
      systemPrompt: 'You are a frontend developer',
      abilities: ['react', 'ui'],
      selectionMetadata: {
        primaryIntents: ['build UI', 'frontend component'],
        secondarySignals: ['ui', 'component', 'page']
      }
    },
    quality: {
      name: 'quality',
      displayName: 'Queenie',
      role: 'QA Engineer',
      description: 'Quality assurance specialist',
      systemPrompt: 'You are a QA engineer',
      abilities: ['testing', 'review'],
      selectionMetadata: {
        primaryIntents: ['test', 'review'],
        secondarySignals: ['test', 'verify']
      }
    }
  };

  beforeEach(() => {
    mockProfileLoader = {
      listProfiles: vi.fn().mockResolvedValue(Object.keys(mockProfiles)),
      loadProfile: vi.fn().mockImplementation((name: string) => {
        const profile = mockProfiles[name];
        if (!profile) throw new Error(`Profile not found: ${name}`);
        return Promise.resolve(profile);
      }),
      resolveAgentName: vi.fn().mockImplementation((name: string) => Promise.resolve(name))
    } as unknown as ProfileLoader;

    mockMemoryManager = {
      search: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue({ totalEntries: 0 })
    } as unknown as IMemoryManager;

    mockContextManager = {
      createContext: vi.fn().mockImplementation((agent: string, task: string) => {
        return Promise.resolve({
          agent: mockProfiles[agent] || mockProfiles['backend'],
          task,
          provider: {
            execute: vi.fn().mockResolvedValue({
              content: `Completed task for ${agent}`,
              model: 'test-model',
              tokensUsed: { prompt: 100, completion: 200, total: 300 }
            })
          }
        } as unknown as ExecutionContext);
      })
    } as unknown as ContextManager;

    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({ id: 'test-session-123' }),
      completeSession: vi.fn().mockResolvedValue(undefined),
      failSession: vi.fn().mockResolvedValue(undefined),
      getActiveSessions: vi.fn().mockResolvedValue([])
    } as unknown as SessionManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('plan_only mode', () => {
    it('should return plan without executing', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        memoryManager: mockMemoryManager,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build a REST API',
        mode: 'plan_only'
      });

      expect(result.mode).toBe('plan_only');
      expect(result.plan).toBeDefined();
      expect(result.plan.subtasks.length).toBeGreaterThan(0);
      expect(result.execution).toBeUndefined();
      expect(result.summary).toContain('plan');
    });

    it('should be the default mode', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something'
      });

      expect(result.mode).toBe('plan_only');
      expect(result.execution).toBeUndefined();
    });
  });

  describe('execute mode', () => {
    it('should execute subtasks sequentially', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        memoryManager: mockMemoryManager,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {
          sessionManager: mockSessionManager
        }
      });

      const result = await handler({
        task: 'Build a simple feature',
        mode: 'execute'
      });

      expect(result.mode).toBe('execute');
      expect(result.plan).toBeDefined();
      expect(result.execution).toBeDefined();
      expect(result.execution?.results.length).toBeGreaterThan(0);
    });

    it('should track execution results', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        memoryManager: mockMemoryManager,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Implement API',
        mode: 'execute'
      });

      expect(result.execution).toBeDefined();
      expect(result.execution?.success).toBeDefined();
      expect(result.execution?.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.execution?.results).toBeDefined();
    });
  });

  describe('execute_parallel mode', () => {
    it('should support parallel execution mode', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build frontend and backend together',
        mode: 'execute_parallel'
      });

      expect(result.mode).toBe('execute_parallel');
      expect(result.execution).toBeDefined();
    });
  });

  describe('session management', () => {
    it('should create session when requested', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something',
        mode: 'execute',
        createSession: true
      });

      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(result.execution?.sessionId).toBe('test-session-123');
    });

    it('should complete session on success', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      await handler({
        task: 'Build something',
        mode: 'execute',
        createSession: true
      });

      expect(mockSessionManager.completeSession).toHaveBeenCalledWith('test-session-123');
    });

    it('should not create session by default', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      await handler({
        task: 'Build something',
        mode: 'execute'
      });

      expect(mockSessionManager.createSession).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue on failure when configured', async () => {
      // Make first task fail
      let callCount = 0;
      mockContextManager.createContext = vi.fn().mockImplementation((agent: string, task: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            agent: mockProfiles['backend'],
            task,
            provider: {
              execute: vi.fn().mockRejectedValue(new Error('Task failed'))
            }
          } as unknown as ExecutionContext);
        }
        return Promise.resolve({
          agent: mockProfiles[agent] || mockProfiles['backend'],
          task,
          provider: {
            execute: vi.fn().mockResolvedValue({
              content: 'Success',
              model: 'test'
            })
          }
        } as unknown as ExecutionContext);
      });

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {},
        continueOnFailure: true
      } as any);

      const result = await handler({
        task: 'Build multiple things',
        mode: 'execute',
        continueOnFailure: true
      });

      // Should continue despite failure
      expect(result.execution?.results.length).toBeGreaterThan(0);
    });
  });

  describe('output structure', () => {
    it('should include all required fields', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something',
        mode: 'plan_only'
      });

      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('summary');
      expect(result.plan).toHaveProperty('originalTask');
      expect(result.plan).toHaveProperty('subtasks');
      expect(result.plan).toHaveProperty('executionPlan');
    });

    it('should provide meaningful summary', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build a feature',
        mode: 'execute'
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  describe('input validation', () => {
    it('should handle empty preferred agents', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something',
        preferredAgents: []
      });

      expect(result.plan.subtasks.length).toBeGreaterThan(0);
    });

    it('should handle custom maxSubtasks', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build a complex system',
        maxSubtasks: 2
      });

      expect(result.plan.subtasks.length).toBeLessThanOrEqual(2);
    });
  });
});
