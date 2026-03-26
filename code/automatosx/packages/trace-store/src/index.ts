import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { TraceTreeNode } from './sqlite.js';
import { createSqliteTraceStore } from './sqlite.js';

export type TraceSurface = 'cli' | 'mcp';
export type TraceStatus = 'running' | 'completed' | 'failed';

export interface TraceRecord {
  traceId: string;
  workflowId: string;
  surface: TraceSurface;
  status: TraceStatus;
  startedAt: string;
  completedAt?: string;
  input?: Record<string, unknown>;
  stepResults: Array<{
    stepId: string;
    success: boolean;
    durationMs: number;
    retryCount: number;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  output?: unknown;
  error?: {
    code?: string;
    message?: string;
    failedStepId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface TraceStatusCounts {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

export interface HourlyMetricBucket {
  /** ISO timestamp for the start of the hour bucket (truncated to the hour) */
  hour: string;
  total: number;
  completed: number;
  failed: number;
}

export interface TraceStore {
  upsertTrace(record: TraceRecord): Promise<TraceRecord>;
  getTrace(traceId: string): Promise<TraceRecord | undefined>;
  listTraces(limit?: number): Promise<TraceRecord[]>;
  getTraceStatusCounts(): Promise<TraceStatusCounts>;
  countTraces(status?: TraceStatus): Promise<number>;
  listTracesByStatus(status: TraceStatus, limit?: number): Promise<TraceRecord[]>;
  listTracesByWorkflow(workflowId: string, limit?: number): Promise<TraceRecord[]>;
  listTracesBySession(sessionId: string, limit?: number): Promise<TraceRecord[]>;
  getTraceTree(traceId: string): Promise<TraceTreeNode | undefined>;
  closeStuckTraces(maxAgeMs?: number): Promise<TraceRecord[]>;
  getHourlyMetrics(hours?: number): Promise<HourlyMetricBucket[]>;
}

interface TraceStoreFile {
  traces: TraceRecord[];
}

export interface FileTraceStoreConfig {
  basePath?: string;
  storageFile?: string;
  /** Storage backend. Defaults to 'sqlite'. Use 'json' to keep the legacy file-based store. */
  backend?: 'sqlite' | 'json';
}

const DEFAULT_TRACE_STORE_FILE = join('.automatosx', 'runtime', 'traces.json');
const traceStoreQueues = new Map<string, Promise<void>>();
const LOCK_WAIT_TIMEOUT_MS = 5_000;
const LOCK_STALE_AFTER_MS = 60_000;
const LOCK_RETRY_DELAY_MS = 10;
const traceStoreFileSchema = z.object({
  traces: z.array(z.unknown()).optional(),
});

export class FileTraceStore implements TraceStore {
  private readonly storageFile: string;

  constructor(config: FileTraceStoreConfig = {}) {
    this.storageFile = config.storageFile ?? join(config.basePath ?? process.cwd(), DEFAULT_TRACE_STORE_FILE);
  }

  async upsertTrace(record: TraceRecord): Promise<TraceRecord> {
    return enqueueExclusive(this.storageFile, traceStoreQueues, async () => {
      const data = await this.readData();
      const existingIndex = data.traces.findIndex((entry) => entry.traceId === record.traceId);

      if (existingIndex >= 0) {
        data.traces[existingIndex] = record;
      } else {
        data.traces.push(record);
      }

      await this.writeData(data);
      return record;
    });
  }

  async getTrace(traceId: string): Promise<TraceRecord | undefined> {
    const data = await this.readConsistentData();
    return data.traces.find((entry) => entry.traceId === traceId);
  }

  async listTraces(limit?: number): Promise<TraceRecord[]> {
    const data = await this.readConsistentData();
    const sorted = [...data.traces].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    return limit === undefined ? sorted : sorted.slice(0, limit);
  }

  async getTraceStatusCounts(): Promise<TraceStatusCounts> {
    const data = await this.readConsistentData();
    return {
      total: data.traces.length,
      running: data.traces.filter((trace) => trace.status === 'running').length,
      completed: data.traces.filter((trace) => trace.status === 'completed').length,
      failed: data.traces.filter((trace) => trace.status === 'failed').length,
    };
  }

  async countTraces(status?: TraceStatus): Promise<number> {
    const data = await this.readConsistentData();
    if (status === undefined) {
      return data.traces.length;
    }
    return data.traces.filter((trace) => trace.status === status).length;
  }

  async listTracesByStatus(status: TraceStatus, limit?: number): Promise<TraceRecord[]> {
    const data = await this.readConsistentData();
    const filtered = data.traces
      .filter((trace) => trace.status === status)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    return limit === undefined ? filtered : filtered.slice(0, limit);
  }

  async listTracesByWorkflow(workflowId: string, limit?: number): Promise<TraceRecord[]> {
    const data = await this.readConsistentData();
    const filtered = data.traces
      .filter((trace) => trace.workflowId === workflowId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    return limit === undefined ? filtered : filtered.slice(0, limit);
  }

  async listTracesBySession(sessionId: string, limit?: number): Promise<TraceRecord[]> {
    const data = await this.readConsistentData();
    const filtered = data.traces
      .filter((trace) => trace.metadata?.sessionId === sessionId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    return limit === undefined ? filtered : filtered.slice(0, limit);
  }

  async getTraceTree(traceId: string): Promise<TraceTreeNode | undefined> {
    const data = await this.readConsistentData();
    return buildTraceTree(data.traces, traceId);
  }

  async getHourlyMetrics(hours = 24): Promise<HourlyMetricBucket[]> {
    const data = await this.readConsistentData();
    const cutoff = Date.now() - hours * 3_600_000;
    const buckets = new Map<string, HourlyMetricBucket>();

    for (const trace of data.traces) {
      const ts = Date.parse(trace.startedAt);
      if (Number.isNaN(ts) || ts < cutoff) continue;
      const d = new Date(ts);
      d.setMinutes(0, 0, 0);
      const key = d.toISOString();
      const existing = buckets.get(key) ?? { hour: key, total: 0, completed: 0, failed: 0 };
      existing.total += 1;
      if (trace.status === 'completed') existing.completed += 1;
      if (trace.status === 'failed') existing.failed += 1;
      buckets.set(key, existing);
    }

    return [...buckets.values()].sort((a, b) => a.hour.localeCompare(b.hour));
  }

  async closeStuckTraces(maxAgeMs = 86_400_000): Promise<TraceRecord[]> {
    return enqueueExclusive(this.storageFile, traceStoreQueues, async () => {
      const data = await this.readData();
      const threshold = Date.now() - maxAgeMs;
      const closed: TraceRecord[] = [];

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

  private async readConsistentData(): Promise<TraceStoreFile> {
    await waitForQueue(this.storageFile, traceStoreQueues);
    return this.readData();
  }

  private async readData(): Promise<TraceStoreFile> {
    try {
      const raw = await readFile(this.storageFile, 'utf8');
      const result = traceStoreFileSchema.safeParse(JSON.parse(raw));
      if (!result.success) {
        return { traces: [] };
      }
      const parsed = result.data;
      return {
        traces: Array.isArray(parsed.traces) ? parsed.traces as TraceRecord[] : [],
      };
    } catch {
      return { traces: [] };
    }
  }

  private async writeData(data: TraceStoreFile): Promise<void> {
    await mkdir(dirname(this.storageFile), { recursive: true });
    const tempFile = `${this.storageFile}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(tempFile, this.storageFile);
  }
}

export function createLegacyJsonTraceStore(config?: FileTraceStoreConfig): TraceStore {
  return new FileTraceStore(config);
}

export function createTraceStore(config?: FileTraceStoreConfig): TraceStore {
  if (config?.backend === 'json') {
    return createLegacyJsonTraceStore(config);
  }
  return createSqliteTraceStore({
    basePath: config?.basePath,
    dbFile: config?.storageFile,
  });
}

export { createSqliteTraceStore, SqliteTraceStore } from './sqlite.js';
export type { SqliteTraceStoreConfig, TraceTreeNode } from './sqlite.js';
export { migrateTraceJsonToSqlite } from './migrate.js';
export type { MigrateTraceJsonToSqliteOptions, TraceMigrationResult } from './migrate.js';

function buildTraceTree(traces: TraceRecord[], traceId: string): TraceTreeNode | undefined {
  const traceMap = new Map(traces.map((trace) => [trace.traceId, trace] as const));
  const anchor = traceMap.get(traceId);
  if (anchor === undefined) {
    return undefined;
  }

  let root = anchor;
  const seen = new Set<string>();
  while (
    typeof root.metadata?.parentTraceId === 'string' &&
    traceMap.has(root.metadata.parentTraceId) &&
    !seen.has(root.traceId)
  ) {
    seen.add(root.traceId);
    root = traceMap.get(root.metadata.parentTraceId)!;
  }

  if (
    root === anchor &&
    typeof anchor.metadata?.rootTraceId === 'string' &&
    traceMap.has(anchor.metadata.rootTraceId)
  ) {
    root = traceMap.get(anchor.metadata.rootTraceId)!;
  }

  const childMap = new Map<string, TraceRecord[]>();
  for (const trace of traces) {
    const parentId = typeof trace.metadata?.parentTraceId === 'string'
      ? trace.metadata.parentTraceId
      : typeof trace.metadata?.rootTraceId === 'string' && trace.traceId !== trace.metadata.rootTraceId
        ? trace.metadata.rootTraceId
        : undefined;
    if (parentId === undefined) {
      continue;
    }

    const children = childMap.get(parentId) ?? [];
    children.push(trace);
    childMap.set(parentId, children);
  }

  return toTraceTreeNode(root, childMap, new Set<string>());
}

function toTraceTreeNode(
  trace: TraceRecord,
  childMap: Map<string, TraceRecord[]>,
  visited: Set<string>,
): TraceTreeNode {
  if (visited.has(trace.traceId)) {
    return {
      trace,
      children: [],
    };
  }

  visited.add(trace.traceId);
  return {
    trace,
    children: (childMap.get(trace.traceId) ?? [])
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
      .map((child) => toTraceTreeNode(child, childMap, visited)),
  };
}

async function waitForQueue(storageFile: string, queueMap: Map<string, Promise<void>>): Promise<void> {
  const pending = queueMap.get(storageFile);
  if (pending !== undefined) {
    await pending;
  }
}

async function enqueueExclusive<T>(
  storageFile: string,
  queueMap: Map<string, Promise<void>>,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queueMap.get(storageFile) ?? Promise.resolve();
  let releaseCurrent = (): void => {};
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queueTail = previous.then(() => current);
  queueMap.set(storageFile, queueTail);

  await previous;

  try {
    return await withCrossProcessLock(storageFile, operation);
  } finally {
    releaseCurrent();
    if (queueMap.get(storageFile) === queueTail) {
      queueMap.delete(storageFile);
    }
  }
}

async function withCrossProcessLock<T>(storageFile: string, operation: () => Promise<T>): Promise<T> {
  const release = await acquireLock(storageFile);
  try {
    return await operation();
  } finally {
    await release();
  }
}

async function acquireLock(storageFile: string): Promise<() => Promise<void>> {
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
    } catch (error) {
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

async function isStaleLock(lockDir: string, staleAfterMs: number): Promise<boolean> {
  try {
    const info = await stat(lockDir);
    return Date.now() - info.mtimeMs > staleAfterMs;
  } catch {
    return false;
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'EEXIST';
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
