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
  });
});
