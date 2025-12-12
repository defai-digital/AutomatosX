/**
 * Grok CLI Wrapper Unit Tests
 *
 * Tests for CLI fallback execution for Grok provider.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GrokCliWrapper } from '../../../../src/integrations/ax-grok/cli-wrapper.js';
import type { ExecutionRequest } from '../../../../src/types/provider.js';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

const versionResultRef = vi.hoisted(() => ({
  result: { stdout: '1.0.0', stderr: '' },
  error: null as Error | null
}));
const availabilityRef = vi.hoisted(() => ({ available: true }));

vi.mock('util', () => ({
  promisify: vi.fn(() => (cmd: string) => {
    if (cmd.includes('which')) {
      if (!availabilityRef.available) {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve({ stdout: '/usr/local/bin/ax-grok', stderr: '' });
    }
    if (cmd.includes('--version')) {
      if (versionResultRef.error) return Promise.reject(versionResultRef.error);
      return Promise.resolve(versionResultRef.result);
    }
    return Promise.resolve({ stdout: '', stderr: '' });
  }),
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GrokCliWrapper', () => {
  let mockExec: Mock;
  let mockSpawn: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    versionResultRef.error = null;
    versionResultRef.result = { stdout: '1.0.0', stderr: '' };
    availabilityRef.available = true;

    mockExec = exec as unknown as Mock;
    mockSpawn = spawn as unknown as Mock;

    // Default mock respects availability and version refs
    mockExec.mockImplementation((cmd: string, _options: unknown, callback?: (error: unknown, result: unknown) => void) => {
      const isWhich = cmd.includes('which');
      const isVersion = cmd.includes('--version');

      const result = isWhich
        ? {
            stdout: availabilityRef.available ? '/usr/local/bin/ax-grok' : '',
            stderr: availabilityRef.available ? '' : 'not found',
          }
        : isVersion
          ? versionResultRef.result
          : { stdout: '', stderr: '' };

      const error = isWhich
        ? availabilityRef.available ? null : new Error('not found')
        : isVersion && versionResultRef.error
          ? versionResultRef.error
          : null;

      if (typeof callback === 'function') {
        callback(error, result);
      }

      if (error) {
        throw error;
      }

      return result;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create wrapper with default config', () => {
      const wrapper = new GrokCliWrapper();
      expect(wrapper.getModel()).toBe('grok-4-0709');
      expect(wrapper.getCommand()).toBe('ax-grok');
    });

    it('should create wrapper with custom model', () => {
      const wrapper = new GrokCliWrapper({ model: 'grok-3' });
      expect(wrapper.getModel()).toBe('grok-3');
    });

    it('should create wrapper with custom command', () => {
      const wrapper = new GrokCliWrapper({ command: 'custom-grok' });
      expect(wrapper.getCommand()).toBe('custom-grok');
    });

    it('should create wrapper with custom timeout', () => {
      const wrapper = new GrokCliWrapper({ timeout: 60000 });
      expect(wrapper).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when CLI is in PATH', async () => {
      const wrapper = new GrokCliWrapper();
      const result = await wrapper.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when CLI is not in PATH', async () => {
      availabilityRef.available = false;

      const wrapper = new GrokCliWrapper();
      const result = await wrapper.isAvailable();
      expect(result).toBe(false);
    });

    it('should detect CLI version', async () => {
      const wrapper = new GrokCliWrapper();
      await wrapper.isAvailable();
      expect(wrapper.getVersion()).toBe('1.0.0');
    });

    it('should handle version detection failure gracefully', async () => {
      versionResultRef.error = new Error('version not available');
      versionResultRef.result = { stdout: '', stderr: '' };

      const wrapper = new GrokCliWrapper();
      await wrapper.isAvailable();
      expect(wrapper.getVersion()).toBe('unknown');
      versionResultRef.error = null;
    });
  });

  describe('initialize', () => {
    it('should initialize when CLI is available', async () => {
      const wrapper = new GrokCliWrapper();
      await expect(wrapper.initialize()).resolves.not.toThrow();
    });

    it('should throw when CLI is not available', async () => {
      availabilityRef.available = false;

      const wrapper = new GrokCliWrapper();
      await expect(wrapper.initialize()).rejects.toThrow(
        'ax-grok CLI is not installed or not in PATH'
      );
    });
  });

  describe('execute', () => {
    let mockProcess: EventEmitter & {
      stdin: { write: Mock; end: Mock };
      stdout: EventEmitter;
      stderr: EventEmitter;
    };

    beforeEach(() => {
      mockProcess = Object.assign(new EventEmitter(), {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
      });

      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should execute request and return response', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      // Simulate CLI output
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Test response');
        mockProcess.emit('close', 0);
      }, 10);

      const response = await executePromise;
      expect(response.content).toBe('Test response');
      expect(response.finishReason).toBe('stop');
    });

    it('should parse JSON response', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          JSON.stringify({
            content: 'JSON response',
            model: 'grok-3',
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
            finish_reason: 'stop',
          })
        );
        mockProcess.emit('close', 0);
      }, 10);

      const response = await executePromise;
      expect(response.content).toBe('JSON response');
      expect(response.tokensUsed.total).toBe(30);
    });

    it('should handle system prompt', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        systemPrompt: 'You are helpful',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Response');
        mockProcess.emit('close', 0);
      }, 10);

      await executePromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax-grok',
        expect.arrayContaining(['--system', 'You are helpful']),
        expect.anything()
      );
    });

    it('should handle max tokens option', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        maxTokens: 500,
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Response');
        mockProcess.emit('close', 0);
      }, 10);

      await executePromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax-grok',
        expect.arrayContaining(['--max-tokens', '500']),
        expect.anything()
      );
    });

    it('should handle temperature option', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
        temperature: 0.7,
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Response');
        mockProcess.emit('close', 0);
      }, 10);

      await executePromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax-grok',
        expect.arrayContaining(['--temperature', '0.7']),
        expect.anything()
      );
    });

    it('should add model flag for non-default models', async () => {
      const wrapper = new GrokCliWrapper({ model: 'grok-3-mini' });
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Response');
        mockProcess.emit('close', 0);
      }, 10);

      await executePromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax-grok',
        expect.arrayContaining(['--model', 'grok-3-mini']),
        expect.anything()
      );
    });

    it('should throw on CLI error', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stderr.emit('data', 'CLI error message');
        mockProcess.emit('close', 1);
      }, 10);

      await expect(executePromise).rejects.toThrow(
        'CLI exited with code 1: CLI error message'
      );
    });

    it('should handle process error', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.emit('error', new Error('Process spawn error'));
      }, 10);

      await expect(executePromise).rejects.toThrow(
        'CLI process error: Process spawn error'
      );
    });

    it('should track latency', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Response');
        mockProcess.emit('close', 0);
      }, 50);

      const response = await executePromise;
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should write prompt to stdin', async () => {
      const wrapper = new GrokCliWrapper();
      const request: ExecutionRequest = {
        prompt: 'Test prompt',
      };

      const executePromise = wrapper.execute(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Response');
        mockProcess.emit('close', 0);
      }, 10);

      await executePromise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('Test prompt');
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });
  });

  describe('getModel', () => {
    it('should return configured model', () => {
      const wrapper = new GrokCliWrapper({ model: 'grok-3-mini' });
      expect(wrapper.getModel()).toBe('grok-3-mini');
    });
  });

  describe('getVersion', () => {
    it('should return null before initialization', () => {
      const wrapper = new GrokCliWrapper();
      expect(wrapper.getVersion()).toBeNull();
    });
  });

  describe('getCommand', () => {
    it('should return configured command', () => {
      const wrapper = new GrokCliWrapper({ command: 'custom-grok' });
      expect(wrapper.getCommand()).toBe('custom-grok');
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const wrapper = new GrokCliWrapper();
      await wrapper.destroy();
      // Should not throw
      expect(wrapper).toBeDefined();
    });
  });
});
