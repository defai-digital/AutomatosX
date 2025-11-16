/**
 * AgentExecutionConfig.ts
 * REFACTORING #19: Load agent execution configuration from YAML
 * Replaces hard-coded retry/timeout constants in AgentBase
 */
export interface BackoffConfig {
    baseMs: number;
    maxMs: number;
    multiplier: number;
}
export interface ErrorHandlingConfig {
    logTraces: boolean;
    emitEvents: boolean;
}
export interface AgentExecutionConfig {
    version: string;
    maxRetries: number;
    timeoutMs: number;
    backoff: BackoffConfig;
    errors: ErrorHandlingConfig;
}
/**
 * Load agent execution configuration from YAML (with caching)
 */
export declare function loadAgentExecutionConfig(): AgentExecutionConfig;
/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export declare function clearAgentExecutionConfigCache(): void;
//# sourceMappingURL=AgentExecutionConfig.d.ts.map