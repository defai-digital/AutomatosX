import { v4 as uuidv4 } from 'uuid';
import { TelemetryQueue } from './TelemetryQueue.js';
import { TelemetrySubmissionClient } from './TelemetrySubmissionClient.js';
import { RateLimiter } from './RateLimiter.js';
import { getDatabase } from '../database/connection.js';
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
export class TelemetryService {
    sessionId;
    enabled;
    remoteEnabled;
    dao; // Will be injected - TelemetryDao
    // Remote submission components
    queue;
    submissionClient;
    rateLimiter;
    submissionConfig;
    submissionTimer;
    constructor(dao, submissionConfig) {
        this.sessionId = uuidv4();
        this.enabled = false;
        this.remoteEnabled = false;
        this.dao = dao;
        this.submissionConfig = submissionConfig;
    }
    /**
     * Initialize telemetry service
     * Loads configuration and checks consent status
     */
    async initialize() {
        if (!this.dao) {
            return;
        }
        const config = await this.dao.getConfig();
        if (config) {
            this.enabled = config.enabled;
            this.remoteEnabled = config.remote;
            this.sessionId = config.sessionId;
        }
        // Initialize remote submission components if enabled
        if (this.remoteEnabled && this.submissionConfig) {
            this.initializeRemoteSubmission();
        }
    }
    /**
     * Initialize remote submission components
     * @private
     */
    initializeRemoteSubmission() {
        if (!this.submissionConfig || !this.dao) {
            return;
        }
        try {
            const db = getDatabase();
            // Initialize queue
            this.queue = new TelemetryQueue(db);
            // Initialize submission client
            this.submissionClient = new TelemetrySubmissionClient(this.submissionConfig);
            // Initialize rate limiter (default: 60 events/min, burst 10)
            this.rateLimiter = new RateLimiter({
                rate: 60,
                burst: 10,
            });
            // Start background submission (every 30 seconds)
            this.startBackgroundSubmission(30000);
        }
        catch (error) {
            // Silent failure - remote submission is optional
            console.debug('Failed to initialize remote submission:', error);
        }
    }
    /**
     * Check if telemetry is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Enable telemetry collection
     */
    async enable(remote = false) {
        this.enabled = true;
        this.remoteEnabled = remote;
        if (this.dao) {
            await this.dao.saveConfig({
                enabled: true,
                remote,
                sessionId: this.sessionId,
                consentDate: Date.now(),
            });
        }
        // Initialize remote submission if enabled
        if (remote && this.submissionConfig) {
            this.initializeRemoteSubmission();
        }
    }
    /**
     * Disable telemetry collection
     */
    async disable() {
        this.enabled = false;
        this.remoteEnabled = false;
        // Stop background submission
        this.stopBackgroundSubmission();
        if (this.dao) {
            await this.dao.saveConfig({
                enabled: false,
                remote: false,
                sessionId: this.sessionId,
                optOutDate: Date.now(),
            });
        }
    }
    /**
     * Track a generic telemetry event
     */
    async trackEvent(eventType, eventData) {
        if (!this.enabled || !this.dao) {
            return;
        }
        const event = {
            sessionId: this.sessionId,
            eventType,
            eventData,
            timestamp: Date.now(),
        };
        try {
            // Save event to local database
            const eventId = await this.dao.saveEvent(event);
            // Enqueue for remote submission if enabled
            if (this.remoteEnabled && this.queue && eventId) {
                try {
                    this.queue.enqueue([eventId]);
                }
                catch (queueError) {
                    // Silent failure - remote submission is optional
                    console.debug('Failed to enqueue event for remote submission:', queueError);
                }
            }
        }
        catch (error) {
            // Silent failure - telemetry should never break the application
            console.debug('Telemetry event failed:', error);
        }
    }
    /**
     * Track command execution
     */
    async trackCommand(command, args = [], duration, exitCode, error) {
        const data = {
            command,
            args,
            duration,
            exitCode,
            error,
        };
        await this.trackEvent('command_executed', data);
    }
    /**
     * Track query performance
     */
    async trackQuery(queryType, query, resultCount, duration, cached, language) {
        // Truncate query for privacy (max 100 chars)
        const truncatedQuery = query.substring(0, 100);
        const data = {
            queryType,
            query: truncatedQuery,
            resultCount,
            duration,
            cached,
            language,
        };
        await this.trackEvent('query_performed', data);
    }
    /**
     * Track parser invocation
     */
    async trackParser(language, fileExtension, duration, symbolCount, lineCount, error) {
        const data = {
            language,
            fileExtension,
            duration,
            symbolCount,
            lineCount,
            error,
        };
        await this.trackEvent('parser_invoked', data);
    }
    /**
     * Track error occurrence
     */
    async trackError(errorType, message, stack, context, fatal = false) {
        // Truncate message and stack for privacy
        const truncatedMessage = message.substring(0, 200);
        const truncatedStack = stack?.substring(0, 500);
        const data = {
            errorType,
            message: truncatedMessage,
            stack: truncatedStack,
            context,
            fatal,
        };
        await this.trackEvent('error_occurred', data);
    }
    /**
     * Track performance metric
     */
    async trackPerformance(metricName, value, unit, context) {
        const data = {
            metricName,
            value,
            unit,
            context,
        };
        await this.trackEvent('performance_metric', data);
    }
    /**
     * Track feature usage
     */
    async trackFeature(featureName, enabled, variant) {
        const data = {
            featureName,
            enabled,
            variant,
        };
        await this.trackEvent('feature_used', data);
    }
    /**
     * Get session ID
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Get telemetry statistics
     * Returns aggregated usage data for analytics dashboard
     */
    async getStats(startDate, endDate) {
        if (!this.dao) {
            return [];
        }
        return this.dao.getStats(startDate, endDate);
    }
    /**
     * Clear all telemetry data
     * Used for testing or user privacy request
     */
    async clearAllData() {
        if (!this.dao) {
            return;
        }
        await this.dao.clearAllEvents();
    }
    /**
     * Export telemetry data
     * For debugging or remote submission
     */
    async exportData(startDate, endDate) {
        if (!this.dao) {
            return [];
        }
        return this.dao.getEvents(startDate, endDate);
    }
    /**
     * Start background submission timer
     * @param intervalMs - Interval in milliseconds
     * @private
     */
    startBackgroundSubmission(intervalMs) {
        if (this.submissionTimer) {
            clearInterval(this.submissionTimer);
        }
        this.submissionTimer = setInterval(() => {
            this.submitQueuedEvents().catch((error) => {
                console.debug('Background submission failed:', error);
            });
        }, intervalMs);
    }
    /**
     * Stop background submission timer
     * @private
     */
    stopBackgroundSubmission() {
        if (this.submissionTimer) {
            clearInterval(this.submissionTimer);
            this.submissionTimer = undefined;
        }
    }
    /**
     * Submit queued events to remote server
     * Called periodically by background timer or manually
     */
    async submitQueuedEvents() {
        if (!this.remoteEnabled || !this.queue || !this.submissionClient || !this.rateLimiter || !this.dao) {
            return null;
        }
        try {
            // Check rate limit
            const batchSize = 10;
            if (!this.rateLimiter.canSubmit(batchSize)) {
                const waitTime = this.rateLimiter.getWaitTime();
                console.debug(`Rate limited, wait ${waitTime}ms before next submission`);
                return null;
            }
            // Dequeue events
            const queuedEvents = this.queue.dequeue(batchSize);
            if (queuedEvents.length === 0) {
                return null; // Nothing to submit
            }
            // Get full event data from database
            const eventIds = queuedEvents.map((qe) => qe.eventId);
            const events = [];
            const db = getDatabase();
            for (const eventId of eventIds) {
                const eventRecord = db
                    .prepare('SELECT * FROM telemetry_events WHERE id = ?')
                    .get(eventId);
                if (eventRecord) {
                    events.push({
                        sessionId: eventRecord.session_id,
                        eventType: eventRecord.event_type,
                        eventData: eventRecord.event_data ? JSON.parse(eventRecord.event_data) : undefined,
                        timestamp: eventRecord.timestamp,
                    });
                }
            }
            // Consume rate limit tokens
            if (!this.rateLimiter.consume(events.length)) {
                console.debug('Failed to consume rate limit tokens');
                return null;
            }
            // Submit to remote server
            const result = await this.submissionClient.submitBatch(events);
            // Handle result
            if (result.success) {
                // Mark events as submitted (remove from queue)
                const queueIds = queuedEvents.map((qe) => qe.id);
                this.queue.markSubmitted(queueIds);
            }
            else {
                // Mark events as failed (schedule retry)
                const queueIds = queuedEvents.map((qe) => qe.id);
                const errorMsg = result.errors?.join(', ') || 'Unknown error';
                this.queue.markFailed(queueIds, errorMsg);
            }
            return result;
        }
        catch (error) {
            console.debug('Submission failed:', error);
            return {
                success: false,
                accepted: 0,
                rejected: 0,
                errors: [error.message || 'Unknown error'],
            };
        }
    }
    /**
     * Get queue statistics
     */
    getQueueStats() {
        if (!this.queue) {
            return null;
        }
        return this.queue.getStats();
    }
    /**
     * Clear the submission queue
     * Removes all pending events
     */
    clearQueue() {
        if (!this.queue) {
            return 0;
        }
        const stats = this.queue.getStats();
        const total = stats.pending + stats.retrying;
        // Clear all events from queue
        this.queue.clearAll();
        return total;
    }
    /**
     * Manually trigger submission of queued events
     * Useful for testing or forced submission
     */
    async forceSubmission() {
        return this.submitQueuedEvents();
    }
}
// Singleton instance
let telemetryServiceInstance = null;
/**
 * Get singleton telemetry service instance
 */
export function getTelemetryService() {
    if (!telemetryServiceInstance) {
        telemetryServiceInstance = new TelemetryService();
    }
    return telemetryServiceInstance;
}
/**
 * Initialize telemetry service with DAO and optional submission config
 */
export function initializeTelemetryService(dao, submissionConfig) {
    telemetryServiceInstance = new TelemetryService(dao, submissionConfig);
    return telemetryServiceInstance;
}
//# sourceMappingURL=TelemetryService.js.map