import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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
  }>;
  output?: unknown;
  error?: {
    code?: string;
    message?: string;
    failedStepId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface TraceStore {
  upsertTrace(record: TraceRecord): Promise<TraceRecord>;
  getTrace(traceId: string): Promise<TraceRecord | undefined>;
  listTraces(limit?: number): Promise<TraceRecord[]>;
  closeStuckTraces(maxAgeMs?: number): Promise<TraceRecord[]>;
}

interface TraceStoreFile {
  traces: TraceRecord[];
}

export interface FileTraceStoreConfig {
  basePath?: string;
  storageFile?: string;
}

const DEFAULT_TRACE_STORE_FILE = join('.automatosx', 'runtime', 'traces.json');
const traceStoreQueues = new Map<string, Promise<void>>();
const LOCK_WAIT_TIMEOUT_MS = 5_000;
const LOCK_STALE_AFTER_MS = 60_000;
const LOCK_RETRY_DELAY_MS = 10;

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
      const parsed = JSON.parse(raw) as Partial<TraceStoreFile>;
      return {
        traces: Array.isArray(parsed.traces) ? parsed.traces : [],
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

export function createTraceStore(config?: FileTraceStoreConfig): TraceStore {
  return new FileTraceStore(config);
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
