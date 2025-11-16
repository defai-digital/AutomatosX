/**
 * Agent Executor Prompt Enhancement Tests
 *
 * Tests for Phase 1.1 of path standardization initiative.
 * Verifies that the executor prompt includes proper WorkspaceManager usage guidelines.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';

describe('AgentExecutor - Prompt Enhancement (Path Standardization)', () => {
  let executor: AgentExecutor;
  let mockProvider: Provider;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    executor = new AgentExecutor();

    // Mock provider
    mockProvider = {
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

    // Mock context
    mockContext = {
      agent: {
        name: 'Test Agent',
        role: 'tester',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        abilities: ['ability1', 'ability2'],
        provider: 'mock',
        temperature: 0.7,
        model: 'mock-model'
      },
      task: 'Test task',
      memory: [],
      projectDir: '/test/project',
      workingDir: '/test/project',
      agentWorkspace: '/test/project/.automatosx/workspaces/test-agent',
      provider: mockProvider,
      abilities: '# Ability 1\nTest ability',
      createdAt: new Date(),
      orchestration: {
        isDelegationEnabled: true,
        availableAgents: [],
        sharedWorkspace: '/test/project/.automatosx/shared',
        delegationChain: [],
        maxDelegationDepth: 2
      }
    };
  });

  describe('File Writing Guidelines Section', () => {
    it('should include "File Writing Guidelines" header in prompt', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      expect(executeCall).toHaveBeenCalled();

      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;
      expect(prompt).toBeDefined();
      expect(prompt).toContain('**File Writing Guidelines:**');
    });

    it('should include WorkspaceManager API usage example', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('ALWAYS use WorkspaceManager for workspace file operations');
      expect(prompt).toContain('await workspaceManager.writeTmp(\'report.md\', content);');
    });

    it('should include prohibition against relative paths', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('DO NOT use relative paths like \'tmp/\' or \'./tmp/\' for workspace files');
    });

    it('should include prohibition against direct fs.writeFile() for workspace files', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('DO NOT use direct fs.writeFile() for workspace files (automatosx/tmp/, automatosx/PRD/)');
    });

    it('should clarify that normal file I/O is acceptable for project files', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('For project files outside workspace (src/, tests/, docs/), use normal file I/O');
    });
  });

  describe('Organization Guidelines Section (existing)', () => {
    it('should still include "Organization Guidelines" header', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('**Organization Guidelines (NOT restrictions):**');
    });

    it('should still include workspace path preferences', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('Prefer automatosx/PRD/ for planning documents');
      expect(prompt).toContain('Prefer automatosx/tmp/ for temporary files');
    });
  });

  describe('Temporary Workspace Section (existing)', () => {
    it('should include temporary workspace path', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      expect(prompt).toContain('**Temporary workspace:**');
      expect(prompt).toContain('/test/project/automatosx/tmp');
    });
  });

  describe('Prompt Section Ordering', () => {
    it('should place File Writing Guidelines after Organization Guidelines', async () => {
      await executor.execute(mockContext);

      const executeCall = mockProvider.execute as ReturnType<typeof vi.fn>;
      const prompt = executeCall.mock.calls[0]?.[0]?.prompt as string | undefined;

      const orgGuidelinesIndex = prompt?.indexOf('**Organization Guidelines (NOT restrictions):**') ?? -1;
      const fileGuidelinesIndex = prompt?.indexOf('**File Writing Guidelines:**') ?? -1;

      expect(orgGuidelinesIndex).toBeGreaterThan(-1);
      expect(fileGuidelinesIndex).toBeGreaterThan(-1);
      expect(fileGuidelinesIndex).toBeGreaterThan(orgGuidelinesIndex);
    });
  });
});
