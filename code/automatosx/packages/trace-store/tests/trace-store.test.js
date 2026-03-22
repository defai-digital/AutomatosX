import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createTraceStore } from '../src/index.js';
const execFileAsync = promisify(execFile);
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `trace-store-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
describe('trace store', () => {
    const tempDirs = [];
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
    it('preserves trace writes across concurrent node processes', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const workerSource = [
            'import { createTraceStore } from "./packages/trace-store/src/index.js";',
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
});
