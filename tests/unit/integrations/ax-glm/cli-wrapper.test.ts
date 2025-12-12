import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type { ExecutionRequest } from '../../../../src/types/provider.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

const versionRef = vi.hoisted(() => ({ result: { stdout: '1.2.3', stderr: '' }, error: null as Error | null }));
const availabilityRef = vi.hoisted(() => ({ available: true }));

vi.mock('util', () => ({
  promisify: vi.fn(() => (cmd: string) => {
    if (cmd.includes('which')) {
      return availabilityRef.available
        ? Promise.resolve({ stdout: '/usr/local/bin/ax-glm', stderr: '' })
        : Promise.reject(new Error('not found'));
    }
    if (cmd.includes('--version')) {
      if (versionRef.error) return Promise.reject(versionRef.error);
      return Promise.resolve(versionRef.result);
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

import { GLMCliWrapper } from '../../../../src/integrations/ax-glm/cli-wrapper.js';

describe('GLMCliWrapper', () => {
  let mockExec: Mock;
  let mockSpawn: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    availabilityRef.available = true;
    versionRef.error = null;
    versionRef.result = { stdout: '1.2.3', stderr: '' };
    mockExec = exec as unknown as Mock;
    mockSpawn = spawn as unknown as Mock;

    mockExec.mockImplementation((cmd: string, _opts: unknown, cb?: (err: unknown, res: unknown) => void) => {
      const result = cmd.includes('which')
        ? availabilityRef.available
          ? { stdout: '/usr/local/bin/ax-glm', stderr: '' }
          : { stdout: '', stderr: 'not found' }
        : { stdout: '1.2.3', stderr: '' };
      const error = cmd.includes('which') && !availabilityRef.available ? new Error('not found') : null;
      if (typeof cb === 'function') cb(error, result);
      if (error) throw error;
      return result;
    });
  });

  describe('isAvailable', () => {
    it('returns true when CLI is present', async () => {
      const wrapper = new GLMCliWrapper();
      expect(await wrapper.isAvailable()).toBe(true);
    });

    it('returns false when CLI missing', async () => {
      availabilityRef.available = false;
      const wrapper = new GLMCliWrapper();
      expect(await wrapper.isAvailable()).toBe(false);
    });

    it('sets version to unknown on version error', async () => {
      versionRef.error = new Error('no version');
      versionRef.result = { stdout: '', stderr: '' };
      const wrapper = new GLMCliWrapper();
      await wrapper.isAvailable();
      expect(wrapper.getVersion()).toBe('unknown');
    });
  });

  describe('initialize', () => {
    it('succeeds when available', async () => {
      const wrapper = new GLMCliWrapper();
      await expect(wrapper.initialize()).resolves.not.toThrow();
    });

    it('throws when unavailable', async () => {
      availabilityRef.available = false;
      const wrapper = new GLMCliWrapper();
      await expect(wrapper.initialize()).rejects.toThrow('ax-glm CLI is not installed');
    });
  });

  describe('execute', () => {
    const mockRequest: ExecutionRequest = { prompt: 'Hello' };

    beforeEach(() => {
      const proc = Object.assign(new EventEmitter(), {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(proc);

      // helper to emit
      (mockSpawn as any).lastProcess = proc;
    });

    it('returns parsed response', async () => {
      const wrapper = new GLMCliWrapper();
      const promise = wrapper.execute(mockRequest);
      const proc = (mockSpawn as any).lastProcess as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };

      setTimeout(() => {
        proc.stdout.emit('data', 'Response text');
        proc.emit('close', 0);
      }, 5);

      const res = await promise;
      expect(res.content).toBe('Response text');
      expect(res.finishReason).toBe('stop');
    });

    it('rejects on CLI error', async () => {
      const wrapper = new GLMCliWrapper();
      const promise = wrapper.execute(mockRequest);
      const proc = (mockSpawn as any).lastProcess as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };

      setTimeout(() => {
        proc.stderr.emit('data', 'bad');
        proc.emit('close', 1);
      }, 5);

      await expect(promise).rejects.toThrow(/CLI exited with code 1/);
    });

    it('rejects on process error', async () => {
      const wrapper = new GLMCliWrapper();
      const promise = wrapper.execute(mockRequest);
      const proc = (mockSpawn as any).lastProcess as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };

      setTimeout(() => {
        proc.emit('error', new Error('spawn fail'));
      }, 5);

      await expect(promise).rejects.toThrow(/spawn fail/);
    });
  });
});
