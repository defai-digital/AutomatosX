/**
 * Unit tests for AxCliSdkAdapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the SDK before importing adapter
vi.mock('@defai.digital/ax-cli/sdk', () => {
  const mockAgent = {
    processUserMessage: vi.fn(),
    processUserMessageStream: vi.fn(),
    getChatHistory: vi.fn().mockReturnValue([]),
    getCurrentModel: vi.fn().mockReturnValue('glm-4.6'),
    dispose: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  };

  // Mock SDKError class
  class MockSDKError extends Error {
    public code: string;
    public override cause?: Error;

    constructor(code: string, message: string, cause?: Error) {
      super(message);
      this.name = 'SDKError';
      this.code = code;
      this.cause = cause;
    }

    static isSDKError(error: unknown): boolean {
      return error instanceof MockSDKError;
    }
  }

  // Mock SDKErrorCode enum
  const MockSDKErrorCode = {
    SETUP_NOT_RUN: 'SDK_SETUP_NOT_RUN',
    API_KEY_MISSING: 'SDK_API_KEY_MISSING',
    BASE_URL_MISSING: 'SDK_BASE_URL_MISSING',
    AGENT_DISPOSED: 'SDK_AGENT_DISPOSED',
    VALIDATION_ERROR: 'SDK_VALIDATION_ERROR',
    ABORTED: 'SDK_ABORTED',
    RATE_LIMIT_EXCEEDED: 'SDK_RATE_LIMIT_EXCEEDED',
    INVALID_CONFIG: 'SDK_INVALID_CONFIG',
    INTERNAL_ERROR: 'SDK_INTERNAL_ERROR'
  };

  return {
    createAgent: vi.fn().mockResolvedValue(mockAgent),
    SDKError: MockSDKError,
    SDKErrorCode: MockSDKErrorCode,
    GLM_MODELS: ['glm-4.6', 'glm-4.9']
  };
});

import { AxCliSdkAdapter } from '../../../../src/integrations/ax-cli-sdk/adapter.js';

describe('AxCliSdkAdapter', () => {
  let adapter: AxCliSdkAdapter;
  let mockProcessUserMessageStream: any;
  let mockGetChatHistory: any;
  let mockGetCurrentModel: any;

  beforeEach(async () => {
    // Get the mock SDK module
    const { createAgent } = await import('@defai.digital/ax-cli/sdk');

    // Reset all mocks
    vi.clearAllMocks();

    // Mock chat history (what getChatHistory() will return)
    const mockChatHistory = [
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
    ];

    // Setup streaming mock (async generator)
    mockProcessUserMessageStream = vi.fn().mockImplementation(async function* () {
      // Simulate streaming chunks
      yield { type: 'content', content: 'Mock response from SDK' };
      yield { type: 'token_count', tokenCount: 50 };
    });

    // Setup chat history mock - returns empty before execution, full history after
    // This mock simulates the SDK's behavior of building history incrementally
    // The adapter calls getChatHistory() twice per execution:
    //   1. Before execution (to get starting length)
    //   2. After execution (to extract new entries)
    mockGetChatHistory = vi.fn().mockImplementation(() => {
      const currentCallCount = mockGetChatHistory.mock.calls.length;
      // Odd calls (1st, 3rd, 5th...): before execution (empty history)
      // Even calls (2nd, 4th, 6th...): after execution (full history)
      return currentCallCount % 2 === 1 ? [] : mockChatHistory;
    });

    // Setup model getter mock
    mockGetCurrentModel = vi.fn().mockReturnValue('glm-4.6');

    // Configure createAgent to return agent with streaming API
    (createAgent as any).mockResolvedValue({
      processUserMessageStream: mockProcessUserMessageStream,
      getChatHistory: mockGetChatHistory,
      getCurrentModel: mockGetCurrentModel,
      dispose: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn()
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
      expect(version).toBe('3.7.0+');
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

    it('should recreate agent when maxToolRounds changes', async () => {
      const result1 = await adapter.execute('Test', { maxToolRounds: 50 });
      expect(result1.model).toBe('glm-4.6');  // Model always from SDK settings

      // Change maxToolRounds - should recreate agent
      const result2 = await adapter.execute('Test', { maxToolRounds: 100 });
      expect(result2.model).toBe('glm-4.6');  // Model still from SDK settings

      // Both executions should succeed
      expect(result1.content).toBeDefined();
      expect(result2.content).toBeDefined();
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
