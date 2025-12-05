/**
 * Unit tests for AxCliProvider (v9.2.0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process and util before imports
vi.mock('child_process');
vi.mock('util', () => ({
  promisify: vi.fn(() => {
    return vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes('which ax-cli')) {
        return { stdout: '/usr/local/bin/ax-cli', stderr: '' };
      }
      if (cmd.includes('ax-cli --version')) {
        return { stdout: '2.5.1\n', stderr: '' };
      }
      return {
        stdout: '{"role":"assistant","content":"Mock response"}',
        stderr: ''
      };
    });
  })
}));

import { AxCliProvider } from '../../../src/providers/ax-cli-provider.js';
import type { AxCliProviderConfig } from '../../../src/providers/ax-cli-provider.js';

describe('AxCliProvider', () => {
  const baseConfig: AxCliProviderConfig = {
    name: 'ax-cli',
    enabled: true,
    priority: 4,
    timeout: 120000,
    command: 'ax-cli'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with ax-cli defaults', () => {
      const provider = new AxCliProvider(baseConfig);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('ax-cli');
    });

    it('should initialize with custom ax-cli config', () => {
      const config: AxCliProviderConfig = {
        ...baseConfig,
        axCli: {
          provider: 'glm',
          model: 'glm-4.6',
          maxToolRounds: 400
        }
      };

      const provider = new AxCliProvider(config);

      expect(provider).toBeDefined();
    });

    it('should support custom provider via ax-cli', () => {
      const config: AxCliProviderConfig = {
        ...baseConfig,
        axCli: {
          provider: 'xai',  // User can configure Grok
          model: 'grok-2'
        }
      };

      const provider = new AxCliProvider(config);

      expect(provider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should check ax-cli availability', async () => {
      const provider = new AxCliProvider(baseConfig);

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  describe('getVersion', () => {
    it('should return ax-cli version or unknown', async () => {
      const provider = new AxCliProvider(baseConfig);

      const version = await provider.getVersion();

      // Mock may return actual version or 'unknown' depending on mock execution
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('getCLICommand', () => {
    it('should return ax-cli-auto command before initialization (auto mode default)', () => {
      const provider = new AxCliProvider(baseConfig);

      const command = provider.getCLICommand();

      // In auto mode (default), the adapter hasn't determined whether to use SDK or CLI yet
      // so it returns 'ax-cli-auto' to indicate the pending selection
      expect(command).toBe('ax-cli-auto');
    });
  });

  describe('provider configuration', () => {
    it('should support all ax-cli providers', () => {
      const providers: Array<'glm' | 'xai' | 'openai' | 'anthropic' | 'ollama'> = [
        'glm', 'xai', 'openai', 'anthropic', 'ollama'
      ];

      providers.forEach(providerName => {
        const config: AxCliProviderConfig = {
          ...baseConfig,
          axCli: {
            provider: providerName,
            model: 'test-model'
          }
        };

        const provider = new AxCliProvider(config);
        expect(provider).toBeDefined();
      });
    });

    it('should support API key override', () => {
      const config: AxCliProviderConfig = {
        ...baseConfig,
        axCli: {
          provider: 'glm',
          apiKey: 'test-key-123'
        }
      };

      const provider = new AxCliProvider(config);
      expect(provider).toBeDefined();
    });

    it('should support base URL override', () => {
      const config: AxCliProviderConfig = {
        ...baseConfig,
        axCli: {
          provider: 'glm',
          baseUrl: 'https://custom-api.example.com'
        }
      };

      const provider = new AxCliProvider(config);
      expect(provider).toBeDefined();
    });

    it('should support max tool rounds configuration', () => {
      const config: AxCliProviderConfig = {
        ...baseConfig,
        axCli: {
          provider: 'glm',
          maxToolRounds: 500
        }
      };

      const provider = new AxCliProvider(config);
      expect(provider).toBeDefined();
    });
  });
});
