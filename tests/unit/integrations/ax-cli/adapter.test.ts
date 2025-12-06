/**
 * Unit tests for AxCliAdapter (v10.0.0)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock that's available during hoisting
const { mockExecFileAsync, mockExecAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
  mockExecAsync: vi.fn()
}));

// Mock child_process before any imports
vi.mock('child_process', () => {
  // Create named functions to preserve name property for promisify checks
  function execFile() {}
  function exec() {}
  return { execFile, exec };
});

// Mock util.promisify to return our mock based on function name
vi.mock('util', () => ({
  promisify: vi.fn((fn: { name?: string }) => {
    if (fn?.name === 'execFile') return mockExecFileAsync;
    if (fn?.name === 'exec') return mockExecAsync;
    return mockExecFileAsync;
  })
}));

import { AxCliAdapter } from '../../../../src/integrations/ax-cli/adapter.js';

describe('AxCliAdapter', () => {
  let adapter: AxCliAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileAsync.mockReset();
    adapter = new AxCliAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should execute prompt successfully', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"user","content":"test"}\n{"role":"assistant","content":"response"}',
        stderr: ''
      });

      const result = await adapter.execute('test prompt', { timeout: 5000 });

      expect(result.content).toBe('response');
      expect(mockExecFileAsync).toHaveBeenCalled();
    });

    it('should pass model option to CLI', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { model: 'glm-4.6' });

      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      // execFile takes (command, args, options) - args is callArgs[1]
      const args = callArgs![1] as string[];
      expect(args).toContain('--model');
      // Values are escaped with ANSI-C quoting ($'...')
      expect(args).toContain("$'glm-4.6'");
      expect(mockExecFileAsync).toHaveBeenCalled();
    });

    it('should handle stderr warnings', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: 'Warning: deprecated API'
      });

      const result = await adapter.execute('test', {});

      expect(result.content).toBe('response');
    });

    it('should throw error on execution failure', async () => {
      mockExecFileAsync.mockRejectedValue(new Error('Command failed'));

      await expect(adapter.execute('test', {})).rejects.toThrow('ax-cli execution failed');
    });

    it('should use default timeout when not provided', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', {});

      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      // execFile takes (command, args, options) - options is callArgs[2]
      const options = callArgs![2] as { timeout: number };
      expect(options).toHaveProperty('timeout');
      expect(options.timeout).toBe(120000); // Default 2 minutes
    });

    it('should respect custom timeout', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { timeout: 30000 });

      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      // execFile takes (command, args, options) - options is callArgs[2]
      const options = callArgs![2] as { timeout: number };
      expect(options.timeout).toBe(30000);
    });

    it('should pass provider option to CLI', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { provider: 'xai' });

      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      // execFile takes (command, args, options) - args is callArgs[1]
      const args = callArgs![1] as string[];
      expect(args).toContain('--provider');
      // Values are escaped with ANSI-C quoting ($'...')
      expect(args).toContain("$'xai'");
    });

    it('should handle maxToolRounds option', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { maxToolRounds: 500 });

      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      // execFile takes (command, args, options) - args is callArgs[1]
      const args = callArgs![1] as string[];
      expect(args).toContain('--max-tool-rounds');
      expect(args).toContain('500');
    });

    it('should parse JSONL response correctly', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"user","content":"question"}\n{"role":"assistant","content":"answer here"}',
        stderr: ''
      });

      const result = await adapter.execute('test', {});

      expect(result.content).toBe('answer here');
    });

    it('should include usage information when provided', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"test","usage":{"input_tokens":10,"output_tokens":20}}',
        stderr: ''
      });

      const result = await adapter.execute('test', {});

      expect(result.tokensUsed).toBeDefined();
      expect(result.tokensUsed.prompt).toBe(10);
      expect(result.tokensUsed.completion).toBe(20);
      expect(result.tokensUsed.total).toBe(30);
    });
  });

  describe('isAvailable', () => {
    it('should return true when ax-cli is available', async () => {
      // isAvailable uses exec (via which/where), not execFile
      mockExecAsync.mockResolvedValue({
        stdout: '/usr/local/bin/ax-cli',
        stderr: ''
      });

      const available = await adapter.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when ax-cli is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const available = await adapter.isAvailable();

      expect(available).toBe(false);
    });

    it('should cache availability result', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '/usr/local/bin/ax-cli',
        stderr: ''
      });

      await adapter.isAvailable();
      await adapter.isAvailable();

      // Should only call once due to caching
      expect(mockExecAsync).toHaveBeenCalledTimes(1);
    });

    it('should recheck after cache expires', async () => {
      vi.useFakeTimers();

      mockExecAsync.mockResolvedValue({
        stdout: '/usr/local/bin/ax-cli',
        stderr: ''
      });

      await adapter.isAvailable();

      // Advance time beyond cache TTL (60s)
      vi.advanceTimersByTime(61000);

      await adapter.isAvailable();

      // Should call twice (cache expired)
      expect(mockExecAsync).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('getVersion', () => {
    it('should return version string', async () => {
      // getVersion uses exec (ax-cli --version), not execFile
      mockExecAsync.mockResolvedValue({
        stdout: '2.5.1\n',
        stderr: ''
      });

      const version = await adapter.getVersion();

      expect(version).toBe('2.5.1');
    });

    it('should return "unknown" on error', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const version = await adapter.getVersion();

      expect(version).toBe('unknown');
    });

    it('should trim whitespace from version', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '  2.5.1  \n',
        stderr: ''
      });

      const version = await adapter.getVersion();

      expect(version).toBe('2.5.1');
    });
  });

  describe('getCommand', () => {
    it('should return "ax-cli"', () => {
      expect(adapter.getCommand()).toBe('ax-cli');
    });
  });

  describe('getDisplayName', () => {
    it('should return display name', () => {
      expect(adapter.getDisplayName()).toBe('ax-cli (multi-provider)');
    });
  });
});
