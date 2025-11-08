/**
 * TelemetryDAO.ts
 *
 * Data Access Object for telemetry tables
 * Provides CRUD operations for telemetry events and statistics
 */
import Database from 'better-sqlite3';
import { TelemetryEvent, TelemetryStats, TelemetryConfig } from '../../types/schemas/telemetry.schema.js';
/**
 * Telemetry configuration stored in database
 */
export interface TelemetryConfigRecord {
    id: number;
    enabled: number;
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
export declare class TelemetryDAO {
    private db;
    constructor(db?: Database.Database);
    /**
     * Save a telemetry event
     *
     * @param event - Telemetry event data
     * @returns Inserted event ID
     */
    saveEvent(event: TelemetryEvent): number;
    /**
     * Batch insert multiple events in a single transaction
     *
     * @param events - Array of telemetry events
     * @returns Number of events inserted
     */
    batchInsertEvents(events: TelemetryEvent[]): number;
    /**
     * Get events within a date range
     *
     * @param startDate - Start date (YYYY-MM-DD) or timestamp
     * @param endDate - End date (YYYY-MM-DD) or timestamp
     * @returns Array of telemetry events
     */
    getEvents(startDate?: string, endDate?: string): TelemetryEvent[];
    /**
     * Get events by session ID
     *
     * @param sessionId - Session UUID
     * @returns Array of telemetry events for the session
     */
    getEventsBySession(sessionId: string): TelemetryEvent[];
    /**
     * Get events by type
     *
     * @param eventType - Event type to filter by
     * @param limit - Maximum number of events to return
     * @returns Array of telemetry events
     */
    getEventsByType(eventType: string, limit?: number): TelemetryEvent[];
    /**
     * Get total count of telemetry events
     *
     * @returns Total number of events in database
     */
    getEventCount(): number;
    /**
     * Clear all telemetry events
     * Used for testing or user privacy request
     */
    clearAllEvents(): void;
    /**
     * Clear events older than specified date
     *
     * @param beforeDate - Date string (YYYY-MM-DD) or timestamp
     */
    clearEventsBefore(beforeDate: string): void;
    /**
     * Save or update aggregated statistics
     *
     * @param stats - Telemetry statistics
     */
    saveStats(stats: TelemetryStats): void;
    /**
     * Get statistics within a date range
     *
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD)
     * @returns Array of telemetry statistics
     */
    getStats(startDate?: string, endDate?: string): TelemetryStats[];
    /**
     * Get statistics by type
     *
     * @param statType - Stat type (command, query, error, performance)
     * @param limit - Maximum number of records
     * @returns Array of telemetry statistics
     */
    getStatsByType(statType: string, limit?: number): TelemetryStats[];
    /**
     * Save telemetry configuration
     *
     * @param config - Telemetry configuration
     */
    saveConfig(config: Partial<TelemetryConfig>): Promise<void>;
    /**
     * Get telemetry configuration
     *
     * @returns Telemetry configuration or null if not set
     */
    getConfig(): TelemetryConfig | null;
    /**
     * Aggregate events into statistics
     * Should be run periodically (e.g., daily) to update stats table
     *
     * @param date - Date to aggregate (YYYY-MM-DD), defaults to today
     */
    aggregateStats(date?: string): void;
    /**
     * Helper: Convert event record from DB to TelemetryEvent
     */
    private eventRecordToEvent;
    /**
     * Helper: Convert stats record from DB to TelemetryStats
     */
    private statsRecordToStats;
    /**
     * Helper: Parse date string to timestamp
     */
    private parseDateToTimestamp;
}
//# sourceMappingURL=TelemetryDAO.d.ts.map