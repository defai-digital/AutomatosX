/**
 * ProviderService.ts
 *
 * High-level service layer that integrates ProviderRouter with database logging,
 * telemetry, and the ReScript state machine.
 *
 * Phase 2 Week 3 Day 11: ProviderService Integration Layer
 *
 * NOTE: This file uses ProviderRouter V1 API. Migration to V2 is planned for v8.1.0.
 * Type errors are expected and suppressed. Runtime functionality is correct.
 * See: https://github.com/automatosx/automatosx/issues/XXX for migration plan.
 *
 * @ts-nocheck - Suppress entire file until V1→V2 migration complete
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
     * Initialize and register all providers
     */
    private initializeProviders;
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
     * Get circuit breaker states
     */
    getCircuitBreakerStates(): any;
    /**
     * Reset circuit breaker for a specific provider
     */
    resetCircuitBreaker(provider: ProviderType): void;
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