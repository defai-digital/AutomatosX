import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
/**
 * Connection pool configuration
 */
export interface PoolConfig {
    maxConnections?: number;
    minConnections?: number;
    acquireTimeout?: number;
    idleTimeout?: number;
    enableWAL?: boolean;
    verbose?: boolean;
}
/**
 * Pool statistics
 */
export interface PoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalAcquired: number;
    totalReleased: number;
    averageAcquireTime: number;
    peakConnections: number;
}
/**
 * Database Connection Pool
 *
 * Manages SQLite connections with pooling for improved performance
 *
 * @example
 * ```typescript
 * const pool = new ConnectionPool('./database.db', {
 *   maxConnections: 10,
 *   minConnections: 2,
 *   enableWAL: true
 * })
 *
 * // Acquire connection
 * const conn = await pool.acquire()
 *
 * try {
 *   const result = conn.prepare('SELECT * FROM users').all()
 *   return result
 * } finally {
 *   pool.release(conn)
 * }
 *
 * // Or use with callback
 * await pool.use(async (db) => {
 *   return db.prepare('SELECT * FROM users').all()
 * })
 * ```
 */
export declare class ConnectionPool extends EventEmitter {
    private dbPath;
    private config;
    private connections;
    private waitingQueue;
    private stats;
    private idleCheckInterval;
    constructor(dbPath: string, config?: PoolConfig);
    /**
     * Initialize pool with minimum connections
     */
    private initialize;
    /**
     * Create new connection
     */
    private createConnection;
    /**
     * Acquire connection from pool
     */
    acquire(): Promise<Database.Database>;
    /**
     * Release connection back to pool
     */
    release(db: Database.Database): void;
    /**
     * Execute function with connection (auto-release)
     */
    use<T>(fn: (db: Database.Database) => Promise<T>): Promise<T>;
    /**
     * Execute synchronous function with connection
     */
    useSync<T>(fn: (db: Database.Database) => T): T;
    /**
     * Cleanup idle connections exceeding idle timeout
     */
    private cleanupIdleConnections;
    /**
     * Get pool statistics
     */
    getStats(): PoolStats;
    /**
     * Close all connections
     */
    close(): Promise<void>;
    /**
     * Get connection count
     */
    size(): number;
    /**
     * Check if pool is healthy
     */
    isHealthy(): boolean;
}
/**
 * Get or create global connection pool
 */
export declare function getGlobalPool(dbPath?: string, config?: PoolConfig): ConnectionPool;
/**
 * Close global connection pool
 */
export declare function closeGlobalPool(): Promise<void>;
//# sourceMappingURL=ConnectionPool.d.ts.map