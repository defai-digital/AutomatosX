/**
 * TelemetryDAO.ts
 *
 * Data Access Object for telemetry tables
 * Provides CRUD operations for telemetry events and statistics
 */

import { getDatabase } from '../connection.js';
import Database from 'better-sqlite3';
import {
  TelemetryEvent,
  TelemetryEventRecord,
  TelemetryStats,
  TelemetryStatsRecord,
  TelemetryConfig,
} from '../../types/schemas/telemetry.schema.js';

/**
 * Telemetry configuration stored in database
 */
export interface TelemetryConfigRecord {
  id: number;
  enabled: number; // SQLite stores booleans as 0/1
  remote: number;
  session_id: string;
  consent_date: number | null;
  opt_out_date: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * TelemetryDAO - Data Access Object for telemetry tables
 */
export class TelemetryDAO {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Save a telemetry event
   *
   * @param event - Telemetry event data
   * @returns Inserted event ID
   */
  saveEvent(event: TelemetryEvent): number {
    const stmt = this.db.prepare(`
      INSERT INTO telemetry_events (session_id, event_type, event_data, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.sessionId,
      event.eventType,
      event.eventData ? JSON.stringify(event.eventData) : null,
      event.timestamp
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Batch insert multiple events in a single transaction
   *
   * @param events - Array of telemetry events
   * @returns Number of events inserted
   */
  batchInsertEvents(events: TelemetryEvent[]): number {
    const insertMany = this.db.transaction((events: TelemetryEvent[]) => {
      const stmt = this.db.prepare(`
        INSERT INTO telemetry_events (session_id, event_type, event_data, timestamp)
        VALUES (?, ?, ?, ?)
      `);

      for (const event of events) {
        stmt.run(
          event.sessionId,
          event.eventType,
          event.eventData ? JSON.stringify(event.eventData) : null,
          event.timestamp
        );
      }
    });

    insertMany(events);
    return events.length;
  }

  /**
   * Get events within a date range
   *
   * @param startDate - Start date (YYYY-MM-DD) or timestamp
   * @param endDate - End date (YYYY-MM-DD) or timestamp
   * @returns Array of telemetry events
   */
  getEvents(startDate?: string, endDate?: string): TelemetryEvent[] {
    let query = 'SELECT * FROM telemetry_events';
    const params: any[] = [];

    if (startDate || endDate) {
      query += ' WHERE';
      if (startDate) {
        query += ' timestamp >= ?';
        params.push(this.parseDateToTimestamp(startDate));
      }
      if (endDate) {
        if (startDate) query += ' AND';
        query += ' timestamp < ?';
        // Add one day to endDate to include the entire day
        params.push(this.parseDateToTimestamp(endDate) + 86400000);
      }
    }

    query += ' ORDER BY timestamp DESC LIMIT 1000';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as TelemetryEventRecord[];

    return rows.map(this.eventRecordToEvent);
  }

  /**
   * Get events by session ID
   *
   * @param sessionId - Session UUID
   * @returns Array of telemetry events for the session
   */
  getEventsBySession(sessionId: string): TelemetryEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM telemetry_events
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `);

    const rows = stmt.all(sessionId) as TelemetryEventRecord[];
    return rows.map(this.eventRecordToEvent);
  }

  /**
   * Get events by type
   *
   * @param eventType - Event type to filter by
   * @param limit - Maximum number of events to return
   * @returns Array of telemetry events
   */
  getEventsByType(eventType: string, limit: number = 100): TelemetryEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM telemetry_events
      WHERE event_type = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(eventType, limit) as TelemetryEventRecord[];
    return rows.map(this.eventRecordToEvent);
  }

  /**
   * Get total count of telemetry events
   *
   * @returns Total number of events in database
   */
  getEventCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM telemetry_events');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Clear all telemetry events
   * Used for testing or user privacy request
   */
  clearAllEvents(): void {
    this.db.prepare('DELETE FROM telemetry_events').run();
  }

  /**
   * Clear events older than specified date
   *
   * @param beforeDate - Date string (YYYY-MM-DD) or timestamp
   */
  clearEventsBefore(beforeDate: string): void {
    const timestamp = this.parseDateToTimestamp(beforeDate);
    this.db.prepare('DELETE FROM telemetry_events WHERE timestamp < ?').run(timestamp);
  }

