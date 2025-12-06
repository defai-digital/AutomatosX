/**
 * Request Coalescer for Task Engine
 *
 * Deduplicates concurrent identical requests by sharing results.
 * When multiple callers request the same operation simultaneously,
 * only one actual execution occurs and all callers receive the same result.
 *
 * Features:
 * - Pending request deduplication
 * - Result sharing across waiters
 * - Configurable key generation
 * - Statistics tracking
 *
 * Part of Phase 3: Scaling
 *
 * @module core/task-engine/request-coalescer
 * @version 1.0.0
 */

import * as crypto from 'node:crypto';
import { logger } from '../../shared/logging/logger.js';

/**
 * Pending request entry
 */
interface PendingRequest<T> {
  /** Promise that resolves when execution completes */
  promise: Promise<T>;
  /** Number of waiters sharing this request */
  waiterCount: number;
  /** When the request was initiated */
  startedAt: number;
  /** Key identifying this request */
  key: string;
}

/**
 * Request coalescer configuration
 */
export interface RequestCoalescerConfig {
  /** Maximum pending requests to track (default: 1000) */
  maxPending?: number;
  /** Request timeout in ms (default: 120000) */
  timeoutMs?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Request coalescer statistics
 */
export interface RequestCoalescerStats {
  /** Total requests received */
  totalRequests: number;
  /** Requests that were coalesced (shared with pending) */
  coalescedRequests: number;
  /** Requests that executed fresh */
  freshExecutions: number;
  /** Current pending requests */
  pendingCount: number;
  /** Total waiters saved (coalesced count) */
  waitersSaved: number;
  /** Coalesce rate (0-1) */
  coalesceRate: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<RequestCoalescerConfig> = {
  maxPending: 1000,
  timeoutMs: 120000,
  debug: false
};

/**
 * Deep sort object keys for stable JSON serialization
 * Ensures { a: 1, b: 2 } and { b: 2, a: 1 } produce the same JSON string
 */
function deepSortKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Generate a coalesce key from request parameters
 * Uses deep-sorted keys for stable serialization
 */
export function generateCoalesceKey(
  type: string,
  payload: Record<string, unknown>,
  engine?: string
): string {
  // Deep sort all keys for stable serialization
  const keyObject = deepSortKeys({
    engine: engine ?? 'auto',
    payload,
    type
  });
  const json = JSON.stringify(keyObject);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
}

/**
 * RequestCoalescer - Deduplicates concurrent identical requests
 *
 * @example
 * ```typescript
 * const coalescer = new RequestCoalescer<SearchResult>();
 *
 * // Multiple concurrent calls with same key share result
 * const key = generateCoalesceKey('search', { query: 'test' });
 *
 * const [result1, result2, result3] = await Promise.all([
 *   coalescer.execute(key, () => expensiveSearch('test')),
 *   coalescer.execute(key, () => expensiveSearch('test')),
 *   coalescer.execute(key, () => expensiveSearch('test'))
 * ]);
 *
 * // All three get the same result, but search only ran once
 * // coalescer.getStats().waitersSaved === 2
 * ```
 */
export class RequestCoalescer<T = unknown> {
  private readonly config: Required<RequestCoalescerConfig>;
  private readonly pending = new Map<string, PendingRequest<T>>();

  // Statistics
  private stats = {
    totalRequests: 0,
    coalescedRequests: 0,
    freshExecutions: 0,
    waitersSaved: 0
  };

  constructor(config: RequestCoalescerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.debug('[RequestCoalescer] Initialized', {
      maxPending: this.config.maxPending,
      timeoutMs: this.config.timeoutMs
    });
  }

  /**
   * Execute a request with coalescing
   *
   * If a request with the same key is already pending, wait for that result.
   * Otherwise, execute the provided function and share result with any waiters.
   *
   * @param key - Unique key identifying this request
   * @param executor - Function to execute if no pending request exists
   * @returns Promise resolving to the result
   */
  async execute(key: string, executor: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;

    // Check for pending request with same key
    const existing = this.pending.get(key);
    if (existing) {
      existing.waiterCount++;
      this.stats.coalescedRequests++;
      this.stats.waitersSaved++;

      if (this.config.debug) {
        logger.debug('[RequestCoalescer] Coalesced request', {
          key: key.slice(0, 8) + '...',
          waiterCount: existing.waiterCount
        });
      }

      return existing.promise;
    }

    // Check capacity
    if (this.pending.size >= this.config.maxPending) {
      // Execute without coalescing when at capacity
      logger.warn('[RequestCoalescer] At capacity, executing without coalescing', {
        pendingCount: this.pending.size,
        maxPending: this.config.maxPending
      });
      return executor();
    }

    // Create new pending request
    this.stats.freshExecutions++;
    const startedAt = Date.now();

    const promise = this.executeWithTimeout(key, executor)
      .finally(() => {
        // Clean up pending entry
        this.pending.delete(key);
      });

    const entry: PendingRequest<T> = {
      promise,
      waiterCount: 1,
      startedAt,
      key
    };

    this.pending.set(key, entry);

    if (this.config.debug) {
      logger.debug('[RequestCoalescer] New request', {
        key: key.slice(0, 8) + '...',
        pendingCount: this.pending.size
      });
    }

    return promise;
  }

  /**
   * Check if a request with the given key is pending
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get the number of pending requests
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Get coalescer statistics
   */
  getStats(): RequestCoalescerStats {
    const total = this.stats.totalRequests;
    return {
      totalRequests: this.stats.totalRequests,
      coalescedRequests: this.stats.coalescedRequests,
      freshExecutions: this.stats.freshExecutions,
      pendingCount: this.pending.size,
      waitersSaved: this.stats.waitersSaved,
      coalesceRate: total > 0 ? this.stats.coalescedRequests / total : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      coalescedRequests: 0,
      freshExecutions: 0,
      waitersSaved: 0
    };
  }

  /**
   * Clear all pending requests (for shutdown)
   *
   * Note: This does NOT cancel in-flight requests, just removes tracking.
   * Callers will still receive results or errors from their promises.
   */
  clear(): void {
    this.pending.clear();
    logger.debug('[RequestCoalescer] Cleared all pending requests');
  }

  /**
   * Execute with timeout wrapper
   *
   * IMPORTANT: The timeout timer is properly cleaned up when the executor
   * completes (success or failure) to prevent memory leaks.
   */
  private async executeWithTimeout(key: string, executor: () => Promise<T>): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Request coalescer timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });

    try {
      const result = await Promise.race([executor(), timeoutPromise]);
      // Clear timeout on success to prevent memory leak
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      return result;
    } catch (error) {
      // Clear timeout on error to prevent memory leak
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const entry = this.pending.get(key);
      if (entry && entry.waiterCount > 1) {
        logger.warn('[RequestCoalescer] Request failed with waiters', {
          key: key.slice(0, 8) + '...',
          waiterCount: entry.waiterCount,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  }
}

/**
 * Create a request coalescer instance
 */
export function createRequestCoalescer<T = unknown>(
  config?: RequestCoalescerConfig
): RequestCoalescer<T> {
  return new RequestCoalescer<T>(config);
}
