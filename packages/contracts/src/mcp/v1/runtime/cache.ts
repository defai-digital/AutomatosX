import { z } from 'zod';

// ============================================================================
// Cache Entry Schema
// ============================================================================

export const MCPCacheEntrySchema = z.object({
  /** Unique key */
  key: z.string().min(1).max(256),
  /** Stored value */
  value: z.unknown(),
  /** Size in bytes (estimated) */
  sizeBytes: z.number().int().nonnegative(),
  /** Creation timestamp */
  createdAt: z.number().int().positive(),
  /** Last access timestamp */
  lastAccessedAt: z.number().int().positive(),
  /** Access count */
  accessCount: z.number().int().nonnegative().default(0),
  /** Time-to-live in milliseconds (0 = no expiry) */
  ttlMs: z.number().int().nonnegative().default(0),
});

export type MCPCacheEntry = z.infer<typeof MCPCacheEntrySchema>;

// ============================================================================
// Cache Configuration Schema
// ============================================================================

export const MCPCacheConfigSchema = z.object({
  /** Maximum cache size in bytes */
  maxSizeBytes: z.number().int().positive().default(104_857_600), // 100MB
  /** Maximum number of entries */
  maxEntries: z.number().int().positive().default(10_000),
  /** Default TTL in milliseconds (0 = no expiry) */
  defaultTtlMs: z.number().int().nonnegative().default(3_600_000), // 1 hour
  /** Eviction policy */
  evictionPolicy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  /** High water mark (trigger eviction) - percentage of max */
  highWaterMark: z.number().min(0.5).max(1).default(0.9),
  /** Low water mark (eviction target) - percentage of max */
  lowWaterMark: z.number().min(0.1).max(0.9).default(0.7),
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: z.number().int().positive().default(60_000), // 1 minute
});

export type MCPCacheConfig = z.infer<typeof MCPCacheConfigSchema>;

// ============================================================================
// Memory Pressure Levels
// ============================================================================

export const MemoryPressureLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export type MemoryPressureLevel = z.infer<typeof MemoryPressureLevelSchema>;

// ============================================================================
// Cache Statistics Schema
// ============================================================================

export const MCPCacheStatsSchema = z.object({
  /** Current entry count */
  entryCount: z.number().int().nonnegative(),
  /** Current size in bytes */
  currentSizeBytes: z.number().int().nonnegative(),
  /** Maximum size in bytes */
  maxSizeBytes: z.number().int().positive(),
  /** Hit count since start */
  hitCount: z.number().int().nonnegative(),
  /** Miss count since start */
  missCount: z.number().int().nonnegative(),
  /** Hit rate (0-1) */
  hitRate: z.number().min(0).max(1),
  /** Eviction count since start */
  evictionCount: z.number().int().nonnegative(),
  /** Last cleanup timestamp */
  lastCleanupAt: z.number().int().nonnegative().optional(),
  /** Memory pressure level */
  pressureLevel: MemoryPressureLevelSchema,
});

export type MCPCacheStats = z.infer<typeof MCPCacheStatsSchema>;

// ============================================================================
// Cache Operations
// ============================================================================

export const CacheGetResultSchema = z.object({
  hit: z.boolean(),
  value: z.unknown().optional(),
  entry: MCPCacheEntrySchema.optional(),
});

export type CacheGetResult = z.infer<typeof CacheGetResultSchema>;

export const CacheSetOptionsSchema = z.object({
  ttlMs: z.number().int().nonnegative().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type CacheSetOptions = z.infer<typeof CacheSetOptionsSchema>;

// ============================================================================
// Eviction Result
// ============================================================================

export const EvictionResultSchema = z.object({
  /** Number of entries evicted */
  evictedCount: z.number().int().nonnegative(),
  /** Bytes freed */
  bytesFreed: z.number().int().nonnegative(),
  /** Eviction reason */
  reason: z.enum(['size_limit', 'entry_limit', 'ttl_expired', 'manual']),
  /** Duration of eviction in ms */
  durationMs: z.number().int().nonnegative(),
});

export type EvictionResult = z.infer<typeof EvictionResultSchema>;
