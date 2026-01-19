/**
 * Idempotency Manager Implementation
 *
 * Prevents duplicate request processing using idempotency keys.
 * Ensures operations are safely retryable without side effects.
 *
 * Invariants:
 * - INV-ID-001: Same idempotency key returns cached response
 * - INV-ID-002: Different request with same key is rejected (conflict)
 * - INV-ID-003: Cache entries expire after TTL
 */

import {
  type IdempotencyCacheEntry,
  type IdempotencyConfig,
  type IdempotencyCheckResult,
  createDefaultIdempotencyConfig,
  calculateExpiration,
  isEntryExpired,
  IdempotencyErrorCodes,
  getErrorMessage,
} from '@defai.digital/contracts';

/**
 * Idempotency storage interface
 */
export interface IdempotencyStorage {
  /** Get entry by key */
  get(key: string): Promise<IdempotencyCacheEntry | null>;

  /** Set entry */
  set(entry: IdempotencyCacheEntry): Promise<void>;

  /** Delete entry */
  delete(key: string): Promise<boolean>;

  /** Delete expired entries */
  deleteExpired(): Promise<number>;
}

/**
 * Idempotency manager
 */
export interface IdempotencyManager {
  /** Get configuration */
  getConfig(): IdempotencyConfig;

  /** Check request idempotency status */
  check(key: string, requestHash: string): Promise<IdempotencyCheckResult>;

  /** Start processing a request */
  startProcessing(key: string, requestHash: string): Promise<boolean>;

  /** Complete processing and cache result */
  completeProcessing(key: string, response: unknown): Promise<void>;

  /** Mark processing as failed */
  failProcessing(key: string, error: string): Promise<void>;

  /** Get cached entry */
  getEntry(key: string): Promise<IdempotencyCacheEntry | null>;

  /** Cleanup expired entries */
  cleanup(): Promise<number>;
}

/**
 * Creates an in-memory idempotency storage
 */
export function createInMemoryIdempotencyStorage(): IdempotencyStorage {
  const entries = new Map<string, IdempotencyCacheEntry>();

  return {
    async get(key: string): Promise<IdempotencyCacheEntry | null> {
      const entry = entries.get(key);
      if (!entry) return null;

      // Check if expired
      if (isEntryExpired(entry)) {
        entries.delete(key);
        return null;
      }

      return entry;
    },

    async set(entry: IdempotencyCacheEntry): Promise<void> {
      entries.set(entry.key, entry);
    },

    async delete(key: string): Promise<boolean> {
      return entries.delete(key);
    },

    async deleteExpired(): Promise<number> {
      const expiredKeys: string[] = [];

      // Collect expired keys first to avoid deleting while iterating
      for (const [key, entry] of entries) {
        if (isEntryExpired(entry)) {
          expiredKeys.push(key);
        }
      }

      // Delete after iteration completes
      for (const key of expiredKeys) {
        entries.delete(key);
      }

      return expiredKeys.length;
    },
  };
}

/**
 * Creates an idempotency manager
 */
