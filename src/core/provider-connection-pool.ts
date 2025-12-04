/**
 * Provider Connection Pool
 *
 * Manages persistent connections to AI provider SDKs for connection reuse and performance optimization.
 *
 * Features:
 * - Connection pooling (min/max connections per provider)
 * - Automatic lifecycle management (idle timeout, max age)
 * - Health checks and connection validation
 * - Graceful shutdown and cleanup
 * - Warmup strategy for cold-start elimination
 *
 * @module core/provider-connection-pool
 */

import { logger } from '../shared/logging/logger.js';
import { EventEmitter } from 'events';

/**
 * Provider connection instance
 */
export interface ProviderConnection<T = any> {
  provider: string;
  client: T;  // SDK client instance (OpenAI, GoogleGenerativeAI, etc.)
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
  inUse: boolean;
  id: string;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  minConnections: number;      // Minimum connections to maintain (default: 2)
  maxConnections: number;      // Maximum connections per provider (default: 10)
  idleTimeout: number;         // Max idle time before cleanup (default: 300000ms = 5 min)
  maxAge: number;              // Max connection age (default: 3600000ms = 1 hour)
  healthCheckInterval: number; // Health check interval (default: 60000ms = 1 min)
  warmupOnInit: boolean;       // Pre-create connections on init (default: true)
}

/**
 * Connection factory function type
 */
export type ConnectionFactory<T = any> = (provider: string) => Promise<T>;

/**
 * Pool statistics for observability
 */
export interface PoolStats {
  provider: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  avgRequestsPerConnection: number;
  oldestConnectionAge: number;
  newestConnectionAge: number;
}

/**
 * Provider Connection Pool
 *
 * Manages connection pooling for SDK-based providers with automatic lifecycle management.
 */
export class ProviderConnectionPool extends EventEmitter {
  private pools: Map<string, ProviderConnection[]>;
  private factories: Map<string, ConnectionFactory>;
  private config: ConnectionPoolConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private connectionIdCounter = 0;

  // Metrics
  private metrics = {
    totalAcquires: 0,
    totalReleases: 0,
    totalCreated: 0,
    totalDestroyed: 0,
    totalHealthChecks: 0,
    failedHealthChecks: 0
  };

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    this.pools = new Map();
    this.factories = new Map();

    // Default configuration
    this.config = {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 10,
      idleTimeout: config.idleTimeout ?? 300000,       // 5 minutes
      maxAge: config.maxAge ?? 3600000,                 // 1 hour
      healthCheckInterval: config.healthCheckInterval ?? 60000, // 1 minute
      warmupOnInit: config.warmupOnInit ?? true
    };

    // Start background maintenance
    this.startMaintenanceTasks();

    // Bug #41: Register shutdown handler to cleanup intervals
    import('../shared/process/process-manager.js').then(({ processManager }) => {
      processManager.onShutdown(async () => {
        await this.shutdown();
      });
    }).catch(() => {
      logger.debug('ProviderConnectionPool: process-manager not available for shutdown handler');
    });

