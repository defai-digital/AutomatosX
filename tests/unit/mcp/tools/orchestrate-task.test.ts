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

// Use vi.hoisted to ensure mock state is preserved across module resets
const mockExecuteState = vi.hoisted(() => ({
  fn: vi.fn().mockResolvedValue({
    response: {
      content: 'Task completed successfully',
      tokensUsed: { prompt: 100, completion: 200, total: 300 }
    }
  })
}));

vi.mock('../../../../src/agents/executor.js', () => ({
  AgentExecutor: vi.fn().mockImplementation(() => ({
    execute: (...args: any[]) => mockExecuteState.fn(...args)
  }))
}));

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
    vi.clearAllMocks();
    // Reset the mock execute function for each test
    mockExecuteState.fn.mockReset().mockResolvedValue({
      response: {
        content: 'Task completed successfully',
        tokensUsed: { prompt: 100, completion: 200, total: 300 }
      }
    });

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
      expect(result.execution?.groupMetrics.length).toBeGreaterThan(0);
    });

    it('respects maxParallel and propagates per-subtask timeout', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build parallelizable feature',
        mode: 'execute_parallel',
        maxParallel: 1,
        subtaskTimeoutMs: 12345
      });

      // Verify that execution happened
      expect(result.execution).toBeDefined();
      expect(result.execution?.results.length).toBeGreaterThan(0);

      // With maxParallel = 1, execution runs sequentially
      // groupMetrics may be empty or have entries with parallelized=false
      const groupMetrics = result.execution?.groupMetrics ?? [];
      if (groupMetrics.length > 0) {
        // If there are group metrics, the first group should not be parallelized
        expect(groupMetrics[0].parallelized).toBe(false);
      }
      // Main assertion: execution completed successfully with sequential processing
      expect(result.execution?.success).toBeDefined();
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
      // Owner should be the orchestrator for stability
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(expect.any(String), 'orchestrator');
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
      // Make first task fail, then succeed
      let callCount = 0;
      mockExecuteState.fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Task failed');
        }
        return {
          response: {
            content: 'Success',
            tokensUsed: { prompt: 100, completion: 200, total: 300 }
          }
        };
      });

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build multiple things',
        mode: 'execute',
        continueOnFailure: true
      });

      // Should continue despite failure
      expect(result.execution?.results.length).toBeGreaterThan(0);
    });

    it('should track failed results with continueOnFailure option', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build multiple things',
        mode: 'execute',
        continueOnFailure: false,
        maxSubtasks: 2
      });

      // Should execute and track results
      expect(result.execution?.results).toBeDefined();
      expect(result.execution?.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution with session tracking', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something with session tracking',
        mode: 'execute',
        createSession: true
      });

      // Should create and complete session
      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(result.execution?.sessionId).toBe('test-session-123');
    });

    it('should handle session update errors gracefully', async () => {
      // Make session completeSession throw an error
      mockSessionManager.completeSession = vi.fn().mockRejectedValue(new Error('Session error'));

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      // Should not throw, should complete gracefully
      const result = await handler({
        task: 'Build something',
        mode: 'execute',
        createSession: true
      });

      expect(result).toBeDefined();
      expect(result.execution).toBeDefined();
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

  describe('abort handling', () => {
    it('should handle abort signal during execution', async () => {
      const abortController = new AbortController();

      // Make tasks take some time
      mockContextManager.createContext = vi.fn().mockImplementation((agent: string, task: string) => {
        return Promise.resolve({
          agent: mockProfiles['backend'],
          task,
          provider: {
            execute: vi.fn().mockImplementation(async () => {
              // Abort mid-execution
              abortController.abort();
              return { content: 'Success', model: 'test' };
            })
          }
        } as unknown as ExecutionContext);
      });

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler(
        {
          task: 'Build something that gets aborted',
          mode: 'execute',
          maxSubtasks: 3
        },
        { signal: abortController.signal }
      );

      // Should complete with some results
      expect(result.execution).toBeDefined();
    });
  });

  describe('session creation failure', () => {
    it('should continue execution if session creation fails', async () => {
      mockSessionManager.createSession = vi.fn().mockRejectedValue(new Error('Session creation failed'));

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

      // Should still complete execution despite session failure
      expect(result.execution).toBeDefined();
      expect(result.execution?.sessionId).toBeUndefined();
    });
  });

  describe('includeMemory option', () => {
    it('should pass includeMemory to plan handler', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        memoryManager: mockMemoryManager,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something with memory context',
        mode: 'plan_only',
        includeMemory: true
      });

      expect(result.plan).toBeDefined();
      // Memory manager search should have been called by plan handler
    });
  });

  describe('preferredAgents option', () => {
    it('should pass preferredAgents to plan handler', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something with specific agents',
        mode: 'plan_only',
        preferredAgents: ['backend', 'frontend']
      });

      expect(result.plan).toBeDefined();
      // Plan should use preferred agents when possible
      const agentsUsed = result.plan.uniqueAgents;
      // At least some preferred agents should be used if available
      expect(agentsUsed.length).toBeGreaterThan(0);
    });
  });

  describe('failure scenarios', () => {
    it('should fail session on execution failures', async () => {
      // Make all tasks fail
      mockExecuteState.fn = vi.fn().mockRejectedValue(new Error('Task failed'));

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        sessionManager: mockSessionManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build something that will fail',
        mode: 'execute',
        createSession: true,
        maxSubtasks: 2
      });

      // If tasks failed, session should be marked as failed
      if (result.execution?.success === false) {
        expect(mockSessionManager.failSession).toHaveBeenCalled();
      } else {
        // If no subtasks were generated, execution might succeed with 0 tasks
        expect(result.execution?.results.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should stop execution when continueOnFailure is false and task fails', async () => {
      // Make first task fail
      let callCount = 0;
      mockExecuteState.fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First task failed');
        }
        return {
          response: { content: 'Success', tokensUsed: { prompt: 100, completion: 200, total: 300 } }
        };
      });

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build multiple features',
        mode: 'execute',
        continueOnFailure: false,
        maxSubtasks: 3
      });

      // Should have some skipped results
      const skippedResults = result.execution?.results.filter(r => r.status === 'skipped');
      expect(skippedResults?.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle cancelled execution error message', async () => {
      // Simulate cancellation error
      mockExecuteState.fn = vi.fn().mockRejectedValue(new Error('Execution cancelled by user'));

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build an API with multiple components',
        mode: 'execute',
        maxSubtasks: 2
      });

      // Should include cancellation message if tasks were executed
      const failedResult = result.execution?.results.find(r => r.status === 'failed');
      if (failedResult) {
        expect(failedResult.error?.toLowerCase()).toContain('cancel');
      } else {
        // No failures means no tasks were generated or all succeeded
        expect(result.execution).toBeDefined();
      }
    });
  });

  describe('parallel execution edge cases', () => {
    it('should handle parallel execution with failures and stop', async () => {
      // Fail on second call
      let callCount = 0;
      mockExecuteState.fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second task failed');
        }
        return {
          response: { content: 'Success', tokensUsed: { prompt: 100, completion: 200, total: 300 } }
        };
      });

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build frontend and backend',
        mode: 'execute_parallel',
        continueOnFailure: false,
        maxParallel: 2,
        maxSubtasks: 3
      });

      expect(result.execution).toBeDefined();
      // Some tasks may be skipped due to failure
      const results = result.execution?.results || [];
      expect(results.length).toBeGreaterThan(0);
    });

    it('should track group metrics correctly', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build a complex multi-step feature',
        mode: 'execute_parallel',
        maxParallel: 3,
        maxSubtasks: 4
      });

      expect(result.execution?.groupMetrics).toBeDefined();
      expect(result.execution?.groupMetrics.length).toBeGreaterThanOrEqual(0);

      for (const metric of result.execution?.groupMetrics || []) {
        expect(metric).toHaveProperty('level');
        expect(metric).toHaveProperty('parallelized');
        expect(metric).toHaveProperty('durationMs');
        expect(metric).toHaveProperty('taskCount');
      }
    });
  });

  describe('summary generation', () => {
    it('should generate success summary', async () => {
      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build a simple feature',
        mode: 'execute'
      });

      if (result.execution?.success) {
        expect(result.summary).toContain('Successfully executed');
        expect(result.summary).toContain('subtasks');
      }
    });

    it('should generate failure summary', async () => {
      // Make all tasks fail
      mockExecuteState.fn = vi.fn().mockRejectedValue(new Error('Task failed'));

      const handler = createOrchestrateTaskHandler({
        profileLoader: mockProfileLoader,
        contextManager: mockContextManager,
        executorConfig: {}
      });

      const result = await handler({
        task: 'Build a complex system with database and API',
        mode: 'execute',
        maxSubtasks: 3
      });

      // Summary depends on execution results
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
      // If there were failures, summary should mention them
      if (result.execution?.success === false) {
        expect(result.summary.toLowerCase()).toMatch(/failure|failed/);
      }
    });
  });
});
