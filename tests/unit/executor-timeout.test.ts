/**
 * Agent Executor - Timeout Handling Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { ExecutionContext } from '../../src/types/agent.js';

describe('AgentExecutor - Timeout Handling', () => {
  let executor: AgentExecutor;
  let context: ExecutionContext;

  beforeEach(() => {
    executor = new AgentExecutor();
  });

  describe('Basic Timeout', () => {
    it('should timeout long-running execution', async () => {
      const slowProvider = {
        name: 'slow-mock',
        type: 'mock',
        execute: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          return {
            content: 'Too slow',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 5000,
            model: 'mock-model',
            finishReason: 'stop'
          };
        })
      };

      context = {
        agent: {
          name: 'test',
          role: 'assistant',
          description: 'Test agent',
          systemPrompt: 'Test',
          abilities: [],
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000
        },
        provider: slowProvider as any,
        task: 'Slow task',
        abilities: '',
        memory: [],
        projectDir: '/tmp/test',
        workingDir: '/tmp/test',
        agentWorkspace: '/tmp/test/.automatosx/workspaces/test',
        createdAt: new Date()
      } as any;

      await expect(
        executor.execute(context, {
          timeout: 100,
          showProgress: false
        })
      ).rejects.toThrow(/timed out after 100ms/);
    });

    it('should complete fast execution before timeout', async () => {
      const fastProvider = {
        name: 'fast-mock',
        type: 'mock',
        execute: vi.fn().mockResolvedValue({
          content: 'Fast response',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 50,
          model: 'mock-model',
          finishReason: 'stop'
        })
      };

      context = {
        agent: {
          name: 'test',
          role: 'assistant',
          description: 'Test agent',
          systemPrompt: 'Test',
          abilities: [],
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000
        },
        provider: fastProvider as any,
        task: 'Fast task',
        abilities: '',
        memory: [],
        projectDir: '/tmp/test',
        workingDir: '/tmp/test',
        agentWorkspace: '/tmp/test/.automatosx/workspaces/test',
        createdAt: new Date()
      } as any;

      const result = await executor.execute(context, {
        timeout: 1000,
        showProgress: false
      });

      expect(result.response.content).toBe('Fast response');
    });

    it('should work with different timeout values', async () => {
      const variableProvider = {
        name: 'variable-mock',
        type: 'mock',
        execute: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
          return {
            content: 'Response',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 150,
            model: 'mock-model',
            finishReason: 'stop'
          };
        })
      };

      context = {
        agent: {
          name: 'test',
          role: 'assistant',
          description: 'Test agent',
          systemPrompt: 'Test',
          abilities: [],
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000
        },
        provider: variableProvider as any,
        task: 'Task',
        abilities: '',
        memory: [],
        projectDir: '/tmp/test',
        workingDir: '/tmp/test',
        agentWorkspace: '/tmp/test/.automatosx/workspaces/test',
        createdAt: new Date()
      } as any;

      // Should timeout
      await expect(
        executor.execute(context, { timeout: 100, showProgress: false })
      ).rejects.toThrow(/timed out/);

      // Should succeed
      const result = await executor.execute(context, { timeout: 300, showProgress: false });
      expect(result.response.content).toBe('Response');
    });
  });

  // Streaming timeout tests removed - streaming functionality has been removed from the system

  describe('No Timeout', () => {
    it('should execute without timeout when not specified', async () => {
      const normalProvider = {
        name: 'normal-mock',
        type: 'mock',
        execute: vi.fn().mockResolvedValue({
          content: 'Normal response',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 100,
          model: 'mock-model',
          finishReason: 'stop'
        })
      };

      context = {
        agent: {
          name: 'test',
          role: 'assistant',
          description: 'Test agent',
          systemPrompt: 'Test',
          abilities: [],
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000
        },
        provider: normalProvider as any,
        task: 'Normal task',
        abilities: '',
        memory: [],
        projectDir: '/tmp/test',
        workingDir: '/tmp/test',
        agentWorkspace: '/tmp/test/.automatosx/workspaces/test',
        createdAt: new Date()
      } as any;

      const result = await executor.execute(context, { showProgress: false });
      expect(result.response.content).toBe('Normal response');
    });
  });

  describe('Long Timeout', () => {
    it('should handle very long timeouts', async () => {
      const provider = {
        name: 'mock',
        type: 'mock',
        execute: vi.fn().mockResolvedValue({
          content: 'Response',
          tokensUsed: { prompt: 10, completion: 10, total: 20 },
          latencyMs: 50,
          model: 'mock-model',
          finishReason: 'stop'
        })
      };

      context = {
        agent: {
          name: 'test',
          role: 'assistant',
          description: 'Test agent',
          systemPrompt: 'Test',
          abilities: [],
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000
        },
        provider: provider as any,
        task: 'Task',
        abilities: '',
        memory: [],
        projectDir: '/tmp/test',
        workingDir: '/tmp/test',
        agentWorkspace: '/tmp/test/.automatosx/workspaces/test',
        createdAt: new Date()
      } as any;

      const result = await executor.execute(context, {
        timeout: 900000, // 15 minutes
        showProgress: false
      });

      expect(result.response.content).toBe('Response');
    });
  });
});
