/**
 * AgentScoringConfig.ts
 * REFACTORING #18: Load agent scoring configuration from YAML
 * Replaces hard-coded scoring weights in AgentBase
 */
export interface AgentScoringConfig {
    version: string;
    minCapabilityScore: number;
    keywordMatchWeight: number;
    specializationMatchWeight: number;
    scoreNormalizationDivisor: number;
    messages: {
        outsideSpecialization: string;
    };
}
/**
 * Load agent scoring configuration from YAML (with caching)
 */
export declare function loadAgentScoringConfig(): AgentScoringConfig;
/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export declare function clearAgentScoringConfigCache(): void;
//# sourceMappingURL=AgentScoringConfig.d.ts.map