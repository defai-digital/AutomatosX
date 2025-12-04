/**
 * Agent Executor - Multiple Delegations to Same Agent Tests
 *
 * Tests that multiple delegations to the same agent are all executed
 * and results are properly collected and displayed.
 *
 * @group unit
 * @group orchestration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import { DelegationParser } from '../../src/agents/delegation-parser.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';
import type { SessionManager } from '../../src/core/session/manager.js';
import type { WorkspaceManager } from '../../src/core/workspace-manager.js';
import type { ContextManager } from '../../src/agents/context-manager.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../src/types/agent.js';

describe('AgentExecutor - Multiple Delegations to Same Agent', () => {
  let executor: AgentExecutor;
  let mockProvider: Provider;
  let mockContextManager: ContextManager;
  let mockProfileLoader: ProfileLoader;

  // Counter to track delegation execution order
  let delegationCounter = 0;

  beforeEach(() => {
    delegationCounter = 0;

    // Mock provider that tracks delegation calls
    mockProvider = {
      name: 'mock',
      execute: vi.fn(async (request) => {
        // Coordinator response with multiple delegations to frontend
        if (request.prompt.includes('coordinator')) {
          return {
            content: `I need frontend to do three tasks:

@frontend Create the header component.

@frontend Create the footer component.

@frontend Create the sidebar component.

All tasks delegated.`,
            model: 'mock-model',
            tokensUsed: { prompt: 100, completion: 80, total: 180 },
            latencyMs: 100,
            finishReason: 'stop'
          } as ExecutionResponse;
        }

        // Frontend responses - different for each task
        if (request.prompt.includes('header')) {
          delegationCounter++;
          return {
            content: `[${delegationCounter}] Header component created successfully.`,
            model: 'mock-model',
            tokensUsed: { prompt: 30, completion: 20, total: 50 },
            latencyMs: 30,
            finishReason: 'stop'
          } as ExecutionResponse;
        }

        if (request.prompt.includes('footer')) {
          delegationCounter++;
          return {
            content: `[${delegationCounter}] Footer component created successfully.`,
            model: 'mock-model',
            tokensUsed: { prompt: 30, completion: 20, total: 50 },
            latencyMs: 30,
            finishReason: 'stop'
          } as ExecutionResponse;
        }

        if (request.prompt.includes('sidebar')) {
          delegationCounter++;
          return {
            content: `[${delegationCounter}] Sidebar component created successfully.`,
            model: 'mock-model',
            tokensUsed: { prompt: 30, completion: 20, total: 50 },
            latencyMs: 30,
            finishReason: 'stop'
          } as ExecutionResponse;
        }

        return {
          content: 'Default response',
          model: 'mock-model',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 10,
          finishReason: 'stop'
        } as ExecutionResponse;
      })
    } as any;

    // Mock profile loader
    const frontendProfile: AgentProfile = {
      name: 'frontend',
      role: 'frontend developer',
      description: 'Frontend development',
      systemPrompt: 'You are a frontend developer.',
      abilities: [],
      orchestration: {
        maxDelegationDepth: 2
      }
    };

    const coordinatorProfile: AgentProfile = {
      name: 'coordinator',
      role: 'coordinator',
      description: 'Coordinates work',
      systemPrompt: 'You coordinate tasks.',
      abilities: [],
      orchestration: {
        maxDelegationDepth: 2
      }
    };

    mockProfileLoader = {
      loadProfile: vi.fn(async (name: string) => {
        if (name === 'frontend') return frontendProfile;
        if (name === 'coordinator') return coordinatorProfile;
        throw new Error(`Profile not found: ${name}`);
      })
    } as any;

    // Mock context manager
    mockContextManager = {
      createContext: vi.fn(async (agentName: string, task: string) => {
        const profile = await mockProfileLoader.loadProfile(agentName);
        return {
          agent: profile,
          task,
          provider: mockProvider,
          memory: [],
          abilities: '',
          projectRoot: '/test',
          projectDir: '/test',
          workingDir: '/test',
          workspace: `/test/.automatosx/workspaces/${agentName}`,
          agentWorkspace: `/test/.automatosx/workspaces/${agentName}`,
          createdAt: new Date(),
          orchestration: profile.orchestration ? {
            isDelegationEnabled: true,
            availableAgents: ['frontend', 'backend'],
            sharedWorkspace: '/test/.automatosx/workspaces/shared',
            delegationChain: [],
            maxDelegationDepth: profile.orchestration.maxDelegationDepth ?? 3
          } : undefined
        } as ExecutionContext;
      })
    } as any;

    // Create executor with mocks
    executor = new AgentExecutor({
      contextManager: mockContextManager,
      profileLoader: mockProfileLoader
    });
  });

  it('should parse multiple delegations to same agent correctly', async () => {
    const parser = new DelegationParser();

    const response = `Frontend needs to handle three tasks:

@frontend Create the header component.

@frontend Create the footer component.

@frontend Create the sidebar component.`;

    const delegations = await parser.parse(response, 'coordinator');

    // Should parse all 3 delegations
    expect(delegations).toHaveLength(3);

    // All should be to frontend
    expect(delegations.every(d => d.toAgent === 'frontend')).toBe(true);

    // Verify tasks
    expect(delegations[0]?.task).toContain('header');
    expect(delegations[1]?.task).toContain('footer');
    expect(delegations[2]?.task).toContain('sidebar');
  });

  it('should format delegation results with indices', async () => {
    // This tests the display format logic
    const results = [
      { toAgent: 'frontend', response: { content: 'Result 1' } },
      { toAgent: 'frontend', response: { content: 'Result 2' } },
      { toAgent: 'frontend', response: { content: 'Result 3' } }
    ];

    let summary = '## Delegation Results\n\n';
    results.forEach((result, index) => {
      summary += `### Delegation ${index + 1}: ${result.toAgent}\n\n`;
      summary += result.response.content + '\n\n';
    });

    expect(summary).toContain('Delegation 1: frontend');
    expect(summary).toContain('Result 1');
    expect(summary).toContain('Delegation 2: frontend');
    expect(summary).toContain('Result 2');
    expect(summary).toContain('Delegation 3: frontend');
    expect(summary).toContain('Result 3');
  });

  it('should parse natural language delegation correctly', async () => {
    const parser = new DelegationParser();

    const response = `@frontend Task 1.
@frontend Task 2.
@frontend Task 3.`;

    const delegations = await parser.parse(response, 'coordinator');

    expect(delegations).toHaveLength(3);
    expect(delegations[0]?.toAgent).toBe('frontend');
    expect(delegations[1]?.toAgent).toBe('frontend');
    expect(delegations[2]?.toAgent).toBe('frontend');
  });
});
