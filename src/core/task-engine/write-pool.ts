/**
 * Write Pool - Multiple SQLite Write Connections
 *
 * Manages a pool of write connections for parallel database operations.
 * Enables 50 concurrent tasks by distributing writes across connections.
 *
 * Features:
 * - Connection pooling with configurable size
 * - Fair request queuing
 * - Connection health monitoring
 * - Automatic connection recovery
 *
 * Part of Phase 5: Full Scale
 *
 * @module core/task-engine/write-pool
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import { logger } from '../../shared/logging/logger.js';

/**
 * Write pool configuration
 */
export interface WritePoolConfig {
  /** Database file path */
  dbPath: string;
  /** Number of write connections (default: 4) */
  poolSize?: number;
  /** Busy timeout in ms (default: 10000) */
  busyTimeoutMs?: number;
  /** Max queue size before rejecting (default: 1000) */
  maxQueueSize?: number;
  /** Connection acquire timeout in ms (default: 30000) */
  acquireTimeoutMs?: number;
}

/**
 * Write pool statistics
 */
export interface WritePoolStats {
  /** Total pool size */
  poolSize: number;
  /** Currently busy connections */
  busyConnections: number;
  /** Available connections */
  availableConnections: number;
  /** Pending requests in queue */
  pendingRequests: number;
  /** Total operations executed */
  totalOperations: number;
  /** Total wait time in ms */
  totalWaitTimeMs: number;
  /** Average wait time in ms */
  averageWaitTimeMs: number;
  /** Connection errors */
  connectionErrors: number;
}

/**
 * Pending write request
 */
interface PendingRequest<T> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Connection wrapper with metadata
 */
interface PooledConnection {
  db: Database.Database;
  index: number;
  operationCount: number;
  lastUsedAt: number;
  healthy: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  poolSize: 4,
  busyTimeoutMs: 10000,
  maxQueueSize: 1000,
  acquireTimeoutMs: 30000
};

/**
 * WritePool - Multiple write connection management
 *
 * @example
 * ```typescript
 * const pool = new WritePool({
 *   dbPath: '.automatosx/data/tasks.db',
 *   poolSize: 4
 * });
 *
 * // Execute write operation
 * await pool.execute((db) => {
 *   db.prepare('INSERT INTO tasks (id, status) VALUES (?, ?)').run('task_1', 'pending');
 * });
 *
 * // Shutdown
 * await pool.shutdown();
 * ```
 */
export class WritePool {
  private readonly config: Required<WritePoolConfig>;
  private connections: PooledConnection[] = [];
  private busy: Set<PooledConnection> = new Set();
  private queue: Array<PendingRequest<PooledConnection>> = [];
  private closed = false;

  // Statistics
  private stats = {
    totalOperations: 0,
    totalWaitTimeMs: 0,
    connectionErrors: 0
  };

  constructor(config: WritePoolConfig) {
    this.config = {
      dbPath: config.dbPath,
      poolSize: config.poolSize ?? DEFAULT_CONFIG.poolSize,
      busyTimeoutMs: config.busyTimeoutMs ?? DEFAULT_CONFIG.busyTimeoutMs,
      maxQueueSize: config.maxQueueSize ?? DEFAULT_CONFIG.maxQueueSize,
      acquireTimeoutMs: config.acquireTimeoutMs ?? DEFAULT_CONFIG.acquireTimeoutMs
    };

    this.initializePool();

    logger.debug('[WritePool] Initialized', {
      poolSize: this.config.poolSize,
      dbPath: this.config.dbPath
    });
  }

