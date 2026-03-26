import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorkflowToolExecutor } from '../src/runtime-workflow-tool-executor.js';

const SHARED_RUNTIME_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createTempDir(): string {
  const dir = join(SHARED_RUNTIME_PACKAGE_ROOT, '.tmp', `runtime-workflow-tool-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('runtime workflow tool executor', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('installs and runs bridges through the shared bridge runtime', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const installSourceDir = join(tempDir, 'fixtures', 'installable-bridge');
    mkdirSync(installSourceDir, { recursive: true });
    await writeFile(join(installSourceDir, 'echo.js'), [
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));",
      '',
    ].join('\n'), 'utf8');
    await writeFile(join(installSourceDir, 'bridge.json'), `${JSON.stringify({
      schemaVersion: 1,
      bridgeId: 'tool-executor-bridge',
      name: 'Tool Executor Bridge',
      version: '0.1.0',
      description: 'Bridge installed through workflow tool executor.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, null, 2)}\n`, 'utf8');

    const executor = createWorkflowToolExecutor({
      basePath: tempDir,
      traceId: 'workflow-tool-trace',
      sessionId: 'workflow-tool-session',
      surface: 'cli',
      createTraceId: () => 'child-trace',
      traceStore: {
        upsertTrace: async (trace) => trace,
      } as never,
      stateStore: {} as never,
      runAgent: async () => {
        throw new Error('runAgent should not be called');
      },
    });

    const installed = await executor.execute('bridge.install', {
      sourcePath: 'fixtures/installable-bridge',
    });
    expect(installed).toMatchObject({
      success: true,
      output: {
        definition: {
          bridgeId: 'tool-executor-bridge',
        },
      },
    });

    const executed = await executor.execute('bridge.run', {
      reference: 'tool-executor-bridge',
      args: ['hello'],
    });
    expect(executed).toMatchObject({
      success: true,
      output: {
        execution: {
          exitCode: 0,
          stdout: expect.stringContaining('"args":["hello"]'),
        },
      },
    });
  });

  it('passes through unknown tool names without special routing', async () => {
    const executor = createWorkflowToolExecutor({
      basePath: '/tmp/runtime-workflow-tool',
      traceId: 'workflow-tool-trace',
      sessionId: 'workflow-tool-session',
      surface: 'cli',
      createTraceId: () => 'child-trace',
      traceStore: {
        upsertTrace: async (trace) => trace,
      } as never,
      stateStore: {} as never,
      runAgent: async () => {
        throw new Error('runAgent should not be called');
      },
    });

    expect(executor.getAvailableTools()).toEqual(['skill.run', 'bridge.run', 'bridge.install']);
    await expect(executor.execute('custom.tool', { foo: 'bar' })).resolves.toMatchObject({
      success: true,
      output: {
        toolName: 'custom.tool',
        args: {
          foo: 'bar',
        },
        mode: 'shared-runtime-passthrough',
      },
    });
  });
});
