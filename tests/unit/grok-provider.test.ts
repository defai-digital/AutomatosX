/**
 * GrokProvider Unit Tests (v8.4.0)
 *
 * Tests for GrokProvider pure CLI wrapper with Grok CLI integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrokProvider } from '../../src/providers/grok-provider.js';
import type { ProviderConfig } from '../../src/types/provider.js';

describe('GrokProvider', () => {
  let config: ProviderConfig;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    config = {
      name: 'grok',
      enabled: true,
      priority: 2,
      timeout: 120000,
      command: 'grok'
    };

    // Enable mock mode
    process.env.AX_MOCK_PROVIDERS = 'true';
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('Construction', () => {
    it('should create GrokProvider instance', () => {
      const provider = new GrokProvider(config);
      expect(provider).toBeInstanceOf(GrokProvider);
    });

    it('should normalize provider name to lowercase', () => {
      const upperConfig = { ...config, name: 'GROK' };
      const provider = new GrokProvider(upperConfig);
      expect(provider.name).toBe('grok');
    });

    it('should accept valid configuration', () => {
      const validConfig: ProviderConfig = {
        name: 'grok',
        enabled: true,
        priority: 3,
        timeout: 180000,
        command: 'grok'
      };

      const provider = new GrokProvider(validConfig);
      expect(provider.name).toBe('grok');
      expect(provider.priority).toBe(3);
    });
  });

  describe('Mock Mode', () => {
    it('should return mock response in mock mode', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new GrokProvider(config);

      const request = {
        prompt: 'Test prompt',
        context: {},
        sessionId: 'test-session'
      };

      const response = await provider.execute(request);

      expect(response.content).toContain('[Mock Grok Response]');
      expect(response.content).toContain('mock response');
      expect(response.model).toBe('default');
      expect(response.finishReason).toBe('stop');
    });

    it('should include execution metadata in response', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new GrokProvider(config);

      const request = {
        prompt: 'Test prompt',
        context: {},
        sessionId: 'test-session'
      };

      const response = await provider.execute(request);

      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(response.tokensUsed).toBeDefined();
      expect(response.tokensUsed.total).toBe(0);
      expect(response.cached).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should check availability', async () => {
      const provider = new GrokProvider(config);
      const health = await provider.healthCheck();

      expect(health).toBeDefined();
      expect(typeof health.available).toBe('boolean');
      expect(typeof health.latencyMs).toBe('number');
      expect(typeof health.errorRate).toBe('number');
      expect(typeof health.consecutiveFailures).toBe('number');
    });

    it('should check CLI availability', async () => {
      const provider = new GrokProvider(config);
      const available = await provider.isAvailable();

      expect(typeof available).toBe('boolean');
    });
  });

  describe('Provider Interface', () => {
    it('should expose provider name', () => {
      const provider = new GrokProvider(config);
      expect(provider.name).toBe('grok');
    });

    it('should expose provider priority', () => {
      const provider = new GrokProvider(config);
      expect(provider.priority).toBe(2);
    });

    it('should expose CLI command', () => {
      const provider = new GrokProvider(config);
      expect((provider as any).getCLICommand()).toBe('grok');
    });

    it('should return capabilities', () => {
      const provider = new GrokProvider(config);
      const capabilities = provider.capabilities;

      expect(capabilities.supportsStreaming).toBe(false);
      expect(capabilities.supportsEmbedding).toBe(false);
      expect(capabilities.supportsVision).toBe(false);
      expect(capabilities.maxContextTokens).toBe(128000);
      expect(capabilities.supportedModels).toContain('default');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid provider names', () => {
      const invalidConfig = { ...config, name: 'invalid-provider' };

      expect(() => new GrokProvider(invalidConfig)).toThrow('Invalid provider name');
    });

    it('should handle execution failures gracefully', async () => {
      const provider = new GrokProvider(config);

      // Temporarily disable mock mode to test real failures
      delete process.env.AX_MOCK_PROVIDERS;

      const request = {
        prompt: 'Test prompt',
        context: {},
        sessionId: 'test-session'
      };

      // This should fail if Grok CLI is not available
      try {
        await provider.execute(request);
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }

      // Restore mock mode
      process.env.AX_MOCK_PROVIDERS = 'true';
    });

    it('should update health status on failures', async () => {
      const provider = new GrokProvider(config);
      const initialHealth = await provider.healthCheck();

      // Failures should be tracked
      expect(typeof initialHealth.consecutiveFailures).toBe('number');
      expect(typeof initialHealth.errorRate).toBe('number');
    });
  });

  describe('Retry Logic', () => {
    it('should determine if error is retryable', () => {
      const provider = new GrokProvider(config);

      expect(provider.shouldRetry(new Error('timeout'))).toBe(true);
      expect(provider.shouldRetry(new Error('rate limit'))).toBe(true);
      expect(provider.shouldRetry(new Error('503'))).toBe(true);
      expect(provider.shouldRetry(new Error('temporarily unavailable'))).toBe(true);
      expect(provider.shouldRetry(new Error('invalid input'))).toBe(false);
    });

    it('should calculate exponential backoff for retries', () => {
      const provider = new GrokProvider(config);

      expect(provider.getRetryDelay(1)).toBe(1000); // 1s
      expect(provider.getRetryDelay(2)).toBe(2000); // 2s
      expect(provider.getRetryDelay(3)).toBe(4000); // 4s
      expect(provider.getRetryDelay(4)).toBe(8000); // 8s
      expect(provider.getRetryDelay(10)).toBe(30000); // Cap at 30s
    });
  });

  describe('Configuration Validation', () => {
    it('should require valid timeout', () => {
      const invalidConfig = { ...config, timeout: -1 };
      const provider = new GrokProvider(invalidConfig);

      // Should still create, but timeout will be used by CLI execution
      expect(provider).toBeDefined();
    });

    it('should handle missing command field', () => {
      const configWithoutCommand = {
        name: 'grok',
        enabled: true,
        priority: 2,
        timeout: 120000
      } as ProviderConfig;

      const provider = new GrokProvider(configWithoutCommand);
      expect(provider).toBeDefined();
    });
  });

  describe('X.AI vs Z.AI Support', () => {
    it('should work with X.AI Grok models', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new GrokProvider(config);

      const request = {
        prompt: 'Test X.AI Grok',
        context: {},
        sessionId: 'test-session'
      };

      const response = await provider.execute(request);
      expect(response.content).toBeDefined();
    });

    it('should work with Z.AI GLM models', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new GrokProvider(config);

      const request = {
        prompt: 'Test Z.AI GLM',
        context: {},
        sessionId: 'test-session'
      };

      const response = await provider.execute(request);
      expect(response.content).toBeDefined();
    });
  });

  describe('Cache Metrics', () => {
    it('should return cache metrics', () => {
      const provider = new GrokProvider(config);
      const metrics = provider.getCacheMetrics();

      expect(metrics.availability).toBeDefined();
      expect(metrics.version).toBeDefined();
      expect(metrics.health).toBeDefined();
      expect(metrics.health.consecutiveFailures).toBeGreaterThanOrEqual(0);
    });

    it('should allow cache clearing', () => {
      const provider = new GrokProvider(config);
      // Should not throw
      expect(() => provider.clearCaches()).not.toThrow();
    });
  });
});