  /**
   * Execute a write operation using a pooled connection
   */
  async execute<T>(fn: (db: Database.Database) => T): Promise<T> {
    if (this.closed) {
      throw new Error('WritePool is closed');
    }

    const startTime = Date.now();
    const conn = await this.acquire();

    try {
      const result = fn(conn.db);
      conn.operationCount++;
      conn.lastUsedAt = Date.now();
      this.stats.totalOperations++;
      return result;
    } catch (error) {
      // Check if connection is still healthy
      if (!this.isConnectionHealthy(conn)) {
        conn.healthy = false;
        this.stats.connectionErrors++;
        this.tryRecoverConnection(conn);
      }
      throw error;
    } finally {
      this.stats.totalWaitTimeMs += Date.now() - startTime;
      this.release(conn);
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async executeTransaction<T>(fn: (db: Database.Database) => T): Promise<T> {
    return this.execute((db) => {
      return db.transaction(() => fn(db))();
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): WritePoolStats {
    const totalOps = this.stats.totalOperations || 1;
    return {
      poolSize: this.connections.length,
      busyConnections: this.busy.size,
      availableConnections: this.connections.length - this.busy.size,
      pendingRequests: this.queue.length,
      totalOperations: this.stats.totalOperations,
      totalWaitTimeMs: this.stats.totalWaitTimeMs,
      averageWaitTimeMs: this.stats.totalWaitTimeMs / totalOps,
      connectionErrors: this.stats.connectionErrors
    };
  }

  /**
   * Get connection health status
   */
  getHealthStatus(): { healthy: number; unhealthy: number } {
    let healthy = 0;
    let unhealthy = 0;

    for (const conn of this.connections) {
      if (conn.healthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    return { healthy, unhealthy };
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    // Reject pending requests and clear their timeouts
    for (const pending of this.queue) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(new Error('WritePool is shutting down'));
    }
    this.queue = [];

    // Close all connections
    for (const conn of this.connections) {
      try {
        conn.db.close();
      } catch (error) {
        logger.warn('[WritePool] Error closing connection', {
          index: conn.index,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.connections = [];
    this.busy.clear();

    logger.debug('[WritePool] Shutdown complete', {
      totalOperations: this.stats.totalOperations
    });
  }

  /**
   * Initialize the connection pool
   */
  private initializePool(): void {
    for (let i = 0; i < this.config.poolSize; i++) {
      const conn = this.createConnection(i);
      this.connections.push(conn);
    }
  }

  /**
   * Create a new pooled connection
   */
  private createConnection(index: number): PooledConnection {
    const db = new Database(this.config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma(`busy_timeout = ${this.config.busyTimeoutMs}`);
    db.pragma('synchronous = NORMAL');

    return {
      db,
      index,
      operationCount: 0,
      lastUsedAt: Date.now(),
      healthy: true
    };
  }

  /**
   * Acquire a connection from the pool
   */
  private async acquire(): Promise<PooledConnection> {
    // Find available healthy connection
    for (const conn of this.connections) {
      if (!this.busy.has(conn) && conn.healthy) {
        this.busy.add(conn);
        return conn;
      }
    }

    // Check queue limit
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('WritePool queue is full');
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const request: PendingRequest<PooledConnection> = {
        resolve: (conn) => {
          // Clear timeout when resolved successfully
          if (request.timeoutId) {
            clearTimeout(request.timeoutId);
          }
          resolve(conn);
        },
        reject: (error) => {
          // Clear timeout when rejected
          if (request.timeoutId) {
            clearTimeout(request.timeoutId);
          }
          reject(error);
        },
        queuedAt: Date.now()
      };

      this.queue.push(request);

      // Set acquire timeout with stored reference
      request.timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(request);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Connection acquire timeout'));
        }
      }, this.config.acquireTimeoutMs);
    });
  }

  /**
   * Release a connection back to the pool
   */
  private release(conn: PooledConnection): void {
    this.busy.delete(conn);

    // If there are pending requests, try to assign a healthy connection
    if (this.queue.length > 0) {
      if (conn.healthy) {
        // Use this connection for the pending request
        const pending = this.queue.shift();
        if (pending) {
          this.busy.add(conn);
          pending.resolve(conn);
        }
      } else {
        // Connection is unhealthy - find another healthy connection for pending request
        for (const otherConn of this.connections) {
          if (!this.busy.has(otherConn) && otherConn.healthy) {
            const pending = this.queue.shift();
            if (pending) {
              this.busy.add(otherConn);
              pending.resolve(otherConn);
            }
            break;
          }
        }
        // If no healthy connection available, pending request stays in queue
        // (it will be served when a connection becomes available or timeout)
      }
    }
  }

  /**
   * Check if a connection is healthy
   */
  private isConnectionHealthy(conn: PooledConnection): boolean {
    try {
      conn.db.pragma('quick_check');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to recover an unhealthy connection
   */
  private tryRecoverConnection(conn: PooledConnection): void {
    try {
      // Close old connection
      try {
        conn.db.close();
      } catch {
        // Ignore close errors
      }

      // Create new connection
      const newConn = this.createConnection(conn.index);
      const index = this.connections.indexOf(conn);
      if (index !== -1) {
        this.connections[index] = newConn;
      }

      logger.info('[WritePool] Connection recovered', { index: conn.index });
    } catch (error) {
      logger.error('[WritePool] Failed to recover connection', {
        index: conn.index,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Create a write pool instance
 */
export function createWritePool(config: WritePoolConfig): WritePool {
  return new WritePool(config);
}
