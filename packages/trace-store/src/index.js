import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createSqliteTraceStore } from './sqlite.js';
const DEFAULT_TRACE_STORE_FILE = join('.automatosx', 'runtime', 'traces.json');
const traceStoreQueues = new Map();
const LOCK_WAIT_TIMEOUT_MS = 5_000;
const LOCK_STALE_AFTER_MS = 60_000;
const LOCK_RETRY_DELAY_MS = 10;
export class FileTraceStore {
    storageFile;
    constructor(config = {}) {
        this.storageFile = config.storageFile ?? join(config.basePath ?? process.cwd(), DEFAULT_TRACE_STORE_FILE);
    }
    async upsertTrace(record) {
        return enqueueExclusive(this.storageFile, traceStoreQueues, async () => {
            const data = await this.readData();
            const existingIndex = data.traces.findIndex((entry) => entry.traceId === record.traceId);
            if (existingIndex >= 0) {
                data.traces[existingIndex] = record;
            }
            else {
                data.traces.push(record);
            }
            await this.writeData(data);
            return record;
        });
    }
    async getTrace(traceId) {
        const data = await this.readConsistentData();
        return data.traces.find((entry) => entry.traceId === traceId);
    }
    async listTraces(limit) {
        const data = await this.readConsistentData();
        const sorted = [...data.traces].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
        return limit === undefined ? sorted : sorted.slice(0, limit);
    }
    async closeStuckTraces(maxAgeMs = 86_400_000) {
        return enqueueExclusive(this.storageFile, traceStoreQueues, async () => {
            const data = await this.readData();
            const threshold = Date.now() - maxAgeMs;
            const closed = [];
            for (const trace of data.traces) {
                if (trace.status !== 'running') {
                    continue;
                }
                const startedAt = Date.parse(trace.startedAt);
                if (Number.isNaN(startedAt) || startedAt > threshold) {
                    continue;
                }
                const now = new Date().toISOString();
                trace.status = 'failed';
                trace.completedAt = now;
                trace.error = {
                    code: 'TRACE_AUTO_CLOSED',
                    message: 'Auto-closed as stuck trace',
                    failedStepId: trace.error?.failedStepId,
                };
                closed.push(trace);
            }
            await this.writeData(data);
            return closed;
        });
    }
    async readConsistentData() {
        await waitForQueue(this.storageFile, traceStoreQueues);
        return this.readData();
    }
    async readData() {
        try {
            const raw = await readFile(this.storageFile, 'utf8');
            const parsed = JSON.parse(raw);
            return {
                traces: Array.isArray(parsed.traces) ? parsed.traces : [],
            };
        }
        catch {
            return { traces: [] };
        }
    }
    async writeData(data) {
        await mkdir(dirname(this.storageFile), { recursive: true });
        const tempFile = `${this.storageFile}.${process.pid}.${randomUUID()}.tmp`;
        await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
        await rename(tempFile, this.storageFile);
    }
}
export function createTraceStore(config) {
    if (config?.backend === 'json') {
        return new FileTraceStore(config);
    }
    return createSqliteTraceStore({
        basePath: config?.basePath,
        dbFile: config?.storageFile,
    });
}
export { createSqliteTraceStore, SqliteTraceStore } from './sqlite.js';
export { migrateTraceJsonToSqlite } from './migrate.js';
async function waitForQueue(storageFile, queueMap) {
    const pending = queueMap.get(storageFile);
    if (pending !== undefined) {
        await pending;
    }
}
async function enqueueExclusive(storageFile, queueMap, operation) {
    const previous = queueMap.get(storageFile) ?? Promise.resolve();
    let releaseCurrent = () => { };
    const current = new Promise((resolve) => {
        releaseCurrent = resolve;
    });
    const queueTail = previous.then(() => current);
    queueMap.set(storageFile, queueTail);
    await previous;
    try {
        return await withCrossProcessLock(storageFile, operation);
    }
    finally {
        releaseCurrent();
        if (queueMap.get(storageFile) === queueTail) {
            queueMap.delete(storageFile);
        }
    }
}
async function withCrossProcessLock(storageFile, operation) {
    const release = await acquireLock(storageFile);
    try {
        return await operation();
    }
    finally {
        await release();
    }
}
async function acquireLock(storageFile) {
    const lockDir = `${storageFile}.lock`;
    const ownerFile = join(lockDir, 'owner.json');
    const startTime = Date.now();
    await mkdir(dirname(storageFile), { recursive: true });
    for (;;) {
        try {
            await mkdir(lockDir);
            await writeFile(ownerFile, `${JSON.stringify({
                pid: process.pid,
                acquiredAt: new Date().toISOString(),
            }, null, 2)}\n`, 'utf8');
            return async () => {
                await rm(lockDir, { recursive: true, force: true });
            };
        }
        catch (error) {
            if (!isAlreadyExistsError(error)) {
                throw error;
            }
            if (await isStaleLock(lockDir, LOCK_STALE_AFTER_MS)) {
                await rm(lockDir, { recursive: true, force: true });
                continue;
            }
            if (Date.now() - startTime >= LOCK_WAIT_TIMEOUT_MS) {
                throw new Error(`Timed out acquiring trace store lock for ${storageFile}`);
            }
            await delay(LOCK_RETRY_DELAY_MS);
        }
    }
}
async function isStaleLock(lockDir, staleAfterMs) {
    try {
        const info = await stat(lockDir);
        return Date.now() - info.mtimeMs > staleAfterMs;
    }
    catch {
        return false;
    }
}
function isAlreadyExistsError(error) {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'EEXIST';
}
async function delay(ms) {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
