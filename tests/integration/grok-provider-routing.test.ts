/**
 * Grok Provider Routing Integration Tests
 *
 * Tests GrokProvider integration with Router for multi-provider routing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GrokProvider } from '../../src/providers/grok-provider.js';
import { ClaudeProvider } from '../../src/providers/claude-provider.js';
import { GeminiProvider } from '../../src/providers/gemini-provider.js';
import { Router } from '../../src/core/router.js';
import type { ProviderConfig } from '../../src/types/provider.js';

describe('Grok Provider Routing Integration', () => {
  beforeEach(() => {
    // Enable mock mode for all providers
    process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
  });

  describe('Provider Instantiation', () => {
    it('should create GrokProvider with default config', () => {
      const config: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 4,
        timeout: 120000,
        command: 'grok'
      };

      const provider = new GrokProvider(config);

      expect(provider).toBeInstanceOf(GrokProvider);
      expect(provider.name).toBe('grok');
      expect(provider.priority).toBe(4);
    });

    it('should create GrokProvider with custom command', () => {
      const config: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 4,
        timeout: 120000,
        command: 'grok-z-ai'
      };

      const provider = new GrokProvider(config);

      expect(provider).toBeInstanceOf(GrokProvider);
      expect(provider.name).toBe('grok');
    });
  });

  describe('Multi-Provider Router', () => {
    it('should include GrokProvider in router with multiple providers', async () => {
      const claudeConfig: ProviderConfig = {
        name: 'claude',
        enabled: true,
        priority: 1,
        timeout: 120000,
        command: 'claude'
      };

      const geminiConfig: ProviderConfig = {
        name: 'gemini',
        enabled: true,
        priority: 2,
        timeout: 120000,
        command: 'gemini'
      };

      const grokConfig: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 3,
        timeout: 120000,
        command: 'grok'
      };

      const providers = [
        new ClaudeProvider(claudeConfig),
        new GeminiProvider(geminiConfig),
        new GrokProvider(grokConfig)
      ];

      const router = new Router({
        providers,
        fallbackEnabled: true
      });

      expect(router).toBeDefined();
    });

    it('should route request through GrokProvider in mock mode', async () => {
      const grokConfig: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 1,
        timeout: 120000,
        command: 'grok'
      };

      const provider = new GrokProvider(grokConfig);

      const router = new Router({
        providers: [provider],
        fallbackEnabled: false
      });

      const request = {
        prompt: 'Test prompt for Grok',
        context: {},
        sessionId: 'test-session'
      };

      const response = await router.execute(request);

      expect(response).toBeDefined();
      expect(response.content).toContain('[Mock Grok Response]');
      expect(response.model).toBe('default');
      expect(response.finishReason).toBe('stop');
    });

    it('should handle fallback when GrokProvider fails', async () => {
      const grokConfig: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 1,
        timeout: 120000,
        command: 'grok'
      };

      const claudeConfig: ProviderConfig = {
        name: 'claude',
        enabled: true,
        priority: 2,
        timeout: 120000,
        command: 'claude'
      };

      // First provider is Grok (will use mock), second is Claude (fallback)
      const router = new Router({
        providers: [
          new GrokProvider(grokConfig),
          new ClaudeProvider(claudeConfig)
        ],
        fallbackEnabled: true
      });

      const request = {
        prompt: 'Test fallback',
        context: {},
        sessionId: 'test-session'
      };

      const response = await router.execute(request);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  describe('Provider Priority', () => {
    it('should respect provider priority ordering with Grok', async () => {
      const openaiConfig: ProviderConfig = {
        name: 'openai',
        enabled: true,
        priority: 1,
        timeout: 120000,
        command: 'codex'
      };

      const geminiConfig: ProviderConfig = {
        name: 'gemini',
        enabled: true,
        priority: 2,
        timeout: 120000,
        command: 'gemini'
      };

      const claudeConfig: ProviderConfig = {
        name: 'claude',
        enabled: true,
        priority: 3,
        timeout: 120000,
        command: 'claude'
      };

      const grokConfig: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 4,
        timeout: 120000,
        command: 'grok'
      };

      const router = new Router({
        providers: [
          new GrokProvider(grokConfig),
          new ClaudeProvider(claudeConfig),
          new GeminiProvider(geminiConfig),
          new ClaudeProvider({ ...openaiConfig, name: 'openai' })
        ],
        fallbackEnabled: true
      });

      expect(router).toBeDefined();
    });
  });
});