  /**
   * Save or update aggregated statistics
   *
   * @param stats - Telemetry statistics
   */
  saveStats(stats: TelemetryStats): void {
    const stmt = this.db.prepare(`
      INSERT INTO telemetry_stats (
        stat_date, stat_type, stat_key, count,
        total_duration, avg_duration, min_duration, max_duration, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stat_date, stat_type, stat_key)
      DO UPDATE SET
        count = count + excluded.count,
        total_duration = COALESCE(total_duration, 0) + COALESCE(excluded.total_duration, 0),
        avg_duration = (COALESCE(total_duration, 0) + COALESCE(excluded.total_duration, 0)) /
                       (count + excluded.count),
        min_duration = MIN(COALESCE(min_duration, 999999), COALESCE(excluded.min_duration, 999999)),
        max_duration = MAX(COALESCE(max_duration, 0), COALESCE(excluded.max_duration, 0)),
        metadata = COALESCE(excluded.metadata, metadata),
        updated_at = strftime('%s', 'now')
    `);

    stmt.run(
      stats.statDate,
      stats.statType,
      stats.statKey,
      stats.count,
      stats.totalDuration || null,
      stats.avgDuration || null,
      stats.minDuration || null,
      stats.maxDuration || null,
      stats.metadata ? JSON.stringify(stats.metadata) : null
    );
  }

  /**
   * Get statistics within a date range
   *
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Array of telemetry statistics
   */
  getStats(startDate?: string, endDate?: string): TelemetryStats[] {
    let query = 'SELECT * FROM telemetry_stats';
    const params: any[] = [];

    if (startDate || endDate) {
      query += ' WHERE';
      if (startDate) {
        query += ' stat_date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        if (startDate) query += ' AND';
        query += ' stat_date <= ?';
        params.push(endDate);
      }
    }

    query += ' ORDER BY stat_date DESC, stat_type, stat_key';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as TelemetryStatsRecord[];

    return rows.map(this.statsRecordToStats);
  }

  /**
   * Get statistics by type
   *
   * @param statType - Stat type (command, query, error, performance)
   * @param limit - Maximum number of records
   * @returns Array of telemetry statistics
   */
  getStatsByType(statType: string, limit: number = 100): TelemetryStats[] {
    const stmt = this.db.prepare(`
      SELECT * FROM telemetry_stats
      WHERE stat_type = ?
      ORDER BY stat_date DESC
      LIMIT ?
    `);

    const rows = stmt.all(statType, limit) as TelemetryStatsRecord[];
    return rows.map(this.statsRecordToStats);
  }

