/**
 * MCP Client Connection Pool Manager (v10.6.0)
 *
 * Manages a pool of MCP client connections for efficient
 * cross-provider execution. Connections are reused across
 * requests to amortize startup costs.
 *
 * Features:
 * - Lazy initialization (spawn on first use)
 * - Connection reuse (return to pool after use)
 * - Idle timeout (cleanup unused connections)
 * - Health checks (validate before use)
 * - Graceful shutdown (cleanup on exit)
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/logging/logger.js';
import { McpClient, createMcpClient } from './mcp-client.js';
import type {
  PoolConfig,
  PoolStats,
  ProviderPoolStats,
  PoolEvent,
  PoolEventType
} from './types.js';
import { ConnectionTimeoutError } from './types.js';
import { TIMEOUTS } from '../../core/validation-limits.js';

interface PooledClient {
  client: McpClient;
  inUse: boolean;
  lastUsed: number;
  useCount: number;
  createdAt: number;
}

interface ProviderPool {
  clients: PooledClient[];
  waitQueue: Array<{
    resolve: (client: McpClient) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  stats: {
    totalRequests: number;
    totalLatencyMs: number;
  };
  /** Track in-flight connection creations to prevent over-allocation race condition */
  pendingConnections: number;
}

/**
 * v12.5.3: Use centralized TIMEOUTS constants
 */
const DEFAULT_CONFIG: PoolConfig = {
  maxConnectionsPerProvider: 2,
  idleTimeoutMs: TIMEOUTS.IDLE_CONNECTION, // 5 minutes
  healthCheckIntervalMs: TIMEOUTS.MCP_HEALTH_CHECK, // 30 seconds
  acquireTimeoutMs: TIMEOUTS.VERSION_CHECK, // 10 seconds
  fallbackToCli: true
};

/** Interval for scanning idle connections (implementation detail, not user-configurable) */
const IDLE_CLEANUP_INTERVAL_MS = TIMEOUTS.CONFIG_CACHE_TTL; // 1 minute

export class McpClientPool extends EventEmitter {
  private config: PoolConfig;
  private pools: Map<string, ProviderPool> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private idleCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Store signal handler for cleanup (same handler for all signals)
  private readonly drainHandler: () => void;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start background maintenance
    this.startHealthChecks();
    this.startIdleCleanup();

    // Cleanup on process exit - single handler for all signals
    this.drainHandler = () => this.drain();
    process.on('beforeExit', this.drainHandler);
    process.on('SIGTERM', this.drainHandler);
    process.on('SIGINT', this.drainHandler);

