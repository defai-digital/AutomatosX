/**
 * Tests for OpenAIProvider - Hybrid Codex Provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the HybridCodexAdapter
vi.mock('../../../src/integrations/openai-codex/hybrid-adapter.js', () => ({
  HybridCodexAdapter: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      content: 'Test response',
      tokenCount: 100
    }),
    getActiveMode: vi.fn().mockReturnValue('cli'),
    switchToCliMode: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('OpenAIProvider', () => {
  const mockConfig = {
    name: 'openai',
    enabled: true,
    priority: 1,
    timeout: 120000
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    // Default to mock mode for most tests
    process.env.AX_MOCK_PROVIDERS = 'true';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with config', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const { logger } = await import('../../../src/shared/logging/logger.js');

      const provider = new OpenAIProvider(mockConfig);

      expect(provider).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        '[OpenAI/Codex] Initialized',
        { mode: 'auto' }
      );
    });

    it('should use specified mode from config', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const { logger } = await import('../../../src/shared/logging/logger.js');

      const provider = new OpenAIProvider({ ...mockConfig, mode: 'cli' });

      expect(provider).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        '[OpenAI/Codex] Initialized',
        { mode: 'cli' }
      );
    });
  });

  describe('execute', () => {
    it('should return mock response when AX_MOCK_PROVIDERS is true', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';

      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      const result = await provider.execute({ prompt: 'Test prompt' });

      expect(result.content).toContain('[Mock OpenAI/Codex Response]');
      expect(result.model).toBe('codex');
      expect(result.tokensUsed).toEqual({ prompt: 10, completion: 20, total: 30 });
      expect(result.finishReason).toBe('stop');
    });

    it('should throw error if provider is destroyed', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      await provider.destroy();

      await expect(provider.execute({ prompt: 'Test' }))
        .rejects.toThrow('OpenAIProvider has been destroyed');
    });
  });

  describe('capabilities', () => {
    it('should return correct capabilities', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      const capabilities = provider.capabilities;

      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsEmbedding).toBe(false);
      expect(capabilities.supportsVision).toBe(true);
      expect(capabilities.maxContextTokens).toBe(128000);
      expect(capabilities.supportedModels).toContain('codex');
    });
  });

  describe('getActiveMode', () => {
    it('should return null when adapter not initialized', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      const mode = provider.getActiveMode();

      expect(mode).toBeNull();
    });
  });

  describe('switchToCliMode', () => {
    it('should be safe when adapter not initialized', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      // Should not throw
      expect(() => provider.switchToCliMode()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should set destroyed flag', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      await provider.destroy();

      // Try to execute - should fail
      await expect(provider.execute({ prompt: 'Test' }))
        .rejects.toThrow('OpenAIProvider has been destroyed');
    });

    it('should handle destroy when adapter not initialized', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      // Should not throw
      await expect(provider.destroy()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      // Multiple destroys should not throw
      await provider.destroy();
      await expect(provider.destroy()).resolves.not.toThrow();
    });
  });

  describe('mock response', () => {
    it('should return consistent mock response format', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';

      const { OpenAIProvider } = await import('../../../src/providers/openai-provider.js');
      const provider = new OpenAIProvider(mockConfig);

      const result = await provider.execute({ prompt: 'Test' });

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.finishReason).toBe('stop');
      expect(typeof result.content).toBe('string');
    });
  });
});
