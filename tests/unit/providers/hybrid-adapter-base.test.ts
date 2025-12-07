/**
 * Unit tests for HybridAdapterBase (v12.0.0)
 *
 * Tests SDK-first execution with CLI fallback, circuit breaker integration,
 * and error classification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock feature flags before imports
const mockIsSDKFirstModeEnabled = vi.fn(() => true);
const mockIsSDKFallbackEnabled = vi.fn(() => true);
vi.mock('../../../src/core/feature-flags/flags.js', () => ({
  isSDKFirstModeEnabled: () => mockIsSDKFirstModeEnabled(),
  isSDKFallbackEnabled: () => mockIsSDKFallbackEnabled()
}));

// Mock metrics
vi.mock('../../../src/core/metrics/provider-metrics.js', () => ({
  getMetricsCollector: vi.fn(() => ({
    recordSDKExecution: vi.fn(),
    recordCLIExecution: vi.fn(),
    recordSDKFallback: vi.fn()
  }))
}));

// Mock fallback decision
vi.mock('../../../src/providers/fallback-decision.js', () => ({
  decideFallback: vi.fn((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('sdk unavailable')) {
      return { decision: 'use_cli', reason: 'SDK not available', severity: 'warn' };
    }
    if (message.includes('auth error')) {
      return { decision: 'propagate', reason: 'Auth error', severity: 'error' };
    }
    if (message.includes('transient')) {
      return { decision: 'retry_sdk', reason: 'Transient error', severity: 'warn', retryDelayMs: 100 };
    }
    return { decision: 'use_cli', reason: 'Unknown error', severity: 'warn' };
  }),
  FallbackDecision: {
    RETRY_SDK: 'retry_sdk',
    USE_CLI: 'use_cli',
    PROPAGATE: 'propagate'
  }
}));

import {
  HybridAdapterBase,
  type ExecutionRequest,
  type ExecutionResponse
} from '../../../src/providers/hybrid-adapter-base.js';

/**
 * Test implementation of HybridAdapterBase
 */
class TestHybridAdapter extends HybridAdapterBase {
  public sdkAvailable = true;
  public cliAvailable = true;
  public sdkExecuteResult: ExecutionResponse | null = null;
  public cliExecuteResult: ExecutionResponse | null = null;
  public sdkError: Error | null = null;
  public cliError: Error | null = null;
  public testSdkInitialized = false;
  public testCliInitialized = false;

  constructor(options: { mode?: 'sdk' | 'cli' | 'auto'; maxRetries?: number } = {}) {
    super({
      providerName: 'test',
      mode: options.mode || 'auto',
      maxRetries: options.maxRetries ?? 1
    });
  }

  protected override async executeViaSDK(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (this.sdkError) {
      throw this.sdkError;
    }
    return this.sdkExecuteResult || {
      content: 'SDK response',
      model: 'test-model',
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      latencyMs: 5,
      finishReason: 'stop',
      cached: false
    };
  }

  protected override async executeViaCLI(request: ExecutionRequest): Promise<ExecutionResponse> {
    if (this.cliError) {
      throw this.cliError;
    }
    return this.cliExecuteResult || {
      content: 'CLI response',
      model: 'test-model',
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      latencyMs: 100,
      finishReason: 'stop',
      cached: false
    };
  }

  protected async isSDKAvailable(): Promise<boolean> {
    return this.sdkAvailable;
  }

  protected async isCLIAvailable(): Promise<boolean> {
    return this.cliAvailable;
  }

  protected async initializeSDK(): Promise<void> {
    this.testSdkInitialized = true;
  }

  protected async initializeCLI(): Promise<void> {
    this.testCliInitialized = true;
  }

  protected async destroySDK(): Promise<void> {
    this.testSdkInitialized = false;
  }

  protected async destroyCLI(): Promise<void> {
    this.testCliInitialized = false;
  }

  // Expose initialization state for testing
  public isTestSdkInitialized(): boolean {
    return this.testSdkInitialized;
  }

  public isTestCliInitialized(): boolean {
    return this.testCliInitialized;
  }
}

