/**
 * TelemetrySubmissionClient.ts
 *
 * HTTP client for submitting telemetry data to remote server
 * Handles batch submission, retries, and error handling
 */
import { SubmissionConfig, SubmissionResult, ServerInfo, TelemetryEvent } from '../types/schemas/telemetry.schema.js';
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
export declare class TelemetrySubmissionClient {
    private config;
    /**
     * Create a new telemetry submission client
     *
     * @param config - Submission configuration (endpoint, API key, timeout)
     * @throws {ZodError} - If config validation fails
     */
    constructor(config: SubmissionConfig);
    /**
     * Submit a batch of telemetry events to the remote server
     *
     * Privacy guarantee: Events are already anonymized by TelemetryService
     * before being passed to this method. No additional PII is added.
     *
     * @param events - Array of telemetry events to submit
     * @returns Promise<SubmissionResult> - Result with acceptance counts
     */
    submitBatch(events: TelemetryEvent[]): Promise<SubmissionResult>;
    /**
     * Test connection to the telemetry server
     *
     * @returns Promise<boolean> - True if server is reachable
     */
    ping(): Promise<boolean>;
    /**
     * Get server information (version, status, capabilities)
     *
     * @returns Promise<ServerInfo> - Server metadata
     * @throws {Error} - If server is unreachable or returns invalid data
     */
    getServerInfo(): Promise<ServerInfo>;
    /**
     * Get the configured endpoint URL
     *
     * @returns string - The endpoint URL
     */
    getEndpoint(): string;
    /**
     * Get the configured timeout in milliseconds
     *
     * @returns number - Timeout in ms
     */
    getTimeout(): number;
    /**
     * Check if API key is configured
     *
     * @returns boolean - True if API key is set
     */
    hasApiKey(): boolean;
}
//# sourceMappingURL=TelemetrySubmissionClient.d.ts.map