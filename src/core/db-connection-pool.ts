/**
 * Database Connection Pool - SQLite connection pooling for concurrent reads
 * v5.6.13: Phase 3.2 - Connection pooling for 15-25% improvement in high concurrency
 * v5.6.24: P1-3 - Dynamic pool sizing based on CPU cores for +20-40% throughput
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { cpus } from 'os';
import { Mutex } from 'async-mutex';
import { logger } from '../utils/logger.js';

export interface ConnectionPoolConfig {
  dbPath: string;
  readPoolSize?: number;     // Number of read-only connections (fixed size, overrides autoDetect)
  writePoolSize?: number;    // Number of write connections (default: 1)
  maxWaitTime?: number;      // Max wait time for connection in ms (default: 5000)
  healthCheckInterval?: number; // Health check interval in ms (default: 60000)

  // v5.6.24: Dynamic pool sizing (P1-3)
  autoDetect?: boolean;      // Enable CPU-based pool sizing (default: false for backward compatibility)
  cpuMultiplier?: number;    // CPU cores × multiplier for pool size (default: 2.0)
  minPoolSize?: number;      // Minimum pool size (default: 4)
  maxPoolSize?: number;      // Maximum pool size (default: 16)
}

interface PooledConnection {
  db: Database.Database;
  busy: boolean;
  readonly: boolean;
  createdAt: number;
  lastUsed: number;
  queryCount: number;
}

/**
 * v5.6.24 P1-3: Calculate optimal read pool size based on CPU cores
 *
 * Strategy:
 * - If readPoolSize is explicitly set, use it (override autoDetect)
 * - If autoDetect is disabled, use default (5)
 * - If autoDetect is enabled, calculate based on CPU cores × multiplier
 * - Clamp result between minPoolSize and maxPoolSize
 *
 * Expected improvement: +20-40% throughput in high-concurrency scenarios
 */
function calculateOptimalPoolSize(config: ConnectionPoolConfig): number {
  // If explicit readPoolSize is set, use it (override autoDetect)
  if (config.readPoolSize !== undefined) {
    return config.readPoolSize;
  }

  // If autoDetect is disabled, use default
  if (!config.autoDetect) {
    return 5;  // Default from v5.6.18
  }

  // Auto-detect based on CPU cores
  const cpuCount = cpus().length;
  const multiplier = config.cpuMultiplier ?? 2.0;
  const calculated = Math.floor(cpuCount * multiplier);

  // Clamp to min/max bounds
  const minPoolSize = config.minPoolSize ?? 4;
  const maxPoolSize = config.maxPoolSize ?? 16;
  const result = Math.max(minPoolSize, Math.min(calculated, maxPoolSize));

  logger.debug('Calculated optimal DB pool size', {
    cpuCount,
    multiplier,
    calculated,
    result,
    bounds: { min: minPoolSize, max: maxPoolSize }
  });

  return result;
}

/**
 * Database Connection Pool
 *
 * Manages a pool of SQLite connections for concurrent read/write operations.
 *
 * Key Features:
 * - Separate read-only and write connection pools
 * - Automatic connection health checks
 * - Wait queue for connection requests
 * - Connection reuse tracking
 * - v5.6.24: Dynamic pool sizing based on CPU cores (opt-in via autoDetect)
 *
 * SQLite WAL mode configuration:
 * - Write-Ahead Logging (WAL) enables concurrent reads during writes
 * - Multiple readers can access the database simultaneously
 * - Single writer (but doesn't block readers)
 */
