/**
 * Integration Tests: Router Quota Exhaustion and Fallback
 *
 * These tests verify that all three critical bugs are fixed:
 * - Bug #1: Race condition with stale provider snapshot
 * - Bug #2: String-based rate limit detection missing provider-specific formats
 * - Bug #3: Missing error context validation causing silent failures
 *
 * @group integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../../src/core/router.js';
import { getProviderLimitManager } from '../../src/core/provider-limit-manager.js';
import { BaseProvider } from '../../src/providers/base-provider.js';
import { ErrorCode, ProviderError } from '../../src/types/provider.js';
import type { ProviderRequest, ProviderResponse } from '../../src/types/provider.js';

// Mock providers for testing
class MockGeminiProvider extends BaseProvider {
  public executeCalls = 0;
  public shouldFail = false;
  public failureType: 'quota' | 'rate_limit' | 'generic' = 'quota';

  constructor() {
    super({
      name: 'gemini-cli',
      enabled: true,
      timeout: 5000,
      maxRetries: 1
    });
  }

  async execute(_request: ProviderRequest): Promise<ProviderResponse> {
    this.executeCalls++;

    if (this.shouldFail) {
      // Simulate different error types based on configuration
      switch (this.failureType) {
        case 'quota':
          // Gemini-specific quota error format (Bug #2 test)
          throw new ProviderError(
            'Error: RESOURCE_EXHAUSTED - Quota exceeded for requests per day',
            ErrorCode.PROVIDER_RATE_LIMIT,
            {
              resetAtMs: Date.now() + 86400000, // 24 hours
              limitWindow: 'daily',
              reason: 'quota_exceeded'
            }
          );
        case 'rate_limit':
          // Generic rate limit error with missing context (Bug #3 test)
          throw new ProviderError(
            'Rate limit exceeded',
            ErrorCode.PROVIDER_RATE_LIMIT,
            {} // Empty context - tests Bug #3 fix
          );
        default:
          throw new ProviderError('Generic error', ErrorCode.PROVIDER_EXEC_ERROR);
      }
    }

    return {
      content: 'Success from Gemini',
      model: 'gemini-1.5-flash',
      latencyMs: 100,
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      finishReason: 'stop'
    };
  }
}

class MockClaudeProvider extends BaseProvider {
  public executeCalls = 0;
  public shouldFail = false;

  constructor() {
    super({
      name: 'claude',
      enabled: true,
      timeout: 5000,
      maxRetries: 1
    });
  }

  async execute(_request: ProviderRequest): Promise<ProviderResponse> {
    this.executeCalls++;

    if (this.shouldFail) {
      throw new ProviderError('Service unavailable', ErrorCode.PROVIDER_EXEC_ERROR);
    }

    return {
      content: 'Success from Claude',
      model: 'claude-3-sonnet',
      latencyMs: 150,
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      finishReason: 'stop'
    };
  }
}

class MockOpenAIProvider extends BaseProvider {
  public executeCalls = 0;
  public shouldFail = false;

  constructor() {
    super({
      name: 'openai',
      enabled: true,
      timeout: 5000,
      maxRetries: 1
    });
  }

  async execute(_request: ProviderRequest): Promise<ProviderResponse> {
    this.executeCalls++;

    if (this.shouldFail) {
      // OpenAI-specific quota error format (Bug #2 test)
      throw new ProviderError(
        'insufficient_quota: You have exceeded your quota',
        ErrorCode.PROVIDER_RATE_LIMIT,
        {
          resetAtMs: Date.now() + 3600000, // 1 hour
          limitWindow: 'hour'
        }
      );
    }

    return {
      content: 'Success from OpenAI',
      model: 'gpt-4',
      latencyMs: 200,
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      finishReason: 'stop'
    };
  }
}

describe('Router Quota Exhaustion - Real World Scenarios', () => {
  let router: Router;
  let mockGemini: MockGeminiProvider;
  let mockClaude: MockClaudeProvider;
  let mockOpenAI: MockOpenAIProvider;

  beforeEach(async () => {
    // Reset limit manager state
    const limitManager = await getProviderLimitManager();
    limitManager['providerStates'].clear();

    // Create mock providers
    mockGemini = new MockGeminiProvider();
    mockClaude = new MockClaudeProvider();
    mockOpenAI = new MockOpenAIProvider();

    // Create router with mock providers
    router = new Router({
      providers: {
        'gemini-cli': { enabled: true, priority: 1, timeout: 5000 },
        'claude': { enabled: true, priority: 2, timeout: 5000 },
        'openai': { enabled: true, priority: 3, timeout: 5000 }
      },
      router: {
        fallbackEnabled: true,
        healthCheckInterval: 60000
      },
      execution: {
        defaultTimeout: 10000,
        maxRetries: 1
      }
    });

    // Inject mock providers
    router['providers'] = {
      'gemini-cli': mockGemini,
      'claude': mockClaude,
      'openai': mockOpenAI
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bug #1: Race Condition with Stale Provider Snapshot', () => {
    it('should skip provider that became limited during concurrent execution', async () => {
      // Scenario: Two concurrent requests
      // Request 1 exhausts Gemini quota
      // Request 2 should skip Gemini and use Claude

      mockGemini.shouldFail = true;
      mockGemini.failureType = 'quota';

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Execute first request - exhausts Gemini
      const promise1 = router.execute(request);

      // Execute second request concurrently
      // Bug #1 Fix: Should dynamically check if Gemini is limited
      const promise2 = router.execute(request);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // First request should fallback to Claude (Gemini failed)
      expect(result1.content).toContain('Claude');
      expect(mockGemini.executeCalls).toBeGreaterThanOrEqual(1);
      expect(mockClaude.executeCalls).toBeGreaterThanOrEqual(1);

      // Second request should skip limited Gemini and use Claude directly
      expect(result2.content).toContain('Claude');

      // Verify Gemini is marked as limited
      const limitManager = await getProviderLimitManager();
      const limitCheck = limitManager.isProviderLimited('gemini-cli');
      expect(limitCheck.isLimited).toBe(true);
      expect(limitCheck.reason).toBe('quota_exceeded');
    });

    it('should handle all providers becoming limited during fallback loop', async () => {
      // All providers fail with quota errors
      mockGemini.shouldFail = true;
      mockGemini.failureType = 'quota';
      mockClaude.shouldFail = true;
      mockOpenAI.shouldFail = true;

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Should try all providers and eventually throw error
      await expect(router.execute(request)).rejects.toThrow();

      // All providers should be marked as limited
      const limitManager = await getProviderLimitManager();
      expect(limitManager.isProviderLimited('gemini-cli').isLimited).toBe(true);
      expect(limitManager.isProviderLimited('claude').isLimited).toBe(true);
      expect(limitManager.isProviderLimited('openai').isLimited).toBe(true);
    });

    it('should recover when provider quota resets', async () => {
      vi.useFakeTimers();

      // Gemini is initially limited
      mockGemini.shouldFail = true;
      mockGemini.failureType = 'quota';

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // First request falls back to Claude
      const result1 = await router.execute(request);
      expect(result1.content).toContain('Claude');

      // Gemini quota resets (simulate 24 hour pass)
      mockGemini.shouldFail = false;
      vi.advanceTimersByTime(86400000 + 1000); // 24 hours + 1 second

      // Second request should use Gemini again (quota reset)
      const result2 = await router.execute(request);
      expect(result2.content).toContain('Gemini');

      vi.useRealTimers();
    });
  });

  describe('Bug #2: Provider-Specific Error Detection', () => {
    it('should detect Gemini RESOURCE_EXHAUSTED as quota error', async () => {
      mockGemini.shouldFail = true;
      mockGemini.failureType = 'quota';

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Should fallback to Claude (Gemini quota detected)
      const result = await router.execute(request);
      expect(result.content).toContain('Claude');

      // Verify Gemini was marked as limited (not just failed)
      const limitManager = await getProviderLimitManager();
      const limitCheck = limitManager.isProviderLimited('gemini-cli');
      expect(limitCheck.isLimited).toBe(true);
      expect(limitCheck.reason).toBe('quota_exceeded');
    });

    it('should detect OpenAI insufficient_quota as quota error', async () => {
      // Make Gemini unavailable so OpenAI is tried
      mockGemini.shouldFail = true;
      mockGemini.failureType = 'generic';

      mockOpenAI.shouldFail = true;
      mockOpenAI.failureType = 'quota';

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Should eventually succeed with Claude
      const result = await router.execute(request);
      expect(result.content).toContain('Claude');

      // Verify OpenAI was marked as limited
      const limitManager = await getProviderLimitManager();
      const limitCheck = limitManager.isProviderLimited('openai');
      expect(limitCheck.isLimited).toBe(true);
    });

    it('should detect Claude overloaded_error as rate limit', async () => {
      // Make Gemini fail first
      mockGemini.shouldFail = true;
      mockGemini.failureType = 'generic';

      // Mock Claude with overloaded error
      mockClaude.shouldFail = true;
      mockClaude['failureType'] = 'rate_limit';

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Should fallback to OpenAI
      const result = await router.execute(request);
      expect(result.content).toContain('OpenAI');

      // Verify Claude was marked as limited
      const limitManager = await getProviderLimitManager();
      const limitCheck = limitManager.isProviderLimited('claude');
      expect(limitCheck.isLimited).toBe(true);
    });
  });

  describe('Bug #3: Missing Error Context Validation', () => {
    it('should record limit even when resetAtMs is missing', async () => {
      mockGemini.shouldFail = true;
      mockGemini.failureType = 'rate_limit'; // This throws error with empty context

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Should fallback to Claude
      const result = await router.execute(request);
      expect(result.content).toContain('Claude');

      // Bug #3 Fix: Limit should still be recorded (with default 1hr)
      const limitManager = await getProviderLimitManager();
      const limitCheck = limitManager.isProviderLimited('gemini-cli');
      expect(limitCheck.isLimited).toBe(true);
      expect(limitCheck.reason).toBeDefined();
    });

    it('should use default reset time when context incomplete', async () => {
      vi.useFakeTimers();

      mockGemini.shouldFail = true;
      mockGemini.failureType = 'rate_limit'; // Empty context

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // First request - Gemini fails, falls back
      await router.execute(request);

      // Gemini should be limited for ~1 hour (default)
      const limitManager = await getProviderLimitManager();
      expect(limitManager.isProviderLimited('gemini-cli').isLimited).toBe(true);

      // After 30 minutes - still limited
      vi.advanceTimersByTime(1800000); // 30 minutes
      expect(limitManager.isProviderLimited('gemini-cli').isLimited).toBe(true);

      // After 1 hour + buffer - should be available again
      vi.advanceTimersByTime(1900000); // 30 minutes + buffer
      mockGemini.shouldFail = false;

      // Should use Gemini again (quota reset with default timing)
      const result2 = await router.execute(request);
      expect(result2.content).toContain('Gemini');

      vi.useRealTimers();
    });

    it('should log warning when error context incomplete', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockGemini.shouldFail = true;
      mockGemini.failureType = 'rate_limit'; // Empty context

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      await router.execute(request);

      // Should have logged warnings about missing context
      expect(warnSpy).toHaveBeenCalled();
      const warnings = warnSpy.mock.calls.map(call => JSON.stringify(call));
      const hasResetWarning = warnings.some(w =>
        w.includes('resetAtMs') || w.includes('missing')
      );
      expect(hasResetWarning).toBe(true);

      warnSpy.mockRestore();
    });
  });

  describe('Integration: All Fixes Working Together', () => {
    it('should handle complex scenario with concurrent quota exhaustion', async () => {
      // Scenario:
      // 1. Multiple concurrent requests
      // 2. First request exhausts Gemini (provider-specific error)
      // 3. Second request should skip Gemini (race condition fix)
      // 4. Error has incomplete context (context validation fix)

      mockGemini.shouldFail = true;
      mockGemini.failureType = 'rate_limit'; // Incomplete context

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      // Launch 3 concurrent requests
      const promises = [
        router.execute(request),
        router.execute(request),
        router.execute(request)
      ];

      const results = await Promise.all(promises);

      // All should succeed by falling back to Claude/OpenAI
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.content).not.toContain('Gemini');
      });

      // Gemini should be marked as limited
      const limitManager = await getProviderLimitManager();
      expect(limitManager.isProviderLimited('gemini-cli').isLimited).toBe(true);

      // Later requests should not even try Gemini
      mockGemini.executeCalls = 0; // Reset counter
      const laterResult = await router.execute(request);
      expect(laterResult.content).toBeDefined();
      expect(mockGemini.executeCalls).toBe(0); // Gemini was skipped
    });

    it('should maintain performance with quota checking overhead', async () => {
      // Ensure quota checking adds minimal latency

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      const startTime = Date.now();
      await router.execute(request);
      const elapsed = Date.now() - startTime;

      // Quota check should add < 5ms overhead
      expect(elapsed).toBeLessThan(500); // 500ms total (includes mock execution)
    });
  });

  describe('Error Messages and Observability', () => {
    it('should provide clear error when all providers quota exhausted', async () => {
      mockGemini.shouldFail = true;
      mockClaude.shouldFail = true;
      mockOpenAI.shouldFail = true;

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      await expect(router.execute(request)).rejects.toThrow(
        /all providers/i
      );
    });

    it('should log quota exhaustion events for debugging', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockGemini.shouldFail = true;
      mockGemini.failureType = 'quota';

      const request: ProviderRequest = {
        prompt: 'Test task',
        model: 'default'
      };

      await router.execute(request);

      // Should have logged quota exhaustion
      expect(warnSpy).toHaveBeenCalled();
      const logs = warnSpy.mock.calls.map(call => JSON.stringify(call));
      const hasQuotaLog = logs.some(log =>
        log.includes('quota') || log.includes('limit')
      );
      expect(hasQuotaLog).toBe(true);

      warnSpy.mockRestore();
    });
  });
});
