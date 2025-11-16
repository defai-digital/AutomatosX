/**
 * Agent Executor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { Provider, ExecutionResponse } from '../../src/types/provider.js';

describe('AgentExecutor', () => {
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
      createdAt: new Date()
    };
  });

  describe('execute', () => {
    it('should execute successfully and return result', async () => {
      const result = await executor.execute(mockContext, { showProgress: false });

      expect(result).toBeDefined();
      expect(result.response.content).toBe('Mock response');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.context).toBe(mockContext);
      expect(mockProvider.execute).toHaveBeenCalledWith({
        prompt: expect.stringContaining('Test task'),
        systemPrompt: 'You are a test agent',
        model: 'mock-model',
        temperature: 0.7,
        maxTokens: undefined
      });
    });

    it('should build prompt with abilities', async () => {
      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('# Your Abilities')
        })
      );
    });

    it('should build prompt with memory', async () => {
      mockContext.memory = [
        {
          id: 1,
          content: 'Previous task result',
          embedding: [],
          metadata: {
            type: 'task',
            source: 'test',
            agentId: 'test'
          },
          createdAt: new Date(),
          accessCount: 1,
          score: 0.95
        }
      ];

      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('# Relevant Context from Memory')
        })
      );
    });

    it('should include memory relevance score in prompt', async () => {
      mockContext.memory = [
        {
          id: 1,
          content: 'Previous task result',
          embedding: [],
          metadata: {
            type: 'task',
            source: 'test',
            agentId: 'test'
          },
          createdAt: new Date(),
          accessCount: 1,
          score: 0.85
        }
      ];

      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('relevance: 85.0%')
        })
      );
    });

    it('should handle verbose mode', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executor.execute(mockContext, { verbose: true, showProgress: false });

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should enhance error with context on failure', async () => {
      const providerError = new Error('Provider execution failed');
      mockProvider.execute = vi.fn().mockRejectedValue(providerError);

      await expect(
        executor.execute(mockContext, { showProgress: false })
      ).rejects.toThrow('Provider execution failed');

      try {
        await executor.execute(mockContext, { showProgress: false });
      } catch (error: any) {
        expect(error.context).toBeDefined();
        expect(error.context.agent).toBe('Test Agent');
        expect(error.context.provider).toBe('mock');
        expect(error.context.model).toBe('mock-model');
        expect(error.context.task).toBe('Test task');
      }
    });

    it('should truncate long task in error context', async () => {
      const longTask = 'A'.repeat(150);
      mockContext.task = longTask;
      mockProvider.execute = vi.fn().mockRejectedValue(new Error('Provider failed'));

      try {
        await executor.execute(mockContext, { showProgress: false });
      } catch (error: any) {
        expect(error.context.task).toHaveLength(103); // 100 + '...'
        expect(error.context.task).toContain('...');
      }
    });

    it('should preserve error stack trace', async () => {
      const providerError = new Error('Provider failed');
      providerError.stack = 'Original stack trace';
      mockProvider.execute = vi.fn().mockRejectedValue(providerError);

      try {
        await executor.execute(mockContext, { showProgress: false });
      } catch (error: any) {
        expect(error.stack).toBe('Original stack trace');
      }
    });
  });

  describe('displayResult', () => {
    it('should display basic result', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = {
        response: {
          content: 'Test response',
          tokensUsed: {
            prompt: 10,
            completion: 20,
            total: 30
          },
          latencyMs: 100,
          model: 'mock-model',
          finishReason: 'stop' as const
        },
        duration: 150,
        context: mockContext
      };

      executor.displayResult(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should display metrics in verbose mode', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = {
        response: {
          content: 'Test response',
          tokensUsed: {
            prompt: 10,
            completion: 20,
            total: 30
          },
          latencyMs: 100,
          model: 'mock-model',
          finishReason: 'stop' as const
        },
        duration: 150,
        context: mockContext
      };

      executor.displayResult(result, { verbose: true });

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });

  describe('displayError', () => {
    it('should display error with formatter', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Test error');
      executor.displayError(error, 'test-agent');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should display error in verbose mode', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Test error');
      executor.displayError(error, 'test-agent', { verbose: true });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('buildPrompt', () => {
    it('should build prompt with task only', async () => {
      mockContext.abilities = '';
      mockContext.memory = [];

      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/^# Task\n\nTest task$/)
        })
      );
    });

    it('should build prompt with abilities and task', async () => {
      mockContext.abilities = '# Ability 1\nTest ability';
      mockContext.memory = [];

      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('# Your Abilities')
        })
      );
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('# Task')
        })
      );
    });

    it('should build prompt with memory without score', async () => {
      mockContext.memory = [
        {
          id: 1,
          content: 'Previous task',
          embedding: [],
          metadata: {
            type: 'task',
            source: 'test',
            agentId: 'test'
          },
          createdAt: new Date(),
          accessCount: 1
          // No score
        }
      ];

      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('## Memory 1\n')
        })
      );
    });

    it('should build prompt with multiple memory entries', async () => {
      mockContext.memory = [
        {
          id: 1,
          content: 'Memory 1',
          embedding: [],
          metadata: {
            type: 'task',
            source: 'test',
            agentId: 'test'
          },
          createdAt: new Date(),
          accessCount: 1,
          score: 0.9
        },
        {
          id: 2,
          content: 'Memory 2',
          embedding: [],
          metadata: {
            type: 'task',
            source: 'test',
            agentId: 'test'
          },
          createdAt: new Date(),
          accessCount: 1,
          score: 0.8
        }
      ];

      await executor.execute(mockContext, { showProgress: false });

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('## Memory 1')
        })
      );
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('## Memory 2')
        })
      );
    });
  });
});