export class DatabaseConnectionPool {
  private config: Required<ConnectionPoolConfig>;
  private readPool: PooledConnection[] = [];
  private writePool: PooledConnection[] = [];
  private waitQueue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (error: Error) => void;
    readonly: boolean;
    requestedAt: number;
    timeoutId?: NodeJS.Timeout; // Track timeout to clear it
    abortHandler?: () => void;  // Track abort handler to remove listener
    signal?: AbortSignal;       // Track signal to remove listener
  }> = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private shutdownRequested = false;
  private acquisitionMutex = new Mutex(); // Ensures atomic acquire/release operations

  constructor(config: ConnectionPoolConfig) {
    // v5.6.24 P1-3: Calculate optimal pool size (CPU-based if autoDetect enabled)
    const optimalReadPoolSize = calculateOptimalPoolSize(config);

    this.config = {
      dbPath: config.dbPath,
      readPoolSize: optimalReadPoolSize,
      writePoolSize: config.writePoolSize ?? 1,
      maxWaitTime: config.maxWaitTime ?? 5000,
      healthCheckInterval: config.healthCheckInterval ?? 60000,
      // v5.6.24: Dynamic pool sizing defaults
      autoDetect: config.autoDetect ?? false,
      cpuMultiplier: config.cpuMultiplier ?? 2.0,
      minPoolSize: config.minPoolSize ?? 4,
      maxPoolSize: config.maxPoolSize ?? 16
    };

    // Initialize connection pools
    this.initializePools();

    // Start health checks
    this.startHealthChecks();

    // Bug #42: Register shutdown handler to cleanup health check interval
    import('../utils/process-manager.js').then(({ processManager }) => {
      processManager.onShutdown(async () => {
        await this.shutdown();
      });
    }).catch(() => {
      logger.debug('DatabaseConnectionPool: process-manager not available for shutdown handler');
    });

    logger.debug('Database connection pool initialized', {
      dbPath: this.config.dbPath,
      readPoolSize: this.config.readPoolSize,
      writePoolSize: this.config.writePoolSize,
      autoDetect: this.config.autoDetect,
      cpuMultiplier: this.config.cpuMultiplier
    });
  }

  /**
   * Acquire a connection from the pool
   *
   * @param readonly - Whether to acquire a read-only connection
   * @param signal - Optional AbortSignal to cancel the acquisition
   * @returns Pooled connection
   */
  async acquire(readonly: boolean = true, signal?: AbortSignal): Promise<PooledConnection> {
    if (this.shutdownRequested) {
      throw new Error('Connection pool is shutting down');
    }

    // Try to get an idle connection (mutex-protected for atomicity)
    const idleConn = await this.acquisitionMutex.runExclusive(() => {
      const pool = readonly ? this.readPool : this.writePool;
      const conn = pool.find(c => !c.busy);

      if (conn) {
        conn.busy = true;
        conn.lastUsed = Date.now();
        conn.queryCount++;

        logger.debug('Connection acquired from pool', {
          readonly,
          queryCount: conn.queryCount
        });
      }

      return conn;
    });

    if (idleConn) {
      return idleConn;
    }

    // No idle connections, wait in queue
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (signal?.aborted) {
        reject(new Error('Connection acquisition cancelled'));
        return;
      }

      const queueEntry = {
        resolve,
        reject,
        readonly,
        requestedAt: Date.now(),
        timeoutId: undefined as NodeJS.Timeout | undefined,
        abortHandler: undefined as (() => void) | undefined,  // CRITICAL: Store handler for cleanup
        signal: signal  // CRITICAL: Store signal for cleanup
      };

      this.waitQueue.push(queueEntry);

      logger.debug('Connection request queued', {
        readonly,
        queueLength: this.waitQueue.length
      });

      // Set up abort handler
      if (signal) {
        queueEntry.abortHandler = () => {
          const index = this.waitQueue.indexOf(queueEntry);
          if (index !== -1) {
            this.waitQueue.splice(index, 1);
            if (queueEntry.timeoutId) {
              clearTimeout(queueEntry.timeoutId);
            }
            reject(new Error('Connection acquisition cancelled'));
          }
        };
        signal.addEventListener('abort', queueEntry.abortHandler, { once: true });
      }

      // Set timeout and store ID for cleanup
      queueEntry.timeoutId = setTimeout(() => {
        const index = this.waitQueue.indexOf(queueEntry);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          // Remove abort handler if present
          if (queueEntry.abortHandler && queueEntry.signal) {
            queueEntry.signal.removeEventListener('abort', queueEntry.abortHandler);
          }
          reject(new Error(`Connection wait timeout after ${this.config.maxWaitTime}ms`));
        }
      }, this.config.maxWaitTime);
    });
  }

  /**
   * Release a connection back to the pool
   *
   * @param conn - Pooled connection to release
   */
  async release(conn: PooledConnection): Promise<void> {
    if (!conn.busy) {
      logger.warn('Attempted to release idle connection');
      return;
    }

    await this.acquisitionMutex.runExclusive(() => {
      conn.busy = false;

      logger.debug('Connection released to pool', {
        readonly: conn.readonly,
        queryCount: conn.queryCount
      });
    });

    // Process wait queue (outside mutex to avoid deadlock)
    await this.processWaitQueue();
  }

  /**
   * Execute a query with automatic connection management
   *
   * @param readonly - Whether this is a read-only query
   * @param fn - Function to execute with the connection
   * @returns Query result
   */
  async execute<T>(readonly: boolean, fn: (db: Database.Database) => T): Promise<T> {
    const conn = await this.acquire(readonly);

    try {
      const result = fn(conn.db);
      return result;
    } finally {
      await this.release(conn);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const readBusy = this.readPool.filter(c => c.busy).length;
    const writeBusy = this.writePool.filter(c => c.busy).length;

    return {
      readPool: {
        total: this.readPool.length,
        busy: readBusy,
        idle: this.readPool.length - readBusy,
        totalQueries: this.readPool.reduce((sum, c) => sum + c.queryCount, 0)
      },
      writePool: {
        total: this.writePool.length,
        busy: writeBusy,
        idle: this.writePool.length - writeBusy,
        totalQueries: this.writePool.reduce((sum, c) => sum + c.queryCount, 0)
      },
      waitQueue: this.waitQueue.length
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    this.shutdownRequested = true;

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Reject all queued requests and clear timeouts
    for (const entry of this.waitQueue) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }

      // CRITICAL: Remove AbortSignal listener before rejecting to prevent memory leak
      if (entry.signal && entry.abortHandler) {
        entry.signal.removeEventListener('abort', entry.abortHandler);
        entry.abortHandler = undefined;  // Allow GC to reclaim
      }

      entry.reject(new Error('Connection pool shutting down'));
    }
    this.waitQueue = [];

    // Close all connections
    for (const conn of [...this.readPool, ...this.writePool]) {
      try {
        conn.db.close();
      } catch (error) {
        logger.warn('Error closing connection', {
          error: (error as Error).message
        });
      }
    }

    this.readPool = [];
    this.writePool = [];

    logger.info('Database connection pool shut down');
  }

  /**
   * Initialize connection pools
   */
  private initializePools(): void {
    // Create read-only connections
    for (let i = 0; i < this.config.readPoolSize; i++) {
      const db = this.createConnection(true);
      this.readPool.push({
        db,
        busy: false,
        readonly: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        queryCount: 0
      });
    }

    // Create write connections
    for (let i = 0; i < this.config.writePoolSize; i++) {
      const db = this.createConnection(false);
      this.writePool.push({
        db,
        busy: false,
        readonly: false,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        queryCount: 0
      });
    }

    logger.debug('Connection pools created', {
      readConnections: this.readPool.length,
      writeConnections: this.writePool.length
    });
  }

  /**
   * Create a database connection
   */
  private createConnection(readonly: boolean): Database.Database {
    const db = new Database(this.config.dbPath, {
      readonly,
      fileMustExist: !readonly  // Write connections can create DB
    });

    // Load sqlite-vec extension
    sqliteVec.load(db);

    // Enable WAL mode for concurrent reads (only on write connections)
    if (!readonly) {
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -64000'); // 64MB cache
      db.pragma('temp_store = MEMORY');
    } else {
      // Read-only connections use smaller cache
      db.pragma('cache_size = -16000'); // 16MB cache
      db.pragma('temp_store = MEMORY');
    }

    logger.debug('Database connection created', {
      readonly,
      path: this.config.dbPath
    });

    return db;
  }

  /**
   * Process the wait queue
   */
  private async processWaitQueue(): Promise<void> {
    if (this.waitQueue.length === 0) {
      return;
    }

    // Mutex-protected operation to prevent race conditions
    const processed = await this.acquisitionMutex.runExclusive(() => {
      // Find first waiting request that can be satisfied
      for (let i = 0; i < this.waitQueue.length; i++) {
        const entry = this.waitQueue[i];
        if (!entry) {
          continue;
        }

        const pool = entry.readonly ? this.readPool : this.writePool;
        const idleConn = pool.find(c => !c.busy);

        if (idleConn) {
          // Remove from queue
          this.waitQueue.splice(i, 1);

          // Clear timeout to prevent memory leak
          if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
          }

          // CRITICAL: Remove abort listener to prevent memory leak
          if (entry.abortHandler && entry.signal) {
            entry.signal.removeEventListener('abort', entry.abortHandler);
          }

          // Acquire connection
          idleConn.busy = true;
          idleConn.lastUsed = Date.now();
          idleConn.queryCount++;

          logger.debug('Connection allocated from wait queue', {
            readonly: entry.readonly,
            waitedFor: Date.now() - entry.requestedAt,
            queueLength: this.waitQueue.length
          });

          // Resolve promise outside the mutex
          entry.resolve(idleConn);

          return true; // Indicate we processed an entry
        }
      }
      return false; // No entry processed
    });

    // Continue processing queue if we satisfied a request (iterative approach)
    if (processed) {
      await this.processWaitQueue();
    }
  }

  /**
   * Start health checks for connections
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      // Check all idle connections
      const allConnections = [...this.readPool, ...this.writePool];
      const idleConnections = allConnections.filter(c => !c.busy);

      for (const conn of idleConnections) {
        try {
          // Simple health check query
          conn.db.prepare('SELECT 1').get();
        } catch (error) {
          logger.error('Connection health check failed', {
            readonly: conn.readonly,
            error: (error as Error).message
          });

          // Recreate failed connection
          this.recreateConnection(conn);
        }
      }

      logger.debug('Connection pool health check completed', {
        totalConnections: allConnections.length,
        healthyConnections: idleConnections.length
      });
    }, this.config.healthCheckInterval);
  }

  /**
   * Recreate a failed connection
   */
  private recreateConnection(conn: PooledConnection): void {
    try {
      conn.db.close();
    } catch (error) {
      // Ignore close errors
    }

    // Create new connection
    conn.db = this.createConnection(conn.readonly);
    conn.createdAt = Date.now();
    conn.lastUsed = Date.now();
    conn.queryCount = 0;

    logger.info('Connection recreated', {
      readonly: conn.readonly
    });
  }
}
