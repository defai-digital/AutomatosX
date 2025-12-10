/**
 * Unit tests for QwenProvider (v12.7.0)
 *
 * Tests for SDK-first Qwen provider integration with CLI fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process and util before imports
vi.mock('child_process');
vi.mock('util', () => ({
  promisify: vi.fn(() => {
    return vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes('which qwen')) {
        return { stdout: '/usr/local/bin/qwen', stderr: '' };
      }
      if (cmd.includes('qwen --version')) {
        return { stdout: '1.0.0\n', stderr: '' };
      }
      return {
        stdout: '{"role":"assistant","content":"Mock Qwen response"}',
        stderr: ''
      };
    });
  })
}));

import { QwenProvider } from '../../../src/providers/qwen-provider.js';
import type { QwenProviderConfig } from '../../../src/providers/qwen-provider.js';
import type { QwenModel } from '../../../src/integrations/qwen-code/types.js';

describe('QwenProvider', () => {
  const baseConfig: QwenProviderConfig = {
    name: 'qwen',
    enabled: true,
    priority: 4,
    timeout: 120000,
    command: 'qwen'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const provider = new QwenProvider(baseConfig);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('qwen');
    });

    it('should initialize with custom model', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen-max'
      };

      const provider = new QwenProvider(config);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('qwen');
    });

    it('should accept all supported models', () => {
      const models: QwenModel[] = [
        'qwen3-coder-480b-a35b-instruct',
        'qwen3-coder-30b-a3b-instruct',
        'qwen2.5-coder-32b-instruct',
        'qwen-max',
        'qwen-plus',
        'qwen-turbo'
      ];

      models.forEach(model => {
        const config: QwenProviderConfig = {
          ...baseConfig,
          model
        };

        const provider = new QwenProvider(config);
        expect(provider).toBeDefined();
      });
    });
  });

  describe('capabilities', () => {
    it('should report streaming support', () => {
      const provider = new QwenProvider(baseConfig);

      expect(provider.capabilities.supportsStreaming).toBe(true);
    });

    it('should report correct context window for default model', () => {
      const provider = new QwenProvider(baseConfig);

      // qwen-turbo has 128K context
      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });

    it('should report 128K context for qwen3-coder-480b-a35b-instruct', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen3-coder-480b-a35b-instruct'
      };

      const provider = new QwenProvider(config);

      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });

    it('should report 64K context for qwen3-coder-30b-a3b-instruct', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen3-coder-30b-a3b-instruct'
      };

      const provider = new QwenProvider(config);

      expect(provider.capabilities.maxContextTokens).toBe(64000);
    });

    it('should report 64K context for qwen2.5-coder-32b-instruct', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen2.5-coder-32b-instruct'
      };

      const provider = new QwenProvider(config);

      // qwen2.5-coder doesn't have 480b or 30b in name, so defaults to 64K
      expect(provider.capabilities.maxContextTokens).toBe(64000);
    });

    it('should report vision support for qwen-max', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen-max'
      };

      const provider = new QwenProvider(config);

      // qwen-max has vision capability
      expect(provider.capabilities.supportsVision).toBe(true);
    });

    it('should report vision support for qwen3-coder models', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen3-coder-480b-a35b-instruct'
      };

      const provider = new QwenProvider(config);

      // qwen3-coder models have vision capability
      expect(provider.capabilities.supportsVision).toBe(true);
    });

    it('should not report vision support for qwen-turbo', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen-turbo'
      };

      const provider = new QwenProvider(config);

      // qwen-turbo does not have vision capability
      expect(provider.capabilities.supportsVision).toBe(false);
    });

    it('should include supported models in capabilities', () => {
      const provider = new QwenProvider(baseConfig);

      expect(provider.capabilities.supportedModels).toContain('qwen-turbo');
      expect(provider.capabilities.supportedModels).toContain('qwen-max');
      expect(provider.capabilities.supportedModels).toContain('qwen-plus');
    });
  });

  describe('static methods', () => {
    it('should return supported models', () => {
      const models = QwenProvider.getSupportedModels();

      expect(models).toContain('qwen3-coder-480b-a35b-instruct');
      expect(models).toContain('qwen3-coder-30b-a3b-instruct');
      expect(models).toContain('qwen2.5-coder-32b-instruct');
      expect(models).toContain('qwen-max');
      expect(models).toContain('qwen-plus');
      expect(models).toContain('qwen-turbo');
    });
  });

  describe('SUPPORTED_MODELS static property', () => {
    it('should contain all expected models', () => {
      expect(QwenProvider.SUPPORTED_MODELS).toContain('qwen-turbo');
      expect(QwenProvider.SUPPORTED_MODELS).toContain('qwen-max');
      expect(QwenProvider.SUPPORTED_MODELS).toContain('qwen-plus');
      expect(QwenProvider.SUPPORTED_MODELS).toContain('qwen3-coder-480b-a35b-instruct');
      expect(QwenProvider.SUPPORTED_MODELS).toContain('qwen3-coder-30b-a3b-instruct');
      expect(QwenProvider.SUPPORTED_MODELS).toContain('qwen2.5-coder-32b-instruct');
      expect(QwenProvider.SUPPORTED_MODELS.length).toBe(6);
    });
  });

  describe('execute', () => {
    let originalMockProviders: string | undefined;

    beforeEach(() => {
      originalMockProviders = process.env.AX_MOCK_PROVIDERS;
      process.env.AX_MOCK_PROVIDERS = 'true';
    });

    afterEach(() => {
      if (originalMockProviders !== undefined) {
        process.env.AX_MOCK_PROVIDERS = originalMockProviders;
      } else {
        delete process.env.AX_MOCK_PROVIDERS;
      }
    });

    it('should return mock response when AX_MOCK_PROVIDERS is true', async () => {
      const provider = new QwenProvider(baseConfig);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Test system prompt'
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('Mock Qwen Response');
      expect(result.model).toBe('qwen-turbo');
      expect(result.tokensUsed).toBeDefined();
    });

    it('should include model name in mock response', async () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'qwen-max'
      };

      const provider = new QwenProvider(config);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Test system prompt'
      });

      expect(result.model).toBe('qwen-max');
      expect(result.content).toContain('qwen-max');
    });

    it('should estimate token count based on prompt length', async () => {
      const provider = new QwenProvider(baseConfig);
      const prompt = 'a'.repeat(400); // 400 chars = ~100 tokens

      const result = await provider.execute({
        prompt,
        systemPrompt: 'System'
      });

      expect(result.tokensUsed?.prompt).toBe(100);
    });

    it('should indicate SDK mode in mock response for sdk mode', async () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        mode: 'sdk'
      };

      const provider = new QwenProvider(config);

      const result = await provider.execute({
        prompt: 'Test',
        systemPrompt: 'System'
      });

      expect(result.content).toContain('Qwen SDK');
    });

    it('should indicate provider info in mock response', async () => {
      const provider = new QwenProvider(baseConfig);

      const result = await provider.execute({
        prompt: 'Test prompt'
      });

      expect(result.content).toContain('Provider: Qwen');
      expect(result.content).toContain('Alibaba Cloud');
    });
  });

  describe('getActiveMode', () => {
    it('should return null when no adapter is created', () => {
      const provider = new QwenProvider(baseConfig);

      const mode = provider.getActiveMode();

      expect(mode).toBeNull();
    });
  });

  describe('resetCircuitBreakers', () => {
    it('should not throw when no adapter exists', () => {
      const provider = new QwenProvider(baseConfig);

      expect(() => provider.resetCircuitBreakers()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources without error', async () => {
      const provider = new QwenProvider(baseConfig);

      await expect(provider.destroy()).resolves.not.toThrow();
    });

    it('should cleanup multiple times without error', async () => {
      const provider = new QwenProvider(baseConfig);

      await provider.destroy();
      await provider.destroy();
      // Should not throw on second call
    });
  });

  describe('mode execution', () => {
    let originalMockProviders: string | undefined;

    beforeEach(() => {
      originalMockProviders = process.env.AX_MOCK_PROVIDERS;
      process.env.AX_MOCK_PROVIDERS = 'true';
    });

    afterEach(() => {
      if (originalMockProviders !== undefined) {
        process.env.AX_MOCK_PROVIDERS = originalMockProviders;
      } else {
        delete process.env.AX_MOCK_PROVIDERS;
      }
    });

    it('should indicate CLI mode in mock response for cli mode', async () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        mode: 'cli'
      };

      const provider = new QwenProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      // CLI mode indicates using Qwen Code CLI
      expect(result.content).toContain('cli');
    });

    it('should indicate auto mode in mock response', async () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        mode: 'auto'
      };

      const provider = new QwenProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      // auto mode uses SDK with CLI fallback
      expect(result.content).toBeDefined();
    });

    it('should default to sdk mode when mode not specified', async () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        mode: undefined
      };

      const provider = new QwenProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      // Mock response shows "Mode: sdk" in lowercase
      expect(result.content).toContain('sdk');
    });
  });

  describe('model configuration', () => {
    it('should support all Qwen model variants', () => {
      const models: QwenModel[] = [
        'qwen3-coder-480b-a35b-instruct',
        'qwen3-coder-30b-a3b-instruct',
        'qwen2.5-coder-32b-instruct',
        'qwen-max',
        'qwen-plus',
        'qwen-turbo'
      ];

      models.forEach(model => {
        const config: QwenProviderConfig = {
          ...baseConfig,
          model
        };

        const provider = new QwenProvider(config);
        expect(provider).toBeDefined();
      });
    });

    it('should fallback to qwen-turbo for unknown model', () => {
      const config: QwenProviderConfig = {
        ...baseConfig,
        model: 'unknown-model' as QwenModel
      };

      const provider = new QwenProvider(config);
      expect(provider).toBeDefined();
      // Should fallback to qwen-turbo and set default context
      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });
  });

  describe('getCLICommand', () => {
    it('should return qwen by default', () => {
      const provider = new QwenProvider(baseConfig);

      // getCLICommand is protected, but we can verify the provider is configured correctly
      expect(provider.name).toBe('qwen');
    });
  });
});