    logger.debug('ProviderConnectionPool initialized', {
      config: this.config
    });
  }

  /**
   * Register a provider with its connection factory
   */
  registerProvider<T>(provider: string, factory: ConnectionFactory<T>): void {
    this.factories.set(provider, factory as ConnectionFactory);
    this.pools.set(provider, []);

    logger.debug('Provider registered in connection pool', {
      provider,
      minConnections: this.config.minConnections
    });

    // Skip warmup in mock/test mode to avoid API key requirement errors
    const isMockMode =
      process.env.AX_MOCK_PROVIDERS === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST === 'true';

    // Warmup connections if enabled and not in mock mode
    if (this.config.warmupOnInit && !isMockMode) {
      void this.warmup(provider).catch(err => {
        logger.warn('Failed to warmup connections for provider', {
          provider,
          error: err.message
        });
      });
    }
  }

  /**
   * Warmup connections for a provider (pre-create min connections)
   */
  async warmup(provider: string): Promise<void> {
    // Skip warmup in mock/test mode to avoid API key requirement errors
    const isMockMode =
      process.env.AX_MOCK_PROVIDERS === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST === 'true';

    if (isMockMode) {
      logger.debug('Skipping pool warmup in mock mode', { provider });
      return;
    }

    const factory = this.factories.get(provider);
    if (!factory) {
      throw new Error(`Provider ${provider} not registered`);
    }

    const pool = this.pools.get(provider) || [];
    const needed = this.config.minConnections - pool.length;

    if (needed <= 0) {
      logger.debug('Pool already warmed up', { provider, current: pool.length });
      return;
    }

    logger.debug('Warming up connection pool', {
      provider,
      creating: needed,
      current: pool.length
    });

    const promises = Array.from({ length: needed }, () => this.createConnection(provider, factory));

    try {
      await Promise.all(promises);
      logger.debug('Pool warmup completed', {
        provider,
        total: this.pools.get(provider)?.length || 0
      });
    } catch (error) {
      logger.warn('Pool warmup partially failed', {
        provider,
        error: (error as Error).message
      });
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire<T = any>(provider: string): Promise<ProviderConnection<T>> {
    this.metrics.totalAcquires++;

    const factory = this.factories.get(provider);
    if (!factory) {
      throw new Error(`Provider ${provider} not registered. Call registerProvider() first.`);
    }

    const pool = this.pools.get(provider) || [];

    // Try to find an available connection
    let connection = pool.find(conn => !conn.inUse);

    // No available connection - create new if under max limit
    if (!connection) {
      if (pool.length < this.config.maxConnections) {
        logger.debug('Creating new connection (pool not at max)', {
          provider,
          current: pool.length,
          max: this.config.maxConnections
        });
        connection = await this.createConnection(provider, factory);
      } else {
        // Pool exhausted - wait for a connection to become available
        logger.warn('Connection pool exhausted, waiting for available connection', {
          provider,
          poolSize: pool.length
        });

        // Simple wait-and-retry strategy (max 30 seconds)
        const maxWaitMs = 30000;
        const checkIntervalMs = 100;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          connection = pool.find(conn => !conn.inUse);
          if (connection) break;
          await this.sleep(checkIntervalMs);
        }

        if (!connection) {
          throw new Error(`Connection pool timeout for provider ${provider} after ${maxWaitMs}ms`);
        }
      }
    }

    // Mark as in-use and update last used timestamp
    connection.inUse = true;
    connection.lastUsedAt = Date.now();
    connection.requestCount++;

    logger.debug('Connection acquired', {
      provider,
      connectionId: connection.id,
      requestCount: connection.requestCount,
      age: Date.now() - connection.createdAt
    });

    this.emit('connection-acquired', { provider, connectionId: connection.id });

    return connection as ProviderConnection<T>;
  }

  /**
   * Release a connection back to the pool
   */
  async release(provider: string, connection: ProviderConnection): Promise<void> {
    this.metrics.totalReleases++;

    connection.inUse = false;
    connection.lastUsedAt = Date.now();

    logger.debug('Connection released', {
      provider,
      connectionId: connection.id,
      requestCount: connection.requestCount
    });

    this.emit('connection-released', { provider, connectionId: connection.id });
  }

  /**
   * Create a new connection
   */
  private async createConnection<T>(provider: string, factory: ConnectionFactory<T>): Promise<ProviderConnection<T>> {
    this.metrics.totalCreated++;

    const connectionId = `${provider}-${++this.connectionIdCounter}`;

    logger.debug('Creating new connection', {
      provider,
      connectionId
    });

    try {
      const client = await factory(provider);

      const connection: ProviderConnection<T> = {
        provider,
        client,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        requestCount: 0,
        inUse: false,
        id: connectionId
      };

      const pool = this.pools.get(provider) || [];
      pool.push(connection);
      this.pools.set(provider, pool);

      logger.debug('Connection created successfully', {
        provider,
        connectionId,
        poolSize: pool.length
      });

      this.emit('connection-created', { provider, connectionId });

      return connection;
    } catch (error) {
      logger.error('Failed to create connection', {
        provider,
        connectionId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Destroy a connection
   */
  private async destroyConnection(connection: ProviderConnection): Promise<void> {
    this.metrics.totalDestroyed++;

    logger.debug('Destroying connection', {
      provider: connection.provider,
      connectionId: connection.id,
      age: Date.now() - connection.createdAt,
      requestCount: connection.requestCount
    });

    const pool = this.pools.get(connection.provider) || [];
    const index = pool.findIndex(c => c.id === connection.id);

    if (index !== -1) {
      pool.splice(index, 1);
    }

    // SDK clients typically don't need explicit cleanup
    // but we emit event for monitoring
    this.emit('connection-destroyed', {
      provider: connection.provider,
      connectionId: connection.id
    });
  }

  /**
   * Start background maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Cleanup stale connections
    this.cleanupInterval = setInterval(() => {
      void this.cleanupStaleConnections().catch(err => {
        logger.error('Cleanup task failed', { error: err.message });
      });
    }, 60000); // Every minute

    // Health checks
    this.healthCheckInterval = setInterval(() => {
      void this.runHealthChecks().catch(err => {
        logger.error('Health check task failed', { error: err.message });
      });
    }, this.config.healthCheckInterval);

    logger.debug('Maintenance tasks started', {
      cleanupInterval: 60000,
      healthCheckInterval: this.config.healthCheckInterval
    });
  }

  /**
   * Cleanup stale connections (idle or too old)
   */
  private async cleanupStaleConnections(): Promise<void> {
    const now = Date.now();
    let totalDestroyed = 0;

    for (const [provider, pool] of this.pools.entries()) {
      const staleConnections: ProviderConnection[] = [];

      for (const connection of pool) {
        // Skip connections currently in use
        if (connection.inUse) continue;

        const age = now - connection.createdAt;
        const idleTime = now - connection.lastUsedAt;
        const poolSize = pool.length;

        // Destroy if: too old OR (idle too long AND pool > min)
        if (age > this.config.maxAge) {
          logger.debug('Connection exceeded max age', {
            provider,
            connectionId: connection.id,
            age,
            maxAge: this.config.maxAge
          });
          staleConnections.push(connection);
        } else if (idleTime > this.config.idleTimeout && poolSize > this.config.minConnections) {
          logger.debug('Connection idle too long', {
            provider,
            connectionId: connection.id,
            idleTime,
            idleTimeout: this.config.idleTimeout
          });
          staleConnections.push(connection);
        }
      }

      // Destroy stale connections
      for (const connection of staleConnections) {
        await this.destroyConnection(connection);
        totalDestroyed++;
      }
    }

    if (totalDestroyed > 0) {
      logger.debug('Cleanup completed', {
        totalDestroyed,
        remaining: this.getTotalConnections()
      });
    }
  }

  /**
   * Run health checks on idle connections
   */
  private async runHealthChecks(): Promise<void> {
    this.metrics.totalHealthChecks++;

    // Health checks would go here
    // For now, just log the pool state
    for (const [providerName, pool] of this.pools.entries()) {
      const stats = this.getStats(providerName);
      logger.debug('Pool health check', {
        provider: stats.provider,
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections,
        totalRequests: stats.totalRequests
      });
    }
  }

  /**
   * Get pool statistics for a provider
   */
  getStats(provider: string): PoolStats {
    const pool = this.pools.get(provider) || [];
    const now = Date.now();

    const activeConnections = pool.filter(c => c.inUse).length;
    const idleConnections = pool.filter(c => !c.inUse).length;
    const totalRequests = pool.reduce((sum, c) => sum + c.requestCount, 0);
    const avgRequestsPerConnection = pool.length > 0 ? totalRequests / pool.length : 0;

    const ages = pool.map(c => now - c.createdAt);
    const oldestConnectionAge = ages.length > 0 ? Math.max(...ages) : 0;
    const newestConnectionAge = ages.length > 0 ? Math.min(...ages) : 0;

    return {
      provider,
      totalConnections: pool.length,
      activeConnections,
      idleConnections,
      totalRequests,
      avgRequestsPerConnection,
      oldestConnectionAge,
      newestConnectionAge
    };
  }

  /**
   * Get global metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get total connections across all providers
   */
  getTotalConnections(): number {
    return Array.from(this.pools.values()).reduce((sum, pool) => sum + pool.length, 0);
  }

  /**
   * Graceful shutdown - destroy all connections
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down connection pool...');

    // Stop maintenance tasks
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Destroy all connections
    for (const [provider, pool] of this.pools.entries()) {
      for (const connection of pool) {
        await this.destroyConnection(connection);
      }
    }

    this.pools.clear();
    this.factories.clear();

    logger.info('Connection pool shutdown complete', {
      metrics: this.metrics
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global connection pool instance (singleton)
 */
let globalConnectionPool: ProviderConnectionPool | null = null;

/**
 * Get global connection pool instance
 */
export function getProviderConnectionPool(config?: Partial<ConnectionPoolConfig>): ProviderConnectionPool {
  if (!globalConnectionPool) {
    globalConnectionPool = new ProviderConnectionPool(config);
  }
  return globalConnectionPool;
}

/**
 * Reset global connection pool (for testing)
 */
export function resetProviderConnectionPool(): void {
  if (globalConnectionPool) {
    void globalConnectionPool.shutdown();
    globalConnectionPool = null;
  }
}
