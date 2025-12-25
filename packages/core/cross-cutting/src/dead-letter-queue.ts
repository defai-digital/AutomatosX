/**
 * Dead Letter Queue Implementation
 *
 * Captures and manages failed events for later retry or analysis.
 * Prevents event loss and enables debugging of failures.
 *
 * Invariants:
 * - INV-DLQ-001: Failed events captured with full context
 * - INV-DLQ-002: Retries respect maxRetries limit
 * - INV-DLQ-003: Exhausted entries marked appropriately
 */

import {
  type DeadLetterEntry,
  type DeadLetterError,
  type DeadLetterStatus,
  type DLQConfig,
  type DLQStats,
  createDefaultDLQConfig,
  DLQErrorCodes,
} from '@defai.digital/contracts';

/**
 * DLQ storage interface
 */
export interface DeadLetterStorage {
  /** Add entry to DLQ */
  add(entry: DeadLetterEntry): Promise<void>;

  /** Get entry by ID */
  get(entryId: string): Promise<DeadLetterEntry | null>;

  /** List entries with optional status filter */
  list(status?: DeadLetterStatus): Promise<DeadLetterEntry[]>;

  /** Update entry */
  update(entry: DeadLetterEntry): Promise<void>;

  /** Delete entry */
  delete(entryId: string): Promise<boolean>;

  /** Count entries by status */
  countByStatus(): Promise<Record<DeadLetterStatus, number>>;
}

/**
 * Dead letter queue manager
 */
export interface DeadLetterQueue {
  /** Get configuration */
  getConfig(): DLQConfig;

  /** Add a failed event to the DLQ */
  enqueue(
    eventId: string,
    eventType: string,
    payload: unknown,
    error: DeadLetterError,
    source: string
  ): Promise<DeadLetterEntry>;

  /** Get an entry from the DLQ */
  getEntry(entryId: string): Promise<DeadLetterEntry | null>;

  /** Get entries ready for retry */
  getRetryable(): Promise<DeadLetterEntry[]>;

  /** Mark entry as being retried */
  markRetrying(entryId: string): Promise<DeadLetterEntry | null>;

  /** Mark entry as successfully resolved */
  markResolved(entryId: string, notes?: string): Promise<DeadLetterEntry | null>;

  /** Mark entry as exhausted (max retries) */
  markExhausted(entryId: string): Promise<DeadLetterEntry | null>;

  /** Discard entry */
  discard(entryId: string, notes?: string): Promise<DeadLetterEntry | null>;

  /** Get DLQ statistics */
  getStats(): Promise<DLQStats>;

  /** Purge resolved entries older than retention period */
  purgeResolved(): Promise<number>;
}

/**
 * Creates an in-memory DLQ storage
 */
export function createInMemoryDeadLetterStorage(): DeadLetterStorage {
  const entries = new Map<string, DeadLetterEntry>();

  return {
    async add(entry: DeadLetterEntry): Promise<void> {
      entries.set(entry.entryId, entry);
    },

    async get(entryId: string): Promise<DeadLetterEntry | null> {
      return entries.get(entryId) ?? null;
    },

    async list(status?: DeadLetterStatus): Promise<DeadLetterEntry[]> {
      const all = Array.from(entries.values());
      if (status) {
        return all.filter((e) => e.status === status);
      }
      return all;
    },

    async update(entry: DeadLetterEntry): Promise<void> {
      entries.set(entry.entryId, entry);
    },

    async delete(entryId: string): Promise<boolean> {
      return entries.delete(entryId);
    },

    async countByStatus(): Promise<Record<DeadLetterStatus, number>> {
      const counts: Record<DeadLetterStatus, number> = {
        pending: 0,
        retrying: 0,
        exhausted: 0,
        resolved: 0,
        discarded: 0,
      };

      for (const entry of entries.values()) {
        counts[entry.status]++;
      }

      return counts;
    },
  };
}

/**
 * Creates a dead letter queue manager
 */
