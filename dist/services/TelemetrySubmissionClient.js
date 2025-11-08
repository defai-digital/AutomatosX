/**
 * TelemetrySubmissionClient.ts
 *
 * HTTP client for submitting telemetry data to remote server
 * Handles batch submission, retries, and error handling
 */
import { SubmissionConfigSchema, SubmissionResultSchema, ServerInfoSchema, } from '../types/schemas/telemetry.schema.js';
/**
 * Client for submitting telemetry events to remote server
 *
 * Features:
 * - HTTPS-only requests
 * - API key authentication
 * - Request/response validation with Zod
 * - Timeout handling
 * - Privacy-preserving (submits only anonymized data)
 */
export class TelemetrySubmissionClient {
    config;
    /**
     * Create a new telemetry submission client
     *
     * @param config - Submission configuration (endpoint, API key, timeout)
     * @throws {ZodError} - If config validation fails
     */
    constructor(config) {
        // Validate configuration with Zod
        this.config = SubmissionConfigSchema.parse(config);
        // Security: Ensure HTTPS only (unless localhost for testing)
        const url = new URL(this.config.endpoint);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
            throw new Error('Telemetry endpoint must use HTTPS for security');
        }
    }
    /**
     * Submit a batch of telemetry events to the remote server
     *
     * Privacy guarantee: Events are already anonymized by TelemetryService
     * before being passed to this method. No additional PII is added.
     *
     * @param events - Array of telemetry events to submit
     * @returns Promise<SubmissionResult> - Result with acceptance counts
     */
    async submitBatch(events) {
        try {
            // Validate we have events to submit
            if (!events || events.length === 0) {
                return {
                    success: true,
                    accepted: 0,
                    rejected: 0,
                };
            }
            // Make POST request to submission endpoint
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'AutomatosX-Telemetry/2.0',
                    ...(this.config.apiKey ? { 'X-API-Key': this.config.apiKey } : {}),
                },
                body: JSON.stringify({ events }),
                signal: AbortSignal.timeout(this.config.timeout),
            });
            // Handle HTTP errors
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            // Parse and validate response
            const jsonResponse = await response.json();
            const result = SubmissionResultSchema.parse(jsonResponse);
            return result;
        }
        catch (error) {
            // Handle timeout errors
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                return {
                    success: false,
                    accepted: 0,
                    rejected: events.length,
                    errors: [`Request timeout after ${this.config.timeout}ms`],
                };
            }
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return {
                    success: false,
                    accepted: 0,
                    rejected: events.length,
                    errors: ['Network error: Unable to reach telemetry server'],
                };
            }
            // Handle all other errors
            return {
                success: false,
                accepted: 0,
                rejected: events.length,
                errors: [error.message || 'Unknown error occurred'],
            };
        }
    }
    /**
     * Test connection to the telemetry server
     *
     * @returns Promise<boolean> - True if server is reachable
     */
    async ping() {
        try {
            const url = new URL(this.config.endpoint);
            const pingUrl = `${url.protocol}//${url.host}/ping`;
            const response = await fetch(pingUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'AutomatosX-Telemetry/2.0',
                },
                signal: AbortSignal.timeout(5000), // 5 second timeout for ping
            });
            return response.ok;
        }
        catch {
            // Any error means server is not reachable
            return false;
        }
    }
    /**
     * Get server information (version, status, capabilities)
     *
     * @returns Promise<ServerInfo> - Server metadata
     * @throws {Error} - If server is unreachable or returns invalid data
     */
    async getServerInfo() {
        try {
            const url = new URL(this.config.endpoint);
            const infoUrl = `${url.protocol}//${url.host}/info`;
            const response = await fetch(infoUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'AutomatosX-Telemetry/2.0',
                },
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const jsonResponse = await response.json();
            const serverInfo = ServerInfoSchema.parse(jsonResponse);
            return serverInfo;
        }
        catch (error) {
            throw new Error(`Failed to get server info: ${error.message}`);
        }
    }
    /**
     * Get the configured endpoint URL
     *
     * @returns string - The endpoint URL
     */
    getEndpoint() {
        return this.config.endpoint;
    }
    /**
     * Get the configured timeout in milliseconds
     *
     * @returns number - Timeout in ms
     */
    getTimeout() {
        return this.config.timeout;
    }
    /**
     * Check if API key is configured
     *
     * @returns boolean - True if API key is set
     */
    hasApiKey() {
        return !!this.config.apiKey;
    }
}
//# sourceMappingURL=TelemetrySubmissionClient.js.map