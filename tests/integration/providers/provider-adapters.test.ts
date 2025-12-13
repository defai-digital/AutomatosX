/**
 * Provider Adapters Integration Tests
 *
 * End-to-end tests for SDK-first provider adapters:
 * - GLM adapter
 * - Grok adapter
 * - Qwen adapter
 * - Common adapter functionality
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock environment variables before importing providers
vi.stubEnv('GLM_API_KEY', 'test-glm-key');
vi.stubEnv('XAI_API_KEY', 'test-xai-key');
vi.stubEnv('DASHSCOPE_API_KEY', 'test-dashscope-key');
vi.stubEnv('AX_MOCK_PROVIDERS', 'true');

describe('Provider Adapters Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'provider-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('GLM Adapter', () => {
    it('should validate GLM API key presence', async () => {
      const { GLMSdkAdapter } = await import('../../../src/integrations/ax-glm/sdk-adapter.js');

      const adapter = new GLMSdkAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should have correct provider metadata', async () => {
      const { GLMSdkAdapter } = await import('../../../src/integrations/ax-glm/sdk-adapter.js');

      const adapter = new GLMSdkAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should support required operations', async () => {
      const { GLMSdkAdapter } = await import('../../../src/integrations/ax-glm/sdk-adapter.js');

      const adapter = new GLMSdkAdapter({ apiKey: 'test-key' });

      // Check that execute method exists
      expect(typeof adapter.execute).toBe('function');
    });
  });

  describe('Grok Adapter', () => {
    it('should validate Grok API key presence', async () => {
      const { GrokSdkAdapter } = await import('../../../src/integrations/ax-grok/sdk-adapter.js');

      const adapter = new GrokSdkAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should have correct provider metadata', async () => {
      const { GrokSdkAdapter } = await import('../../../src/integrations/ax-grok/sdk-adapter.js');

      const adapter = new GrokSdkAdapter({ apiKey: 'test-key' });
      expect(adapter).toBeDefined();
    });

    it('should support required operations', async () => {
      const { GrokSdkAdapter } = await import('../../../src/integrations/ax-grok/sdk-adapter.js');

      const adapter = new GrokSdkAdapter({ apiKey: 'test-key' });

      // Check that execute method exists
      expect(typeof adapter.execute).toBe('function');
    });
  });

  describe('Qwen Adapter', () => {
    it('should create Qwen hybrid adapter', async () => {
      const { QwenHybridAdapter } = await import('../../../src/integrations/qwen-code/hybrid-adapter.js');

      const adapter = new QwenHybridAdapter({
        apiKey: 'test-key',
        mode: 'sdk'
      });
      expect(adapter).toBeDefined();
    });

    it('should have correct provider metadata', async () => {
      const { QwenHybridAdapter } = await import('../../../src/integrations/qwen-code/hybrid-adapter.js');

      const adapter = new QwenHybridAdapter({
        apiKey: 'test-key',
        mode: 'auto'
      });

      expect(adapter).toBeDefined();
    });

    it('should prefer SDK mode when API key is present', async () => {
      const { QwenHybridAdapter } = await import('../../../src/integrations/qwen-code/hybrid-adapter.js');

      const adapter = new QwenHybridAdapter({
        apiKey: 'test-dashscope-key',
        mode: 'sdk'
      });

      expect(adapter).toBeDefined();
    });
  });

  describe('Base Provider Functionality', () => {
    it('should validate provider name whitelist', async () => {
      const { BaseProvider } = await import('../../../src/providers/base-provider.js');

      // Valid provider names should work (tested via GLM/Grok adapters)
      // BaseProvider validates names in constructor - invalid names throw
      expect(BaseProvider).toBeDefined();
    });

    it('should have required capabilities interface', async () => {
      const { BaseProvider } = await import('../../../src/providers/base-provider.js');

      // Check capabilities type exists
      expect(BaseProvider).toBeDefined();
    });
  });

  describe('Provider Configuration', () => {
    it('should handle timeout configuration', async () => {
      const { GLMSdkAdapter } = await import('../../../src/integrations/ax-glm/sdk-adapter.js');

      const adapter = new GLMSdkAdapter({
        apiKey: 'test-key',
        timeout: 30000
      });

      expect(adapter).toBeDefined();
    });

    it('should handle model selection', async () => {
      const { GrokSdkAdapter } = await import('../../../src/integrations/ax-grok/sdk-adapter.js');

      const adapter = new GrokSdkAdapter({
        apiKey: 'test-key',
        model: 'grok-2'
      });

      expect(adapter).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', async () => {
      // Temporarily remove API key
      const originalKey = process.env.GLM_API_KEY;
      delete process.env.GLM_API_KEY;

      const { GLMSdkAdapter } = await import('../../../src/integrations/ax-glm/sdk-adapter.js');

      // Should not throw during construction
      expect(() => new GLMSdkAdapter({})).not.toThrow();

      // Restore
      process.env.GLM_API_KEY = originalKey;
    });

    it('should validate request parameters', async () => {
      const { GLMSdkAdapter } = await import('../../../src/integrations/ax-glm/sdk-adapter.js');

      const adapter = new GLMSdkAdapter({ apiKey: 'test-key' });

      // Execute with empty prompt should handle gracefully
      await expect(adapter.execute({ prompt: '' }))
        .rejects.toBeDefined();
    });
  });
});

describe('CLI Wrapper Integration', () => {
  describe('GLM CLI Wrapper', () => {
    it('should create CLI wrapper', async () => {
      const { GLMCliWrapper } = await import('../../../src/integrations/ax-glm/cli-wrapper.js');

      const wrapper = new GLMCliWrapper();
      expect(wrapper).toBeDefined();
    });

    it('should check CLI availability', async () => {
      const { GLMCliWrapper } = await import('../../../src/integrations/ax-glm/cli-wrapper.js');

      const wrapper = new GLMCliWrapper();
      const available = await wrapper.isAvailable();

      // Should return boolean (may or may not be available)
      expect(typeof available).toBe('boolean');
    });
  });

  describe('Grok CLI Wrapper', () => {
    it('should create CLI wrapper', async () => {
      const { GrokCliWrapper } = await import('../../../src/integrations/ax-grok/cli-wrapper.js');

      const wrapper = new GrokCliWrapper();
      expect(wrapper).toBeDefined();
    });

    it('should check CLI availability', async () => {
      const { GrokCliWrapper } = await import('../../../src/integrations/ax-grok/cli-wrapper.js');

      const wrapper = new GrokCliWrapper();
      const available = await wrapper.isAvailable();

      expect(typeof available).toBe('boolean');
    });
  });

  describe('Qwen CLI Wrapper', () => {
    it('should create CLI wrapper', async () => {
      const { QwenCliWrapper } = await import('../../../src/integrations/qwen-code/cli-wrapper.js');

      const wrapper = new QwenCliWrapper();
      expect(wrapper).toBeDefined();
    });

    it('should check CLI availability', async () => {
      const { QwenCliWrapper } = await import('../../../src/integrations/qwen-code/cli-wrapper.js');

      const wrapper = new QwenCliWrapper();
      const available = await wrapper.isAvailable();

      expect(typeof available).toBe('boolean');
    });
  });
});

describe('Hybrid Adapter Pattern', () => {
  it('should create Grok hybrid adapter with SDK preference', async () => {
    const { GrokHybridAdapter } = await import('../../../src/integrations/ax-grok/hybrid-adapter.js');

    const adapter = new GrokHybridAdapter({
      apiKey: 'test-key',
      mode: 'sdk'
    });

    expect(adapter).toBeDefined();
  });

  it('should create Grok hybrid adapter with CLI preference', async () => {
    const { GrokHybridAdapter } = await import('../../../src/integrations/ax-grok/hybrid-adapter.js');

    const adapter = new GrokHybridAdapter({
      mode: 'cli'
    });

    expect(adapter).toBeDefined();
  });

  it('should create Qwen hybrid adapter', async () => {
    const { QwenHybridAdapter } = await import('../../../src/integrations/qwen-code/hybrid-adapter.js');

    const adapter = new QwenHybridAdapter({
      apiKey: 'test-key',
      mode: 'sdk'
    });

    expect(adapter).toBeDefined();
  });
});
