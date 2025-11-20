/**
 * Unit tests for AxCliAdapter (v10.0.0)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock that's available during hoisting
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn()
}));

// Mock util.promisify to return our mock
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync)
}));

// Mock child_process (required for import)
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

import { AxCliAdapter } from '../../../../src/integrations/ax-cli/adapter.js';

describe('AxCliAdapter', () => {
  let adapter: AxCliAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockReset();
    adapter = new AxCliAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should execute prompt successfully', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"user","content":"test"}\n{"role":"assistant","content":"response"}',
        stderr: ''
      });

      const result = await adapter.execute('test prompt', { timeout: 5000 });

      expect(result.content).toBe('response');
      expect(mockExecAsync).toHaveBeenCalled();
    });

    it('should pass model option to CLI', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { model: 'glm-4.6' });

      const callArgs = mockExecAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toContain('--model');
      expect(callArgs![0]).toContain('glm-4.6');
      expect(mockExecAsync).toHaveBeenCalled();
    });

    it('should handle stderr warnings', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: 'Warning: deprecated API'
      });

      const result = await adapter.execute('test', {});

      expect(result.content).toBe('response');
    });

    it('should throw error on execution failure', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      await expect(adapter.execute('test', {})).rejects.toThrow('ax-cli execution failed');
    });

    it('should use default timeout when not provided', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', {});

      const callArgs = mockExecAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![1]).toHaveProperty('timeout');
      expect(callArgs![1].timeout).toBe(120000); // Default 2 minutes
    });

    it('should respect custom timeout', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { timeout: 30000 });

      const callArgs = mockExecAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![1].timeout).toBe(30000);
    });

    it('should pass provider option to CLI', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { provider: 'xai' });

      const callArgs = mockExecAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toContain('--provider');
      expect(callArgs![0]).toContain('xai');
    });

    it('should handle maxToolRounds option', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"assistant","content":"response"}',
        stderr: ''
      });

      await adapter.execute('test', { maxToolRounds: 500 });

      const callArgs = mockExecAsync.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toContain('--max-tool-rounds');
      expect(callArgs![0]).toContain('500');
    });

    it('should parse JSONL response correctly', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"role":"user","content":"question"}\n{"role":"assistant","content":"answer here"}',
        stderr: ''
      });

      const result = await adapter.execute('test', {});

      expect(result.content).toBe('answer here');
    });

    it('should include usage information when provided', async () => {
      mockExecAsync.mockResolvedValue({
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
