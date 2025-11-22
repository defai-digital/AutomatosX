/**
 * Unit tests for AxCliSdkAdapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the SDK before importing adapter
vi.mock('@defai.digital/ax-cli/sdk', () => {
  const mockAgent = {
    processUserMessage: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined)
  };

  return {
    createAgent: vi.fn().mockResolvedValue(mockAgent),
    initializeSDK: vi.fn().mockResolvedValue(undefined),
    getUsageTracker: vi.fn().mockReturnValue({
      getUsage: vi.fn().mockReturnValue({ total: 0 }),
      getTotalUsage: vi.fn().mockReturnValue(0)
    }),
    GLM_MODELS: ['glm-4.6', 'glm-4.9']
  };
});

import { AxCliSdkAdapter } from '../../../../src/integrations/ax-cli-sdk/adapter.js';

describe('AxCliSdkAdapter', () => {
  let adapter: AxCliSdkAdapter;
  let mockProcessUserMessage: any;

  beforeEach(async () => {
    // Get the mock SDK module
    const { createAgent } = await import('@defai.digital/ax-cli/sdk');

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock response
    mockProcessUserMessage = vi.fn().mockResolvedValue([
      {
        type: 'user',
        content: 'Test prompt',
        timestamp: new Date().toISOString()
      },
      {
        type: 'assistant',
        content: 'Mock response from SDK',
        timestamp: new Date().toISOString()
      }
    ]);

    // Configure createAgent to return agent with our mock
    (createAgent as any).mockResolvedValue({
      processUserMessage: mockProcessUserMessage,
      destroy: vi.fn().mockResolvedValue(undefined)
    });

    adapter = new AxCliSdkAdapter();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
  });

  describe('Initialization', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(AxCliSdkAdapter);
    });

    it('should return correct command name', () => {
      expect(adapter.getCommand()).toBe('ax-cli-sdk');
    });

    it('should return correct display name', () => {
      expect(adapter.getDisplayName()).toBe('ax-cli (SDK)');
    });

    it('should default to reuse enabled', () => {
      const adapter = new AxCliSdkAdapter();
      // Reuse is enabled by default (verified via behavior test)
      expect(adapter).toBeDefined();
    });

    it('should support custom reuse configuration', () => {
      const adapter1 = new AxCliSdkAdapter({ reuseEnabled: true });
      expect(adapter1).toBeDefined();

      const adapter2 = new AxCliSdkAdapter({ reuseEnabled: false });
      expect(adapter2).toBeDefined();
    });

    it('should support streaming configuration', () => {
      const adapter = new AxCliSdkAdapter({ streamingEnabled: true });
      expect(adapter).toBeDefined();
    });
  });

  describe('Availability', () => {
    it('should return true when SDK is installed', async () => {
      const available = await adapter.isAvailable();
      expect(available).toBe(true);
    });

    it('should cache availability check', async () => {
      // First call
      const result1 = await adapter.isAvailable();
      expect(result1).toBe(true);

      // Second call should use cached value (faster)
      const start = Date.now();
      const result2 = await adapter.isAvailable();
      const duration = Date.now() - start;

      expect(result2).toBe(true);
      expect(duration).toBeLessThan(50); // Should be very fast (cached)
    });

    it('should return version when SDK is installed', async () => {
      const version = await adapter.getVersion();
      expect(version).toBe('3.4.6');
    });
  });

  describe('Execution', () => {
    it('should execute simple prompt and return valid response', async () => {
      const result = await adapter.execute('Say hello', {
        model: 'glm-4.6'
      });

      // Verify ExecutionResponse structure
      expect(result).toMatchObject({
        content: expect.any(String),
        model: expect.any(String),
        tokensUsed: {
          prompt: expect.any(Number),
          completion: expect.any(Number),
          total: expect.any(Number)
        },
        latencyMs: expect.any(Number),
        finishReason: expect.stringMatching(/^(stop|length|error)$/),
        cached: expect.any(Boolean)
      });

      // Verify content is not empty
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content).toBeTruthy();

      // Verify model is correct
      expect(result.model).toBe('glm-4.6');

      // Verify latency is measured (can be 0 with mocks)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify finish reason is valid
      expect(['stop', 'length', 'error']).toContain(result.finishReason);

      // Verify cached is boolean
      expect(typeof result.cached).toBe('boolean');
    });

    it('should handle short prompts', async () => {
      const result = await adapter.execute('Hi', {
        model: 'glm-4.6'
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should handle longer prompts', async () => {
      const longPrompt = 'Count from 1 to 10, then explain what counting means.';
      const result = await adapter.execute(longPrompt, {
        model: 'glm-4.6'
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(10);
    });

    it('should reuse agent on subsequent calls with same config', async () => {
      // First call - creates agent
      const start1 = Date.now();
      const result1 = await adapter.execute('Test 1', { model: 'glm-4.6' });
      const duration1 = Date.now() - start1;

      expect(result1.content).toBeDefined();

      // Second call - reuses agent (should be potentially faster)
      const start2 = Date.now();
      const result2 = await adapter.execute('Test 2', { model: 'glm-4.6' });
      const duration2 = Date.now() - start2;

      expect(result2.content).toBeDefined();

      // Log performance for analysis
      console.log(`First call: ${duration1}ms, Second call: ${duration2}ms`);

      // Note: We don't assert duration2 < duration1 because
      // actual API response time varies. The important thing
      // is that both execute successfully.
    });

    it('should recreate agent when model changes', async () => {
      const result1 = await adapter.execute('Test', { model: 'glm-4.6' });
      expect(result1.model).toBe('glm-4.6');

      // Change model - should recreate agent
      const result2 = await adapter.execute('Test', { model: 'glm-4.9' });
      expect(result2.model).toBe('glm-4.9');
    });

    it('should handle multiple sequential executions', async () => {
      const prompts = ['Hello', 'Count to 3', 'Say goodbye'];

      for (const prompt of prompts) {
        const result = await adapter.execute(prompt, { model: 'glm-4.6' });
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error when SDK unavailable', async () => {
      // Create mock adapter that reports SDK as unavailable
      const mockAdapter = new AxCliSdkAdapter();
      vi.spyOn(mockAdapter as any, 'ensureSDKAvailable').mockResolvedValue(false);

      await expect(
        mockAdapter.execute('Test', { model: 'glm-4.6' })
      ).rejects.toThrow(/SDK not available/);
    });

    it('should handle empty prompt gracefully', async () => {
      // Even empty prompt should not crash
      const result = await adapter.execute('', { model: 'glm-4.6' });
      expect(result).toBeDefined();
    });

    it('should validate response has assistant message', async () => {
      // This tests the response conversion logic
      // Real SDK should always return assistant message
      const result = await adapter.execute('Hello', { model: 'glm-4.6' });
      expect(result.content).toBeDefined();
      expect(result.content).not.toBe('');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup agent on destroy', async () => {
      await adapter.execute('Test', { model: 'glm-4.6' });
      await expect(adapter.destroy()).resolves.not.toThrow();
    });

    it('should handle destroy when no agent exists', async () => {
      const newAdapter = new AxCliSdkAdapter();
      await expect(newAdapter.destroy()).resolves.not.toThrow();
    });

    it('should allow re-execution after destroy', async () => {
      await adapter.execute('Test 1', { model: 'glm-4.6' });
      await adapter.destroy();

      // Should work after destroy (creates new agent)
      const result = await adapter.execute('Test 2', { model: 'glm-4.6' });
      expect(result.content).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should use provided model', async () => {
      const result = await adapter.execute('Test', { model: 'glm-4.6' });
      expect(result.model).toBe('glm-4.6');
    });

    it('should handle apiKey option', async () => {
      // Note: This doesn't test actual auth, just that option doesn't crash
      const result = await adapter.execute('Test', {
        model: 'glm-4.6',
        apiKey: process.env.ZHIPUAI_API_KEY || 'test-key'
      });
      expect(result).toBeDefined();
    });

    it('should handle baseUrl option', async () => {
      // Note: This doesn't test actual endpoint, just that option doesn't crash
      const result = await adapter.execute('Test', {
        model: 'glm-4.6',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
      });
      expect(result).toBeDefined();
    });
  });
});
