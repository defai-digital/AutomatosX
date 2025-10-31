/**
 * Telemetry Collector - Event collection and storage
 *
 * Phase 4 (v6.1.0): Observability, Analytics & Optimization
 *
 * Collects execution telemetry events and stores them in SQLite for analytics.
 * Features:
 * - Buffered writes for performance
 * - Auto-flush on interval
 * - SQLite storage with indexes
 * - Configurable retention
 * - Privacy-first (local storage only)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import type {
  TelemetryEvent,
  TelemetryOptions,
  TelemetryQueryFilters,
  TelemetryEventType
} from '../../types/telemetry.js';
import { logger } from '../../utils/logger.js';

/**
 * Default telemetry options
 */
const DEFAULT_OPTIONS: TelemetryOptions = {
  enabled: false,  // Opt-in by default (privacy-first)
  dbPath: join(process.cwd(), '.automatosx', 'telemetry', 'events.db'),
  flushIntervalMs: 30000,  // 30 seconds
  retentionDays: 30,        // 30 days
  bufferSize: 100           // Flush after 100 events
};

/**
 * Telemetry Collector
 *
 * Collects and stores telemetry events for analytics and optimization.
 */
export class TelemetryCollector {
  private db: Database.Database | null = null;
  private buffer: TelemetryEvent[] = [];
  private flushInterval?: NodeJS.Timeout;
  private options: TelemetryOptions;
  private flushing: boolean = false;
  private closed: boolean = false;
  private maxBufferSize: number = 10000;  // Prevent unbounded growth

  constructor(options: Partial<TelemetryOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Validate configuration (prevent negative/zero values)
    if (this.options.bufferSize <= 0) {
      logger.warn('Invalid bufferSize, using default', { value: this.options.bufferSize });
      this.options.bufferSize = DEFAULT_OPTIONS.bufferSize;
    }
    if (this.options.flushIntervalMs <= 0) {
      logger.warn('Invalid flushIntervalMs, using default', { value: this.options.flushIntervalMs });
      this.options.flushIntervalMs = DEFAULT_OPTIONS.flushIntervalMs;
    }
    if (this.options.retentionDays <= 0) {
      logger.warn('Invalid retentionDays, using default', { value: this.options.retentionDays });
      this.options.retentionDays = DEFAULT_OPTIONS.retentionDays;
    }

    // Only initialize database if enabled (resource optimization)
    if (this.options.enabled) {
      try {
        this.db = this.initializeDatabase();
        this.startAutoFlush();
        logger.debug('Telemetry collector initialized', {
          dbPath: this.options.dbPath,
          flushInterval: this.options.flushIntervalMs,
          retentionDays: this.options.retentionDays
        });
      } catch (error) {
        logger.error('Failed to initialize telemetry collector', {
          error: (error as Error).message
        });
        // Disable telemetry if initialization fails
        this.options.enabled = false;
        this.db = null;
      }
    }
  }

  /**
   * Initialize SQLite database with schema
   */
  private initializeDatabase(): Database.Database {
    // Ensure directory exists
    const dbDir = dirname(this.options.dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Open database
    const db = new Database(this.options.dbPath);

    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');

    // Set busy timeout to handle lock contention (5 seconds)
    // This prevents "database is locked" errors when multiple processes access the DB
    db.pragma('busy_timeout = 5000');

    // Create telemetry_events table
    db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        agent_name TEXT,
        session_id TEXT,
        latency_ms INTEGER NOT NULL,
        tokens_prompt INTEGER NOT NULL,
        tokens_completion INTEGER NOT NULL,
        tokens_total INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        success INTEGER NOT NULL,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER,
        context TEXT
      );
    `);

    // Create indexes for efficient queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON telemetry_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_provider ON telemetry_events(provider);
      CREATE INDEX IF NOT EXISTS idx_type ON telemetry_events(type);
      CREATE INDEX IF NOT EXISTS idx_agent_name ON telemetry_events(agent_name);
      CREATE INDEX IF NOT EXISTS idx_session_id ON telemetry_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_success ON telemetry_events(success);
    `);

    logger.debug('Telemetry database initialized', {
      path: this.options.dbPath
    });