    logger.info('[MCP Pool] Initialized', {
      maxConnectionsPerProvider: this.config.maxConnectionsPerProvider,
      idleTimeoutMs: this.config.idleTimeoutMs
    });
  }

  /**
   * Acquire a client from the pool
   */
  async acquire(provider: string): Promise<McpClient> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    const startTime = Date.now();
    const pool = this.getOrCreatePool(provider);

    // Try to get an existing available client
    const available = pool.clients.find(c => !c.inUse && c.client.isConnected());
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      available.useCount++;

      const latency = this.recordAcquireStats(pool, startTime);
      this.emitEvent('connection_acquired', provider, { reused: true, latencyMs: latency });
      logger.debug('[MCP Pool] Acquired existing connection', {
        provider,
        useCount: available.useCount,
        latencyMs: latency
      });

      return available.client;
    }

    // Check if we can create a new connection
    // Include pendingConnections to prevent concurrent over-allocation race condition
    let activeCount = 0;
    for (const c of pool.clients) {
      if (c.client.isConnected()) activeCount++;
    }
    const totalPending = activeCount + pool.pendingConnections;
    if (totalPending < this.config.maxConnectionsPerProvider) {
      // Increment pending count BEFORE await to reserve the slot
      pool.pendingConnections++;
      try {
        const client = await this.createConnection(provider);
        pool.clients.push(this.createPooledClient(client));

        const latency = this.recordAcquireStats(pool, startTime);
        this.emitEvent('connection_created', provider, { latencyMs: latency });
        logger.info('[MCP Pool] Created new connection', {
          provider,
          poolSize: pool.clients.length,
          latencyMs: latency
        });

        return client;
      } catch (error) {
        logger.error('[MCP Pool] Failed to create connection', {
          provider,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        pool.pendingConnections--;
      }
    }

    // All connections in use, wait for one to be released
    return this.waitForConnection(provider, pool);
  }

  /**
   * Release a client back to the pool
   */
  release(provider: string, client: McpClient): void {
    const pool = this.pools.get(provider);
    if (!pool) {
      logger.warn('[MCP Pool] Release called for unknown provider', { provider });
      return;
    }

    const pooledClient = pool.clients.find(c => c.client === client);
    if (!pooledClient) {
      logger.warn('[MCP Pool] Release called for unknown client', { provider });
      return;
    }

    pooledClient.inUse = false;
    pooledClient.lastUsed = Date.now();

    this.emitEvent('connection_released', provider);
    logger.debug('[MCP Pool] Released connection', {
      provider,
      useCount: pooledClient.useCount
    });

    // Check if anyone is waiting for a connection
    if (pool.waitQueue.length > 0) {
      const waiter = pool.waitQueue.shift();
      // Race condition guard: waiter's timeout could have removed it between
      // the length check and shift() - verify waiter exists before proceeding
      if (!waiter) {
        return;
      }
      clearTimeout(waiter.timeout);

      if (client.isConnected()) {
        pooledClient.inUse = true;
        pooledClient.lastUsed = Date.now();
        pooledClient.useCount++;
        waiter.resolve(client);
      } else {
        // Connection died - remove the dead client from pool first
        this.removeFromPool(pool, pooledClient);
        this.emitEvent('connection_closed', provider, { reason: 'connection_died' });

        // BUG FIX: Track pending connection creation to prevent over-allocation race condition.
        // Previously, createConnection() was called without incrementing pendingConnections,
        // which meant hasCapacity() and acquire() could allow additional connections during
        // the async operation, exceeding maxConnectionsPerProvider.
        pool.pendingConnections++;

        // Create a new connection for the waiter
        this.createConnection(provider)
          .then(newClient => {
            pool.clients.push(this.createPooledClient(newClient));
            waiter.resolve(newClient);
          })
          .catch(waiter.reject)
          .finally(() => {
            pool.pendingConnections--;
          });
      }
    }
  }

  /**
   * Drain the pool (graceful shutdown)
   */
  async drain(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info('[MCP Pool] Draining...');

    // Remove signal handlers
    process.off('beforeExit', this.drainHandler);
    process.off('SIGTERM', this.drainHandler);
    process.off('SIGINT', this.drainHandler);

    // Stop maintenance timers
    this.clearTimer('healthCheckTimer');
    this.clearTimer('idleCheckTimer');

    // Reject all waiters and disconnect all clients
    const disconnectPromises: Promise<void>[] = [];

    for (const [provider, pool] of this.pools) {
      // Reject waiters
      for (const waiter of pool.waitQueue) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('Pool is shutting down'));
      }
      pool.waitQueue = [];

      // Queue disconnects
      for (const { client } of pool.clients) {
        disconnectPromises.push(
          client.disconnect().catch(err => {
            logger.warn('[MCP Pool] Error disconnecting client', {
              provider,
              error: err instanceof Error ? err.message : String(err)
            });
          })
        );
      }
    }

    await Promise.all(disconnectPromises);
    this.pools.clear();
    logger.info('[MCP Pool] Drained');
  }

  /** Clear a timer by property name */
  private clearTimer(name: 'healthCheckTimer' | 'idleCheckTimer'): void {
    if (this[name]) {
      clearInterval(this[name]!);
      this[name] = null;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const providers: Record<string, ProviderPoolStats> = {};
    let totalConnections = 0;
    let connectionsInUse = 0;

    for (const [provider, pool] of this.pools) {
      // Single pass: count connected and in-use together
      let connectedCount = 0;
      let inUseCount = 0;
      for (const c of pool.clients) {
        if (c.client.isConnected()) {
          connectedCount++;
          if (c.inUse) inUseCount++;
        }
      }

      providers[provider] = {
        connections: connectedCount,
        inUse: inUseCount,
        available: connectedCount - inUseCount,
        totalRequests: pool.stats.totalRequests,
        avgLatencyMs: pool.stats.totalRequests > 0
          ? Math.round(pool.stats.totalLatencyMs / pool.stats.totalRequests)
          : 0
      };

      totalConnections += connectedCount;
      connectionsInUse += inUseCount;
    }

    return {
      providers,
      totalConnections,
      connectionsInUse
    };
  }

  /**
   * Check if pool has available capacity for provider
   *
   * BUG FIX: Account for pendingConnections to avoid reporting capacity
   * when concurrent connection creations are in progress. Previously,
   * hasCapacity() could return true even when all slots were about to be
   * filled by in-flight createConnection() calls, causing over-allocation.
   */
  hasCapacity(provider: string): boolean {
    const pool = this.pools.get(provider);
    if (!pool) {
      return true; // Can create new pool
    }

    // Single pass: check for available or room for new
    let connectedCount = 0;
    for (const c of pool.clients) {
      if (c.client.isConnected()) {
        if (!c.inUse) return true; // Found available connection
        connectedCount++;
      }
    }

    // BUG FIX: Include pendingConnections in the count to prevent over-allocation
    // race condition when multiple callers check hasCapacity() concurrently
    const totalAllocated = connectedCount + pool.pendingConnections;
    return totalAllocated < this.config.maxConnectionsPerProvider;
  }

  // ============================================
  // Private Methods
  // ============================================

  private getOrCreatePool(provider: string): ProviderPool {
    let pool = this.pools.get(provider);
    if (!pool) {
      pool = {
        clients: [],
        waitQueue: [],
        stats: {
          totalRequests: 0,
          totalLatencyMs: 0
        },
        pendingConnections: 0
      };
      this.pools.set(provider, pool);
    }
    return pool;
  }

  /** Create a new PooledClient wrapper */
  private createPooledClient(client: McpClient): PooledClient {
    const now = Date.now();
    return {
      client,
      inUse: true,
      lastUsed: now,
      useCount: 1,
      createdAt: now
    };
  }

  /** Record stats for an acquire operation */
  private recordAcquireStats(pool: ProviderPool, startTime: number): number {
    const latency = Date.now() - startTime;
    pool.stats.totalRequests++;
    pool.stats.totalLatencyMs += latency;
    return latency;
  }

  /** Remove a client from the pool */
  private removeFromPool(pool: ProviderPool, pooledClient: PooledClient): void {
    pool.clients = pool.clients.filter(c => c !== pooledClient);
  }

  private async createConnection(provider: string): Promise<McpClient> {
    const client = createMcpClient(provider);

    // Set up error handling
    client.on('error', (error) => {
      this.emitEvent('connection_error', provider, { error: error.message });
    });

    client.on('disconnected', () => {
      this.emitEvent('connection_closed', provider);
    });

    // Connect with timeout (clean up timer to prevent memory leak)
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const connectPromise = client.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.config.acquireTimeoutMs}ms`));
        }, this.config.acquireTimeoutMs);
      });

      await Promise.race([connectPromise, timeoutPromise]);
      return client;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async waitForConnection(provider: string, pool: ProviderPool): Promise<McpClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = pool.waitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          pool.waitQueue.splice(index, 1);
        }
        reject(new ConnectionTimeoutError(provider, this.config.acquireTimeoutMs));
      }, this.config.acquireTimeoutMs);

      pool.waitQueue.push({ resolve, reject, timeout });

      logger.debug('[MCP Pool] Waiting for connection', {
        provider,
        queuePosition: pool.waitQueue.length
      });
    });
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        for (const [provider, pool] of this.pools) {
          const toRemove: PooledClient[] = [];

          for (const pooledClient of pool.clients) {
            if (!pooledClient.inUse && pooledClient.client.isConnected()) {
              const healthy = await pooledClient.client.healthCheck();
              if (!healthy) {
                toRemove.push(pooledClient);
              }
            }
          }

          // Remove unhealthy clients from pool (outside iteration to avoid mutation issues)
          for (const pooledClient of toRemove) {
            // Re-check inUse status - client could have been acquired during health check
            if (pooledClient.inUse) {
              logger.debug('[MCP Pool] Skipping unhealthy client removal - now in use', { provider });
              continue;
            }
            this.emitEvent('health_check_failed', provider);
            logger.warn('[MCP Pool] Health check failed, removing connection', { provider });
            await pooledClient.client.disconnect();
            this.removeFromPool(pool, pooledClient);
            this.emitEvent('connection_closed', provider, { reason: 'health_check_failed' });
          }
        }
      } catch (error) {
        // Prevent unhandled promise rejection from crashing the process
        logger.error('[MCP Pool] Unexpected error in health check interval', {
          error: (error as Error).message,
        });
      }
    }, this.config.healthCheckIntervalMs);
    // v12.5.3: Prevent blocking process exit
    if (this.healthCheckTimer.unref) this.healthCheckTimer.unref();
  }

  private startIdleCleanup(): void {
    this.idleCheckTimer = setInterval(() => {
      const now = Date.now();

      for (const [provider, pool] of this.pools) {
        const toRemove: PooledClient[] = [];

        for (const pooledClient of pool.clients) {
          if (!pooledClient.inUse) {
            const idleTime = now - pooledClient.lastUsed;
            if (idleTime > this.config.idleTimeoutMs) {
              toRemove.push(pooledClient);
            }
          }
        }

        for (const pooledClient of toRemove) {
          // BUG FIX: Re-check inUse status before removing, similar to health check logic.
          // A client could have been acquired between the idle time check and removal,
          // causing us to disconnect a client that's now in use.
          if (pooledClient.inUse) {
            logger.debug('[MCP Pool] Skipping idle client removal - now in use', { provider });
            continue;
          }
          logger.debug('[MCP Pool] Closing idle connection', {
            provider,
            idleTimeMs: now - pooledClient.lastUsed
          });
          pooledClient.client.disconnect().catch(() => {});
          this.removeFromPool(pool, pooledClient);
          this.emitEvent('connection_closed', provider, { reason: 'idle_timeout' });
        }
      }
    }, IDLE_CLEANUP_INTERVAL_MS);
    // v12.5.3: Prevent blocking process exit
    if (this.idleCheckTimer.unref) this.idleCheckTimer.unref();
  }

  private emitEvent(type: PoolEventType, provider: string, details?: Record<string, unknown>): void {
    const event: PoolEvent = {
      type,
      provider,
      timestamp: Date.now(),
      details
    };
    this.emit(type, event);
    this.emit('event', event);
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// Singleton instance for global use
let globalPool: McpClientPool | null = null;

/**
 * Get or create the global MCP client pool singleton
 *
 * BUG FIX: Log warning when config is provided but pool already exists,
 * as the config will be ignored. Use resetGlobalPool() first if you need
 * to recreate with different config.
 */
export function getGlobalPool(config?: Partial<PoolConfig>): McpClientPool {
  if (!globalPool) {
    globalPool = new McpClientPool(config);
  } else if (config) {
    // BUG FIX: Warn when config is provided but pool already exists
    logger.warn('[MCP Pool] Global pool already exists, ignoring new config', {
      hint: 'Call resetGlobalPool() first to recreate with new config'
    });
  }
  return globalPool;
}

export async function resetGlobalPool(): Promise<void> {
  if (globalPool) {
    await globalPool.drain();
    globalPool = null;
  }
}
