/**
 * Qwen Hybrid Adapter Unit Tests
 *
 * Tests for SDK-first execution with CLI fallback for Qwen provider.
 * Uses class-based mocks to properly test the HybridCodexAdapter behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionRequest, ExecutionResponse } from '../../../../src/types/provider.js';

// Mock state variables that can be modified between tests
let sdkAvailable = true;
let cliAvailable = true;
let sdkExecuteError: Error | null = null;
let cliExecuteError: Error | null = null;

// Mock logger
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock response
const createMockResponse = (content: string = 'Test response'): ExecutionResponse => ({
  content,
  model: 'qwen-turbo',
  tokensUsed: { prompt: 10, completion: 20, total: 30 },
  latencyMs: 100,
  finishReason: 'stop',
  cached: false,
});

// Mock SDK adapter with class-based pattern
vi.mock('../../../../src/integrations/qwen-code/sdk-adapter.js', () => ({
  QwenSdkAdapter: class MockQwenSdkAdapter {
    async isAvailable(): Promise<boolean> {
      return sdkAvailable;
    }

    async execute(_request: ExecutionRequest): Promise<ExecutionResponse> {
      if (sdkExecuteError) throw sdkExecuteError;
      return createMockResponse('SDK response');
    }

    async destroy(): Promise<void> {}
  },
}));

// Mock CLI wrapper with class-based pattern
vi.mock('../../../../src/integrations/qwen-code/cli-wrapper.js', () => ({
  QwenCliWrapper: class MockQwenCliWrapper {
    async isAvailable(): Promise<boolean> {
      return cliAvailable;
    }

    async execute(_request: ExecutionRequest): Promise<ExecutionResponse> {
      if (cliExecuteError) throw cliExecuteError;
      return createMockResponse('CLI response');
    }
  },
}));

import { QwenHybridAdapter } from '../../../../src/integrations/qwen-code/hybrid-adapter.js';

describe('QwenHybridAdapter', () => {
  const mockRequest: ExecutionRequest = {
    prompt: 'Test prompt',
    systemPrompt: 'You are a helpful assistant',
    maxTokens: 1000,
    temperature: 0.7,
  };

  beforeEach(() => {
    // Reset mock state
    sdkAvailable = true;
    cliAvailable = true;
    sdkExecuteError = null;
    cliExecuteError = null;
  });

  describe('constructor', () => {
    it('should create adapter with default options', () => {
      const adapter = new QwenHybridAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should create adapter with custom model', () => {
      const adapter = new QwenHybridAdapter({ model: 'qwen-plus' });
      expect(adapter).toBeDefined();
    });

    it('should accept mode option', () => {
      const adapter = new QwenHybridAdapter({ mode: 'sdk' });
      expect(adapter).toBeDefined();
    });

    it('should accept timeout option', () => {
      const adapter = new QwenHybridAdapter({ timeout: 30000 });
      expect(adapter).toBeDefined();
    });

    it('should accept API key option', () => {
      const adapter = new QwenHybridAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should accept CLI command option', () => {
      const adapter = new QwenHybridAdapter({ command: 'qwen-cli' });
      expect(adapter).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute via SDK in sdk mode', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'sdk' });
      const response = await adapter.execute(mockRequest);

      expect(response.content).toBe('SDK response');
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should execute via CLI in cli mode', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'cli' });
      const response = await adapter.execute(mockRequest);

      expect(response.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should prefer SDK in auto mode when available', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute(mockRequest);

      expect(response.content).toBe('SDK response');
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should fall back to CLI when SDK not available in auto mode', async () => {
      sdkAvailable = false;
      const adapter = new QwenHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute(mockRequest);

      expect(response.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should fall back to CLI when SDK execute fails in auto mode', async () => {
      sdkExecuteError = new Error('SDK error');
      const adapter = new QwenHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute(mockRequest);

      expect(response.content).toBe('CLI response');
    });

    it('should throw when SDK not available in sdk mode', async () => {
      sdkAvailable = false;
      const adapter = new QwenHybridAdapter({ mode: 'sdk' });

      await expect(adapter.execute(mockRequest)).rejects.toThrow();
    });
  });

  describe('getActiveMode', () => {
    it('should return null before execution', () => {
      const adapter = new QwenHybridAdapter();
      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should return sdk after SDK execution', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'sdk' });
      await adapter.execute(mockRequest);
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should return cli after CLI execution', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'cli' });
      await adapter.execute(mockRequest);
      expect(adapter.getActiveMode()).toBe('cli');
    });
  });

  describe('destroy', () => {
    it('should clean up adapters', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'sdk' });
      await adapter.execute(mockRequest);
      await adapter.destroy();
      // Should not throw
    });

    it('should handle destroy when nothing initialized', async () => {
      const adapter = new QwenHybridAdapter();
      await adapter.destroy();
      // Should not throw
    });
  });
});

describe('QwenHybridAdapter Circuit Breaker', () => {
  const mockRequest: ExecutionRequest = {
    prompt: 'Test prompt',
  };

  beforeEach(() => {
    sdkAvailable = true;
    cliAvailable = true;
    sdkExecuteError = null;
    cliExecuteError = null;
  });

  it('should fall back to CLI after SDK failures', async () => {
    sdkExecuteError = new Error('SDK error');
    const adapter = new QwenHybridAdapter({ mode: 'auto' });
    const response = await adapter.execute(mockRequest);

    expect(response.content).toBe('CLI response');
  });

  it('should use SDK when available in auto mode', async () => {
    const adapter = new QwenHybridAdapter({ mode: 'auto' });
    const response = await adapter.execute(mockRequest);

    expect(response.content).toBe('SDK response');
  });
});

describe('QwenHybridAdapter Error Handling', () => {
  const mockRequest: ExecutionRequest = {
    prompt: 'Test prompt',
  };

  beforeEach(() => {
    sdkAvailable = true;
    cliAvailable = true;
    sdkExecuteError = null;
    cliExecuteError = null;
  });

  it('should propagate SDK errors in sdk mode', async () => {
    sdkExecuteError = new Error('SDK API error');
    const adapter = new QwenHybridAdapter({ mode: 'sdk' });

    await expect(adapter.execute(mockRequest)).rejects.toThrow('SDK API error');
  });

  it('should propagate CLI errors in cli mode', async () => {
    cliExecuteError = new Error('CLI error');
    const adapter = new QwenHybridAdapter({ mode: 'cli' });

    await expect(adapter.execute(mockRequest)).rejects.toThrow('CLI error');
  });

  it('should throw when both SDK and CLI fail in auto mode', async () => {
    sdkExecuteError = new Error('SDK error');
    cliExecuteError = new Error('CLI error');
    const adapter = new QwenHybridAdapter({ mode: 'auto' });

    await expect(adapter.execute(mockRequest)).rejects.toThrow();
  });
});

describe('QwenHybridAdapter Integration Scenarios', () => {
  const mockRequest: ExecutionRequest = {
    prompt: 'Test prompt',
  };

  beforeEach(() => {
    sdkAvailable = true;
    cliAvailable = true;
    sdkExecuteError = null;
    cliExecuteError = null;
  });

  describe('Mode transitions', () => {
    it('should maintain mode after successful execution', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'sdk' });

      await adapter.execute(mockRequest);
      expect(adapter.getActiveMode()).toBe('sdk');

      await adapter.execute(mockRequest);
      expect(adapter.getActiveMode()).toBe('sdk');
    });
  });

  describe('Concurrent execution', () => {
    it('should handle multiple concurrent requests', async () => {
      const adapter = new QwenHybridAdapter({ mode: 'auto' });

      const results = await Promise.all([
        adapter.execute(mockRequest),
        adapter.execute(mockRequest),
        adapter.execute(mockRequest),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(response => {
        expect(response.content).toBeTruthy();
      });
    });
  });
});
