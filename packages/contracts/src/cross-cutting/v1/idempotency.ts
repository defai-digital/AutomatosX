/**
 * Idempotency Contract V1
 *
 * Provides contracts for preventing duplicate request processing.
 * Enables safe retries and exactly-once semantics.
 *
 * Invariants:
 * - INV-ID-001: Same idempotency key returns cached response
 * - INV-ID-002: Different request with same key is rejected (conflict)
 * - INV-ID-003: Cache entries expire after TTL
 */

import { z } from 'zod';
import {
  IDEMPOTENCY_TTL_SECONDS,
  LIMIT_STORE_ENTRIES,
  CLEANUP_INTERVAL_SECONDS,
  TIMEOUT_SAGA_DEFAULT,
} from '../../constants.js';

/**
 * Idempotency check status
 */
export const IdempotencyStatusSchema = z.enum([
  'new',         // New request, proceed with processing
  'cached',      // Cached response available
  'processing',  // Request currently being processed
  'conflict',    // Different request with same key
]);

export type IdempotencyStatus = z.infer<typeof IdempotencyStatusSchema>;

/**
 * Idempotency cache entry status
 */
export const CacheEntryStatusSchema = z.enum([
  'processing',  // Request is being processed
  'completed',   // Request completed successfully
  'failed',      // Request failed (allows retry)
]);

export type CacheEntryStatus = z.infer<typeof CacheEntryStatusSchema>;

/**
 * Idempotency cache entry
 */
export const IdempotencyCacheEntrySchema = z.object({
  /** Idempotency key */
  key: z.string().uuid(),

  /** Hash of original request */
  requestHash: z.string(),

  /** Cached response (if completed) */
  response: z.unknown(),

  /** Entry creation timestamp */
  createdAt: z.string().datetime(),

  /** Entry expiration timestamp */
  expiresAt: z.string().datetime(),

  /** Current status */
  status: CacheEntryStatusSchema,

  /** Error message if failed */
  error: z.string().optional(),

  /** Request metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /** Last update timestamp */
  updatedAt: z.string().datetime().optional(),
});

export type IdempotencyCacheEntry = z.infer<typeof IdempotencyCacheEntrySchema>;

/**
 * Idempotency configuration
 */
export const IdempotencyConfigSchema = z.object({
  /** Enable idempotency checking */
  enabled: z.boolean().default(true),

  /** TTL for cached responses in seconds */
  ttlSeconds: z.number().int().min(60).max(86400).default(IDEMPOTENCY_TTL_SECONDS),

  /** Maximum cached entries */
  maxEntries: z.number().int().min(100).max(100000).default(LIMIT_STORE_ENTRIES),

  /** Cleanup interval in seconds */
  cleanupIntervalSeconds: z.number().int().min(60).max(3600).default(CLEANUP_INTERVAL_SECONDS),

  /** Lock timeout for processing state in ms */
  lockTimeoutMs: z.number().int().min(1000).max(300000).default(TIMEOUT_SAGA_DEFAULT),

  /** Include request body in hash */
  hashRequestBody: z.boolean().default(true),

  /** Include specific headers in hash */
  hashHeaders: z.array(z.string()).default([]),
});

export type IdempotencyConfig = z.infer<typeof IdempotencyConfigSchema>;

/**
 * Idempotency check result
 */
export const IdempotencyCheckResultSchema = z.object({
  /** Result status */
  status: IdempotencyStatusSchema,

  /** Cached response (if status is 'cached') */
  response: z.unknown().optional(),

  /** When response was cached (if cached) */
  cachedAt: z.string().datetime().optional(),

  /** Error message (if status is 'conflict') */
  error: z.string().optional(),

  /** Time until lock expires (if processing) */
  lockExpiresInMs: z.number().int().min(0).optional(),
});

export type IdempotencyCheckResult = z.infer<typeof IdempotencyCheckResultSchema>;

/**
 * Idempotency statistics
 */
export const IdempotencyStatsSchema = z.object({
  /** Total cached entries */
  totalEntries: z.number().int().min(0),

  /** Entries by status */
  byStatus: z.object({
    processing: z.number().int().min(0),
    completed: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),

  /** Cache hit rate (0-1) */
  hitRate: z.number().min(0).max(1),

  /** Total hits */
  totalHits: z.number().int().min(0),

  /** Total misses */
  totalMisses: z.number().int().min(0),

  /** Total conflicts */
  totalConflicts: z.number().int().min(0),

  /** Oldest entry timestamp */
  oldestEntry: z.string().datetime().optional(),
});

export type IdempotencyStats = z.infer<typeof IdempotencyStatsSchema>;

/**
 * Idempotency error codes
 */
export const IdempotencyErrorCodes = {
  KEY_CONFLICT: 'IDEMPOTENCY_KEY_CONFLICT',
  LOCK_TIMEOUT: 'IDEMPOTENCY_LOCK_TIMEOUT',
  CACHE_FULL: 'IDEMPOTENCY_CACHE_FULL',
  INVALID_KEY: 'IDEMPOTENCY_INVALID_KEY',
  ENTRY_EXPIRED: 'IDEMPOTENCY_ENTRY_EXPIRED',
} as const;

export type IdempotencyErrorCode =
  (typeof IdempotencyErrorCodes)[keyof typeof IdempotencyErrorCodes];

/**
 * Validates idempotency configuration
 */
export function validateIdempotencyConfig(data: unknown): IdempotencyConfig {
  return IdempotencyConfigSchema.parse(data);
}

/**
 * Validates idempotency cache entry
 */
export function validateIdempotencyCacheEntry(data: unknown): IdempotencyCacheEntry {
  return IdempotencyCacheEntrySchema.parse(data);
}

/**
 * Creates default idempotency configuration
 */
export function createDefaultIdempotencyConfig(): IdempotencyConfig {
  return IdempotencyConfigSchema.parse({});
}

/**
 * Generates request hash from request data
 */
export function generateRequestHash(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): string {
  const data = JSON.stringify({
    method,
    path,
    body,
    headers,
  });

  // Simple hash - in production use crypto
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Calculates expiration timestamp
 */
export function calculateExpiration(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

/**
 * Checks if entry is expired
 */
export function isEntryExpired(entry: IdempotencyCacheEntry): boolean {
  return new Date(entry.expiresAt) < new Date();
}
