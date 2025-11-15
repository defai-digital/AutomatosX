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
     *
     * SAFETY: We use a synchronous for-loop with immediate mutation to avoid race conditions.
     * The inUse flag is set atomically before any async operations.
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