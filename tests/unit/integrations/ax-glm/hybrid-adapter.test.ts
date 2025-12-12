/**
 * GLM Hybrid Adapter Unit Tests
 *
 * Tests for SDK-first execution with CLI fallback for GLM provider.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExecutionRequest, ExecutionResponse } from '../../../../src/types/provider.js';

// Mock logger
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SDK availability and execution
let sdkAvailable = true;
let sdkInitError: Error | null = null;
let sdkExecuteError: Error | null = null;
let sdkResponse: ExecutionResponse = {
  content: 'SDK response',
  model: 'glm-4',
  tokensUsed: { prompt: 10, completion: 20, total: 30 },
  latencyMs: 100,
  finishReason: 'stop',
  cached: false,
};

vi.mock('../../../../src/integrations/ax-glm/sdk-adapter.js', () => ({
  GLMSdkAdapter: class MockGLMSdkAdapter {
    async isAvailable(): Promise<boolean> {
      return sdkAvailable;
    }

    async initialize(): Promise<void> {
      if (sdkInitError) throw sdkInitError;
    }

    async execute(_request: ExecutionRequest): Promise<ExecutionResponse> {
      if (sdkExecuteError) throw sdkExecuteError;
      return sdkResponse;
    }

    async destroy(): Promise<void> {}
  },
}));

// Mock CLI availability and execution
let cliAvailable = true;
let cliInitError: Error | null = null;
let cliExecuteError: Error | null = null;
let cliResponse: ExecutionResponse = {
  content: 'CLI response',
  model: 'glm-4',
  tokensUsed: { prompt: 10, completion: 20, total: 30 },
  latencyMs: 150,
  finishReason: 'stop',
  cached: false,
};
let cliVersion: string | null = '1.0.0';

vi.mock('../../../../src/integrations/ax-glm/cli-wrapper.js', () => ({
  GLMCliWrapper: class MockGLMCliWrapper {
    private command = 'ax-glm';

    async isAvailable(): Promise<boolean> {
      return cliAvailable;
    }

    async initialize(): Promise<void> {
      if (cliInitError) throw cliInitError;
    }

    async execute(_request: ExecutionRequest): Promise<ExecutionResponse> {
      if (cliExecuteError) throw cliExecuteError;
      return cliResponse;
    }

    getVersion(): string | null {
      return cliVersion;
    }

    getCommand(): string {
      return this.command;
    }

    async destroy(): Promise<void> {}
  },
}));

import { GLMHybridAdapter } from '../../../../src/integrations/ax-glm/hybrid-adapter.js';

describe('GLMHybridAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    sdkAvailable = true;
    sdkInitError = null;
    sdkExecuteError = null;
    sdkResponse = {
      content: 'SDK response',
      model: 'glm-4',
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      latencyMs: 100,
      finishReason: 'stop',
      cached: false,
    };
    cliAvailable = true;
    cliInitError = null;
    cliExecuteError = null;
    cliResponse = {
      content: 'CLI response',
      model: 'glm-4',
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      latencyMs: 150,
      finishReason: 'stop',
      cached: false,
    };
    cliVersion = '1.0.0';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with default options', () => {
      const adapter = new GLMHybridAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.getModel()).toBe('glm-4.6');
    });

    it('should create adapter with custom model', () => {
      const adapter = new GLMHybridAdapter({ model: 'glm-4' });
      expect(adapter.getModel()).toBe('glm-4');
    });

    it('should create adapter with custom mode', () => {
      const adapter = new GLMHybridAdapter({ mode: 'sdk' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with CLI mode', () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom timeout', () => {
      const adapter = new GLMHybridAdapter({ timeout: 60000 });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom command', () => {
      const adapter = new GLMHybridAdapter({ command: 'custom-glm' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with API key', () => {
      const adapter = new GLMHybridAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom base URL', () => {
      const adapter = new GLMHybridAdapter({ baseUrl: 'https://custom.api.com' });
      expect(adapter).toBeDefined();
    });

    it('should create adapter with max retries', () => {
      const adapter = new GLMHybridAdapter({ maxRetries: 5 });
      expect(adapter).toBeDefined();
    });
  });

  describe('availability checks', () => {
    it('should execute successfully when CLI is available in cli mode', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      const response = await adapter.execute({ prompt: 'Test' });
      expect(response).toBeDefined();
    });

    it('should execute successfully when SDK or CLI is available in auto mode', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute({ prompt: 'Test' });
      expect(response).toBeDefined();
    });

    it('should fallback to CLI when SDK not available in auto mode', async () => {
      sdkAvailable = false;
      const adapter = new GLMHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute({ prompt: 'Test' });
      expect(response.content).toBe('CLI response');
    });

    it('should throw when neither SDK nor CLI is available', async () => {
      sdkAvailable = false;
      cliAvailable = false;
      const adapter = new GLMHybridAdapter({ mode: 'auto' });
      await expect(adapter.execute({ prompt: 'Test' })).rejects.toThrow();
    });
  });

  describe('execute', () => {
    it('should execute and return response in auto mode', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute({ prompt: 'Test prompt' });

      // In auto mode, it will use whichever is available (SDK or CLI)
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    it('should execute via CLI in cli mode', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      const response = await adapter.execute({ prompt: 'Test prompt' });

      expect(response.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should fall back to CLI when SDK not available', async () => {
      sdkAvailable = false;

      const adapter = new GLMHybridAdapter({ mode: 'auto' });
      const response = await adapter.execute({ prompt: 'Test prompt' });

      expect(response.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should throw when CLI fails in cli mode', async () => {
      cliExecuteError = new Error('CLI execution failed');

      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      await expect(adapter.execute({ prompt: 'Test prompt' })).rejects.toThrow();
    });

    it('should handle request with system prompt', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      const response = await adapter.execute({
        prompt: 'Test prompt',
        systemPrompt: 'You are helpful',
      });

      expect(response).toBeDefined();
    });

    it('should handle request with max tokens', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      const response = await adapter.execute({
        prompt: 'Test prompt',
        maxTokens: 500,
      });

      expect(response).toBeDefined();
    });

    it('should handle request with temperature', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      const response = await adapter.execute({
        prompt: 'Test prompt',
        temperature: 0.7,
      });

      expect(response).toBeDefined();
    });
  });

  describe('getModel', () => {
    it('should return configured model', () => {
      const adapter = new GLMHybridAdapter({ model: 'glm-4.6' });
      expect(adapter.getModel()).toBe('glm-4.6');
    });
  });

  describe('getCommand', () => {
    it('should return default command before initialization', () => {
      const adapter = new GLMHybridAdapter();
      expect(adapter.getCommand()).toBe('ax-glm');
    });

    it('should return configured command', () => {
      const adapter = new GLMHybridAdapter({ command: 'custom-glm' });
      expect(adapter.getCommand()).toBe('custom-glm');
    });

    it('should return CLI wrapper command after CLI initialization', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      await adapter.execute({ prompt: 'Test' });
      expect(adapter.getCommand()).toBe('ax-glm');
    });
  });

  describe('getCLIVersion', () => {
    it('should return null before CLI initialization', () => {
      const adapter = new GLMHybridAdapter();
      expect(adapter.getCLIVersion()).toBeNull();
    });

    it('should return CLI version after CLI initialization', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      await adapter.execute({ prompt: 'Test' });
      expect(adapter.getCLIVersion()).toBe('1.0.0');
    });
  });

  describe('destroy', () => {
    it('should clean up SDK resources', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'sdk' });
      await adapter.execute({ prompt: 'Test' });
      await adapter.destroy();

      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should clean up CLI resources', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      await adapter.execute({ prompt: 'Test' });
      await adapter.destroy();

      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should handle destroy when nothing initialized', async () => {
      const adapter = new GLMHybridAdapter();
      await adapter.destroy();

      expect(adapter.getActiveMode()).toBeNull();
    });
  });

  describe('getActiveMode', () => {
    it('should return null before execution', () => {
      const adapter = new GLMHybridAdapter();
      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should return cli after CLI execution', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'cli' });
      await adapter.execute({ prompt: 'Test' });
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should return mode after execution', async () => {
      const adapter = new GLMHybridAdapter({ mode: 'auto' });
      await adapter.execute({ prompt: 'Test' });
      // In auto mode, it should have selected a mode
      expect(adapter.getActiveMode()).toBeDefined();
    });
  });
});

describe('GLMHybridAdapter Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkAvailable = true;
    sdkInitError = null;
    sdkExecuteError = null;
    cliAvailable = true;
    cliInitError = null;
    cliExecuteError = null;
  });

  it('should fallback to CLI when SDK is not available', async () => {
    sdkAvailable = false;

    const adapter = new GLMHybridAdapter({ mode: 'auto' });
    const response = await adapter.execute({ prompt: 'Test' });

    // Should fallback to CLI
    expect(response.content).toBe('CLI response');
  });

  it('should throw error when CLI fails in cli mode', async () => {
    cliExecuteError = new Error('CLI failed');

    const adapter = new GLMHybridAdapter({ mode: 'cli' });

    await expect(adapter.execute({ prompt: 'Test' })).rejects.toThrow('CLI failed');
  });

  it('should throw error when neither SDK nor CLI is available', async () => {
    sdkAvailable = false;
    cliAvailable = false;

    const adapter = new GLMHybridAdapter({ mode: 'auto' });

    await expect(adapter.execute({ prompt: 'Test' })).rejects.toThrow();
  });
});
