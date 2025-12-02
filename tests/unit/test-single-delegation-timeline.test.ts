/**
 * Test: Single delegation should show timeline when --show-timeline is set
 *
 * This test verifies the fix in executor.ts:428-432 where we now
 * use parallel path (which includes timeline) even for single delegations
 * if showTimeline or showDependencyGraph flags are set.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { SessionManager } from '../../src/core/session-manager.js';
import type { WorkspaceManager } from '../../src/core/workspace-manager.js';
import type { ContextManager } from '../../src/agents/context-manager.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../src/types/agent.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';

describe('AgentExecutor - Single Delegation Timeline', () => {
  let executor: AgentExecutor;
  let mockProfileLoader: ProfileLoader;
  let mockContextManager: ContextManager;
  let mockWorkspaceManager: WorkspaceManager;

  const mockProfile: AgentProfile = {
    name: 'backend',
    role: 'backend developer',
    description: 'Backend developer',
    systemPrompt: 'You are a backend developer',
    abilities: [],
    orchestration: {
      maxDelegationDepth: 2
    }
  };

  beforeEach(() => {
    // Mock ProfileLoader
    mockProfileLoader = {
      loadProfile: vi.fn().mockResolvedValue(mockProfile),
      resolveAgentName: vi.fn().mockResolvedValue('backend')
    } as any;

    // Mock ContextManager
    mockContextManager = {
      createContext: vi.fn().mockResolvedValue({
        agent: mockProfile,
        task: 'test task',
        provider: {} as Provider,
        orchestration: {
          maxDelegationDepth: 2,
          delegationChain: ['cto'],
          sharedWorkspace: '/tmp/test',
          isDelegationEnabled: true,
          availableAgents: ['backend', 'frontend']
        },
        abilities: '',
        memory: [],
        projectDir: '/tmp/project',
        workingDir: '/tmp/working',
        agentWorkspace: '/tmp/workspace',
        createdAt: new Date()
      } as ExecutionContext)
    } as any;

    // Mock WorkspaceManager
    mockWorkspaceManager = {
      ensureWorkspace: vi.fn().mockResolvedValue('/tmp/test')
    } as any;

    executor = new AgentExecutor();
    (executor as any).profileLoader = mockProfileLoader;
    (executor as any).contextManager = mockContextManager;
    (executor as any).workspaceManager = mockWorkspaceManager;
  });

  it('should use parallel path for single delegation when showTimeline=true', async () => {
    // Mock the executeDelegationsParallel method to verify it's called
    const parallelSpy = vi.spyOn(executor as any, 'executeDelegationsParallel');
    parallelSpy.mockResolvedValue([
      {
        toAgent: 'backend',
        task: 'test task',
        success: true,
        result: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      }
    ]);

    const context: ExecutionContext = {
      agent: mockProfile,
      task: 'test task',
      provider: {
        name: 'gemini-cli',
        execute: vi.fn().mockResolvedValue({
          content: 'completed',
          tokensUsed: { prompt: 10, completion: 20, total: 30 },
          latencyMs: 100,
          finishReason: 'stop'
        })
      } as any,
      orchestration: {
        maxDelegationDepth: 2,
        delegationChain: [],
        sharedWorkspace: '/tmp/test',
        isDelegationEnabled: true,
        availableAgents: ['backend', 'frontend']
      },
      abilities: '',
      memory: [],
      projectDir: '/tmp/project',
      workingDir: '/tmp/working',
      agentWorkspace: '/tmp/workspace',
      createdAt: new Date()
    };

    // Call executeDelegations with single delegation and showTimeline=true
    await (executor as any).executeDelegations(
      [{ toAgent: 'backend', task: 'test task' }],
      context,
      { showTimeline: true, parallelEnabled: true }
    );

    // Verify parallel path was used
    expect(parallelSpy).toHaveBeenCalled();
  });

  it('should use parallel path for single delegation when showDependencyGraph=true', async () => {
    // Mock the executeDelegationsParallel method to verify it's called
    const parallelSpy = vi.spyOn(executor as any, 'executeDelegationsParallel');
    parallelSpy.mockResolvedValue([
      {
        toAgent: 'backend',
        task: 'test task',
        success: true,
        result: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      }
    ]);

    const context: ExecutionContext = {
      agent: mockProfile,
      task: 'test task',
      provider: {
        name: 'gemini-cli',
        execute: vi.fn().mockResolvedValue({
          content: 'completed',
          tokensUsed: { prompt: 10, completion: 20, total: 30 },
          latencyMs: 100,
          finishReason: 'stop'
        })
      } as any,
      orchestration: {
        maxDelegationDepth: 2,
        delegationChain: [],
        sharedWorkspace: '/tmp/test',
        isDelegationEnabled: true,
        availableAgents: ['backend', 'frontend']
      },
      abilities: '',
      memory: [],
      projectDir: '/tmp/project',
      workingDir: '/tmp/working',
      agentWorkspace: '/tmp/workspace',
      createdAt: new Date()
    };

    // Call executeDelegations with single delegation and showDependencyGraph=true
    await (executor as any).executeDelegations(
      [{ toAgent: 'backend', task: 'test task' }],
      context,
      { showDependencyGraph: true, parallelEnabled: true }
    );

    // Verify parallel path was used
    expect(parallelSpy).toHaveBeenCalled();
  });

  it('should use sequential path for single delegation when showTimeline=false and showDependencyGraph=false', async () => {
    // Mock both methods
    const parallelSpy = vi.spyOn(executor as any, 'executeDelegationsParallel');
    const sequentialSpy = vi.spyOn(executor as any, 'executeDelegationsSequential');

    sequentialSpy.mockResolvedValue([
      {
        toAgent: 'backend',
        task: 'test task',
        success: true,
        result: 'completed',
        startedAt: new Date(),
        completedAt: new Date()
      }
    ]);

    const context: ExecutionContext = {
      agent: mockProfile,
      task: 'test task',
      provider: {
        name: 'gemini-cli',
        execute: vi.fn().mockResolvedValue({
          content: 'completed',
          tokensUsed: { prompt: 10, completion: 20, total: 30 },
          latencyMs: 100,
          finishReason: 'stop'
        })
      } as any,
      orchestration: {
        maxDelegationDepth: 2,
        delegationChain: [],
        sharedWorkspace: '/tmp/test',
        isDelegationEnabled: true,
        availableAgents: ['backend', 'frontend']
      },
      abilities: '',
      memory: [],
      projectDir: '/tmp/project',
      workingDir: '/tmp/working',
      agentWorkspace: '/tmp/workspace',
      createdAt: new Date()
    };

    // Call executeDelegations with single delegation and both flags false
    await (executor as any).executeDelegations(
      [{ toAgent: 'backend', task: 'test task' }],
      context,
      { showTimeline: false, showDependencyGraph: false, parallelEnabled: true }
    );

    // Verify sequential path was used
    expect(sequentialSpy).toHaveBeenCalled();
    expect(parallelSpy).not.toHaveBeenCalled();
  });
});