  /**
   * Save telemetry configuration
   *
   * @param config - Telemetry configuration
   */
  async saveConfig(config: Partial<TelemetryConfig>): Promise<void> {
    // Check if config exists
    const existingConfig = this.getConfig();

    if (existingConfig) {
      // Update existing config
      const stmt = this.db.prepare(`
        UPDATE telemetry_config
        SET enabled = ?, remote = ?, session_id = ?, consent_date = ?, opt_out_date = ?, updated_at = ?
        WHERE id = 1
      `);

      stmt.run(
        config.enabled !== undefined ? (config.enabled ? 1 : 0) : (existingConfig.enabled ? 1 : 0),
        config.remote !== undefined ? (config.remote ? 1 : 0) : (existingConfig.remote ? 1 : 0),
        config.sessionId || existingConfig.sessionId,
        config.consentDate || existingConfig.consentDate || null,
        config.optOutDate || existingConfig.optOutDate || null,
        Date.now()
      );
    } else {
      // Insert new config
      const stmt = this.db.prepare(`
        INSERT INTO telemetry_config (id, enabled, remote, session_id, consent_date, opt_out_date)
        VALUES (1, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        config.enabled ? 1 : 0,
        config.remote ? 1 : 0,
        config.sessionId || '',
        config.consentDate || null,
        config.optOutDate || null
      );
    }
  }

  /**
   * Get telemetry configuration
   *
   * @returns Telemetry configuration or null if not set
   */
  getConfig(): TelemetryConfig | null {
    // First check if table exists
    const tableExists = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='telemetry_config'
    `).get();

    if (!tableExists) {
      return null;
    }

    const stmt = this.db.prepare('SELECT * FROM telemetry_config WHERE id = 1');
    const row = stmt.get() as TelemetryConfigRecord | undefined;

    if (!row) {
      return null;
    }

    return {
      enabled: row.enabled === 1,
      remote: row.remote === 1,
      sessionId: row.session_id,
      consentDate: row.consent_date || undefined,
      optOutDate: row.opt_out_date || undefined,
    };
  }

  /**
   * Aggregate events into statistics
   * Should be run periodically (e.g., daily) to update stats table
   *
   * @param date - Date to aggregate (YYYY-MM-DD), defaults to today
   */
  aggregateStats(date?: string): void {
    const statDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(statDate).setHours(0, 0, 0, 0);
    const endOfDay = new Date(statDate).setHours(23, 59, 59, 999);

    // Aggregate command stats
    const commandStats = this.db.prepare(`
      SELECT
        event_type,
        json_extract(event_data, '$.command') as stat_key,
        COUNT(*) as count,
        SUM(CAST(json_extract(event_data, '$.duration') as INTEGER)) as total_duration,
        AVG(CAST(json_extract(event_data, '$.duration') as INTEGER)) as avg_duration,
        MIN(CAST(json_extract(event_data, '$.duration') as INTEGER)) as min_duration,
        MAX(CAST(json_extract(event_data, '$.duration') as INTEGER)) as max_duration
      FROM telemetry_events
      WHERE event_type = 'command_executed'
        AND timestamp >= ? AND timestamp <= ?
      GROUP BY stat_key
    `).all(startOfDay, endOfDay);

    for (const row of commandStats as any[]) {
      this.saveStats({
        statDate,
        statType: 'command',
        statKey: row.stat_key,
        count: row.count,
        totalDuration: row.total_duration,
        avgDuration: row.avg_duration,
        minDuration: row.min_duration,
        maxDuration: row.max_duration,
      });
    }

    // Aggregate query stats
    const queryStats = this.db.prepare(`
      SELECT
        json_extract(event_data, '$.queryType') as stat_key,
        COUNT(*) as count,
        SUM(CAST(json_extract(event_data, '$.duration') as INTEGER)) as total_duration,
        AVG(CAST(json_extract(event_data, '$.duration') as INTEGER)) as avg_duration,
        MIN(CAST(json_extract(event_data, '$.duration') as INTEGER)) as min_duration,
        MAX(CAST(json_extract(event_data, '$.duration') as INTEGER)) as max_duration
      FROM telemetry_events
      WHERE event_type = 'query_performed'
        AND timestamp >= ? AND timestamp <= ?
      GROUP BY stat_key
    `).all(startOfDay, endOfDay);

    for (const row of queryStats as any[]) {
      this.saveStats({
        statDate,
        statType: 'query',
        statKey: row.stat_key,
        count: row.count,
        totalDuration: row.total_duration,
        avgDuration: row.avg_duration,
        minDuration: row.min_duration,
        maxDuration: row.max_duration,
      });
    }

    // Aggregate error stats
    const errorStats = this.db.prepare(`
      SELECT
        json_extract(event_data, '$.errorType') as stat_key,
        COUNT(*) as count
      FROM telemetry_events
      WHERE event_type = 'error_occurred'
        AND timestamp >= ? AND timestamp <= ?
      GROUP BY stat_key
    `).all(startOfDay, endOfDay);

    for (const row of errorStats as any[]) {
      this.saveStats({
        statDate,
        statType: 'error',
        statKey: row.stat_key,
        count: row.count,
      });
    }
  }

  /**
   * Helper: Convert event record from DB to TelemetryEvent
   */
  private eventRecordToEvent(record: TelemetryEventRecord): TelemetryEvent {
    return {
      sessionId: record.session_id,
      eventType: record.event_type as any,
      eventData: record.event_data ? JSON.parse(record.event_data) : undefined,
      timestamp: record.timestamp,
    };
  }

  /**
   * Helper: Convert stats record from DB to TelemetryStats
   */
  private statsRecordToStats(record: TelemetryStatsRecord): TelemetryStats {
    return {
      statDate: record.stat_date,
      statType: record.stat_type as any,
      statKey: record.stat_key,
      count: record.count,
      totalDuration: record.total_duration || undefined,
      avgDuration: record.avg_duration || undefined,
      minDuration: record.min_duration || undefined,
      maxDuration: record.max_duration || undefined,
      metadata: record.metadata ? JSON.parse(record.metadata) : undefined,
    };
  }

  /**
   * Helper: Parse date string to timestamp
   */
  private parseDateToTimestamp(date: string): number {
    // If already a number (timestamp), return as-is
    if (!isNaN(Number(date))) {
      return Number(date);
    }

    // Parse date string (YYYY-MM-DD) as local midnight
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }
}
