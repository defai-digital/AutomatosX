/**
 * Agent Executor - Retry Mechanism Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentExecutor } from '../../src/agents/executor.js';
import type { RetryConfig } from '../../src/types/config.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { BaseProvider } from '../../src/providers/base-provider.js';

// Mock provider
class MockProvider implements Partial<BaseProvider> {
  name = 'mock';
  type = 'mock' as const;
  private failCount = 0;
  private readonly failUntil: number;

  constructor(failUntil: number = 0) {
    this.failUntil = failUntil;
  }

  async execute(options: any) {
    this.failCount++;

    if (this.failCount <= this.failUntil) {
      const error: any = new Error(`rate_limit: API rate limit exceeded`);
      error.code = 'rate_limit';
      throw error;
    }

    return {
      content: 'Success',
      tokensUsed: { prompt: 10, completion: 10, total: 20 },
      latencyMs: 100,
      model: 'mock-model',
      finishReason: 'stop' as const
    };
  }
}

describe('AgentExecutor - Retry Mechanism', () => {
  let executor: AgentExecutor;
  let context: ExecutionContext;

  beforeEach(() => {
    executor = new AgentExecutor();

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
      provider: new MockProvider() as any,
      task: 'Test task',
      abilities: '',
      memory: [],
      projectDir: '/tmp/test',
      workingDir: '/tmp/test',
      agentWorkspace: '/tmp/test/.automatosx/workspaces/test',
      createdAt: new Date()
    } as any;
  });

  describe('Retry Configuration', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('should retry on retryable errors', async () => {
      const provider = new MockProvider(2); // Fail first 2 attempts
      context.provider = provider as any;

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffFactor: 2
      };

      const result = await executor.execute(context, {
        retry: retryConfig,
        showProgress: false
      });

      expect(result.response.content).toBe('Success');
      expect((provider as any).failCount).toBe(3); // Failed twice, succeeded on third
    });

    it('should fail if max attempts exceeded', async () => {
      const provider = new MockProvider(5); // Fail 5 times
      context.provider = provider as any;

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffFactor: 2
      };

      await expect(
        executor.execute(context, {
          retry: retryConfig,
          showProgress: false
        })
      ).rejects.toThrow('rate_limit');

      expect((provider as any).failCount).toBe(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableProvider = {
        name: 'mock',
        type: 'mock',
        execute: vi.fn().mockRejectedValue(new Error('Syntax error'))
      };

      context.provider = nonRetryableProvider as any;

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffFactor: 2
      };

      await expect(
        executor.execute(context, {
          retry: retryConfig,
          showProgress: false,
        })
      ).rejects.toThrow('Syntax error');

      // Should only try once (no retries for non-retryable errors)
      expect(nonRetryableProvider.execute).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff', async () => {
      const provider = new MockProvider(2);
      context.provider = provider as any;

      const startTime = Date.now();

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2
      };

      await executor.execute(context, {
        retry: retryConfig,
        showProgress: false
      });

      const elapsed = Date.now() - startTime;

      // Should wait at least: 100ms (first retry) + 200ms (second retry) = 300ms
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });

    it('should respect max delay', async () => {
      const provider = new MockProvider(2);
      context.provider = provider as any;

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 500, // Max delay is less than initial delay
        backoffFactor: 2
      };

      const startTime = Date.now();
      await executor.execute(context, {
        retry: retryConfig,
        showProgress: false
      });
      const elapsed = Date.now() - startTime;

      // Should cap at max delay (500ms per retry)
      expect(elapsed).toBeLessThan(2000);
    });

    it('should use custom retryable errors list', async () => {
      const customErrorProvider = {
        name: 'mock',
        type: 'mock',
        execute: vi.fn()
          .mockRejectedValueOnce(new Error('custom_error: My custom error'))
          .mockResolvedValueOnce({
            content: 'Success',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 100,
            model: 'mock-model',
            finishReason: 'stop'
          })
      };

      context.provider = customErrorProvider as any;

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffFactor: 2,
        retryableErrors: ['custom_error']
      };

      const result = await executor.execute(context, {
        retry: retryConfig,
        showProgress: false,
      });

      expect(result.response.content).toBe('Success');
      expect(customErrorProvider.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry with Timeout', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('should timeout even with retry enabled', async () => {
      const slowProvider = {
        name: 'mock',
        type: 'mock',
        execute: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return {
            content: 'Success',
            tokensUsed: { prompt: 10, completion: 10, total: 20 },
            latencyMs: 1000,
            model: 'mock-model',
            finishReason: 'stop'
          };
        })
      };

      context.provider = slowProvider as any;

      await expect(
        executor.execute(context, {
          retry: {
            maxAttempts: 3,
            initialDelay: 10,
            maxDelay: 100,
            backoffFactor: 2
          },
          timeout: 100,
          showProgress: false
        })
      ).rejects.toThrow('timed out');
    });
  });

  describe('Success on First Try', () => {
    it('should not retry if first attempt succeeds', async () => {
      const provider = new MockProvider(0); // Never fails
      context.provider = provider as any;

      const retryConfig: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2
      };

      const startTime = Date.now();
      const result = await executor.execute(context, {
        retry: retryConfig,
        showProgress: false
      });
      const elapsed = Date.now() - startTime;

      expect(result.response.content).toBe('Success');
      expect((provider as any).failCount).toBe(1);
      expect(elapsed).toBeLessThan(50); // No retry delay
    });
  });
});