describe('HybridAdapterBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSDKFirstModeEnabled.mockReturnValue(true);
    mockIsSDKFallbackEnabled.mockReturnValue(true);
  });

  describe('mode selection', () => {
    it('should use SDK when SDK-first mode is enabled', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });

      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('SDK response');
      expect(adapter.getActiveMode()).toBe('sdk');
    });

    it('should use CLI when SDK-first mode is disabled', async () => {
      mockIsSDKFirstModeEnabled.mockReturnValue(false);
      const adapter = new TestHybridAdapter({ mode: 'auto' });

      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should use CLI when mode is explicitly set to cli', async () => {
      const adapter = new TestHybridAdapter({ mode: 'cli' });

      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('CLI response');
      expect(adapter.getActiveMode()).toBe('cli');
    });

    it('should use SDK when mode is explicitly set to sdk', async () => {
      const adapter = new TestHybridAdapter({ mode: 'sdk' });

      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('SDK response');
      expect(adapter.getActiveMode()).toBe('sdk');
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to CLI when SDK throws sdk unavailable error', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });
      adapter.sdkError = new Error('sdk unavailable');

      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('CLI response');
    });

    it('should propagate auth errors without fallback', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });
      adapter.sdkError = new Error('auth error');

      await expect(adapter.execute({ prompt: 'test' })).rejects.toThrow('auth error');
    });

    it('should retry SDK on transient errors', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto', maxRetries: 1 });
      let callCount = 0;

      // First call fails, second succeeds
      const originalExecuteViaSDK = adapter['executeViaSDK'].bind(adapter);
      adapter['executeViaSDK'] = async (request: ExecutionRequest) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('transient error');
        }
        return originalExecuteViaSDK(request);
      };

      adapter.sdkError = null;
      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('SDK response');
      expect(callCount).toBe(2);
    });

    it('should fallback to CLI when max retries exceeded', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto', maxRetries: 1 });
      adapter.sdkError = new Error('transient error');

      const result = await adapter.execute({ prompt: 'test' });

      expect(result.content).toBe('CLI response');
    });

    it('should not fallback when fallback is disabled', async () => {
      mockIsSDKFallbackEnabled.mockReturnValue(false);
      const adapter = new TestHybridAdapter({ mode: 'auto' });
      adapter.sdkError = new Error('sdk unavailable');

      await expect(adapter.execute({ prompt: 'test' })).rejects.toThrow('sdk unavailable');
    });
  });

  describe('circuit breaker', () => {
    it('should track SDK circuit breaker state', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });

      // Initial state should be closed
      expect(adapter.getSDKCircuitBreakerState()).toBe('closed');

      // Execute successfully
      await adapter.execute({ prompt: 'test' });

      // Should still be closed
      expect(adapter.getSDKCircuitBreakerState()).toBe('closed');
    });

    it('should track CLI circuit breaker state', async () => {
      const adapter = new TestHybridAdapter({ mode: 'cli' });

      // Initial state should be closed
      expect(adapter.getCLICircuitBreakerState()).toBe('closed');

      // Execute successfully
      await adapter.execute({ prompt: 'test' });

      // Should still be closed
      expect(adapter.getCLICircuitBreakerState()).toBe('closed');
    });

    it('should reset circuit breakers', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });

      // Reset circuit breakers
      adapter.resetCircuitBreakers();

      expect(adapter.getSDKCircuitBreakerState()).toBe('closed');
      expect(adapter.getCLICircuitBreakerState()).toBe('closed');
    });
  });

  describe('initialization', () => {
    it('should initialize SDK in auto mode when SDK is available', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });
      adapter.sdkAvailable = true;
      adapter.cliAvailable = true;

      await adapter.execute({ prompt: 'test' });

      expect(adapter.isTestSdkInitialized()).toBe(true);
    });

    it('should initialize CLI as fallback in auto mode', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });
      adapter.sdkAvailable = true;
      adapter.cliAvailable = true;

      await adapter.execute({ prompt: 'test' });

      expect(adapter.isTestCliInitialized()).toBe(true);
    });

    it('should throw error when SDK not available in sdk mode', async () => {
      const adapter = new TestHybridAdapter({ mode: 'sdk' });
      adapter.sdkAvailable = false;

      await expect(adapter.execute({ prompt: 'test' })).rejects.toThrow('SDK not available');
    });

    it('should throw error when CLI not available in cli mode', async () => {
      const adapter = new TestHybridAdapter({ mode: 'cli' });
      adapter.cliAvailable = false;

      await expect(adapter.execute({ prompt: 'test' })).rejects.toThrow('CLI not available');
    });
  });

  describe('cleanup', () => {
    it('should destroy adapters on cleanup', async () => {
      const adapter = new TestHybridAdapter({ mode: 'auto' });

      // Initialize
      await adapter.execute({ prompt: 'test' });
      expect(adapter.isTestSdkInitialized()).toBe(true);
      expect(adapter.isTestCliInitialized()).toBe(true);

      // Destroy
      await adapter.destroy();

      expect(adapter.isTestSdkInitialized()).toBe(false);
      expect(adapter.isTestCliInitialized()).toBe(false);
      expect(adapter.getActiveMode()).toBe(null);
    });
  });
});
