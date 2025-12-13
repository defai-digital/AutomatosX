/**
 * Comprehensive tests for BaseProvider
 *
 * Tests for the base provider class that all providers extend.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { ProviderError, ErrorCode } from '../../../src/shared/errors/errors.js';
import type { ExecutionRequest } from '../../../src/types/provider.js';

// Mock spawn for CLI execution tests
const spawnMock = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Mock fs for debug prompt path tests
const writeFileSyncMock = vi.fn();
vi.mock('fs', () => ({
  writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => ''),
}));

// Mock dependencies
vi.mock('../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/shared/logging/verbosity-manager.js', () => ({
  VerbosityManager: {
    getInstance: () => ({
      isQuiet: () => false,
    }),
  },
}));

vi.mock('../../../src/shared/process/streaming-progress-parser.js', () => ({
  StreamingProgressParser: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    update: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    parseLine: vi.fn(() => null),
  })),
}));

vi.mock('../../../src/core/cli-provider-detector.js', () => ({
  findOnPath: vi.fn((cmd: string) => {
    if (cmd === 'echo' || cmd === 'mock-found') {
      return { found: true, path: '/usr/bin/' + cmd };
    }
    return { found: false, path: undefined };
  }),
}));

const isLimitErrorMock = vi.fn();
vi.mock('../../../src/providers/error-patterns.js', () => ({
  isLimitError: (error: unknown, _provider: string) => isLimitErrorMock(error),
}));

const shouldRetryErrorMock = vi.fn();
vi.mock('../../../src/providers/retry-errors.js', () => ({
  shouldRetryError: (error: Error, _provider: string) => shouldRetryErrorMock(error),
}));

vi.mock('../../../src/providers/provider-schemas.js', () => ({
  safeValidateExecutionRequest: vi.fn((req: unknown) => ({ success: true as const, data: req })),
  safeValidateExecutionResponse: vi.fn((res: unknown) => ({ success: true as const, data: res })),
}));

/**
 * Helper to create a typed Zod validation error result
 * Matches the ZodSafeParseError structure from Zod v4
 * Uses type assertion since we only need the properties accessed by the code under test
 */
function createZodValidationError(
  path: (string | number)[],
  message: string,
  additionalIssues?: Array<{ path: (string | number)[]; message: string }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const issues = [
    { path, message, code: 'invalid_type' as const },
    ...(additionalIssues || []).map(i => ({ ...i, code: 'invalid_type' as const })),
  ];
  return {
    success: false as const,
    error: {
      name: 'ZodError' as const,
      message: JSON.stringify(issues),
      issues,
      // Stub methods for ZodError interface compatibility
      format: () => ({}),
      flatten: () => ({ formErrors: [], fieldErrors: {} }),
      addIssue: () => {},
      addIssues: () => {},
    },
  };
}

/**
 * Helper to create a mock child process with proper streams
 * Uses PassThrough streams which are proper Readable streams
 * that work with readline.createInterface
 */
function createMockChildProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  const proc = Object.assign(new EventEmitter(), {
    pid: 12345,
    killed: false,
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    stdout,
    stderr,
    kill: vi.fn(function(this: any) {
      this.killed = true;
    }),
  });
  return proc;
}

import { BaseProvider } from '../../../src/providers/base-provider.js';
import { findOnPath } from '../../../src/core/cli-provider-detector.js';
import {
  safeValidateExecutionRequest,
  safeValidateExecutionResponse,
} from '../../../src/providers/provider-schemas.js';

const baseConfig = {
  name: 'test-provider',
  enabled: true,
  priority: 1,
  timeout: 1000,
};

/**
 * Test implementation of BaseProvider
 */
class TestProvider extends BaseProvider {
  public mockResponseValue = 'mock response';
  public mockCLICommand = 'echo';
  public mockCLIArgs: string[] = [];

  protected getCLICommand(): string {
    return this.mockCLICommand;
  }

  protected override getCLIArgs(): string[] {
    return this.mockCLIArgs;
  }

  protected getMockResponse(): string {
    return this.mockResponseValue;
  }

  // Expose protected methods for testing
  public testHandleError(error: unknown): ProviderError {
    return this.handleError(error);
  }

  public testEscapeShellArg(arg: string): string {
    return this.escapeShellArg(arg);
  }

