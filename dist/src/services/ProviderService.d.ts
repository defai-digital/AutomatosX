/**
 * ProviderService.ts
 *
 * High-level service layer that integrates ProviderRouter with database logging,
 * telemetry, and the ReScript state machine.
 *
 * Phase 2 Week 3 Day 11: ProviderService Integration Layer
 */
import type { ProviderRequest, ProviderResponse, ProviderType, StreamChunk } from '../types/schemas/provider.schema.js';
export interface ProviderServiceConfig {
    primaryProvider?: ProviderType;
    fallbackChain?: ProviderType[];
    enableFallback?: boolean;
    circuitBreakerThreshold?: number;
    circuitBreakerTimeout?: number;
    enableLogging?: boolean;
    enableTelemetry?: boolean;
}
export interface StreamingOptions {
    onChunk?: (chunk: StreamChunk) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
}
/**
 * ProviderService is the main entry point for AI provider interactions.
 * It orchestrates provider routing, database logging, and telemetry.
 */
export declare class ProviderService {
    private router;
    private config;
    private db;
    constructor(config?: ProviderServiceConfig);
    /**
     * Send a request to the AI provider with full logging and telemetry
     */
    sendRequest(request: Partial<ProviderRequest>, userId?: string): Promise<ProviderResponse>;
    /**
     * Send a streaming request with logging
     */
    sendStreamingRequest(request: Partial<ProviderRequest>, options?: StreamingOptions, userId?: string): Promise<ProviderResponse>;
    /**
     * Log request start to database
     */
    private logRequestStart;
    /**
     * Log successful request to database
     */
    private logRequestSuccess;
    /**
     * Log failed request to database
     */
    private logRequestFailure;
    /**
     * Record telemetry data
     */
    private recordTelemetry;
    /**
     * Get provider health status
     */
    getProviderHealth(): Promise<Map<ProviderType, boolean>>;
    /**
     * Get provider statistics
     */
    getProviderStatistics(): Record<string, any>;
    /**
     * Get provider statistics from database
     */
    getProviderStats(timeRangeMs?: number): Promise<any>;
    /**
     * Get recent provider logs
     */
    getRecentLogs(limit?: number): Promise<any[]>;
    /**
     * Update service configuration
     */
    updateConfig(config: Partial<ProviderServiceConfig>): void;
}
//# sourceMappingURL=ProviderService.d.ts.map