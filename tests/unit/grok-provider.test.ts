/**
 * GrokProvider Unit Tests (v8.3.1)
 *
 * Tests for GrokProvider pure CLI wrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrokProvider } from '../../src/providers/grok-provider.js';
import type { ProviderConfig } from '../../src/types/provider.js';

describe('GrokProvider', () => {
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      name: 'grok',
      enabled: true,
      priority: 2,
      timeout: 120000,
      command: 'grok'
    };

    // Enable mock mode
    process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
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
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
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
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
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
  });
});