  public async testCheckCLIAvailable(): Promise<boolean> {
    return this.checkCLIAvailable();
  }
}

describe('BaseProvider', () => {
  let originalMockProviders: string | undefined;
  let originalPlatform: string;

  beforeEach(() => {
    vi.clearAllMocks();
    isLimitErrorMock.mockReturnValue(false);
    shouldRetryErrorMock.mockReturnValue(false);
    originalMockProviders = process.env.AX_MOCK_PROVIDERS;
    originalPlatform = process.platform;
  });

  afterEach(() => {
    if (originalMockProviders !== undefined) {
      process.env.AX_MOCK_PROVIDERS = originalMockProviders;
    } else {
      delete process.env.AX_MOCK_PROVIDERS;
    }
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  describe('constructor', () => {
    it('should accept valid provider names from whitelist', () => {
      const validNames = [
        'claude', 'claude-code', 'gemini', 'gemini-cli',
        'openai', 'codex', 'glm', 'ax-glm', 'grok', 'ax-grok',
        'qwen', 'qwen-code', 'test-provider'
      ];

      for (const name of validNames) {
        expect(() => new TestProvider({ ...baseConfig, name })).not.toThrow();
      }
    });

    it('should reject invalid provider names', () => {
      const invalidNames = ['invalid', 'bad-provider', 'malicious', 'shell;injection'];

      for (const name of invalidNames) {
        expect(() => new TestProvider({ ...baseConfig, name }))
          .toThrow(ProviderError);
      }
    });

    it('should normalize provider name to lowercase', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'TEST-PROVIDER' });
      expect(provider.getName()).toBe('test-provider');
    });

    it('should initialize health state correctly', async () => {
      // Note: getHealth() calls isAvailable() which updates health state
      // In mock mode, isAvailable() returns true, so we test the actual behavior
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);
      const health = await provider.getHealth();

      // After getHealth() call, available is true (mock mode)
      expect(health.available).toBe(true);
      expect(health.errorRate).toBe(0);
      expect(health.consecutiveFailures).toBe(0);
    });
  });

  describe('getName', () => {
    it('should return the provider name', () => {
      const provider = new TestProvider(baseConfig);
      expect(provider.getName()).toBe('test-provider');
    });
  });

  describe('name getter', () => {
    it('should return the provider name', () => {
      const provider = new TestProvider(baseConfig);
      expect(provider.name).toBe('test-provider');
    });
  });

  describe('version getter', () => {
    it('should return version string', () => {
      const provider = new TestProvider(baseConfig);
      expect(provider.version).toBe('1.0.0');
    });
  });

  describe('priority getter', () => {
    it('should return priority from config', () => {
      const provider = new TestProvider({ ...baseConfig, priority: 5 });
      expect(provider.priority).toBe(5);
    });
  });

  describe('capabilities getter', () => {
    it('should return default capabilities', () => {
      const provider = new TestProvider(baseConfig);
      const caps = provider.capabilities;

      expect(caps.supportsStreaming).toBe(false);
      expect(caps.supportsEmbedding).toBe(false);
      expect(caps.supportsVision).toBe(false);
      expect(caps.maxContextTokens).toBe(128000);
      expect(caps.supportedModels).toContain('default');
    });
  });

  describe('execute', () => {
    it('should return mock response in mock mode', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);
      provider.mockResponseValue = 'test mock output';

      const request: ExecutionRequest = {
        prompt: 'test prompt',
      };

      const response = await provider.execute(request);

      expect(response.content).toBe('test mock output');
      expect(response.model).toBe('default');
      expect(response.finishReason).toBe('stop');
      expect(response.cached).toBe(false);
    });

    it('should update health on successful execution', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      const request: ExecutionRequest = {
        prompt: 'test prompt',
      };

      await provider.execute(request);

      const health = await provider.getHealth();
      expect(health.consecutiveFailures).toBe(0);
    });

    it('should combine system prompt with user prompt', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      const request: ExecutionRequest = {
        prompt: 'user prompt',
        systemPrompt: 'system prompt',
      };

      // Just verify no error occurs with both prompts
      const response = await provider.execute(request);
      expect(response.content).toBeDefined();
    });

    it('should throw on invalid request', async () => {
      const provider = new TestProvider(baseConfig);

      vi.mocked(safeValidateExecutionRequest).mockReturnValueOnce(
        createZodValidationError(['prompt'], 'Required')
      );

      const request: ExecutionRequest = {
        prompt: '',
      };

      await expect(provider.execute(request)).rejects.toThrow(ProviderError);
    });

    it('should throw on invalid response', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      vi.mocked(safeValidateExecutionResponse).mockReturnValueOnce(
        createZodValidationError(['content'], 'Invalid content')
      );

      const request: ExecutionRequest = {
        prompt: 'test',
      };

      await expect(provider.execute(request)).rejects.toThrow(ProviderError);
    });

    it('should update health on failure', async () => {
      // Disable mock mode to test real failure tracking
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'not-found';

      vi.mocked(safeValidateExecutionRequest).mockReturnValueOnce(
        createZodValidationError(['prompt'], 'Required')
      );

      const request: ExecutionRequest = {
        prompt: '',
      };

      try {
        await provider.execute(request);
      } catch {
        // Expected
      }

      // getHealth() calls isAvailable() which updates health
      // In non-mock mode with not-found CLI, this will show failures
      const health = await provider.getHealth();
      expect(health.consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('isAvailable', () => {
    it('should return true when CLI is available', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'mock-found';

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when CLI is not available', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'not-found-cmd';

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return true in mock mode', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'not-found-cmd';

      const available = await provider.testCheckCLIAvailable();
      expect(available).toBe(true);
    });

    it('should update health on availability check', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'mock-found';

      await provider.isAvailable();

      // getHealth() calls isAvailable() again, but that's ok since CLI is found
      const health = await provider.getHealth();
      expect(health.available).toBe(true);
      expect(health.lastCheckTime).toBeGreaterThan(0);
    });

    it('should increment consecutive failures on unavailable', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'not-found';

      await provider.isAvailable();
      await provider.isAvailable();

      // Don't call getHealth() as it will trigger another isAvailable() call
      // Instead test directly that isAvailable returns false
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      vi.mocked(findOnPath).mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'mock-found';

      const health = await provider.healthCheck();

      expect(health).toHaveProperty('available');
      expect(health).toHaveProperty('latencyMs');
      expect(health).toHaveProperty('errorRate');
      expect(health).toHaveProperty('consecutiveFailures');
      expect(health).toHaveProperty('lastCheckTime');
    });
  });

  describe('getHealth', () => {
    it('should return health status after availability check', async () => {
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'mock-found';

      await provider.isAvailable();
      const health = await provider.getHealth();

      expect(health.available).toBe(true);
    });
  });

  describe('handleError', () => {
    it('should return existing ProviderError unchanged', () => {
      const provider = new TestProvider(baseConfig);
      const originalError = new ProviderError('Original', ErrorCode.PROVIDER_EXEC_ERROR);

      const result = provider.testHandleError(originalError);
      expect(result).toBe(originalError);
    });

    it('should map "command not found" to PROVIDER_NOT_FOUND', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError(new Error('command not found'));
      expect(result.code).toBe(ErrorCode.PROVIDER_NOT_FOUND);
    });

    it('should map "ENOENT" to PROVIDER_NOT_FOUND', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError(new Error('ENOENT: file not found'));
      expect(result.code).toBe(ErrorCode.PROVIDER_NOT_FOUND);
    });

    it('should map "timeout" to PROVIDER_TIMEOUT', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError(new Error('timeout exceeded'));
      expect(result.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
    });

    it('should map "ETIMEDOUT" to PROVIDER_TIMEOUT', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError(new Error('ETIMEDOUT'));
      expect(result.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
    });

    it('should detect rate limit errors', () => {
      const provider = new TestProvider(baseConfig);
      isLimitErrorMock.mockReturnValue(true);

      const result = provider.testHandleError(new Error('rate limited'));
      expect(result.code).toBe(ErrorCode.PROVIDER_RATE_LIMIT);
    });

    it('should default to PROVIDER_EXEC_ERROR for unknown errors', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError(new Error('some unknown error'));
      expect(result.code).toBe(ErrorCode.PROVIDER_EXEC_ERROR);
    });

    it('should handle non-Error objects', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError('string error');
      expect(result).toBeInstanceOf(ProviderError);
      expect(result.message).toContain('string error');
    });

    it('should include provider name in error message', () => {
      const provider = new TestProvider(baseConfig);

      const result = provider.testHandleError(new Error('test'));
      expect(result.message).toContain('test-provider');
    });
  });

  describe('escapeShellArg', () => {
    describe('POSIX (Unix/Mac)', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
      });

      it('should wrap simple string in single quotes', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('hello');
        expect(result).toBe("'hello'");
      });

      it('should escape single quotes', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg("it's");
        expect(result).toBe("'it'\\''s'");
      });

      it('should handle multiple single quotes', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg("'hello' 'world'");
        expect(result).toBe("''\\''hello'\\'' '\\''world'\\'''");
      });

      it('should preserve special characters', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('$HOME && rm -rf');
        expect(result).toBe("'$HOME && rm -rf'");
      });

      it('should handle newlines', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('line1\nline2');
        expect(result).toBe("'line1\nline2'");
      });
    });

    describe('Windows', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
      });

      it('should wrap simple string in double quotes', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('hello');
        expect(result).toBe('"hello"');
      });

      it('should escape double quotes', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('say "hello"');
        expect(result).toBe('"say \\"hello\\""');
      });

      it('should escape percent signs', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('100%');
        expect(result).toBe('"100%%"');
      });

      it('should handle both quotes and percent', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('"50%"');
        expect(result).toBe('"\\"50%%\\""');
      });
    });
  });

  describe('shouldRetry', () => {
    it('should delegate to shouldRetryError', () => {
      const provider = new TestProvider(baseConfig);
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });

    it('should return false when shouldRetryError returns false', () => {
      const provider = new TestProvider(baseConfig);
      shouldRetryErrorMock.mockReturnValue(false);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(false);
    });

    it('should map provider names correctly for retry logic', () => {
      // Test claude mapping
      const claudeProvider = new TestProvider({ ...baseConfig, name: 'claude' });
      claudeProvider.shouldRetry(new Error('test'));
      expect(shouldRetryErrorMock).toHaveBeenCalled();

      // Test gemini mapping
      vi.clearAllMocks();
      const geminiProvider = new TestProvider({ ...baseConfig, name: 'gemini' });
      geminiProvider.shouldRetry(new Error('test'));
      expect(shouldRetryErrorMock).toHaveBeenCalled();

      // Test openai mapping
      vi.clearAllMocks();
      const openaiProvider = new TestProvider({ ...baseConfig, name: 'openai' });
      openaiProvider.shouldRetry(new Error('test'));
      expect(shouldRetryErrorMock).toHaveBeenCalled();

      // Test glm mapping
      vi.clearAllMocks();
      const glmProvider = new TestProvider({ ...baseConfig, name: 'glm' });
      glmProvider.shouldRetry(new Error('test'));
      expect(shouldRetryErrorMock).toHaveBeenCalled();

      // Test grok mapping
      vi.clearAllMocks();
      const grokProvider = new TestProvider({ ...baseConfig, name: 'grok' });
      grokProvider.shouldRetry(new Error('test'));
      expect(shouldRetryErrorMock).toHaveBeenCalled();

      // Test qwen mapping
      vi.clearAllMocks();
      const qwenProvider = new TestProvider({ ...baseConfig, name: 'qwen' });
      qwenProvider.shouldRetry(new Error('test'));
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('getRetryDelay', () => {
    it('should return exponential backoff delay', () => {
      const provider = new TestProvider(baseConfig);

      expect(provider.getRetryDelay(1)).toBe(1000);   // 1s
      expect(provider.getRetryDelay(2)).toBe(2000);   // 2s
      expect(provider.getRetryDelay(3)).toBe(4000);   // 4s
      expect(provider.getRetryDelay(4)).toBe(8000);   // 8s
      expect(provider.getRetryDelay(5)).toBe(16000);  // 16s
    });

    it('should cap at 30 seconds', () => {
      const provider = new TestProvider(baseConfig);

      expect(provider.getRetryDelay(6)).toBe(30000);  // Capped at 30s
      expect(provider.getRetryDelay(10)).toBe(30000); // Still capped
    });
  });

  describe('getCacheMetrics', () => {
    it('should return cache metrics structure', () => {
      const provider = new TestProvider(baseConfig);
      const metrics = provider.getCacheMetrics();

      expect(metrics.availability).toBeDefined();
      expect(metrics.availability.hits).toBe(0);
      expect(metrics.availability.misses).toBe(0);

      expect(metrics.version).toBeDefined();
      expect(metrics.version.size).toBe(0);

      expect(metrics.health).toBeDefined();
      expect(metrics.health.consecutiveFailures).toBeDefined();
      expect(metrics.health.consecutiveSuccesses).toBeDefined();
    });

    it('should reflect actual health state', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      // Execute to update health
      await provider.execute({ prompt: 'test' });

      const metrics = provider.getCacheMetrics();
      expect(metrics.health.consecutiveSuccesses).toBeGreaterThan(0);
      expect(metrics.health.consecutiveFailures).toBe(0);
    });
  });

  describe('clearCaches', () => {
    it('should not throw', () => {
      const provider = new TestProvider(baseConfig);
      expect(() => provider.clearCaches()).not.toThrow();
    });
  });

  describe('supportsStreaming', () => {
    it('should return false', () => {
      const provider = new TestProvider(baseConfig);
      expect(provider.supportsStreaming()).toBe(false);
    });
  });

  describe('generateEmbedding', () => {
    it('should throw not supported error', async () => {
      const provider = new TestProvider(baseConfig);
      await expect(provider.generateEmbedding('test')).rejects.toThrow('not supported');
    });
  });

  describe('checkRateLimit', () => {
    it('should return always has capacity', async () => {
      const provider = new TestProvider(baseConfig);
      const rateLimit = await provider.checkRateLimit();

      expect(rateLimit.hasCapacity).toBe(true);
      expect(rateLimit.requestsRemaining).toBe(1000);
      expect(rateLimit.tokensRemaining).toBe(1000000);
    });
  });

  describe('waitForCapacity', () => {
    it('should resolve immediately (no-op)', async () => {
      const provider = new TestProvider(baseConfig);
      await expect(provider.waitForCapacity()).resolves.toBeUndefined();
    });
  });

  describe('estimateCost', () => {
    it('should return zero cost', async () => {
      const provider = new TestProvider(baseConfig);
      const cost = await provider.estimateCost({ prompt: 'test' });

      expect(cost.amount).toBe(0);
      expect(cost.currency).toBe('USD');
      expect(cost.breakdown.prompt).toBe(0);
      expect(cost.breakdown.completion).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    it('should return zero stats', async () => {
      const provider = new TestProvider(baseConfig);
      const stats = await provider.getUsageStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.successRate).toBe(1.0);
    });
  });

  describe('checkCLIAvailable', () => {
    it('should use findOnPath to check availability', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'mock-found';

      await provider.testCheckCLIAvailable();

      expect(findOnPath).toHaveBeenCalledWith('mock-found');
    });

    it('should return true in mock mode regardless of CLI', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);
      provider.mockCLICommand = 'nonexistent-command';

      const result = await provider.testCheckCLIAvailable();
      expect(result).toBe(true);
    });

    it('should return false when findOnPath throws', async () => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      const provider = new TestProvider(baseConfig);
      vi.mocked(findOnPath).mockImplementationOnce(() => {
        throw new Error('Search failed');
      });

      const result = await provider.testCheckCLIAvailable();
      expect(result).toBe(false);
    });
  });

  describe('executeCLI (non-mock mode)', () => {
    let originalDebugPrompt: string | undefined;

    beforeEach(() => {
      process.env.AX_MOCK_PROVIDERS = 'false';
      originalDebugPrompt = process.env.AUTOMATOSX_DEBUG_PROMPT;
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
      if (originalDebugPrompt !== undefined) {
        process.env.AUTOMATOSX_DEBUG_PROMPT = originalDebugPrompt;
      } else {
        delete process.env.AUTOMATOSX_DEBUG_PROMPT;
      }
    });

    it('should execute CLI and return stdout', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test prompt' });

      // Simulate CLI output using PassThrough stream
      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('CLI response output\n');
      mockProc.stdout.end();
      mockProc.emit('close', 0, null);

      const response = await executePromise;
      expect(response.content).toContain('CLI response output');
      expect(response.finishReason).toBe('stop');
    });

    it('should handle CLI with multiple output lines', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('line 1\n');
      mockProc.stdout.write('line 2\n');
      mockProc.stdout.write('line 3\n');
      mockProc.stdout.end();
      mockProc.emit('close', 0, null);

      const response = await executePromise;
      expect(response.content).toContain('line 1');
      expect(response.content).toContain('line 2');
      expect(response.content).toContain('line 3');
    });

    it('should throw on CLI non-zero exit code', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stderr.write('Error message');
      mockProc.stderr.end();
      mockProc.stdout.end();
      mockProc.emit('close', 1, null);

      await expect(executePromise).rejects.toThrow(ProviderError);
    });

    it('should throw on CLI spawn error', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('error', new Error('spawn ENOENT'));

      await expect(executePromise).rejects.toThrow(ProviderError);
    });

    it('should throw on CLI killed by signal', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', null, 'SIGTERM');

      await expect(executePromise).rejects.toThrow(ProviderError);
    });

    it('should throw on empty CLI output', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      // Close without any stdout
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      await expect(executePromise).rejects.toThrow('empty output');
    });

    it('should pass CLI args from getCLIArgs', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      provider.mockCLIArgs = ['--approval-mode', 'auto_edit'];

      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('response\n');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      await executePromise;

      // Verify spawn was called (command includes args)
      expect(spawnMock).toHaveBeenCalled();
      const spawnCall = spawnMock.mock.calls[0];
      expect(spawnCall).toBeDefined();
      // The command string should include the args
      expect(spawnCall![0]).toContain('--approval-mode');
    });

    it('should write debug prompt when AUTOMATOSX_DEBUG_PROMPT is set', async () => {
      process.env.AUTOMATOSX_DEBUG_PROMPT = 'true';
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'debug test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('response\n');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      await executePromise;

      expect(writeFileSyncMock).toHaveBeenCalled();
      const writeCall = writeFileSyncMock.mock.calls[0];
      expect(writeCall).toBeDefined();
      expect(writeCall![0]).toContain('debug-prompt.txt');
      expect(writeCall![1]).toContain('debug test');
    });

    it('should capture stderr output', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('stdout output\n');
      mockProc.stderr.write('stderr warning');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      // Should succeed even with stderr output
      const response = await executePromise;
      expect(response.content).toContain('stdout output');
    });

    it('should update latency on successful execution', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const executePromise = provider.execute({ prompt: 'test' });

      // Advance time to simulate latency
      await vi.advanceTimersByTimeAsync(100);
      mockProc.stdout.write('response\n');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      const response = await executePromise;
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shouldRetry with codex provider', () => {
    it('should use codex retry profile', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'codex' });
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('shouldRetry with claude-code alias', () => {
    it('should use claude retry profile for claude-code', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'claude-code' });
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('shouldRetry with gemini-cli alias', () => {
    it('should use gemini retry profile for gemini-cli', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'gemini-cli' });
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('shouldRetry with ax-glm alias', () => {
    it('should use glm retry profile for ax-glm', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'ax-glm' });
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('shouldRetry with ax-grok alias', () => {
    it('should use grok retry profile for ax-grok', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'ax-grok' });
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('shouldRetry with qwen-code alias', () => {
    it('should use qwen retry profile for qwen-code', () => {
      const provider = new TestProvider({ ...baseConfig, name: 'qwen-code' });
      shouldRetryErrorMock.mockReturnValue(true);

      const result = provider.shouldRetry(new Error('test'));
      expect(result).toBe(true);
      expect(shouldRetryErrorMock).toHaveBeenCalled();
    });
  });

  describe('detectRateLimitError', () => {
    it('should detect rate limit errors via isLimitError', () => {
      const provider = new TestProvider(baseConfig);
      isLimitErrorMock.mockReturnValue(true);

      const result = provider.testHandleError(new Error('RESOURCE_EXHAUSTED'));
      expect(result.code).toBe(ErrorCode.PROVIDER_RATE_LIMIT);
      expect(isLimitErrorMock).toHaveBeenCalled();
    });

    it('should not detect non-rate-limit errors', () => {
      const provider = new TestProvider(baseConfig);
      isLimitErrorMock.mockReturnValue(false);

      const result = provider.testHandleError(new Error('some other error'));
      expect(result.code).toBe(ErrorCode.PROVIDER_EXEC_ERROR);
    });
  });

  describe('escapeShellArg edge cases', () => {
    describe('POSIX empty string', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
      });

      it('should handle empty string', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('');
        expect(result).toBe("''");
      });

      it('should handle backslashes', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('path\\to\\file');
        expect(result).toBe("'path\\to\\file'");
      });

      it('should handle tabs', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('col1\tcol2');
        expect(result).toBe("'col1\tcol2'");
      });
    });

    describe('Windows edge cases', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
      });

      it('should handle empty string', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('');
        expect(result).toBe('""');
      });

      it('should handle backslashes (no escaping needed)', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('C:\\Users\\test');
        expect(result).toBe('"C:\\Users\\test"');
      });

      it('should handle mixed special characters', () => {
        const provider = new TestProvider(baseConfig);
        const result = provider.testEscapeShellArg('echo "hello" %PATH%');
        expect(result).toBe('"echo \\"hello\\" %%PATH%%"');
      });
    });
  });

  describe('health tracking', () => {
    it('should track consecutive successes', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      // Execute multiple times
      await provider.execute({ prompt: 'test1' });
      await provider.execute({ prompt: 'test2' });
      await provider.execute({ prompt: 'test3' });

      const metrics = provider.getCacheMetrics();
      expect(metrics.health.consecutiveSuccesses).toBe(3);
      expect(metrics.health.consecutiveFailures).toBe(0);
    });

    it('should reset consecutive successes on failure', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      // Execute successfully first
      await provider.execute({ prompt: 'test' });

      // Then fail
      vi.mocked(safeValidateExecutionRequest).mockReturnValueOnce(
        createZodValidationError(['prompt'], 'Required')
      );

      try {
        await provider.execute({ prompt: '' });
      } catch {
        // Expected
      }

      const metrics = provider.getCacheMetrics();
      expect(metrics.health.consecutiveSuccesses).toBe(0);
      expect(metrics.health.consecutiveFailures).toBe(1);
    });
  });

  describe('execute validation error messages', () => {
    it('should include field path in validation error', async () => {
      const provider = new TestProvider(baseConfig);

      vi.mocked(safeValidateExecutionRequest).mockReturnValueOnce(
        createZodValidationError(['options', 'maxTokens'], 'Must be positive')
      );

      await expect(provider.execute({ prompt: 'test' }))
        .rejects.toThrow('options.maxTokens: Must be positive');
    });

    it('should join multiple validation errors', async () => {
      const provider = new TestProvider(baseConfig);

      vi.mocked(safeValidateExecutionRequest).mockReturnValueOnce(
        createZodValidationError(['prompt'], 'Required', [
          { path: ['options'], message: 'Invalid' },
        ])
      );

      try {
        await provider.execute({ prompt: '' });
      } catch (error) {
        expect((error as Error).message).toContain('prompt: Required');
        expect((error as Error).message).toContain('options: Invalid');
      }
    });
  });

  describe('executeWithStdin (Windows long prompt)', () => {
    let originalMockProviders: string | undefined;
    let originalPlatform: PropertyDescriptor | undefined;

    beforeEach(() => {
      originalMockProviders = process.env.AX_MOCK_PROVIDERS;
      process.env.AX_MOCK_PROVIDERS = 'false';
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      // Simulate Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
      if (originalMockProviders !== undefined) {
        process.env.AX_MOCK_PROVIDERS = originalMockProviders;
      } else {
        delete process.env.AX_MOCK_PROVIDERS;
      }
    });

    it('should use stdin for long prompts on Windows', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      // Create a prompt longer than 7000 chars to trigger stdin mode
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('response from stdin mode\n');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      const response = await executePromise;
      expect(response.content).toContain('response from stdin mode');
      // Verify stdin was used (write should have been called)
      expect(mockProc.stdin.write).toHaveBeenCalled();
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });

    it('should throw if stdin is not available', async () => {
      const mockProc = createMockChildProcess();
      // Remove stdin to simulate unavailability
      (mockProc as any).stdin = null;
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);

      // The promise rejection should be caught
      await expect(provider.execute({ prompt: longPrompt }))
        .rejects.toThrow(/stdin not available/);
    });

    it('should handle stdin write error', async () => {
      const mockProc = createMockChildProcess();
      // Make stdin.write throw an error
      mockProc.stdin.write = vi.fn(() => {
        throw new Error('stdin write failed');
      });
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);

      // The promise rejection should be caught
      await expect(provider.execute({ prompt: longPrompt }))
        .rejects.toThrow(/stdin/);
    });

    it('should throw on non-zero exit code in stdin mode', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stderr.write('Command failed\n');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 1, null);

      await expect(executePromise).rejects.toThrow(ProviderError);
    });

    it('should throw when process killed by signal in stdin mode', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', null, 'SIGKILL');

      await expect(executePromise).rejects.toThrow(/SIGKILL/);
    });

    it('should throw on spawn error in stdin mode', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('error', new Error('spawn EACCES'));

      await expect(executePromise).rejects.toThrow(/spawn/i);
    });

    it('should handle timeout and kill process in stdin mode', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider({ ...baseConfig, timeout: 500 });
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(600);

      // Should have called kill
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');

      // Emit close with signal
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', null, 'SIGTERM');

      await expect(executePromise).rejects.toThrow(/SIGTERM/);
    });

    it('should capture stderr output in stdin mode', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.write('success output\n');
      mockProc.stderr.write('warning message\n');
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      const response = await executePromise;
      expect(response.content).toContain('success output');
    });

    it('should handle empty stdout in stdin mode', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider(baseConfig);
      const longPrompt = 'x'.repeat(8000);
      const executePromise = provider.execute({ prompt: longPrompt });

      await vi.advanceTimersByTimeAsync(10);
      // Empty stdout
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', 0, null);

      await expect(executePromise).rejects.toThrow(/empty/i);
    });
  });

  describe('isAvailable error handling', () => {
    let originalMockProviders: string | undefined;

    beforeEach(() => {
      originalMockProviders = process.env.AX_MOCK_PROVIDERS;
      // Disable mock mode to test real availability check
      process.env.AX_MOCK_PROVIDERS = 'false';
    });

    afterEach(() => {
      if (originalMockProviders !== undefined) {
        process.env.AX_MOCK_PROVIDERS = originalMockProviders;
      } else {
        delete process.env.AX_MOCK_PROVIDERS;
      }
    });

    it('should return false when findOnPath throws an error', async () => {
      const provider = new TestProvider(baseConfig);
      // Mock findOnPath to throw an error
      vi.mocked(findOnPath).mockImplementationOnce(() => {
        throw new Error('Path lookup failed');
      });

      const result = await provider.isAvailable();
      // The catch block handles the error and returns false
      expect(result).toBe(false);
    });
  });

  describe('response validation', () => {
    it('should throw on invalid response format', async () => {
      process.env.AX_MOCK_PROVIDERS = 'true';
      const provider = new TestProvider(baseConfig);

      vi.mocked(safeValidateExecutionResponse).mockReturnValueOnce(
        createZodValidationError(['content'], 'Invalid content type')
      );

      // The error message format is "Provider returned invalid response structure: <error>"
      await expect(provider.execute({ prompt: 'test' }))
        .rejects.toThrow('Invalid content type');
    });
  });

  describe('timeout and process killing', () => {
    let originalMockProviders: string | undefined;

    beforeEach(() => {
      originalMockProviders = process.env.AX_MOCK_PROVIDERS;
      process.env.AX_MOCK_PROVIDERS = 'false';
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
      if (originalMockProviders !== undefined) {
        process.env.AX_MOCK_PROVIDERS = originalMockProviders;
      } else {
        delete process.env.AX_MOCK_PROVIDERS;
      }
    });

    it('should kill process on timeout', async () => {
      const mockProc = createMockChildProcess();
      spawnMock.mockReturnValue(mockProc);

      const provider = new TestProvider({ ...baseConfig, timeout: 1000 });
      const executePromise = provider.execute({ prompt: 'test' });

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(1100);

      // Verify kill was called
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');

      // Now emit close with signal
      mockProc.stdout.end();
      mockProc.stderr.end();
      mockProc.emit('close', null, 'SIGTERM');

      await expect(executePromise).rejects.toThrow(/SIGTERM/);
    });
  });
});