export function createDeadLetterQueue(
  storage: DeadLetterStorage,
  config: Partial<DLQConfig> = {}
): DeadLetterQueue {
  const cfg: DLQConfig = { ...createDefaultDLQConfig(), ...config };

  return {
    getConfig(): DLQConfig {
      return { ...cfg };
    },

    async enqueue(
      eventId: string,
      eventType: string,
      payload: unknown,
      error: DeadLetterError,
      source: string
    ): Promise<DeadLetterEntry> {
      // INV-DLQ-001: Failed events captured with full context
      const entry: DeadLetterEntry = {
        entryId: crypto.randomUUID(),
        originalEventId: eventId,
        eventType,
        eventPayload: payload,
        error,
        retryCount: 0,
        maxRetries: cfg.maxRetries,
        status: 'pending',
        createdAt: new Date().toISOString(),
        source,
        nextRetryAt: new Date(Date.now() + cfg.retryDelayMs).toISOString(),
      };

      await storage.add(entry);
      return entry;
    },

    async getEntry(entryId: string): Promise<DeadLetterEntry | null> {
      return storage.get(entryId);
    },

    async getRetryable(): Promise<DeadLetterEntry[]> {
      const pending = await storage.list('pending');
      const now = Date.now();

      return pending.filter((entry) => {
        // Check if ready for retry (based on nextRetryAt)
        if (entry.nextRetryAt) {
          const nextRetry = new Date(entry.nextRetryAt).getTime();
          return now >= nextRetry;
        }
        return true;
      });
    },

    async markRetrying(entryId: string): Promise<DeadLetterEntry | null> {
      const entry = await storage.get(entryId);
      if (!entry) return null;

      // INV-DLQ-002: Track retry count
      const updatedEntry: DeadLetterEntry = {
        ...entry,
        status: 'retrying',
        retryCount: entry.retryCount + 1,
        lastRetryAt: new Date().toISOString(),
      };

      await storage.update(updatedEntry);
      return updatedEntry;
    },

    async markResolved(entryId: string, notes?: string): Promise<DeadLetterEntry | null> {
      const entry = await storage.get(entryId);
      if (!entry) return null;

      const updatedEntry: DeadLetterEntry = {
        ...entry,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes,
      };

      await storage.update(updatedEntry);
      return updatedEntry;
    },

    async markExhausted(entryId: string): Promise<DeadLetterEntry | null> {
      const entry = await storage.get(entryId);
      if (!entry) return null;

      // INV-DLQ-003: Exhausted entries marked appropriately
      const updatedEntry: DeadLetterEntry = {
        ...entry,
        status: 'exhausted',
      };

      await storage.update(updatedEntry);
      return updatedEntry;
    },

    async discard(entryId: string, notes?: string): Promise<DeadLetterEntry | null> {
      const entry = await storage.get(entryId);
      if (!entry) return null;

      const updatedEntry: DeadLetterEntry = {
        ...entry,
        status: 'discarded',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: notes,
      };

      await storage.update(updatedEntry);
      return updatedEntry;
    },

    async getStats(): Promise<DLQStats> {
      const counts = await storage.countByStatus();
      const all = await storage.list();

      const sorted = all.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      return {
        totalEntries: all.length,
        pendingCount: counts.pending,
        retryingCount: counts.retrying,
        exhaustedCount: counts.exhausted,
        resolvedCount: counts.resolved,
        discardedCount: counts.discarded,
        oldestEntry: sorted[0]?.createdAt,
        newestEntry: sorted[sorted.length - 1]?.createdAt,
      };
    },

    async purgeResolved(): Promise<number> {
      const resolved = await storage.list('resolved');
      const cutoff = Date.now() - cfg.retentionDays * 24 * 60 * 60 * 1000;
      let purged = 0;

      for (const entry of resolved) {
        if (entry.resolvedAt) {
          const resolvedTime = new Date(entry.resolvedAt).getTime();
          if (resolvedTime < cutoff) {
            await storage.delete(entry.entryId);
            purged++;
          }
        }
      }

      return purged;
    },
  };
}

/**
 * Process retry for an entry
 */
export async function processRetry(
  dlq: DeadLetterQueue,
  entryId: string,
  retryFn: (entry: DeadLetterEntry) => Promise<void>
): Promise<boolean> {
  const entry = await dlq.getEntry(entryId);
  if (!entry) return false;

  // Check max retries
  if (entry.retryCount >= entry.maxRetries) {
    await dlq.markExhausted(entryId);
    return false;
  }

  // Mark as retrying
  await dlq.markRetrying(entryId);

  try {
    await retryFn(entry);
    await dlq.markResolved(entryId, 'Retry successful');
    return true;
  } catch {
    // Re-fetch to get updated retry count
    const updated = await dlq.getEntry(entryId);
    if (updated) {
      // Check if exhausted
      if (updated.retryCount >= updated.maxRetries) {
        await dlq.markExhausted(entryId);
      }
      // Note: Next retry scheduling handled by DLQ retry mechanism
    }
    return false;
  }
}

/**
 * DLQ error
 */
export class DeadLetterQueueError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `DLQ error: ${code}`);
    this.name = 'DeadLetterQueueError';
  }

  static entryNotFound(entryId: string): DeadLetterQueueError {
    return new DeadLetterQueueError(
      DLQErrorCodes.ENTRY_NOT_FOUND,
      `DLQ entry not found: ${entryId}`
    );
  }

  static maxEntriesExceeded(): DeadLetterQueueError {
    return new DeadLetterQueueError(
      DLQErrorCodes.MAX_ENTRIES_EXCEEDED,
      'Maximum DLQ entries exceeded'
    );
  }
}
