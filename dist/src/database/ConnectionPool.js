// Sprint 2 Day 18: Database Connection Pool
// SQLite connection pooling for improved performance
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import * as path from 'path';
export class ConnectionPool extends EventEmitter {
    dbPath;
    config;
    connections;
    waitingQueue; // Fixed: Store both resolve and reject
    stats;
    idleCheckInterval;
    constructor(dbPath, config = {}) {
        super();
        this.dbPath = path.resolve(dbPath);
        this.config = {
            maxConnections: config.maxConnections || 10,
            minConnections: config.minConnections || 2,
            acquireTimeout: config.acquireTimeout || 30000,
            idleTimeout: config.idleTimeout || 60000,
            enableWAL: config.enableWAL ?? true,
            verbose: config.verbose ?? false,
        };
        this.connections = new Map();
        this.waitingQueue = [];
        this.stats = {
            totalAcquired: 0,
            totalReleased: 0,
            peakConnections: 0,
            acquireTimes: [],
        };
        this.idleCheckInterval = null;
        this.initialize();
    }
    /**
     * Initialize pool with minimum connections
     */
    initialize() {
        for (let i = 0; i < this.config.minConnections; i++) {
            this.createConnection();
        }
        // Start idle connection cleanup
        this.idleCheckInterval = setInterval(() => {
            this.cleanupIdleConnections();
        }, 30000); // Check every 30 seconds
        this.emit('initialized', {
            connections: this.connections.size,
        });
    }
    /**
     * Create new connection
     */
    createConnection() {
        const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const db = new Database(this.dbPath, {
            verbose: this.config.verbose ? console.log : undefined,
        });
        // Enable WAL mode for better concurrency
        if (this.config.enableWAL) {
            db.pragma('journal_mode = WAL');
        }
        // Set other pragmas for performance
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = -64000'); // 64MB cache
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 30000000000'); // 30GB mmap
        const connection = {
            db,
            id,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            inUse: false,
            queryCount: 0,
        };
        this.connections.set(id, connection);
        // Update peak
        if (this.connections.size > this.stats.peakConnections) {
            this.stats.peakConnections = this.connections.size;
        }
        this.emit('connection-created', { id, total: this.connections.size });
        return connection;
    }
    /**
     * Acquire connection from pool
     *
     * SAFETY: We use a synchronous for-loop with immediate mutation to avoid race conditions.
     * The inUse flag is set atomically before any async operations.
     */
    async acquire() {
        const startTime = Date.now();
        // Try to find idle connection
        // FIXED: Check and set inUse atomically to prevent race conditions
        for (const conn of this.connections.values()) {
            if (!conn.inUse) {
                conn.inUse = true; // Atomically mark as in-use FIRST
                conn.lastUsedAt = Date.now();
                conn.queryCount++;
                const acquireTime = Date.now() - startTime;
                this.stats.acquireTimes.push(acquireTime);
                if (this.stats.acquireTimes.length > 100) {
                    this.stats.acquireTimes.shift();
                }
                this.stats.totalAcquired++;
                this.emit('connection-acquired', {
                    id: conn.id,
                    acquireTime,
                    queueLength: this.waitingQueue.length,
                });
                return conn.db;
            }
        }
        // No idle connection, create new if under max
        if (this.connections.size < this.config.maxConnections) {
            const conn = this.createConnection();
            conn.inUse = true;
            conn.lastUsedAt = Date.now();
            conn.queryCount++;
            this.stats.totalAcquired++;
            return conn.db;
        }
        // Wait for connection to become available
        return new Promise((resolve, reject) => {
            const request = {
                resolve,
                reject,
                addedAt: Date.now(),
            };
            const timeout = setTimeout(() => {
                const index = this.waitingQueue.indexOf(request);
                if (index > -1) {
                    this.waitingQueue.splice(index, 1);
                }
                reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`));
            }, this.config.acquireTimeout);
            // Override resolve to clear timeout
            const originalResolve = request.resolve;
            request.resolve = (db) => {
                clearTimeout(timeout);
                originalResolve(db);
            };
            this.waitingQueue.push(request);
            this.emit('waiting-for-connection', {
                queueLength: this.waitingQueue.length,
            });
        });
    }
    /**
     * Release connection back to pool
     */
    release(db) {
        for (const conn of this.connections.values()) {
            if (conn.db === db) {
                conn.inUse = false;
                conn.lastUsedAt = Date.now();
                this.stats.totalReleased++;
                this.emit('connection-released', {
                    id: conn.id,
                    queryCount: conn.queryCount,
                });
                // Process waiting queue
                if (this.waitingQueue.length > 0) {
                    const request = this.waitingQueue.shift();
                    if (request) {
                        conn.inUse = true;
                        conn.queryCount++;
                        this.stats.totalAcquired++;
                        request.resolve(conn.db); // Fixed: Use resolve method
                    }
                }
                return;
            }
        }
    }
    /**
     * Execute function with connection (auto-release)
     */
    async use(fn) {
        const db = await this.acquire();
        try {
            return await fn(db);
        }
        finally {
            this.release(db);
        }
    }
    /**
     * Execute synchronous function with connection
     */
    useSync(fn) {
        let db = null;
        // Synchronous acquire - find idle connection
        for (const conn of this.connections.values()) {
            if (!conn.inUse) {
                conn.inUse = true;
                conn.lastUsedAt = Date.now();
                conn.queryCount++;
                this.stats.totalAcquired++;
                db = conn.db;
                break;
            }
        }
        // Create new if needed
        if (!db && this.connections.size < this.config.maxConnections) {
            const conn = this.createConnection();
            conn.inUse = true;
            conn.queryCount++;
            this.stats.totalAcquired++;
            db = conn.db;
        }
        if (!db) {
            throw new Error('No connections available (sync mode)');
        }
        try {
            return fn(db);
        }
        finally {
            this.release(db);
        }
    }
    /**
     * Cleanup idle connections exceeding idle timeout
     */
    cleanupIdleConnections() {
        const now = Date.now();
        const minConnections = this.config.minConnections;
        let currentConnections = this.connections.size;
        for (const [id, conn] of this.connections.entries()) {
            // Keep minimum connections
            if (currentConnections <= minConnections) {
                break;
            }
            // Remove idle connections
            if (!conn.inUse && now - conn.lastUsedAt > this.config.idleTimeout) {
                try {
                    conn.db.close();
                    this.connections.delete(id);
                    currentConnections--;
                    this.emit('connection-closed', {
                        id,
                        reason: 'idle-timeout',
                        idleTime: now - conn.lastUsedAt,
                    });
                }
                catch (error) {
                    // Ignore close errors
                }
            }
        }
    }
    /**
     * Get pool statistics
     */
    getStats() {
        let activeConnections = 0;
        let idleConnections = 0;
        for (const conn of this.connections.values()) {
            if (conn.inUse) {
                activeConnections++;
            }
            else {
                idleConnections++;
            }
        }
        const averageAcquireTime = this.stats.acquireTimes.length > 0
            ? this.stats.acquireTimes.reduce((a, b) => a + b, 0) / this.stats.acquireTimes.length
            : 0;
        return {
            totalConnections: this.connections.size,
            activeConnections,
            idleConnections,
            waitingRequests: this.waitingQueue.length,
            totalAcquired: this.stats.totalAcquired,
            totalReleased: this.stats.totalReleased,
            averageAcquireTime,
            peakConnections: this.stats.peakConnections,
        };
    }
    /**
     * Close all connections
     */
    async close() {
        // Clear idle check interval
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = null;
        }
        // Reject all waiting requests
        this.waitingQueue.forEach((request) => {
            request.reject(new Error('Connection pool closed')); // Fixed: Use reject method
        });
        this.waitingQueue = [];
        // Close all connections
        for (const [id, conn] of this.connections.entries()) {
            try {
                conn.db.close();
                this.emit('connection-closed', { id, reason: 'pool-shutdown' });
            }
            catch (error) {
                // Ignore close errors
            }
        }
        this.connections.clear();
        this.emit('pool-closed');
    }
    /**
     * Get connection count
     */
    size() {
        return this.connections.size;
    }
    /**
     * Check if pool is healthy
     */
    isHealthy() {
        return (this.connections.size >= this.config.minConnections &&
            this.connections.size <= this.config.maxConnections &&
            this.waitingQueue.length === 0);
    }
}
/**
 * Global connection pool instance
 */
let globalPool = null;
/**
 * Get or create global connection pool
 */
export function getGlobalPool(dbPath, config) {
    if (!globalPool && dbPath) {
        globalPool = new ConnectionPool(dbPath, config);
    }
    if (!globalPool) {
        throw new Error('Connection pool not initialized. Provide dbPath on first call.');
    }
    return globalPool;
}
/**
 * Close global connection pool
 */
export async function closeGlobalPool() {
    if (globalPool) {
        await globalPool.close();
        globalPool = null;
    }
}
//# sourceMappingURL=ConnectionPool.js.map