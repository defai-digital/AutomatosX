/**
 * Feature flag configuration for ReScript integration
 */
export interface ReScriptFeatureConfig {
    enabled: boolean;
    rolloutPercentage: number;
    enableLogging: boolean;
}
/**
 * Individual feature flags for each ReScript module
 */
export interface ReScriptFeatureFlags {
    timestamp: ReScriptFeatureConfig;
    hybridSearch: ReScriptFeatureConfig;
    messageTransform: ReScriptFeatureConfig;
    statsAggregation: ReScriptFeatureConfig;
    global: {
        enabled: boolean;
        fallbackOnError: boolean;
        enablePerformanceTracking: boolean;
    };
}
/**
 * Get current feature flags
 */
export declare function getFeatureFlags(): Readonly<ReScriptFeatureFlags>;
/**
 * Update feature flags (for gradual rollout)
 */
export declare function updateFeatureFlags(updates: Partial<ReScriptFeatureFlags>): void;
/**
 * Reset feature flags to defaults
 */
export declare function resetFeatureFlags(): void;
/**
 * Check if a feature should use ReScript implementation
 *
 * Uses deterministic hashing for consistent user assignment
 * (same user always gets same variant)
 */
export declare function shouldUseReScript(feature: keyof Omit<ReScriptFeatureFlags, 'global'>, userId?: string): boolean;
/**
 * Log feature flag decision (for debugging)
 */
export declare function logFeatureFlagDecision(feature: keyof Omit<ReScriptFeatureFlags, 'global'>, useReScript: boolean, userId?: string): void;
/**
 * Preset configurations for common rollout stages
 */
export declare const ROLLOUT_PRESETS: {
    disabled: () => Partial<ReScriptFeatureFlags>;
    phase1_10percent: () => Partial<ReScriptFeatureFlags>;
    phase2_50percent: () => Partial<ReScriptFeatureFlags>;
    phase3_100percent: () => Partial<ReScriptFeatureFlags>;
    production: () => Partial<ReScriptFeatureFlags>;
};
/**
 * Apply a rollout preset
 */
export declare function applyRolloutPreset(preset: keyof typeof ROLLOUT_PRESETS): void;
/**
 * Get current rollout phase
 */
export declare function getCurrentPhase(): string;
/**
 * Get feature flag statistics
 */
export declare function getFeatureFlagStats(): {
    phase: string;
    globalEnabled: boolean;
    features: Record<string, {
        enabled: boolean;
        rollout: number;
    }>;
};
//# sourceMappingURL=ReScriptFeatureFlags.d.ts.map