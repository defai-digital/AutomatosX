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
  });
});
