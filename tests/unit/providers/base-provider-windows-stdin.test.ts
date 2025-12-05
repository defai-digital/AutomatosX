import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { ChildProcess } from 'child_process';
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: vi.fn()
  };
});
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { BaseProvider } from '../../../src/providers/base-provider.js';
import type { ProviderConfig } from '../../../src/types/provider.js';

class TestProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  // Expose executeCLI for testing
  public run(prompt: string): Promise<string> {
    return this.executeCLI(prompt);
  }

  protected getCLICommand(): string {
    return 'fake-cli';
  }

  protected override getCLIArgs(): string[] {
    return ['--flag', 'value with space'];
  }

  protected getMockResponse(): string {
    return 'mock';
  }
}

describe('BaseProvider - Windows stdin execution', () => {
  const baseConfig: ProviderConfig = {
    name: 'claude',
    enabled: true,
    priority: 1,
    timeout: 1000,
    command: 'fake-cli'
  };

  let platformSpy: ReturnType<typeof vi.spyOn>;
  let spawnMock: Mock;

  beforeEach(() => {
    process.env.AX_MOCK_PROVIDERS = 'false';
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    spawnMock = spawn as unknown as Mock;
    spawnMock.mockImplementation(() => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdin = new PassThrough();

      const child = Object.assign(new EventEmitter(), {
        stdout,
        stderr,
        stdin,
        pid: 1234,
        killed: false,
        kill: vi.fn().mockReturnValue(true)
      }) as unknown as ChildProcess;

      // Emit one line of output then close
      setTimeout(() => {
        stdout.write('result line\n');
        stdout.end();
        stderr.end();
        child.emit('close', 0, null);
      }, 0);

      return child;
    });
  });

  afterEach(() => {
    delete process.env.AX_MOCK_PROVIDERS;
    platformSpy.mockRestore();
    spawnMock.mockReset();
  });

  it('passes raw CLI args to spawn when falling back to stdin on Windows', async () => {
    const provider = new TestProvider(baseConfig);
    const longPrompt = 'p'.repeat(8000); // triggers stdin path on Windows

    const result = await provider.run(longPrompt);

    expect(result).toContain('result line');
    expect(spawnMock).toHaveBeenCalledTimes(1);

    const call = spawnMock.mock.calls[0];
    expect(call).toBeDefined();
    const args = call![1];
    expect(args).toEqual(['--flag', 'value with space']);
  });
});
