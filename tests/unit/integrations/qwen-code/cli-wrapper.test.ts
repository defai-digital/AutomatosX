import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';

// Hoisted refs to control mocks between tests
const availabilityRef = vi.hoisted(() => ({ found: true, path: '/usr/bin/qwen' }));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../src/core/cli-provider-detector.js', () => ({
  findOnPath: vi.fn(() => availabilityRef),
}));

const spawnMock = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Import after mocks
import { QwenCliWrapper } from '../../../../src/integrations/qwen-code/cli-wrapper.js';

describe('QwenCliWrapper', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    availabilityRef.found = true;
    availabilityRef.path = '/usr/bin/qwen';
    process.env.AX_MOCK_PROVIDERS = 'false';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createChild = () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      stdout,
      stderr,
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      pid: 123,
      killed: false,
      kill: vi.fn(),
    });
    return { child, stdout, stderr };
  };

  it('returns false when CLI not on PATH', async () => {
    availabilityRef.found = false;
    const wrapper = new QwenCliWrapper();
    expect(await wrapper.isAvailable()).toBe(false);
  });

  it('resolves successful execution and parses response', async () => {
    const { child, stdout } = createChild();
    spawnMock.mockReturnValue(child);

    const wrapper = new QwenCliWrapper();
    const promise = wrapper.execute({ prompt: 'Do work' });

    // Simulate CLI output with prompt echo then content
    stdout.emit('data', '> Do work\n');
    stdout.emit('data', 'Answer line\nAnother line\n');
    child.emit('close', 0);

    const response = await promise;
    expect(response.content).toBe('Answer line\nAnother line');
    expect(response.tokensUsed.total).toBeGreaterThan(0);
  });

  it('rejects on non-zero exit', async () => {
    const { child, stderr } = createChild();
    spawnMock.mockReturnValue(child);

    const wrapper = new QwenCliWrapper();
    const promise = wrapper.execute({ prompt: 'fail me' });

    stderr.emit('data', 'bad things happened');
    child.emit('close', 1);

    await expect(promise).rejects.toThrow('Qwen CLI exited with code 1');
  });

  it('rejects on timeout and kills process', async () => {
    vi.useFakeTimers();
    const { child } = createChild();
    spawnMock.mockReturnValue(child);

    const wrapper = new QwenCliWrapper({ timeout: 10 });
    const promise = wrapper.execute({ prompt: 'slow' });

    // Advance timers to trigger timeout then emit close with signal to resolve rejection path
    vi.advanceTimersByTime(15);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    child.emit('close', null, 'SIGTERM');

    await expect(promise).rejects.toThrow(/signal SIGTERM/);
  });

  it('maps stderr-only failure with signal', async () => {
    const { child, stderr } = createChild();
    spawnMock.mockReturnValue(child);

    const wrapper = new QwenCliWrapper();
    const promise = wrapper.execute({ prompt: 'interrupted' });
    stderr.emit('data', 'boom');
    child.emit('close', null, 'SIGKILL');

    await expect(promise).rejects.toThrow(/SIGKILL/);
  });
});
