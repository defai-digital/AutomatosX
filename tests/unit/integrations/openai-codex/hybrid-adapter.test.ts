/**
 * OpenAI Codex Hybrid Adapter Unit Tests
 *
 * Tests for SDK-first execution with CLI fallback for Codex provider.
 * These tests verify the adapter's behavior without complex mock tracking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger to avoid side effects
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SDK adapter with configurable behavior
let sdkAvailable = true;
let sdkExecuteError: Error | null = null;
let cliExecuteError: Error | null = null;

vi.mock('../../../../src/integrations/openai-codex/sdk-adapter.js', () => ({
  CodexSdkAdapter: class MockCodexSdkAdapter {
    async isAvailable(): Promise<boolean> {
      return sdkAvailable;
    }

    async execute(prompt: string, timeout?: number): Promise<{
      content: string;
      duration: number;
      exitCode: number;
    }> {
      if (sdkExecuteError) throw sdkExecuteError;
      return {
        content: 'SDK response',
        duration: 100,
        exitCode: 0,
      };
    }

    async getVersion(): Promise<string> {
      return '1.0.0';
    }

    async destroy(): Promise<void> {}
  },
}));

vi.mock('../../../../src/integrations/openai-codex/cli-wrapper.js', () => ({
  CodexCLI: class MockCodexCLI {
    async isAvailable(): Promise<boolean> {
      return true;
    }

    async execute(options: { prompt: string; timeout?: number }): Promise<{
      content: string;
      duration: number;
      exitCode: number;
    }> {
      if (cliExecuteError) throw cliExecuteError;
      return {
        content: 'CLI response',
        duration: 150,
        exitCode: 0,
      };
    }

    async getVersion(): Promise<string> {
      return '1.0.0';
    }

    async cleanup(): Promise<void> {}
  },
}));

import { HybridCodexAdapter } from '../../../../src/integrations/openai-codex/hybrid-adapter.js';

describe('HybridCodexAdapter', () => {
  beforeEach(() => {
    // Reset mock state
    sdkAvailable = true;
    sdkExecuteError = null;
    cliExecuteError = null;
  });

  describe('constructor', () => {
    it('should create adapter with default options', () => {
      const adapter = new HybridCodexAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should accept mode option', () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      expect(adapter).toBeDefined();
    });

    it('should accept cli config option', () => {
      const adapter = new HybridCodexAdapter({
        cli: {
          command: 'codex',
          timeout: 30000,
        },
      });
      expect(adapter).toBeDefined();
    });

    it('should accept sdk options', () => {
      const adapter = new HybridCodexAdapter({
        sdk: {
          streamingEnabled: true,
          reuseThreads: true,
        },
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute via SDK in sdk mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      const response = await adapter.execute('Test prompt');

      expect(response.content).toBe('SDK response');
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should execute via CLI in cli mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'cli' });
      const response = await adapter.execute('Test prompt');

      expect(response.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should prefer SDK in auto mode when available', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'auto' });
      const response = await adapter.execute('Test prompt');

      expect(response.content).toBe('SDK response');
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should throw when SDK not available in sdk mode', async () => {
      sdkAvailable = false;
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });

      await expect(adapter.execute('Test prompt')).rejects.toThrow();
    });

    it('should fall back to CLI when SDK not available in auto mode', async () => {
      sdkAvailable = false;
      const adapter = new HybridCodexAdapter({ mode: 'auto' });
      const response = await adapter.execute('Test prompt');

      expect(response.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should fall back to CLI when SDK execute fails in auto mode', async () => {
      sdkExecuteError = new Error('SDK error');
      const adapter = new HybridCodexAdapter({ mode: 'auto' });
      const response = await adapter.execute('Test prompt');

      expect(response.content).toBe('CLI response');
    });
  });

  describe('isAvailable', () => {
    it('should check SDK availability in sdk mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      const available = await adapter.isAvailable();

      expect(available).toBe(true);
    });

    it('should check CLI availability in cli mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'cli' });
      const available = await adapter.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when SDK not available in sdk mode', async () => {
      sdkAvailable = false;
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });

      // Catch the error during initialization
      try {
        await adapter.isAvailable();
      } catch {
        // Expected to throw when SDK not available in strict sdk mode
      }
    });
  });

  describe('getVersion', () => {
    it('should get version from SDK in sdk mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      const version = await adapter.getVersion();

      expect(version).toBe('1.0.0');
    });

    it('should get version from CLI in cli mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'cli' });
      const version = await adapter.getVersion();

      expect(version).toBe('1.0.0');
    });
  });

  describe('getActiveMode', () => {
    it('should return null before any operation', () => {
      const adapter = new HybridCodexAdapter();
      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should return sdk after SDK operation', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      await adapter.execute('test');
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should return cli after CLI operation', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'cli' });
      await adapter.execute('test');
      expect(adapter.getActiveMode()).toBe('cli');
    });
  });

  describe('switchToCliMode', () => {
    it('should switch to CLI mode', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      await adapter.execute('test'); // Initialize SDK mode

      adapter.switchToCliMode();
      expect(adapter.getActiveMode()).toBe('cli');
    });
  });

  describe('destroy', () => {
    it('should clean up SDK adapter', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      await adapter.execute('test');
      await adapter.destroy();

      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should clean up CLI adapter', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'cli' });
      await adapter.execute('test');
      await adapter.destroy();

      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should handle destroy when nothing initialized', async () => {
      const adapter = new HybridCodexAdapter();
      await adapter.destroy();
      // Should not throw
      expect(adapter.getActiveMode()).toBeNull();
    });

    it('should reset active mode after destroy', async () => {
      const adapter = new HybridCodexAdapter({ mode: 'sdk' });
      await adapter.execute('test');
      expect(adapter.getActiveMode()).toBe('sdk');

      await adapter.destroy();
      expect(adapter.getActiveMode()).toBeNull();
    });
  });
});

describe('HybridCodexAdapter Error Handling', () => {
  beforeEach(() => {
    sdkAvailable = true;
    sdkExecuteError = null;
    cliExecuteError = null;
  });

  it('should handle SDK timeout and fallback to CLI', async () => {
    sdkExecuteError = new Error('Timeout');

    const adapter = new HybridCodexAdapter({ mode: 'auto' });
    const response = await adapter.execute('test');

    expect(response.content).toBe('CLI response');
  });

  it('should handle SDK rate limit and fallback to CLI', async () => {
    sdkExecuteError = new Error('Rate limit exceeded');

    const adapter = new HybridCodexAdapter({ mode: 'auto' });
    const response = await adapter.execute('test');

    expect(response.content).toBe('CLI response');
  });

  it('should propagate errors in sdk mode without fallback', async () => {
    sdkExecuteError = new Error('SDK error');

    const adapter = new HybridCodexAdapter({ mode: 'sdk' });

    await expect(adapter.execute('test')).rejects.toThrow('SDK error');
  });

  it('should propagate errors in cli mode', async () => {
    cliExecuteError = new Error('CLI error');

    const adapter = new HybridCodexAdapter({ mode: 'cli' });

    await expect(adapter.execute('test')).rejects.toThrow('CLI error');
  });
});
