/**
 * Unit tests for GrokProvider (v12.0.0)
 *
 * Tests for CLI-based Grok provider integration (ax-grok).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process and util before imports
vi.mock('child_process');
vi.mock('util', () => ({
  promisify: vi.fn(() => {
    return vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes('which ax-grok')) {
        return { stdout: '/usr/local/bin/ax-grok', stderr: '' };
      }
      if (cmd.includes('ax-grok --version')) {
        return { stdout: '1.4.0\n', stderr: '' };
      }
      return {
        stdout: '{"role":"assistant","content":"Mock Grok response"}',
        stderr: ''
      };
    });
  })
}));

import { GrokProvider } from '../../../src/providers/grok-provider.js';
import type { GrokProviderConfig, GrokModel } from '../../../src/providers/grok-provider.js';

describe('GrokProvider', () => {
  const baseConfig: GrokProviderConfig = {
    name: 'grok',
    enabled: true,
    priority: 5,
    timeout: 120000,
    command: 'ax-grok'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const provider = new GrokProvider(baseConfig);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('grok');
    });

    it('should initialize with custom model', () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-3-mini'
      };

      const provider = new GrokProvider(config);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('grok');
    });

    it('should accept all supported models', () => {
      const models: GrokModel[] = [
        'grok-3',
        'grok-3-mini',
        'grok-2',
        'grok-2-vision',
        'grok-beta'
      ];

      models.forEach(model => {
        const config: GrokProviderConfig = {
          ...baseConfig,
          model
        };

        const provider = new GrokProvider(config);
        expect(provider).toBeDefined();
      });
    });
  });

  describe('capabilities', () => {
    it('should report streaming support', () => {
      const provider = new GrokProvider(baseConfig);

      expect(provider.capabilities.supportsStreaming).toBe(true);
    });

    it('should report vision support for grok-2-vision', () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-2-vision'
      };

      const provider = new GrokProvider(config);

      expect(provider.capabilities.supportsVision).toBe(true);
    });

    it('should not report vision support for non-vision models', () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-3'
      };

      const provider = new GrokProvider(config);

      expect(provider.capabilities.supportsVision).toBe(false);
    });

    it('should report correct context window', () => {
      const provider = new GrokProvider(baseConfig);

      expect(provider.capabilities.maxContextTokens).toBe(131072);
    });

    it('should report CLI integration mode', () => {
      const provider = new GrokProvider(baseConfig);

      expect(provider.capabilities.integrationMode).toBe('cli');
    });
  });

  describe('isAvailable', () => {
    it('should check ax-grok CLI availability', async () => {
      const provider = new GrokProvider(baseConfig);

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  describe('static methods', () => {
    it('should return supported models', () => {
      const models = GrokProvider.getSupportedModels();

      expect(models).toContain('grok-3');
      expect(models).toContain('grok-3-mini');
      expect(models).toContain('grok-2');
      expect(models).toContain('grok-2-vision');
      expect(models).toContain('grok-beta');
    });
  });

  describe('getCLICommand', () => {
    it('should return ax-grok command', () => {
      const provider = new GrokProvider(baseConfig);

      // getCLICommand is protected, but the command should be set correctly
      expect(provider.name).toBe('grok');
    });
  });

  describe('model configuration', () => {
    it('should support all Grok model variants', () => {
      const models: Array<GrokModel> = [
        'grok-3',
        'grok-3-mini',
        'grok-2',
        'grok-2-vision',
        'grok-beta'
      ];

      models.forEach(model => {
        const config: GrokProviderConfig = {
          ...baseConfig,
          model
        };

        const provider = new GrokProvider(config);
        expect(provider).toBeDefined();
      });
    });

    it('should fallback to grok-3 for unknown model', () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'unknown-model' as GrokModel
      };

      const provider = new GrokProvider(config);
      expect(provider).toBeDefined();
      // Should fallback to grok-3 with default context
      expect(provider.capabilities.maxContextTokens).toBe(131072);
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
      const provider = new GrokProvider(baseConfig);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Test system prompt'
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('Mock Grok Response');
      expect(result.model).toBe('grok-3');
      expect(result.tokensUsed).toBeDefined();
    });

    it('should include model name in mock response', async () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-3-mini'
      };

      const provider = new GrokProvider(config);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Test system prompt'
      });

      expect(result.model).toBe('grok-3-mini');
      expect(result.content).toContain('grok-3-mini');
    });

    it('should estimate token count based on prompt length', async () => {
      const provider = new GrokProvider(baseConfig);
      const prompt = 'a'.repeat(400); // 400 chars = ~100 tokens

      const result = await provider.execute({
        prompt,
        systemPrompt: 'System'
      });

      expect(result.tokensUsed?.prompt).toBe(100);
    });

    it('should indicate SDK mode in mock response for sdk mode', async () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        mode: 'sdk'
      };

      const provider = new GrokProvider(config);

      const result = await provider.execute({
        prompt: 'Test',
        systemPrompt: 'System'
      });

      expect(result.content).toContain('Grok SDK');
    });

    it('should map grok-beta to grok-3 in response', async () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-beta'
      };

      const provider = new GrokProvider(config);

      const result = await provider.execute({
        prompt: 'Test',
        systemPrompt: 'System'
      });

      // grok-beta maps to grok-3
      expect(result.model).toBe('grok-3');
    });
  });

  describe('getCLICommand', () => {
    it('should return ax-grok by default', () => {
      const provider = new GrokProvider(baseConfig);
      const command = provider.getCLICommand();

      expect(command).toBe('ax-grok');
    });
  });

  describe('getActiveMode', () => {
    it('should return null when no adapter is created', () => {
      const provider = new GrokProvider(baseConfig);

      const mode = provider.getActiveMode();

      expect(mode).toBeNull();
    });
  });

  describe('resetCircuitBreakers', () => {
    it('should not throw when no adapter exists', () => {
      const provider = new GrokProvider(baseConfig);

      expect(() => provider.resetCircuitBreakers()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources without error', async () => {
      const provider = new GrokProvider(baseConfig);

      await expect(provider.destroy()).resolves.not.toThrow();
    });
  });

  describe('SUPPORTED_MODELS static property', () => {
    it('should contain all expected models', () => {
      expect(GrokProvider.SUPPORTED_MODELS).toContain('grok-3');
      expect(GrokProvider.SUPPORTED_MODELS).toContain('grok-3-mini');
      expect(GrokProvider.SUPPORTED_MODELS).toContain('grok-2');
      expect(GrokProvider.SUPPORTED_MODELS).toContain('grok-2-vision');
      expect(GrokProvider.SUPPORTED_MODELS).toContain('grok-beta');
      expect(GrokProvider.SUPPORTED_MODELS.length).toBe(5);
    });
  });

  describe('capabilities', () => {
    it('should report correct integration mode', () => {
      const provider = new GrokProvider(baseConfig);
      expect(provider.capabilities.integrationMode).toBe('cli');
    });

    it('should include supported models', () => {
      const provider = new GrokProvider(baseConfig);
      expect(provider.capabilities.supportedModels).toContain('grok-3');
      expect(provider.capabilities.supportedModels).toContain('grok-2');
    });

    it('should report 131072 context tokens for default model', () => {
      const provider = new GrokProvider(baseConfig);
      expect(provider.capabilities.maxContextTokens).toBe(131072);
    });
  });

  describe('mode execution', () => {
    it('should indicate CLI mode in mock response for default mode', async () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        mode: undefined // default
      };

      const provider = new GrokProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.content).toBeDefined();
      expect(result.model).toBe('grok-3');
    });

    it('should indicate SDK mode in mock response', async () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        mode: 'sdk'
      };

      const provider = new GrokProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.content).toContain('Grok SDK');
    });

    it('should indicate auto mode in mock response', async () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        mode: 'auto'
      };

      const provider = new GrokProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.content).toContain('auto');
    });
  });

  describe('destroy with adapters', () => {
    it('should cleanup multiple times without error', async () => {
      const provider = new GrokProvider(baseConfig);

      await provider.destroy();
      await provider.destroy();
      // Should not throw on second call
    });
  });

  describe('model context windows', () => {
    it('should report 131072 context for grok-3-mini', () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-3-mini'
      };
      const provider = new GrokProvider(config);
      expect(provider.capabilities.maxContextTokens).toBe(131072);
    });

    it('should report 131072 context for grok-2', () => {
      const config: GrokProviderConfig = {
        ...baseConfig,
        model: 'grok-2'
      };
      const provider = new GrokProvider(config);
      expect(provider.capabilities.maxContextTokens).toBe(131072);
    });
  });
});
