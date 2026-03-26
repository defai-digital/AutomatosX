import { mkdirSync } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createLegacyJsonTraceStore, createTraceStore } from '../src/index.js';
import { ensurePackageBuilt } from '../../../tests/support/ensure-built.js';

const execFileAsync = promisify(execFile);

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `trace-store-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('trace store', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('preserves concurrent trace writes across store instances', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const storeA = createTraceStore({ basePath: tempDir });
    const storeB = createTraceStore({ basePath: tempDir });

    await Promise.all([
      storeA.upsertTrace({
        traceId: 'trace-a',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-21T00:00:00.000Z',
        completedAt: '2026-03-21T00:00:01.000Z',
        stepResults: [],
      }),
      storeB.upsertTrace({
        traceId: 'trace-b',
        workflowId: 'release',
        surface: 'mcp',
        status: 'completed',
        startedAt: '2026-03-21T00:00:02.000Z',
        completedAt: '2026-03-21T00:00:03.000Z',
        stepResults: [],
      }),
    ]);

    const traces = await storeA.listTraces();
    expect(traces).toHaveLength(2);
    expect(traces.map((trace) => trace.traceId)).toEqual(['trace-b', 'trace-a']);
  });

  it('exposes an explicit legacy json trace store constructor', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createLegacyJsonTraceStore({ basePath: tempDir });
    await store.upsertTrace({
      traceId: 'legacy-trace-001',
      workflowId: 'compat',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-24T00:00:00.000Z',
      completedAt: '2026-03-24T00:00:01.000Z',
      stepResults: [],
    });

    await expect(store.getTrace('legacy-trace-001')).resolves.toMatchObject({
      traceId: 'legacy-trace-001',
      workflowId: 'compat',
    });
  });

  it('treats malformed legacy json trace files as empty data', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    mkdirSync(join(tempDir, '.automatosx', 'runtime'), { recursive: true });
    await writeFile(join(tempDir, '.automatosx', 'runtime', 'traces.json'), '["invalid"]', 'utf8');
    const store = createLegacyJsonTraceStore({ basePath: tempDir });

    await expect(store.listTraces()).resolves.toEqual([]);
  });

  it('preserves trace writes across concurrent node processes', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await ensurePackageBuilt('trace-store');

    const workerSource = [
      'import { createTraceStore } from "./packages/trace-store/dist/index.js";',
      'const store = createTraceStore({ basePath: process.env.AX_BASE_PATH });',
      'const prefix = process.env.AX_PREFIX;',
      'for (let index = 0; index < 20; index += 1) {',
      '  await store.upsertTrace({',
      '    traceId: `${prefix}-${index}`,',
      '    workflowId: "ship",',
      '    surface: "cli",',
      '    status: "completed",',
      '    startedAt: `2026-03-22T00:00:${String(index).padStart(2, "0")}.000Z`,',
      '    completedAt: `2026-03-22T00:00:${String(index).padStart(2, "0")}.500Z`,',
      '    stepResults: [],',
      '  });',
      '  await new Promise((resolve) => setTimeout(resolve, index % 2 === 0 ? 2 : 1));',
      '}',
      '',
    ].join('\n');

    await Promise.all([
      execFileAsync('node', ['--input-type=module', '--eval', workerSource], {
        cwd: process.cwd(),
        env: { ...process.env, AX_BASE_PATH: tempDir, AX_PREFIX: 'proc-a' },
      }),
      execFileAsync('node', ['--input-type=module', '--eval', workerSource], {
        cwd: process.cwd(),
        env: { ...process.env, AX_BASE_PATH: tempDir, AX_PREFIX: 'proc-b' },
      }),
    ]);

    const store = createTraceStore({ basePath: tempDir });
    const traces = await store.listTraces();

    expect(traces).toHaveLength(40);
    expect(traces.some((trace) => trace.traceId === 'proc-a-0')).toBe(true);
    expect(traces.some((trace) => trace.traceId === 'proc-b-19')).toBe(true);
  });

  it('auto-closes stale running traces without touching completed traces', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createTraceStore({ basePath: tempDir });
    await store.upsertTrace({
      traceId: 'stuck-trace-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'running',
      startedAt: '2026-03-20T00:00:00.000Z',
      stepResults: [],
    });
    await store.upsertTrace({
      traceId: 'completed-trace-001',
      workflowId: 'release',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:00:00.000Z',
      completedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
    });

    const closed = await store.closeStuckTraces(0);

    expect(closed).toMatchObject([
      {
        traceId: 'stuck-trace-001',
        status: 'failed',
      },
    ]);

    const traces = await store.listTraces();
    expect(traces.find((trace) => trace.traceId === 'stuck-trace-001')).toMatchObject({
      status: 'failed',
      error: {
        code: 'TRACE_AUTO_CLOSED',
        message: 'Auto-closed as stuck trace',
      },
    });
    expect(traces.find((trace) => trace.traceId === 'completed-trace-001')?.status).toBe('completed');
  });

  it('uses custom storageFile for the default sqlite backend', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const customDbFile = join(tempDir, 'custom', 'traces-custom.db');
    const store = createTraceStore({ basePath: tempDir, storageFile: customDbFile });
    await store.upsertTrace({
      traceId: 'trace-custom',
      workflowId: 'ship',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-21T00:00:00.000Z',
      completedAt: '2026-03-21T00:00:01.000Z',
      stepResults: [],
    });

    await expect(stat(customDbFile)).resolves.toMatchObject({
      isFile: expect.any(Function),
    });
  });

  it('lists traces by session without scanning unrelated records in caller code', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createTraceStore({ basePath: tempDir });
    await store.upsertTrace({
      traceId: 'session-old',
      workflowId: 'discuss',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-21T00:00:00.000Z',
      completedAt: '2026-03-21T00:01:00.000Z',
      stepResults: [],
      metadata: {
        sessionId: 'sess-1',
      },
    });
    await store.upsertTrace({
      traceId: 'session-new',
      workflowId: 'discuss',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:00:00.000Z',
      completedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
      metadata: {
        sessionId: 'sess-1',
      },
    });
    await store.upsertTrace({
      traceId: 'other-session',
      workflowId: 'ship',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-23T00:00:00.000Z',
      completedAt: '2026-03-23T00:01:00.000Z',
      stepResults: [],
      metadata: {
        sessionId: 'sess-2',
      },
    });

    await expect(store.listTracesBySession('sess-1', 1)).resolves.toMatchObject([
      {
        traceId: 'session-new',
        workflowId: 'discuss',
      },
    ]);
  });

  it('lists traces by workflow without scanning unrelated records in caller code', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createTraceStore({ basePath: tempDir });
    await store.upsertTrace({
      traceId: 'review-old',
      workflowId: 'review',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-21T00:00:00.000Z',
      completedAt: '2026-03-21T00:01:00.000Z',
      stepResults: [],
    });
    await store.upsertTrace({
      traceId: 'review-new',
      workflowId: 'review',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:00:00.000Z',
      completedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
    });
    await store.upsertTrace({
      traceId: 'ship-trace',
      workflowId: 'ship',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-23T00:00:00.000Z',
      completedAt: '2026-03-23T00:01:00.000Z',
      stepResults: [],
    });

    await expect(store.listTracesByWorkflow('review', 1)).resolves.toMatchObject([
      {
        traceId: 'review-new',
        workflowId: 'review',
      },
    ]);
  });

  it('lists traces by status without scanning unrelated records in caller code', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createTraceStore({ basePath: tempDir });
    await store.upsertTrace({
      traceId: 'failed-old',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-21T00:00:00.000Z',
      completedAt: '2026-03-21T00:01:00.000Z',
      stepResults: [],
      error: {
        message: 'old failure',
      },
    });
    await store.upsertTrace({
      traceId: 'failed-new',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-22T00:00:00.000Z',
      completedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
      error: {
        message: 'new failure',
      },
    });
    await store.upsertTrace({
      traceId: 'running-trace',
      workflowId: 'ship',
      surface: 'cli',
      status: 'running',
      startedAt: '2026-03-23T00:00:00.000Z',
      stepResults: [],
    });

    await expect(store.listTracesByStatus('failed', 1)).resolves.toMatchObject([
      {
        traceId: 'failed-new',
        status: 'failed',
      },
    ]);
    await expect(store.getTraceStatusCounts()).resolves.toMatchObject({
      total: 3,
      running: 1,
      completed: 0,
      failed: 2,
    });
    await expect(store.countTraces()).resolves.toBe(3);
    await expect(store.countTraces('failed')).resolves.toBe(2);
    await expect(store.countTraces('running')).resolves.toBe(1);
  });

  it('builds a trace tree rooted at the ancestor of the requested trace', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const store = createTraceStore({ basePath: tempDir });
    await store.upsertTrace({
      traceId: 'root',
      workflowId: 'parallel.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-21T00:00:00.000Z',
      completedAt: '2026-03-21T00:01:00.000Z',
      stepResults: [],
    });
    await store.upsertTrace({
      traceId: 'child',
      workflowId: 'agent.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-21T00:02:00.000Z',
      completedAt: '2026-03-21T00:03:00.000Z',
      stepResults: [],
      metadata: {
        parentTraceId: 'root',
        rootTraceId: 'root',
      },
    });
    await store.upsertTrace({
      traceId: 'grandchild',
      workflowId: 'agent.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-21T00:04:00.000Z',
      completedAt: '2026-03-21T00:05:00.000Z',
      stepResults: [],
      metadata: {
        parentTraceId: 'child',
        rootTraceId: 'root',
      },
    });

    await expect(store.getTraceTree('grandchild')).resolves.toMatchObject({
      trace: {
        traceId: 'root',
      },
      children: [
        {
          trace: {
            traceId: 'child',
          },
          children: [
            {
              trace: {
                traceId: 'grandchild',
              },
            },
          ],
        },
      ],
    });
  });
});
