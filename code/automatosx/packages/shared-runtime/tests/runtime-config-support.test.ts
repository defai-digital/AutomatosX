import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getValueAtPath,
  listConfiguredExecutors,
  readWorkspaceConfig,
  setValueAtPath,
  writeWorkspaceConfig,
} from '../src/runtime-config-support.js';

const SHARED_RUNTIME_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createTempDir(): string {
  const dir = join(SHARED_RUNTIME_PACKAGE_ROOT, '.tmp', `runtime-config-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('runtime config support', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('reads and writes workspace config through the shared cache helpers', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const config = {
      providers: {
        default: 'claude',
        executors: {
          claude: { command: 'claude' },
        },
      },
      axBridge: {
        trust: {
          trustedBridgeIds: ['bridge.alpha'],
        },
      },
    } satisfies Record<string, unknown>;

    await writeWorkspaceConfig(tempDir, config);
    await expect(readWorkspaceConfig(tempDir)).resolves.toEqual(config);
  });

  it('supports nested path reads, writes, and configured executor discovery', () => {
    const config: Record<string, unknown> = {
      providers: {
        default: 'claude',
        executors: {
          openai: { command: 'openai' },
          claude: { command: 'claude' },
          invalid: 'skip-me',
        },
      },
    };

    expect(listConfiguredExecutors(config)).toEqual(['claude', 'openai']);
    expect(getValueAtPath(config, 'providers.default')).toBe('claude');
    expect(getValueAtPath(config, 'providers.executors.openai.command')).toBe('openai');

    setValueAtPath(config, 'axBridge.install.rejectDenied', true);
    expect(getValueAtPath(config, 'axBridge.install.rejectDenied')).toBe(true);
  });
});
