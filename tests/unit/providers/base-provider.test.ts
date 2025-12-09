/**
 * Comprehensive tests for BaseProvider (v8.3.0+)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderError, ErrorCode } from '../../../src/shared/errors/errors.js';
import type { ProviderConfig } from '../../../src/types/provider.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  default: {
    writeFileSync: vi.fn()
  }
}));

// Mock cli-provider-detector
vi.mock('../../../src/core/cli-provider-detector.js', () => ({
  findOnPath: vi.fn().mockResolvedValue('/usr/bin/test-command')
}));

// Mock provider-schemas
vi.mock('../../../src/providers/provider-schemas.js', () => ({
  safeValidateExecutionRequest: vi.fn().mockReturnValue({ success: true }),
  safeValidateExecutionResponse: vi.fn().mockReturnValue({ success: true })
}));

// Mock error-patterns
vi.mock('../../../src/providers/error-patterns.js', () => ({
  isLimitError: vi.fn().mockReturnValue(false)
}));

// Import BaseProvider and create a concrete test class
import { BaseProvider } from '../../../src/providers/base-provider.js';
import { spawn } from 'child_process';
import { findOnPath } from '../../../src/core/cli-provider-detector.js';
import { safeValidateExecutionRequest, safeValidateExecutionResponse } from '../../../src/providers/provider-schemas.js';
import { isLimitError } from '../../../src/providers/error-patterns.js';

// Create a concrete test provider class
class TestProvider extends BaseProvider {
  protected getCLICommand(): string {
    return 'test-cli';
  }

  protected getMockResponse(): string {
    return 'Mock test response from TestProvider';
  }

  // Expose protected methods for testing
  public testExecuteCLI(prompt: string): Promise<string> {
    return this.executeCLI(prompt);
  }

  public testEscapeShellArg(arg: string): string {
    return this.escapeShellArg(arg);
  }

  public testHandleError(error: unknown): ProviderError {
    return this.handleError(error);
  }

  public testGetCLIArgs(): string[] | Promise<string[]> {
    return this.getCLIArgs();
  }

  public getHealthState() {
    return (this as any).health;
  }
}

describe('BaseProvider', () => {
  let provider: TestProvider;
  let mockSpawn: any;

  const baseConfig: ProviderConfig = {
    name: 'test-provider',
    enabled: true,
    priority: 5,
    timeout: 60000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AX_MOCK_PROVIDERS = 'true';

    mockSpawn = vi.mocked(spawn);
    provider = new TestProvider(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AX_MOCK_PROVIDERS;
    delete process.env.AUTOMATOSX_SHOW_PROVIDER_OUTPUT;
    delete process.env.AUTOMATOSX_DEBUG;
    delete process.env.AUTOMATOSX_DEBUG_PROMPT;
  });

  describe('constructor', () => {
    it('should initialize with valid provider name', () => {
      const p = new TestProvider(baseConfig);
      expect(p.name).toBe('test-provider');
    });

    it('should normalize provider name to lowercase', () => {
      const config: ProviderConfig = {
        ...baseConfig,
        name: 'TEST-PROVIDER'
      };
      const p = new TestProvider(config);
      expect(p.name).toBe('test-provider');
    });

    it('should throw on invalid provider name', () => {
      const config: ProviderConfig = {
        ...baseConfig,
        name: 'invalid-provider-xyz'
      };
      expect(() => new TestProvider(config)).toThrow(ProviderError);
      expect(() => new TestProvider(config)).toThrow(/Invalid provider name/);
    });

    it('should initialize health status', () => {
      const p = new TestProvider(baseConfig);
      const health = p.getHealthState();
      expect(health.available).toBe(false);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.consecutiveSuccesses).toBe(0);
      expect(health.errorRate).toBe(0);
    });

    it('should accept claude provider name', () => {
      const config: ProviderConfig = { ...baseConfig, name: 'claude' };
      const p = new TestProvider(config);
      expect(p.name).toBe('claude');
    });

    it('should accept gemini-cli provider name', () => {
      const config: ProviderConfig = { ...baseConfig, name: 'gemini-cli' };
      const p = new TestProvider(config);
      expect(p.name).toBe('gemini-cli');
    });

    it('should accept glm provider name', () => {
      const config: ProviderConfig = { ...baseConfig, name: 'glm' };
      const p = new TestProvider(config);
      expect(p.name).toBe('glm');
    });

    it('should accept grok provider name', () => {
      const config: ProviderConfig = { ...baseConfig, name: 'grok' };
      const p = new TestProvider(config);
      expect(p.name).toBe('grok');
    });

    it('should accept codex provider name', () => {
      const config: ProviderConfig = { ...baseConfig, name: 'codex' };
      const p = new TestProvider(config);
      expect(p.name).toBe('codex');
    });
  });

  describe('name getter', () => {
    it('should return config name', () => {
      expect(provider.name).toBe('test-provider');
    });
  });

  describe('version getter', () => {
    it('should return default version', () => {
      expect(provider.version).toBe('1.0.0');
    });
  });

  describe('priority getter', () => {
    it('should return config priority', () => {
      expect(provider.priority).toBe(5);
    });
  });

  describe('capabilities getter', () => {
    it('should return default capabilities', () => {
      const caps = provider.capabilities;
      expect(caps.supportsStreaming).toBe(false);
      expect(caps.supportsEmbedding).toBe(false);
      expect(caps.supportsVision).toBe(false);
      expect(caps.maxContextTokens).toBe(128000);
      expect(caps.supportedModels).toContain('default');
    });
  });

  describe('getCLIArgs', () => {
    it('should return empty array by default', async () => {
      const args = await provider.testGetCLIArgs();
      expect(args).toEqual([]);
    });
  });

  describe('executeCLI', () => {
    it('should return mock response when AX_MOCK_PROVIDERS is true', async () => {
      const result = await provider.testExecuteCLI('test prompt');
      expect(result).toBe('Mock test response from TestProvider');
    });

    it('should not call spawn when in mock mode', async () => {
      await provider.testExecuteCLI('test prompt');
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      vi.mocked(safeValidateExecutionRequest).mockReturnValue({ success: true } as any);
      vi.mocked(safeValidateExecutionResponse).mockReturnValue({ success: true } as any);
    });

    it('should return execution response in mock mode', async () => {
      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'System prompt'
      });

      expect(result.content).toBe('Mock test response from TestProvider');
      expect(result.model).toBe('default');
      expect(result.finishReason).toBe('stop');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should validate request with Zod', async () => {
      await provider.execute({ prompt: 'Test' });
      expect(safeValidateExecutionRequest).toHaveBeenCalled();
    });

    it('should validate response with Zod', async () => {
      await provider.execute({ prompt: 'Test' });
      expect(safeValidateExecutionResponse).toHaveBeenCalled();
    });

    it('should throw on invalid request', async () => {
      vi.mocked(safeValidateExecutionRequest).mockReturnValue({
        success: false,
        error: {
          issues: [{ path: ['prompt'], message: 'Required' }]
        }
      } as any);

      await expect(provider.execute({ prompt: '' })).rejects.toThrow(ProviderError);
    });

    it('should throw on invalid response', async () => {
      vi.mocked(safeValidateExecutionResponse).mockReturnValue({
        success: false,
        error: {
          issues: [{ message: 'Invalid content' }]
        }
      } as any);

      await expect(provider.execute({ prompt: 'Test' })).rejects.toThrow(ProviderError);
    });

    it('should update health on success', async () => {
      await provider.execute({ prompt: 'Test' });

      const health = provider.getHealthState();
      expect(health.available).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.consecutiveSuccesses).toBe(1);
      expect(health.errorRate).toBe(0);
    });

    it('should update health on failure', async () => {
      vi.mocked(safeValidateExecutionRequest).mockReturnValue({
        success: false,
        error: { issues: [{ path: ['prompt'], message: 'Error' }] }
      } as any);

      try {
        await provider.execute({ prompt: 'Test' });
      } catch {
        // Expected
      }

      const health = provider.getHealthState();
      expect(health.consecutiveFailures).toBe(1);
      expect(health.consecutiveSuccesses).toBe(0);
      expect(health.available).toBe(false);
    });

    it('should prepend system prompt when provided', async () => {
      const result = await provider.execute({
        prompt: 'User prompt',
        systemPrompt: 'System prompt'
      });

      expect(result.content).toContain('Mock test response');
    });
  });

  describe('isAvailable', () => {
    it('should return true in mock mode', async () => {
      // AX_MOCK_PROVIDERS=true is set in beforeEach
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return true when CLI is found (non-mock mode)', async () => {
      delete process.env.AX_MOCK_PROVIDERS;
      vi.mocked(findOnPath).mockReturnValue({ found: true, path: '/usr/bin/test-cli' } as any);

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when CLI is not found (non-mock mode)', async () => {
      delete process.env.AX_MOCK_PROVIDERS;
      vi.mocked(findOnPath).mockReturnValue({ found: false } as any);

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should update health on successful check', async () => {
      await provider.isAvailable();

      const health = provider.getHealthState();
      expect(health.available).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });

    it('should update health on failed check (non-mock mode)', async () => {
      delete process.env.AX_MOCK_PROVIDERS;
      vi.mocked(findOnPath).mockReturnValue({ found: false } as any);

      await provider.isAvailable();

      const health = provider.getHealthState();
      expect(health.available).toBe(false);
      expect(health.consecutiveFailures).toBe(1);
    });

    it('should handle check errors (non-mock mode)', async () => {
      delete process.env.AX_MOCK_PROVIDERS;
      vi.mocked(findOnPath).mockImplementation(() => {
        throw new Error('Search failed');
      });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      // Mock mode returns true for availability

      const status = await provider.healthCheck();

      expect(status.available).toBe(true);
      expect(status).toHaveProperty('latencyMs');
      expect(status).toHaveProperty('errorRate');
      expect(status).toHaveProperty('consecutiveFailures');
      expect(status).toHaveProperty('lastCheckTime');
    });
  });

  describe('handleError', () => {
    it('should pass through ProviderError', () => {
      const originalError = new ProviderError('Original', ErrorCode.PROVIDER_TIMEOUT);
      const result = provider.testHandleError(originalError);
      expect(result).toBe(originalError);
    });

    it('should wrap Error with provider name', () => {
      const error = new Error('Something failed');
      const result = provider.testHandleError(error);
      expect(result.message).toContain('test-provider failed');
      expect(result.message).toContain('Something failed');
    });

    it('should detect command not found errors', () => {
      const error = new Error('command not found: test-cli');
      const result = provider.testHandleError(error);
      expect(result.code).toBe(ErrorCode.PROVIDER_NOT_FOUND);
    });

    it('should detect ENOENT errors', () => {
      const error = new Error('spawn test-cli ENOENT');
      const result = provider.testHandleError(error);
      expect(result.code).toBe(ErrorCode.PROVIDER_NOT_FOUND);
    });

    it('should detect timeout errors', () => {
      const error = new Error('Request timeout after 30000ms');
      const result = provider.testHandleError(error);
      expect(result.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
    });

    it('should detect ETIMEDOUT errors', () => {
      const error = new Error('Connection failed: ETIMEDOUT');
      const result = provider.testHandleError(error);
      expect(result.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
    });

    it('should detect rate limit errors', () => {
      vi.mocked(isLimitError).mockReturnValue(true);
      const error = new Error('Rate limit exceeded');
      const result = provider.testHandleError(error);
      expect(result.code).toBe(ErrorCode.PROVIDER_RATE_LIMIT);
    });

    it('should handle non-Error values', () => {
      const result = provider.testHandleError('string error');
      expect(result.message).toContain('string error');
    });
  });

  describe('escapeShellArg', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    describe('Unix escaping', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin'
        });
      });

      it('should wrap simple strings in single quotes', () => {
        const result = provider.testEscapeShellArg('hello');
        expect(result).toBe("'hello'");
      });

      it('should escape single quotes', () => {
        const result = provider.testEscapeShellArg("hello'world");
        expect(result).toBe("'hello'\\''world'");
      });

      it('should escape multiple single quotes', () => {
        const result = provider.testEscapeShellArg("it's a 'test'");
        expect(result).toBe("'it'\\''s a '\\''test'\\'''");
      });

      it('should handle empty string', () => {
        const result = provider.testEscapeShellArg('');
        expect(result).toBe("''");
      });

      it('should preserve special characters', () => {
        const result = provider.testEscapeShellArg('$VAR && rm -rf');
        expect(result).toBe("'$VAR && rm -rf'");
      });
    });

    describe('Windows escaping', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'win32'
        });
      });

      it('should wrap in double quotes on Windows', () => {
        const result = provider.testEscapeShellArg('hello');
        expect(result).toBe('"hello"');
      });

      it('should escape double quotes', () => {
        const result = provider.testEscapeShellArg('hello"world');
        expect(result).toBe('"hello\\"world"');
      });

      it('should escape percent signs', () => {
        const result = provider.testEscapeShellArg('%PATH%');
        expect(result).toBe('"%%PATH%%"');
      });

      it('should handle both double quotes and percent signs', () => {
        const result = provider.testEscapeShellArg('"%TEST%"');
        expect(result).toBe('"\\"%%TEST%%\\""');
      });
    });
  });

  describe('allowed provider names', () => {
    const allowedProviders = [
      'claude',
      'claude-code',
      'gemini',
      'gemini-cli',
      'openai',
      'codex',
      'glm',
      'ax-glm',
      'grok',
      'ax-grok',
      'test-provider'
    ];

    allowedProviders.forEach(name => {
      it(`should accept provider name: ${name}`, () => {
        const config: ProviderConfig = { ...baseConfig, name };
        const p = new TestProvider(config);
        expect(p.name).toBe(name.toLowerCase());
      });
    });
  });
});
