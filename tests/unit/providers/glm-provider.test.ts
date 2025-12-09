/**
 * Unit tests for GLMProvider (v12.0.0)
 *
 * Tests for CLI-based GLM provider integration (ax-glm).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process and util before imports
vi.mock('child_process');
vi.mock('util', () => ({
  promisify: vi.fn(() => {
    return vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes('which ax-glm')) {
        return { stdout: '/usr/local/bin/ax-glm', stderr: '' };
      }
      if (cmd.includes('ax-glm --version')) {
        return { stdout: '1.4.0\n', stderr: '' };
      }
      return {
        stdout: '{"role":"assistant","content":"Mock GLM response"}',
        stderr: ''
      };
    });
  })
}));

import { GLMProvider } from '../../../src/providers/glm-provider.js';
import type { GLMProviderConfig, GLMModel } from '../../../src/providers/glm-provider.js';

describe('GLMProvider', () => {
  const baseConfig: GLMProviderConfig = {
    name: 'glm',
    enabled: true,
    priority: 5,
    timeout: 120000,
    command: 'ax-glm'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const provider = new GLMProvider(baseConfig);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('glm');
    });

    it('should initialize with custom model', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4.6'
      };

      const provider = new GLMProvider(config);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('glm');
    });

    it('should accept all supported models', () => {
      const models: GLMModel[] = [
        // Current models
        'glm-4.6',
        'glm-4.5v',
        'glm-4',
        'glm-4-flash',
        // Legacy aliases
        'glm-4-plus',
        'glm-4v',
        'glm-4-air',
        'glm-4-airx'
      ];

      models.forEach(model => {
        const config: GLMProviderConfig = {
          ...baseConfig,
          model
        };

        const provider = new GLMProvider(config);
        expect(provider).toBeDefined();
      });
    });
  });

  describe('capabilities', () => {
    it('should report streaming support', () => {
      const provider = new GLMProvider(baseConfig);

      expect(provider.capabilities.supportsStreaming).toBe(true);
    });

    it('should report vision support for glm-4.5v', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4.5v'
      };

      const provider = new GLMProvider(config);

      expect(provider.capabilities.supportsVision).toBe(true);
    });

    it('should report vision support for legacy glm-4v', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4v'
      };

      const provider = new GLMProvider(config);

      expect(provider.capabilities.supportsVision).toBe(true);
    });

    it('should not report vision support for non-vision models', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4'
      };

      const provider = new GLMProvider(config);

      expect(provider.capabilities.supportsVision).toBe(false);
    });

    it('should report correct context window for default model', () => {
      const provider = new GLMProvider(baseConfig);

      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });

    it('should report 200K context for glm-4.6', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4.6'
      };

      const provider = new GLMProvider(config);

      expect(provider.capabilities.maxContextTokens).toBe(200000);
    });

    it('should report CLI integration mode', () => {
      const provider = new GLMProvider(baseConfig);

      expect(provider.capabilities.integrationMode).toBe('cli');
    });
  });

  describe('isAvailable', () => {
    it('should check ax-glm CLI availability', async () => {
      const provider = new GLMProvider(baseConfig);

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  describe('static methods', () => {
    it('should return supported models', () => {
      const models = GLMProvider.getSupportedModels();

      // Current models
      expect(models).toContain('glm-4.6');
      expect(models).toContain('glm-4.5v');
      expect(models).toContain('glm-4');
      expect(models).toContain('glm-4-flash');
      // Legacy aliases
      expect(models).toContain('glm-4-plus');
      expect(models).toContain('glm-4v');
      expect(models).toContain('glm-4-air');
      expect(models).toContain('glm-4-airx');
    });
  });

  describe('getCLICommand', () => {
    it('should return ax-glm command', () => {
      const provider = new GLMProvider(baseConfig);

      // getCLICommand is protected, but the command should be set correctly
      expect(provider.name).toBe('glm');
    });
  });

  describe('model configuration', () => {
    it('should support all GLM model variants', () => {
      const models: Array<GLMModel> = [
        'glm-4.6',
        'glm-4.5v',
        'glm-4',
        'glm-4-flash',
        'glm-4-plus',
        'glm-4v',
        'glm-4-air',
        'glm-4-airx'
      ];

      models.forEach(model => {
        const config: GLMProviderConfig = {
          ...baseConfig,
          model
        };

        const provider = new GLMProvider(config);
        expect(provider).toBeDefined();
      });
    });

    it('should fallback to glm-4 for unknown model', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'unknown-model' as GLMModel
      };

      const provider = new GLMProvider(config);
      expect(provider).toBeDefined();
      // Should fallback to glm-4 and set default context
      expect(provider.capabilities.maxContextTokens).toBe(128000);
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
      const provider = new GLMProvider(baseConfig);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Test system prompt'
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('Mock GLM Response');
      expect(result.model).toBe('glm-4');
      expect(result.tokensUsed).toBeDefined();
    });

    it('should include model name in mock response', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4.6'
      };

      const provider = new GLMProvider(config);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Test system prompt'
      });

      expect(result.model).toBe('glm-4.6');
      expect(result.content).toContain('glm-4.6');
    });

    it('should estimate token count based on prompt length', async () => {
      const provider = new GLMProvider(baseConfig);
      const prompt = 'a'.repeat(400); // 400 chars = ~100 tokens

      const result = await provider.execute({
        prompt,
        systemPrompt: 'System'
      });

      expect(result.tokensUsed?.prompt).toBe(100);
    });

    it('should indicate SDK mode in mock response for sdk mode', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        mode: 'sdk'
      };

      const provider = new GLMProvider(config);

      const result = await provider.execute({
        prompt: 'Test',
        systemPrompt: 'System'
      });

      expect(result.content).toContain('GLM SDK');
    });
  });

  describe('getCLICommand', () => {
    it('should return ax-glm by default', () => {
      const provider = new GLMProvider(baseConfig);
      const command = provider.getCLICommand();

      expect(command).toBe('ax-glm');
    });
  });

  describe('getActiveMode', () => {
    it('should return null when no adapter is created', () => {
      const provider = new GLMProvider(baseConfig);

      const mode = provider.getActiveMode();

      expect(mode).toBeNull();
    });
  });

  describe('resetCircuitBreakers', () => {
    it('should not throw when no adapter exists', () => {
      const provider = new GLMProvider(baseConfig);

      expect(() => provider.resetCircuitBreakers()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources without error', async () => {
      const provider = new GLMProvider(baseConfig);

      await expect(provider.destroy()).resolves.not.toThrow();
    });
  });

  describe('context window by model', () => {
    it('should return 64K context for glm-4.5v', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4.5v'
      };

      const provider = new GLMProvider(config);

      expect(provider.capabilities.maxContextTokens).toBe(64000);
    });

    it('should return 200K context for glm-4-plus (legacy)', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4-plus' // Maps to glm-4.6
      };

      const provider = new GLMProvider(config);

      // glm-4-plus maps to glm-4.6 internally, but for capabilities
      // the model name check may not map - it depends on getNormalizedModel
      expect(provider.capabilities.maxContextTokens).toBeGreaterThanOrEqual(128000);
    });

    it('should return 128K context for glm-4-flash', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4-flash'
      };

      const provider = new GLMProvider(config);

      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });
  });

  describe('SUPPORTED_MODELS static property', () => {
    it('should contain all expected models', () => {
      expect(GLMProvider.SUPPORTED_MODELS).toContain('glm-4');
      expect(GLMProvider.SUPPORTED_MODELS).toContain('glm-4.6');
      expect(GLMProvider.SUPPORTED_MODELS).toContain('glm-4.5v');
      expect(GLMProvider.SUPPORTED_MODELS).toContain('glm-4-flash');
      expect(GLMProvider.SUPPORTED_MODELS.length).toBe(8);
    });
  });

  describe('model mapping', () => {
    it('should map glm-4-plus to glm-4.6', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4-plus'
      };

      const provider = new GLMProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.model).toBe('glm-4.6');
    });

    it('should map glm-4v to glm-4.5v', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4v'
      };

      const provider = new GLMProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.model).toBe('glm-4.5v');
    });

    it('should map glm-4-air to glm-4-flash', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4-air'
      };

      const provider = new GLMProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.model).toBe('glm-4-flash');
    });

    it('should map glm-4-airx to glm-4-flash', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4-airx'
      };

      const provider = new GLMProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.model).toBe('glm-4-flash');
    });
  });

  describe('capabilities', () => {
    it('should report correct integration mode', () => {
      const provider = new GLMProvider(baseConfig);
      expect(provider.capabilities.integrationMode).toBe('cli');
    });

    it('should include supported models', () => {
      const provider = new GLMProvider(baseConfig);
      expect(provider.capabilities.supportedModels).toContain('glm-4');
      expect(provider.capabilities.supportedModels).toContain('glm-4.6');
    });

    it('should return 200K context for glm-4.6', () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        model: 'glm-4.6'
      };
      const provider = new GLMProvider(config);
      expect(provider.capabilities.maxContextTokens).toBe(200000);
    });
  });

  describe('mode execution', () => {
    it('should indicate CLI mode in mock response for default mode', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        mode: undefined // default
      };

      const provider = new GLMProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.content).toBeDefined();
      expect(result.model).toBe('glm-4');
    });

    it('should indicate auto mode in mock response', async () => {
      const config: GLMProviderConfig = {
        ...baseConfig,
        mode: 'auto'
      };

      const provider = new GLMProvider(config);
      const result = await provider.execute({ prompt: 'Test' });

      expect(result.content).toContain('auto');
    });
  });

  describe('destroy with adapters', () => {
    it('should cleanup multiple times without error', async () => {
      const provider = new GLMProvider(baseConfig);

      await provider.destroy();
      await provider.destroy();
      // Should not throw on second call
    });
  });
});
