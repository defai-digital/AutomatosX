import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import type { ExecutionRequest } from '../../../../src/types/provider.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const availabilityRef = vi.hoisted(() => ({ available: true, path: '/usr/local/bin/ax-glm' }));

vi.mock('../../../../src/core/cli-provider-detector.js', () => ({
  findOnPath: vi.fn(() => ({
    found: availabilityRef.available,
    path: availabilityRef.available ? availabilityRef.path : undefined
  })),
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
  let mockSpawn: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    availabilityRef.available = true;
    availabilityRef.path = '/usr/local/bin/ax-glm';
    mockSpawn = spawn as unknown as Mock;
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

    it('sets version to unknown (version detection not implemented in base)', async () => {
      const wrapper = new GLMCliWrapper();
      await wrapper.isAvailable();
      expect(wrapper.getVersion()).toBe('unknown');
    });
  });

  describe('initialize', () => {
    it('succeeds when available', () => {
      const wrapper = new GLMCliWrapper();
      expect(() => wrapper.initialize()).not.toThrow();
    });

    it('throws when unavailable', () => {
      availabilityRef.available = false;
      const wrapper = new GLMCliWrapper();
      expect(() => wrapper.initialize()).toThrow('ax-glm CLI is not installed');
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

  describe('constructor', () => {
    it('should create wrapper with default config', () => {
      const wrapper = new GLMCliWrapper();
      expect(wrapper.getModel()).toBe('glm-4.6');
      expect(wrapper.getCommand()).toBe('ax-glm');
    });

    it('should create wrapper with custom model', () => {
      const wrapper = new GLMCliWrapper({ model: 'glm-4' });
      expect(wrapper.getModel()).toBe('glm-4');
    });

    it('should create wrapper with custom command', () => {
      const wrapper = new GLMCliWrapper({ command: 'custom-glm' });
      expect(wrapper.getCommand()).toBe('custom-glm');
    });
  });

  describe('getVersion', () => {
    it('should return null before initialization', () => {
      const wrapper = new GLMCliWrapper();
      expect(wrapper.getVersion()).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const wrapper = new GLMCliWrapper();
      await wrapper.destroy();
      // Should not throw
      expect(wrapper).toBeDefined();
    });
  });
});
