import { TelemetryEvent, EventType, SubmissionConfig, SubmissionResult } from '../types/schemas/telemetry.schema';
import { QueueStats } from './TelemetryQueue.js';
/**
 * TelemetryService
 *
 * Privacy-first telemetry and usage analytics service.
 *
 * Design Principles:
 * - No PII collection (no file paths, code content, or user identifiers)
 * - Anonymous session IDs
 * - Local-only storage by default
 * - Explicit user consent required
 * - Minimal overhead (< 1ms per event)
 */
export declare class TelemetryService {
    private sessionId;
    private enabled;
    private remoteEnabled;
    private dao;
    private queue?;
    private submissionClient?;
    private rateLimiter?;
    private submissionConfig?;
    private submissionTimer?;
    constructor(dao?: any, submissionConfig?: SubmissionConfig);
    /**
     * Initialize telemetry service
     * Loads configuration and checks consent status
     */
    initialize(): Promise<void>;
    /**
     * Initialize remote submission components
     * @private
     */
    private initializeRemoteSubmission;
    /**
     * Check if telemetry is enabled
     */
    isEnabled(): boolean;
    /**
     * Enable telemetry collection
     */
    enable(remote?: boolean): Promise<void>;
    /**
     * Disable telemetry collection
     */
    disable(): Promise<void>;
    /**
     * Track a generic telemetry event
     */
    trackEvent(eventType: EventType, eventData?: Record<string, unknown>): Promise<void>;
    /**
     * Track command execution
     */
    trackCommand(command: string, args: string[] | undefined, duration: number, exitCode: number, error?: string): Promise<void>;
    /**
     * Track query performance
     */
    trackQuery(queryType: 'symbol' | 'text' | 'hybrid', query: string, resultCount: number, duration: number, cached: boolean, language?: string): Promise<void>;
    /**
     * Track parser invocation
     */
    trackParser(language: string, fileExtension: string, duration: number, symbolCount: number, lineCount: number, error?: string): Promise<void>;
    /**
     * Track error occurrence
     */
    trackError(errorType: string, message: string, stack?: string, context?: Record<string, string>, fatal?: boolean): Promise<void>;
    /**
     * Track performance metric
     */
    trackPerformance(metricName: string, value: number, unit: 'ms' | 'bytes' | 'count' | 'percentage', context?: Record<string, string>): Promise<void>;
    /**
     * Track feature usage
     */
    trackFeature(featureName: string, enabled: boolean, variant?: string): Promise<void>;
    /**
     * Get session ID
     */
    getSessionId(): string;
    /**
     * Get telemetry statistics
     * Returns aggregated usage data for analytics dashboard
     */
    getStats(startDate?: string, endDate?: string): Promise<any[]>;
    /**
     * Clear all telemetry data
     * Used for testing or user privacy request
     */
    clearAllData(): Promise<void>;
    /**
     * Export telemetry data
     * For debugging or remote submission
     */
    exportData(startDate?: string, endDate?: string): Promise<TelemetryEvent[]>;
    /**
     * Start background submission timer
     * @param intervalMs - Interval in milliseconds
     * @private
     */
    private startBackgroundSubmission;
    /**
     * Stop background submission timer
     * @private
     */
    private stopBackgroundSubmission;
    /**
     * Submit queued events to remote server
     * Called periodically by background timer or manually
     */
    submitQueuedEvents(): Promise<SubmissionResult | null>;
    /**
     * Get queue statistics
     */
    getQueueStats(): QueueStats | null;
    /**
     * Clear the submission queue
     * Removes all pending events
     */
    clearQueue(): number;
    /**
     * Manually trigger submission of queued events
     * Useful for testing or forced submission
     */
    forceSubmission(): Promise<SubmissionResult | null>;
}
/**
 * Get singleton telemetry service instance
 */
export declare function getTelemetryService(): TelemetryService;
/**
 * Initialize telemetry service with DAO and optional submission config
 */
export declare function initializeTelemetryService(dao: any, submissionConfig?: SubmissionConfig): TelemetryService;
//# sourceMappingURL=TelemetryService.d.ts.map