export function createIdempotencyManager(
  storage: IdempotencyStorage,
  config: Partial<IdempotencyConfig> = {}
): IdempotencyManager {
  const cfg: IdempotencyConfig = { ...createDefaultIdempotencyConfig(), ...config };

  return {
    getConfig(): IdempotencyConfig {
      return { ...cfg };
    },

    async check(key: string, requestHash: string): Promise<IdempotencyCheckResult> {
      if (!cfg.enabled) {
        return { status: 'new' };
      }

      const entry = await storage.get(key);

      if (!entry) {
        return { status: 'new' };
      }

      // INV-ID-001: Same key returns cached response
      if (entry.status === 'completed') {
        // INV-ID-002: Different request with same key is rejected
        if (entry.requestHash !== requestHash) {
          return {
            status: 'conflict',
            error: 'Request hash mismatch for idempotency key',
          };
        }

        return {
          status: 'cached',
          response: entry.response,
          cachedAt: entry.createdAt,
        };
      }

      // Request is being processed
      if (entry.status === 'processing') {
        const lockExpiry = new Date(entry.createdAt).getTime() + cfg.lockTimeoutMs;
        const now = Date.now();

        if (now < lockExpiry) {
          return {
            status: 'processing',
            lockExpiresInMs: lockExpiry - now,
          };
        }

        // Lock expired, allow new processing
        return { status: 'new' };
      }

      // Failed - allow retry with same hash
      if (entry.status === 'failed') {
        if (entry.requestHash !== requestHash) {
          return {
            status: 'conflict',
            error: 'Request hash mismatch for idempotency key',
          };
        }
        return { status: 'new' };
      }

      return { status: 'new' };
    },

    async startProcessing(key: string, requestHash: string): Promise<boolean> {
      if (!cfg.enabled) {
        return true;
      }

      const existing = await storage.get(key);

      // Check if already processing (and not expired)
      if (existing?.status === 'processing') {
        const lockExpiry = new Date(existing.createdAt).getTime() + cfg.lockTimeoutMs;
        if (Date.now() < lockExpiry) {
          return false; // Still locked
        }
      }

      // Check if already completed
      if (existing?.status === 'completed') {
        return false;
      }

      // INV-ID-003: Set expiration
      const expiresAt = calculateExpiration(cfg.ttlSeconds);

      const entry: IdempotencyCacheEntry = {
        key,
        requestHash,
        response: null,
        createdAt: new Date().toISOString(),
        expiresAt,
        status: 'processing',
      };

      await storage.set(entry);
      return true;
    },

    async completeProcessing(key: string, response: unknown): Promise<void> {
      const existing = await storage.get(key);

      if (!existing) {
        // Entry was deleted or expired during processing.
        // Don't create a new entry with empty requestHash as this would
        // violate INV-ID-002 (hash mismatch detection). Future requests
        // with this key will simply reprocess, which is safe.
        return;
      }

      const entry: IdempotencyCacheEntry = {
        ...existing,
        response,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      };

      await storage.set(entry);
    },

    async failProcessing(key: string, error: string): Promise<void> {
      const existing = await storage.get(key);

      if (!existing) {
        return; // Allow silent failure
      }

      const entry: IdempotencyCacheEntry = {
        ...existing,
        status: 'failed',
        error,
        updatedAt: new Date().toISOString(),
      };

      await storage.set(entry);
    },

    async getEntry(key: string): Promise<IdempotencyCacheEntry | null> {
      return storage.get(key);
    },

    async cleanup(): Promise<number> {
      return storage.deleteExpired();
    },
  };
}

/**
 * Wrapper for idempotent operations
 */
export async function withIdempotency<T>(
  manager: IdempotencyManager,
  key: string,
  requestHash: string,
  operation: () => Promise<T>
): Promise<T> {
  // Check for duplicate
  const check = await manager.check(key, requestHash);

  if (check.status === 'cached' && check.response !== undefined) {
    return check.response as T;
  }

  if (check.status === 'processing') {
    throw new IdempotencyError(
      IdempotencyErrorCodes.LOCK_TIMEOUT,
      'Operation already in progress'
    );
  }

  if (check.status === 'conflict') {
    throw new IdempotencyError(
      IdempotencyErrorCodes.KEY_CONFLICT,
      check.error ?? 'Request hash mismatch'
    );
  }

  // Start processing
  const started = await manager.startProcessing(key, requestHash);
  if (!started) {
    throw new IdempotencyError(
      IdempotencyErrorCodes.KEY_CONFLICT,
      'Could not acquire lock for idempotent operation'
    );
  }

  try {
    const result = await operation();
    await manager.completeProcessing(key, result);
    return result;
  } catch (error) {
    await manager.failProcessing(key, getErrorMessage(error));
    throw error;
  }
}

/**
 * Idempotency error
 */
export class IdempotencyError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `Idempotency error: ${code}`);
    this.name = 'IdempotencyError';
  }

  static keyConflict(key: string): IdempotencyError {
    return new IdempotencyError(
      IdempotencyErrorCodes.KEY_CONFLICT,
      `Idempotency key conflict: ${key}`
    );
  }

  static lockTimeout(key: string): IdempotencyError {
    return new IdempotencyError(
      IdempotencyErrorCodes.LOCK_TIMEOUT,
      `Lock timeout for idempotency key: ${key}`
    );
  }
}
