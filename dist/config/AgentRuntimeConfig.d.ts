/**
 * AgentRuntimeConfig.ts
 * REFACTORING #33: Load agent runtime settings from YAML
 * Replaces hard-coded configuration in AgentExecutor, AgentRuntime, TeamManager, provider-config
 */
export interface ExecutionConfig {
    maxTaskLogLength: number;
    defaultTemperature: number;
    defaultMaxTokens: number;
}
export interface RuntimeConfig {
    defaultMaxTokens: number;
    defaultTemperature: number;
    defaultProviderTimeout: number;
}
export interface TemperatureProfiles {
    creative: number;
    balanced: number;
    precise: number;
}
export interface TokenLimits {
    standard: number;
    fallback: number;
}
export interface TeamConfig {
    maxDelegationDepth: number;
    canWriteToShared: boolean;
}
export interface SearchScoringConfig {
    nameMatch: number;
    descriptionMatch: number;
    capabilityMatch: number;
    keywordMatch: number;
    specializationMatch: number;
}
export interface RegistryConfig {
    searchScoring: SearchScoringConfig;
    requiredAgents: string[];
}
export interface ProviderDefaultsConfig {
    maxRetries: number;
    timeout: number;
    rateLimitPerMinute: number;
}
export interface ProviderModelsConfig {
    claude: string;
    gemini: string;
    openai: string;
    codex: string;
}
export interface ProvidersConfig {
    defaults: ProviderDefaultsConfig;
    gemini: {
        rateLimitPerMinute: number;
    };
    models: ProviderModelsConfig;
}
export interface AgentRuntimeConfig {
    version: string;
    execution: ExecutionConfig;
    runtime: RuntimeConfig;
    temperatureProfiles: TemperatureProfiles;
    tokenLimits: TokenLimits;
    team: TeamConfig;
    registry: RegistryConfig;
    providers: ProvidersConfig;
}
/**
 * Load agent runtime configuration from YAML (with caching)
 */
export declare function loadAgentRuntimeConfig(): AgentRuntimeConfig;
/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export declare function clearAgentRuntimeConfigCache(): void;
//# sourceMappingURL=AgentRuntimeConfig.d.ts.map