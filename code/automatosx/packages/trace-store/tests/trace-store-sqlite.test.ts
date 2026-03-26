import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateTraceJsonToSqlite } from '../src/migrate.js';
import { SqliteTraceStore } from '../src/sqlite.js';
import type { TraceRecord } from '../src/index.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `trace-sqlite-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeTrace(id: string, overrides: Partial<TraceRecord> = {}): TraceRecord {
  return {
    traceId: id,
    workflowId: 'ship',
    surface: 'cli',
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    stepResults: [],
    ...overrides,
  };
}

describe('SqliteTraceStore', () => {
  const tempDirs: string[] = [];
  function store(dir: string) { return new SqliteTraceStore({ basePath: dir }); }

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  // -------------------------------------------------------------------------
  // Basic CRUD
  // -------------------------------------------------------------------------

  it('inserts and retrieves a trace with step results', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('tr-1', {
      stepResults: [
        { stepId: 'step-a', success: true, durationMs: 100, retryCount: 0 },
        { stepId: 'step-b', success: false, durationMs: 200, retryCount: 1, error: 'timeout' },
      ],
    }));
    const loaded = await s.getTrace('tr-1');
    expect(loaded?.traceId).toBe('tr-1');
    expect(loaded?.stepResults).toHaveLength(2);
    expect(loaded?.stepResults[1]?.error).toBe('timeout');
  });

  it('updates existing trace on upsert', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('tr-u', { status: 'running' }));
    await s.upsertTrace(makeTrace('tr-u', { status: 'completed' }));
    const loaded = await s.getTrace('tr-u');
    expect(loaded?.status).toBe('completed');
  });

  it('lists traces ordered by startedAt DESC', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('older', { startedAt: '2026-03-01T00:00:00.000Z' }));
    await s.upsertTrace(makeTrace('newer', { startedAt: '2026-03-22T00:00:00.000Z' }));
    const list = await s.listTraces();
    expect(list[0]?.traceId).toBe('newer');
    expect(list[1]?.traceId).toBe('older');
  });

  it('respects limit on listTraces', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    for (let i = 0; i < 5; i++) await s.upsertTrace(makeTrace(`t${i}`));
    const list = await s.listTraces(3);
    expect(list).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // Stuck trace cleanup
  // -------------------------------------------------------------------------

  it('auto-closes stuck running traces only', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('stuck', { status: 'running', startedAt: '2026-01-01T00:00:00.000Z', completedAt: undefined }));
    await s.upsertTrace(makeTrace('done', { status: 'completed', startedAt: '2026-03-22T00:00:00.000Z' }));

    const closed = await s.closeStuckTraces(0);
    expect(closed).toMatchObject([{ traceId: 'stuck', status: 'failed' }]);
    expect(closed[0]?.error?.code).toBe('TRACE_AUTO_CLOSED');

    const done = await s.getTrace('done');
    expect(done?.status).toBe('completed');
  });

  // -------------------------------------------------------------------------
  // Extended queries (v13.5 capabilities)
  // -------------------------------------------------------------------------

  it('listTracesBySession returns only matching traces', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('s1', {
      startedAt: '2026-03-21T00:00:00.000Z',
      metadata: { sessionId: 'sess-abc' },
    }));
    await s.upsertTrace(makeTrace('s2', {
      startedAt: '2026-03-22T00:00:00.000Z',
      metadata: { sessionId: 'sess-abc' },
    }));
    await s.upsertTrace(makeTrace('s3', { metadata: { sessionId: 'sess-xyz' } }));

    const results = await s.listTracesBySession('sess-abc');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.traceId)).toEqual(['s2', 's1']);
  });

  it('listTracesByWorkflow returns only matching traces in descending startedAt order', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('review-old', {
      startedAt: '2026-03-21T00:00:00.000Z',
      workflowId: 'review',
    }));
    await s.upsertTrace(makeTrace('review-new', {
      startedAt: '2026-03-22T00:00:00.000Z',
      workflowId: 'review',
    }));
    await s.upsertTrace(makeTrace('ship-trace', {
      startedAt: '2026-03-23T00:00:00.000Z',
      workflowId: 'ship',
    }));

    await expect(s.listTracesByWorkflow('review')).resolves.toMatchObject([
      { traceId: 'review-new', workflowId: 'review' },
      { traceId: 'review-old', workflowId: 'review' },
    ]);
  });

  it('listTracesByStatus returns only matching traces in descending startedAt order', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('failed-old', {
      startedAt: '2026-03-21T00:00:00.000Z',
      status: 'failed',
      error: { message: 'old failure' },
    }));
    await s.upsertTrace(makeTrace('failed-new', {
      startedAt: '2026-03-22T00:00:00.000Z',
      status: 'failed',
      error: { message: 'new failure' },
    }));
    await s.upsertTrace(makeTrace('running-trace', {
      startedAt: '2026-03-23T00:00:00.000Z',
      status: 'running',
      completedAt: undefined,
    }));

    await expect(s.listTracesByStatus('failed')).resolves.toMatchObject([
      { traceId: 'failed-new', status: 'failed' },
      { traceId: 'failed-old', status: 'failed' },
    ]);
    await expect(s.getTraceStatusCounts()).resolves.toMatchObject({
      total: 3,
      running: 1,
      completed: 0,
      failed: 2,
    });
    await expect(s.countTraces()).resolves.toBe(3);
    await expect(s.countTraces('failed')).resolves.toBe(2);
    await expect(s.countTraces('running')).resolves.toBe(1);
  });

  it('listChildTraces returns direct children by parent_trace_id', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('root'));
    await s.upsertTrace(makeTrace('child-1', { metadata: { parentTraceId: 'root' } }));
    await s.upsertTrace(makeTrace('child-2', { metadata: { parentTraceId: 'root' } }));
    await s.upsertTrace(makeTrace('other'));

    const children = s.listChildTraces('root');
    expect(children.map((r) => r.traceId).sort()).toEqual(['child-1', 'child-2']);
  });

  it('getTraceTree builds tree from root', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('root'));
    await s.upsertTrace(makeTrace('child', { metadata: { parentTraceId: 'root' } }));
    await s.upsertTrace(makeTrace('grandchild', { metadata: { parentTraceId: 'child', rootTraceId: 'root' } }));

    const tree = await s.getTraceTree('grandchild');
    expect(tree?.trace.traceId).toBe('root');
    expect(tree?.children).toMatchObject([
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
    ]);
  });

  it('getTraceTree returns undefined for missing trace', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await expect(s.getTraceTree('nonexistent')).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // JSON migration
  // -------------------------------------------------------------------------

  it('imports records from JSON and makes them queryable', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    const records: TraceRecord[] = [
      makeTrace('migrated-1', { status: 'completed', workflowId: 'architect' }),
      makeTrace('migrated-2', { status: 'failed', workflowId: 'qa' }),
    ];
    await s.importFromJson(records);

    const list = await s.listTraces();
    expect(list.map((r) => r.traceId).sort()).toEqual(['migrated-1', 'migrated-2']);
    expect((await s.getTrace('migrated-2'))?.status).toBe('failed');
  });

  it('rolls back JSON imports when one imported trace is invalid', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    const records = [
      makeTrace('migrated-ok', {
        stepResults: [{ stepId: 'step-a', success: true, durationMs: 5, retryCount: 0 }],
      }),
      {
        ...makeTrace('migrated-bad'),
        traceId: undefined,
      } as unknown as TraceRecord,
    ];

    await expect(s.importFromJson(records)).rejects.toThrow();
    await expect(s.listTraces()).resolves.toEqual([]);
  });

  it('skips migration when traces.json is valid JSON but not an object', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const traceFile = join(dir, '.automatosx', 'runtime', 'traces.json');
    mkdirSync(join(dir, '.automatosx', 'runtime'), { recursive: true });
    await writeFile(traceFile, '["not-an-object"]', 'utf8');

    await expect(migrateTraceJsonToSqlite({ basePath: dir })).resolves.toMatchObject({
      skipped: true,
      reason: 'traces.json is not valid JSON — skipping migration.',
    });
  });

  // -------------------------------------------------------------------------
  // Error storage
  // -------------------------------------------------------------------------

  it('persists and retrieves error details', async () => {
    const dir = createTempDir(); tempDirs.push(dir);
    const s = store(dir);
    await s.upsertTrace(makeTrace('err-1', {
      status: 'failed',
      error: { code: 'STEP_FAILED', message: 'step timed out', failedStepId: 'step-3' },
    }));
    const loaded = await s.getTrace('err-1');
    expect(loaded?.error?.code).toBe('STEP_FAILED');
    expect(loaded?.error?.failedStepId).toBe('step-3');
  });
});
