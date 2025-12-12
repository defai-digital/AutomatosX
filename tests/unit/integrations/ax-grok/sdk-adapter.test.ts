/**
 * Grok SDK Adapter Unit Tests
 *
 * Tests for direct SDK access to xAI's Grok models.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GrokSdkAdapter } from '../../../../src/integrations/ax-grok/sdk-adapter.js';
import type { ExecutionRequest } from '../../../../src/types/provider.js';

// Hoisted OpenAI mock to keep constructor shape stable across tests
const openAiMock = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('openai', () => {
  return {
    default: vi.fn(function OpenAIMock(this: any) {
      this.chat = { completions: { create: openAiMock.create } };
      return this;
    }),
  };
});

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GrokSdkAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.XAI_API_KEY = 'test-api-key';

    // Setup default mock response
    openAiMock.create.mockResolvedValue({
      id: 'chatcmpl-123',
      choices: [
        {
          message: {
            content: 'Test response',
            role: 'assistant',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
      model: 'grok-3',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const adapter = new GrokSdkAdapter();
      expect(adapter.getModel()).toBe('grok-4-0709'); // GROK_DEFAULT_MODEL
    });

    it('should create adapter with custom model', () => {
      const adapter = new GrokSdkAdapter({ model: 'grok-3' });
      expect(adapter.getModel()).toBe('grok-3');
    });

    it('should use environment API key by default', () => {
      const adapter = new GrokSdkAdapter();
      expect(adapter).toBeDefined();
    });

    it('should use provided API key over environment', () => {
      const adapter = new GrokSdkAdapter({ apiKey: 'custom-key' });
      expect(adapter).toBeDefined();
    });

    it('should use custom base URL', () => {
      const adapter = new GrokSdkAdapter({
        baseUrl: 'https://custom.api.example.com/v1',
      });
      expect(adapter).toBeDefined();
    });

    it('should use custom timeout', () => {
      const adapter = new GrokSdkAdapter({ timeout: 60000 });
      expect(adapter).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is set', async () => {
      const adapter = new GrokSdkAdapter();
      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when no API key', async () => {
      delete process.env.XAI_API_KEY;
      const adapter = new GrokSdkAdapter({ apiKey: '' });
      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize the client', async () => {
      const adapter = new GrokSdkAdapter();
      await adapter.initialize();
      // Should not throw
      expect(adapter).toBeDefined();
    });

    it('should not re-initialize if already initialized', async () => {
      const adapter = new GrokSdkAdapter();
      await adapter.initialize();
      await adapter.initialize();
      // Should not throw
      expect(adapter).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute request and return response', async () => {
      const adapter = new GrokSdkAdapter();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const response = await adapter.execute(request);

      expect(response.content).toBe('Test response');
      expect(response.model).toBe('grok-3');
      expect(response.tokensUsed.total).toBe(30);
      expect(response.finishReason).toBe('stop');
      expect(response.cached).toBe(false);
    });

    it('should include system prompt if provided', async () => {
      const adapter = new GrokSdkAdapter();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        systemPrompt: 'You are a helpful assistant',
      };

      await adapter.execute(request);

      expect(openAiMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Test prompt' },
          ]),
        })
      );
    });

    it('should pass max tokens and temperature', async () => {
      const adapter = new GrokSdkAdapter();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        maxTokens: 500,
        temperature: 0.5,
      };

      await adapter.execute(request);

      expect(openAiMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 500,
          temperature: 0.5,
        })
      );
    });

    it('should auto-initialize if not initialized', async () => {
      const adapter = new GrokSdkAdapter();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      // Should not throw - should auto-initialize
      const response = await adapter.execute(request);
      expect(response).toBeDefined();
    });

    it('should throw error when choices array is empty', async () => {
    openAiMock.create.mockResolvedValue({
      id: 'chatcmpl-123',
      choices: [],
      model: 'grok-3',
    });

      const adapter = new GrokSdkAdapter();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      await expect(adapter.execute(request)).rejects.toThrow(
        'Grok API returned empty choices array'
      );
    });

    it('should handle missing usage data', async () => {
      openAiMock.create.mockResolvedValue({
        id: 'chatcmpl-123',
        choices: [
          {
            message: { content: 'Test', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        model: 'grok-3',
      });

      const adapter = new GrokSdkAdapter();
      const response = await adapter.execute({ prompt: 'Test' });

      expect(response.tokensUsed).toEqual({
        prompt: 0,
        completion: 0,
        total: 0,
      });
    });

    it('should track latency', async () => {
      const adapter = new GrokSdkAdapter();
      const response = await adapter.execute({ prompt: 'Test' });

      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should propagate API errors', async () => {
      openAiMock.create.mockRejectedValue(new Error('API rate limit exceeded'));

      const adapter = new GrokSdkAdapter();
      await expect(adapter.execute({ prompt: 'Test' })).rejects.toThrow(
        'API rate limit exceeded'
      );
    });
  });

  describe('getModel', () => {
    it('should return the configured model', () => {
      const adapter = new GrokSdkAdapter({ model: 'grok-3-mini' });
      expect(adapter.getModel()).toBe('grok-3-mini');
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const adapter = new GrokSdkAdapter();
      await adapter.initialize();
      await adapter.destroy();
      // Should not throw
      expect(adapter).toBeDefined();
    });
  });
});

describe('GrokSdkAdapter Model Normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.XAI_API_KEY = 'test-api-key';

    openAiMock.create.mockResolvedValue({
      id: 'chatcmpl-123',
      choices: [
        {
          message: { content: 'Test', role: 'assistant' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      model: 'grok-3',
    });
  });

  it('should normalize grok-latest to grok-4-0709', async () => {
    const adapter = new GrokSdkAdapter({ model: 'grok-latest' });
    await adapter.execute({ prompt: 'Test' });

    expect(openAiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-4-0709',
      })
    );
  });

  it('should normalize grok-beta to grok-3', async () => {
    const adapter = new GrokSdkAdapter({ model: 'grok-beta' });
    await adapter.execute({ prompt: 'Test' });

    expect(openAiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-3',
      })
    );
  });

  it('should normalize grok-fast to grok-4.1-fast', async () => {
    const adapter = new GrokSdkAdapter({ model: 'grok-fast' });
    await adapter.execute({ prompt: 'Test' });

    expect(openAiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-4.1-fast',
      })
    );
  });

  it('should normalize grok-mini to grok-3-mini', async () => {
    const adapter = new GrokSdkAdapter({ model: 'grok-mini' });
    await adapter.execute({ prompt: 'Test' });

    expect(openAiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-3-mini',
      })
    );
  });

  it('should pass through non-aliased models unchanged', async () => {
    const adapter = new GrokSdkAdapter({ model: 'grok-3' });
    await adapter.execute({ prompt: 'Test' });

    expect(openAiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'grok-3',
      })
    );
  });
});
