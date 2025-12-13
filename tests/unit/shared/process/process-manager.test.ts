import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { processManager } from '../../../../src/shared/process/process-manager.js';

const createChild = (pid: number) => {
  const child = Object.assign(new EventEmitter(), {
    pid,
    killed: false,
    exitCode: null as number | null,
    kill: vi.fn(function (this: any, signal?: string) {
      this.killed = true;
      if (signal === 'SIGKILL') {
        this.exitCode = 137;
      }
    }),
  });
  return child;
};

describe('processManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset internal state between tests
    (processManager as any).childProcesses.clear();
    (processManager as any).shutdownHandlers = [];
    (processManager as any).isShuttingDown = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers and auto-removes on exit', () => {
    const child = createChild(1001);
    processManager.register(child as any, 'test');
    expect((processManager as any).childProcesses.size).toBe(1);

    child.emit('exit');
    expect((processManager as any).childProcesses.size).toBe(0);
  });

  it('runs shutdown handlers with timeout protection', async () => {
    const slowHandler = vi.fn(
      () => new Promise<void>(resolve => setTimeout(resolve, 50))
    );
    processManager.onShutdown(slowHandler);

    const shutdownPromise = processManager.shutdown(20);
    vi.runAllTimers();
    await shutdownPromise;

    expect(slowHandler).toHaveBeenCalled();
    expect((processManager as any).shutdownHandlers.length).toBe(0);
  });

  it('sends signals to tracked processes on shutdown', async () => {
    const child = createChild(1002);
    processManager.register(child as any, 'child');

    const shutdownPromise = processManager.shutdown(40);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    // simulate exit after SIGTERM
    child.emit('exit');
    vi.runAllTimers();
    await shutdownPromise;
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('force kills all processes', () => {
    const child1 = createChild(2001);
    const child2 = createChild(2002);
    processManager.register(child1 as any);
    processManager.register(child2 as any);

    processManager.forceKillAll();

    expect(child1.kill).toHaveBeenCalledWith('SIGKILL');
    expect(child2.kill).toHaveBeenCalledWith('SIGKILL');
    expect((processManager as any).childProcesses.size).toBe(0);
  });
});