    return db;
  }

  /**
   * Start auto-flush interval
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.options.flushIntervalMs);

    // Don't keep the process alive just for this
    this.flushInterval.unref();
  }

  /**
   * Record a telemetry event
   *
   * Safe to call even if telemetry disabled or closed - will silently skip.
   * This ensures telemetry never breaks normal execution.
   */
  record(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    // Skip if telemetry disabled, closed, or buffer at max size
    if (!this.options.enabled || this.closed || !this.db) {
      return;
    }

    // Prevent unbounded buffer growth (protection against repeated flush failures)
    if (this.buffer.length >= this.maxBufferSize) {
      logger.warn('Telemetry buffer at maximum size, dropping event', {
        bufferSize: this.buffer.length,
        maxBufferSize: this.maxBufferSize
      });
      return;
    }

    const fullEvent: TelemetryEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...event
    };

    this.buffer.push(fullEvent);

    logger.debug('Telemetry event recorded', {
      type: fullEvent.type,
      provider: fullEvent.provider,
      bufferSize: this.buffer.length
    });

    // Flush if buffer is full
    if (this.buffer.length >= this.options.bufferSize) {
      void this.flush();
    }
  }

  /**
   * Flush buffered events to database
   *
   * Protected against concurrent calls to prevent buffer corruption.
   * Safe to call even if closed - will skip gracefully.
   */
  async flush(): Promise<void> {
    // Skip if already flushing, buffer empty, closed, or no database
    if (this.flushing || this.buffer.length === 0 || this.closed || !this.db) {
      return;
    }

    this.flushing = true;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const stmt = this.db.prepare(`
        INSERT INTO telemetry_events (
          id, timestamp, type, provider, model, agent_name, session_id,
          latency_ms, tokens_prompt, tokens_completion, tokens_total,
          cost_usd, success, error_code, error_message, retry_count, context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((events: TelemetryEvent[]) => {
        for (const event of events) {
          // Safely serialize context (handle circular references)
          let contextJson: string | null = null;
          if (event.context) {
            try {
              contextJson = JSON.stringify(event.context);
            } catch (error) {
              logger.warn('Failed to serialize event context (circular reference?)', {
                eventId: event.id,
                error: (error as Error).message
              });
              contextJson = JSON.stringify({ error: 'Serialization failed' });
            }
          }

          stmt.run(
            event.id,
            event.timestamp,
            event.type,
            event.provider,
            event.model || null,
            event.agentName || null,
            event.sessionId || null,
            event.latencyMs,
            event.tokensUsed.prompt,
            event.tokensUsed.completion,
            event.tokensUsed.total,
            event.cost.estimatedUsd,
            event.success ? 1 : 0,
            event.errorCode || null,
            event.errorMessage || null,
            event.retryCount || null,
            contextJson
          );
        }
      });

      insertMany(events);

      logger.debug('Telemetry events flushed', {
        count: events.length
      });

    } catch (error) {
      logger.error('Failed to flush telemetry events', {
        error: (error as Error).message,
        count: events.length
      });

      // Put events back in buffer ONLY if we won't exceed max size
      // This prevents unbounded growth from repeated failures
      const spaceAvailable = this.maxBufferSize - this.buffer.length;
      if (spaceAvailable > 0) {
        const eventsToRestore = events.slice(0, spaceAvailable);
        this.buffer.unshift(...eventsToRestore);

        if (eventsToRestore.length < events.length) {
          logger.warn('Dropped telemetry events due to buffer limit', {
            dropped: events.length - eventsToRestore.length,
            restored: eventsToRestore.length
          });
        }
      } else {
        logger.warn('Dropped all failed telemetry events - buffer full', {
          dropped: events.length
        });
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Query telemetry events
   *
   * Returns empty array if closed or database not initialized.
   */
  query(filters: TelemetryQueryFilters = {}): TelemetryEvent[] {
    if (this.closed || !this.db) {
      logger.warn('Query called on closed or uninitialized telemetry collector');
      return [];
    }

    let sql = 'SELECT * FROM telemetry_events WHERE 1=1';
    const params: any[] = [];

    if (filters.provider) {
      sql += ' AND provider = ?';
      params.push(filters.provider);
    }

    if (filters.agentName) {
      sql += ' AND agent_name = ?';
      params.push(filters.agentName);
    }

    if (filters.sessionId) {
      sql += ' AND session_id = ?';
      params.push(filters.sessionId);
    }

    if (filters.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    if (filters.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filters.success ? 1 : 0);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(filters.limit || 1000);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  /**
   * Get event count
   *
   * Returns 0 if closed or database not initialized.
   */
  count(filters: TelemetryQueryFilters = {}): number {
    if (this.closed || !this.db) {
      return 0;
    }

    let sql = 'SELECT COUNT(*) as count FROM telemetry_events WHERE 1=1';
    const params: any[] = [];

    if (filters.provider) {
      sql += ' AND provider = ?';
      params.push(filters.provider);
    }

    if (filters.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    const result = this.db.prepare(sql).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Clean up old events based on retention policy
   *
   * Returns 0 if closed or database not initialized.
   */
  async cleanup(): Promise<number> {
    if (this.closed || !this.db) {
      return 0;
    }

    const cutoffTimestamp = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);

    const result = this.db.prepare(`
      DELETE FROM telemetry_events WHERE timestamp < ?
    `).run(cutoffTimestamp);

    logger.info('Telemetry cleanup completed', {
      deletedRows: result.changes,
      retentionDays: this.options.retentionDays
    });

    return result.changes;
  }

  /**
   * Clear all telemetry data
   *
   * No-op if closed or database not initialized.
   */
  async clear(): Promise<void> {
    if (this.closed || !this.db) {
      return;
    }

    this.db.prepare('DELETE FROM telemetry_events').run();
    logger.info('All telemetry data cleared');
  }

  /**
   * Get database stats
   *
   * Returns empty stats if closed or database not initialized.
   */
  getStats(): {
    totalEvents: number;
    oldestEvent: number | null;
    newestEvent: number | null;
    databaseSizeBytes: number;
  } {
    if (this.closed || !this.db) {
      return {
        totalEvents: 0,
        oldestEvent: null,
        newestEvent: null,
        databaseSizeBytes: 0
      };
    }

    const totalEvents = this.db.prepare('SELECT COUNT(*) as count FROM telemetry_events').get() as { count: number };

    const oldest = this.db.prepare('SELECT MIN(timestamp) as ts FROM telemetry_events').get() as { ts: number | null };

    const newest = this.db.prepare('SELECT MAX(timestamp) as ts FROM telemetry_events').get() as { ts: number | null };

    // Get database file size
    let databaseSizeBytes = 0;
    if (existsSync(this.options.dbPath)) {
      const stats = statSync(this.options.dbPath);
      databaseSizeBytes = stats.size;
    }

    return {
      totalEvents: totalEvents.count,
      oldestEvent: oldest.ts,
      newestEvent: newest.ts,
      databaseSizeBytes
    };
  }

  /**
   * Map database row to TelemetryEvent
   *
   * Safely handles JSON parsing and missing columns.
   */
  private mapRowToEvent(row: any): TelemetryEvent {
    // Safely parse context JSON (handle corruption)
    let context: any = undefined;
    if (row.context) {
      try {
        context = JSON.parse(row.context);
      } catch (error) {
        logger.warn('Failed to parse telemetry event context', {
          eventId: row.id,
          error: (error as Error).message
        });
        context = undefined;
      }
    }

    return {
      id: row.id || '',
      timestamp: row.timestamp || 0,
      type: (row.type as TelemetryEventType) || 'execution_complete',
      provider: row.provider || 'unknown',
      model: row.model || undefined,
      agentName: row.agent_name || undefined,
      sessionId: row.session_id || undefined,
      latencyMs: row.latency_ms || 0,
      tokensUsed: {
        prompt: row.tokens_prompt || 0,
        completion: row.tokens_completion || 0,
        total: row.tokens_total || 0
      },
      cost: {
        estimatedUsd: row.cost_usd || 0,
        provider: row.provider || 'unknown'
      },
      success: row.success === 1,
      errorCode: row.error_code || undefined,
      errorMessage: row.error_message || undefined,
      retryCount: row.retry_count || undefined,
      context
    };
  }

  /**
   * Close database and flush remaining events
   *
   * Safe to call multiple times - subsequent calls are no-ops.
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;  // Already closed
    }

    this.closed = true;

    // Stop auto-flush
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    // Flush any remaining events
    await this.flush();

    // Close database if it was initialized
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        logger.error('Error closing telemetry database', {
          error: (error as Error).message
        });
      }
      this.db = null;
    }

    logger.debug('Telemetry collector closed');
  }
}

/**
 * Singleton instance
 */
let telemetryCollector: TelemetryCollector | null = null;
let currentOptions: Partial<TelemetryOptions> | undefined = undefined;

/**
 * Get telemetry collector singleton
 *
 * If options differ from current instance, the old instance is closed
 * and a new one is created. This allows analytics commands to override
 * the default disabled state.
 *
 * Note: This is synchronous for ease of use. If recreating instance,
 * we close synchronously by setting closed flag immediately, then
 * database close happens in background.
 */
export function getTelemetryCollector(options?: Partial<TelemetryOptions>): TelemetryCollector {
  // If options provided and instance exists, check if they differ
  if (telemetryCollector && options) {
    const optionsChanged =
      options.enabled !== undefined && options.enabled !== currentOptions?.enabled;

    if (optionsChanged) {
      logger.debug('Telemetry options changed, recreating instance', {
        oldEnabled: currentOptions?.enabled,
        newEnabled: options.enabled
      });

      // Close old instance (sets closed flag immediately, db close happens async)
      // This prevents race conditions where both instances access same db
      const oldInstance = telemetryCollector;
      telemetryCollector = null;
      currentOptions = undefined;

      // Close in background (safe because closed flag is set immediately)
      void oldInstance.close();
    }
  }

  if (!telemetryCollector) {
    telemetryCollector = new TelemetryCollector(options);
    currentOptions = options;
  }

  return telemetryCollector;
}

/**
 * Reset telemetry collector (for testing and clean shutdown)
 */
export async function resetTelemetryCollector(): Promise<void> {
  if (telemetryCollector) {
    await telemetryCollector.close();
    telemetryCollector = null;
    currentOptions = undefined;
  }
}
