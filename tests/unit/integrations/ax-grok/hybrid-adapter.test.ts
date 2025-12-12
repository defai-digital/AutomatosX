/**
 * Grok Hybrid Adapter Unit Tests
 *
 * Tests for SDK-first execution with CLI fallback for Grok provider.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GrokHybridAdapter } from '../../../../src/integrations/ax-grok/hybrid-adapter.js';
import { GrokSdkAdapter } from '../../../../src/integrations/ax-grok/sdk-adapter.js';
import { GrokCliWrapper } from '../../../../src/integrations/ax-grok/cli-wrapper.js';
import type { ExecutionRequest, ExecutionResponse } from '../../../../src/types/provider.js';

// Hoisted adapter refs so constructors remain constructable
const sdkAdapterRef = vi.hoisted(() => ({ value: undefined as any }));
const cliWrapperRef = vi.hoisted(() => ({ value: undefined as any }));

// Mock the adapters
vi.mock('../../../../src/integrations/ax-grok/sdk-adapter.js', () => ({
  GrokSdkAdapter: vi.fn(function MockSdkAdapter(this: unknown) {
    return sdkAdapterRef.value;
  })
}));

vi.mock('../../../../src/integrations/ax-grok/cli-wrapper.js', () => ({
  GrokCliWrapper: vi.fn(function MockCliWrapper(this: unknown) {
    return cliWrapperRef.value;
  })
}));
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GrokHybridAdapter', () => {
  let mockSdkAdapter: {
    isAvailable: Mock;
    initialize: Mock;
    execute: Mock;
    destroy: Mock;
    getModel: Mock;
  };
  let mockCliWrapper: {
    isAvailable: Mock;
    initialize: Mock;
    execute: Mock;
    destroy: Mock;
    getModel: Mock;
    getVersion: Mock;
    getCommand: Mock;
  };

  const mockRequest: ExecutionRequest = {
    prompt: 'Test prompt',
    systemPrompt: 'You are a helpful assistant',
    maxTokens: 1000,
    temperature: 0.7,
  };

  const mockResponse: ExecutionResponse = {
    content: 'Test response',
    model: 'grok-3',
    tokensUsed: { prompt: 10, completion: 20, total: 30 },
    latencyMs: 100,
    finishReason: 'stop',
    cached: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup SDK adapter mock
    mockSdkAdapter = {
      isAvailable: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(mockResponse),
      destroy: vi.fn().mockResolvedValue(undefined),
      getModel: vi.fn().mockReturnValue('grok-3'),
    };

    // Setup CLI wrapper mock
    mockCliWrapper = {
      isAvailable: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(mockResponse),
      destroy: vi.fn().mockResolvedValue(undefined),
      getModel: vi.fn().mockReturnValue('grok-3'),
      getVersion: vi.fn().mockReturnValue('1.0.0'),
      getCommand: vi.fn().mockReturnValue('ax-grok'),
    };

    // Mock constructors
    sdkAdapterRef.value = mockSdkAdapter;
    cliWrapperRef.value = mockCliWrapper;
  });

  afterEach(() => {
    vi.resetAllMocks();
    sdkAdapterRef.value = undefined;
    cliWrapperRef.value = undefined;
  });

  describe('constructor', () => {
    it('should create adapter with default options', () => {
      const adapter = new GrokHybridAdapter();
      expect(adapter.getModel()).toBe('grok-4-0709'); // GROK_DEFAULT_MODEL
    });

    it('should create adapter with custom model', () => {
      const adapter = new GrokHybridAdapter({ model: 'grok-3-mini' });
      expect(adapter.getModel()).toBe('grok-3-mini');
    });

    it('should accept mode option', () => {
      const adapter = new GrokHybridAdapter({ mode: 'sdk' });
      expect(adapter).toBeDefined();
    });

    it('should accept timeout option', () => {
      const adapter = new GrokHybridAdapter({ timeout: 30000 });
      expect(adapter).toBeDefined();
    });
  });

  describe('isSDKAvailable', () => {
    it('should return true when SDK is available', async () => {
      const adapter = new GrokHybridAdapter();
      // Access protected method through initialization
      await adapter['isSDKAvailable']();
      expect(mockSdkAdapter.isAvailable).toHaveBeenCalled();
    });

    it('should return false when SDK is not available', async () => {
      mockSdkAdapter.isAvailable.mockResolvedValue(false);
      const adapter = new GrokHybridAdapter();
      const result = await adapter['isSDKAvailable']();
      expect(result).toBe(false);
    });

    it('should handle SDK initialization error', async () => {
      mockSdkAdapter.isAvailable.mockRejectedValue(new Error('SDK error'));
      const adapter = new GrokHybridAdapter();
      const result = await adapter['isSDKAvailable']();
      expect(result).toBe(false);
    });
  });

  describe('isCLIAvailable', () => {
    it('should return true when CLI is available', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['isCLIAvailable']();
      expect(mockCliWrapper.isAvailable).toHaveBeenCalled();
    });

    it('should return false when CLI is not available', async () => {
      mockCliWrapper.isAvailable.mockResolvedValue(false);
      const adapter = new GrokHybridAdapter();
      const result = await adapter['isCLIAvailable']();
      expect(result).toBe(false);
    });

    it('should handle CLI initialization error', async () => {
      mockCliWrapper.isAvailable.mockRejectedValue(new Error('CLI error'));
      const adapter = new GrokHybridAdapter();
      const result = await adapter['isCLIAvailable']();
      expect(result).toBe(false);
    });
  });

  describe('executeViaSDK', () => {
    it('should execute request via SDK when initialized', async () => {
      const adapter = new GrokHybridAdapter();
      // Initialize SDK
      await adapter['initializeSDK']();
      const result = await adapter['executeViaSDK'](mockRequest);
      expect(result).toEqual(mockResponse);
      expect(mockSdkAdapter.execute).toHaveBeenCalledWith(mockRequest);
    });

    it('should throw error when SDK not initialized', async () => {
      const adapter = new GrokHybridAdapter();
      await expect(adapter['executeViaSDK'](mockRequest)).rejects.toThrow(
        'Grok SDK adapter not initialized'
      );
    });
  });

  describe('executeViaCLI', () => {
    it('should execute request via CLI when initialized', async () => {
      const adapter = new GrokHybridAdapter();
      // Initialize CLI
      await adapter['initializeCLI']();
      const result = await adapter['executeViaCLI'](mockRequest);
      expect(result).toEqual(mockResponse);
      expect(mockCliWrapper.execute).toHaveBeenCalledWith(mockRequest);
    });

    it('should throw error when CLI not initialized', async () => {
      const adapter = new GrokHybridAdapter();
      await expect(adapter['executeViaCLI'](mockRequest)).rejects.toThrow(
        'Grok CLI wrapper not initialized'
      );
    });
  });

  describe('initialization', () => {
    it('should initialize SDK adapter', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeSDK']();
      expect(mockSdkAdapter.initialize).toHaveBeenCalled();
    });

    it('should initialize CLI wrapper', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeCLI']();
      expect(mockCliWrapper.initialize).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeSDK']();
      await adapter['initializeSDK']();
      // Should only create one adapter
      expect(GrokSdkAdapter).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    it('should destroy SDK adapter', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeSDK']();
      await adapter['destroySDK']();
      expect(mockSdkAdapter.destroy).toHaveBeenCalled();
    });

    it('should destroy CLI wrapper', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeCLI']();
      await adapter['destroyCLI']();
      expect(mockCliWrapper.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when not initialized', async () => {
      const adapter = new GrokHybridAdapter();
      // Should not throw
      await adapter['destroySDK']();
      await adapter['destroyCLI']();
    });
  });

  describe('getModel', () => {
    it('should return the configured model', () => {
      const adapter = new GrokHybridAdapter({ model: 'grok-3' });
      expect(adapter.getModel()).toBe('grok-3');
    });
  });

  describe('getCommand', () => {
    it('should return default command when CLI not initialized', () => {
      const adapter = new GrokHybridAdapter();
      expect(adapter.getCommand()).toBe('ax-grok');
    });

    it('should return CLI command when initialized', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeCLI']();
      expect(adapter.getCommand()).toBe('ax-grok');
    });

    it('should return custom command if specified', () => {
      const adapter = new GrokHybridAdapter({ command: 'custom-grok' });
      expect(adapter.getCommand()).toBe('custom-grok');
    });
  });

  describe('getCLIVersion', () => {
    it('should return null when CLI not initialized', () => {
      const adapter = new GrokHybridAdapter();
      expect(adapter.getCLIVersion()).toBeNull();
    });

    it('should return version when CLI initialized', async () => {
      const adapter = new GrokHybridAdapter();
      await adapter['initializeCLI']();
      expect(adapter.getCLIVersion()).toBe('1.0.0');
    });
  });
});

describe('GrokHybridAdapter Integration Scenarios', () => {
  let mockSdkAdapter: {
    isAvailable: Mock;
    initialize: Mock;
    execute: Mock;
    destroy: Mock;
    getModel: Mock;
  };
  let mockCliWrapper: {
    isAvailable: Mock;
    initialize: Mock;
    execute: Mock;
    destroy: Mock;
    getModel: Mock;
    getVersion: Mock;
    getCommand: Mock;
  };

  const mockResponse: ExecutionResponse = {
    content: 'Test response',
    model: 'grok-3',
    tokensUsed: { prompt: 10, completion: 20, total: 30 },
    latencyMs: 100,
    finishReason: 'stop',
    cached: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSdkAdapter = {
      isAvailable: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(mockResponse),
      destroy: vi.fn().mockResolvedValue(undefined),
      getModel: vi.fn().mockReturnValue('grok-3'),
    };

    mockCliWrapper = {
      isAvailable: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(mockResponse),
      destroy: vi.fn().mockResolvedValue(undefined),
      getModel: vi.fn().mockReturnValue('grok-3'),
      getVersion: vi.fn().mockReturnValue('1.0.0'),
      getCommand: vi.fn().mockReturnValue('ax-grok'),
    };

    sdkAdapterRef.value = mockSdkAdapter;
    cliWrapperRef.value = mockCliWrapper;
  });

  afterEach(() => {
    vi.resetAllMocks();
    sdkAdapterRef.value = undefined;
    cliWrapperRef.value = undefined;
  });

  describe('SDK unavailable fallback', () => {
    it('should fall back to CLI when SDK is not available', async () => {
      mockSdkAdapter.isAvailable.mockResolvedValue(false);
      const adapter = new GrokHybridAdapter({ mode: 'auto' });

      const sdkAvailable = await adapter['isSDKAvailable']();
      expect(sdkAvailable).toBe(false);

      const cliAvailable = await adapter['isCLIAvailable']();
      expect(cliAvailable).toBe(true);
    });
  });

  describe('API key handling', () => {
    it('should pass API key to SDK adapter', () => {
      const adapter = new GrokHybridAdapter({
        apiKey: 'test-api-key',
        model: 'grok-3',
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('Model aliases', () => {
    it('should handle grok-latest alias', () => {
      const adapter = new GrokHybridAdapter({ model: 'grok-latest' });
      expect(adapter.getModel()).toBe('grok-latest');
    });

    it('should handle grok-fast alias', () => {
      const adapter = new GrokHybridAdapter({ model: 'grok-fast' });
      expect(adapter.getModel()).toBe('grok-fast');
    });

    it('should handle grok-mini alias', () => {
      const adapter = new GrokHybridAdapter({ model: 'grok-mini' });
      expect(adapter.getModel()).toBe('grok-mini');
    });

    it('should handle grok-vision alias', () => {
      const adapter = new GrokHybridAdapter({ model: 'grok-vision' });
      expect(adapter.getModel()).toBe('grok-vision');
    });
  });
});
