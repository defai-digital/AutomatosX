/**
 * Provider Factory Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  createProvider,
  createAllProviders,
  getIntegrationMode,
  ClaudeProvider,
  GeminiProvider,
  AxCliProvider,
  OpenAIProvider,
} from './index.js';

describe('createProvider', () => {
  it('should create ClaudeProvider', () => {
    const provider = createProvider('claude');

    expect(provider).toBeInstanceOf(ClaudeProvider);
    expect(provider.id).toBe('claude');
  });

  it('should create GeminiProvider', () => {
    const provider = createProvider('gemini');

    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.id).toBe('gemini');
  });

  it('should create AxCliProvider', () => {
    const provider = createProvider('ax-cli');

    expect(provider).toBeInstanceOf(AxCliProvider);
    expect(provider.id).toBe('ax-cli');
  });

  it('should create OpenAIProvider', () => {
    const provider = createProvider('openai');

    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.id).toBe('openai');
  });

  it('should pass options to ClaudeProvider', () => {
    const provider = createProvider('claude', {
      claude: { command: 'custom-claude', args: ['--debug'] },
    });

    expect(provider).toBeInstanceOf(ClaudeProvider);
  });

  it('should pass options to GeminiProvider', () => {
    const provider = createProvider('gemini', {
      gemini: { command: 'custom-gemini' },
    });

    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('should throw for unknown provider', () => {
    expect(() => createProvider('unknown' as any)).toThrow('Unknown provider type');
  });
});

describe('createAllProviders', () => {
  it('should create all providers', () => {
    const providers = createAllProviders();

    expect(providers.size).toBe(4);
    expect(providers.has('claude')).toBe(true);
    expect(providers.has('gemini')).toBe(true);
    expect(providers.has('ax-cli')).toBe(true);
    expect(providers.has('openai')).toBe(true);
  });

  it('should pass options to all providers', () => {
    const providers = createAllProviders({
      claude: { command: 'custom-claude' },
      gemini: { command: 'custom-gemini' },
    });

    expect(providers.get('claude')).toBeInstanceOf(ClaudeProvider);
    expect(providers.get('gemini')).toBeInstanceOf(GeminiProvider);
  });
});

describe('getIntegrationMode', () => {
  it('should return mcp for Claude', () => {
    expect(getIntegrationMode('claude')).toBe('mcp');
  });

  it('should return mcp for Gemini', () => {
    expect(getIntegrationMode('gemini')).toBe('mcp');
  });

  it('should return sdk for ax-cli', () => {
    expect(getIntegrationMode('ax-cli')).toBe('sdk');
  });

  it('should return bash for OpenAI', () => {
    expect(getIntegrationMode('openai')).toBe('bash');
  });
});

describe('Provider Integration Modes', () => {
  it('ClaudeProvider should have mcp integration mode', () => {
    const provider = createProvider('claude');
    expect(provider.integrationMode).toBe('mcp');
  });

  it('GeminiProvider should have mcp integration mode', () => {
    const provider = createProvider('gemini');
    expect(provider.integrationMode).toBe('mcp');
  });

  it('AxCliProvider should have sdk integration mode', () => {
    const provider = createProvider('ax-cli');
    expect(provider.integrationMode).toBe('sdk');
  });

  it('OpenAIProvider should have bash integration mode', () => {
    const provider = createProvider('openai');
    expect(provider.integrationMode).toBe('bash');
  });
});

describe('Provider Names', () => {
  it('should have proper names', () => {
    expect(createProvider('claude').name).toBe('Claude Code');
    expect(createProvider('gemini').name).toBe('Gemini CLI');
    expect(createProvider('ax-cli').name).toBe('ax-cli');
    expect(createProvider('openai').name).toBe('OpenAI Codex');
  });
});

describe('Provider Health', () => {
  it('should return default health status', () => {
    const provider = createProvider('claude');
    const health = provider.getHealth();

    expect(health).toBeDefined();
    expect(health.healthy).toBe(true); // default
    expect(health.successRate).toBeGreaterThanOrEqual(0);
    expect(health.consecutiveFailures).toBe(0);
  });

  it('should report healthy by default', () => {
    const provider = createProvider('claude');
    expect(provider.isHealthy()).toBe(true);
  });
});

describe('Provider Cleanup', () => {
  it('should cleanup without errors', async () => {
    const provider = createProvider('claude');
    await expect(provider.cleanup()).resolves.not.toThrow();
  });
});
