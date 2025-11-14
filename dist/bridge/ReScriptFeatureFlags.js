// ============================================================================
// ReScriptFeatureFlags.ts - Feature flags for gradual ReScript rollout
// ============================================================================
//
// Controls which features use ReScript implementations vs TypeScript fallback
// Supports A/B testing and gradual rollout (10% → 50% → 100%)
//
// ============================================================================
/**
 * Default feature flags (conservative rollout)
 */
const DEFAULT_FLAGS = {
    timestamp: {
        enabled: false,
        rolloutPercentage: 0,
        enableLogging: true,
    },
    hybridSearch: {
        enabled: false,
        rolloutPercentage: 0,
        enableLogging: true,
    },
    messageTransform: {
        enabled: false,
        rolloutPercentage: 0,
        enableLogging: true,
    },
    statsAggregation: {
        enabled: false,
        rolloutPercentage: 0,
        enableLogging: true,
    },
    global: {
        enabled: false,
        fallbackOnError: true,
        enablePerformanceTracking: true,
    },
};
/**
 * Current feature flags (mutable for runtime updates)
 */
let currentFlags = { ...DEFAULT_FLAGS };
/**
 * Get current feature flags
 */
export function getFeatureFlags() {
    return currentFlags;
}
/**
 * Update feature flags (for gradual rollout)
 */
export function updateFeatureFlags(updates) {
    currentFlags = {
        ...currentFlags,
        ...updates,
    };
}
/**
 * Reset feature flags to defaults
 */
export function resetFeatureFlags() {
    currentFlags = { ...DEFAULT_FLAGS };
}
/**
 * Check if a feature should use ReScript implementation
 *
 * Uses deterministic hashing for consistent user assignment
 * (same user always gets same variant)
 */
export function shouldUseReScript(feature, userId) {
    // Check global switch
    if (!currentFlags.global.enabled) {
        return false;
    }
    const config = currentFlags[feature];
    // Check feature-specific switch
    if (!config.enabled) {
        return false;
    }
    // Check rollout percentage
    if (config.rolloutPercentage === 0) {
        return false;
    }
    if (config.rolloutPercentage === 100) {
        return true;
    }
    // Deterministic rollout based on userId (or random if no userId)
    const hash = userId ? simpleHash(userId) : Math.random() * 100;
    return hash < config.rolloutPercentage;
}
/**
 * Simple hash function for deterministic rollout
 * Maps string to 0-99 (percentage bucket)
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
}
/**
 * Log feature flag decision (for debugging)
 */
export function logFeatureFlagDecision(feature, useReScript, userId) {
    const config = currentFlags[feature];
    if (!config.enableLogging) {
        return;
    }
    console.log(`[ReScript Feature Flag] ${feature}:`, {
        useReScript,
        userId,
        enabled: config.enabled,
        rolloutPercentage: config.rolloutPercentage,
    });
}
/**
 * Preset configurations for common rollout stages
 */
export const ROLLOUT_PRESETS = {
    // Phase 0: Disabled (development only)
    disabled: () => ({
        global: {
            enabled: false,
            fallbackOnError: true,
            enablePerformanceTracking: true,
        },
        timestamp: { enabled: false, rolloutPercentage: 0, enableLogging: true },
        hybridSearch: { enabled: false, rolloutPercentage: 0, enableLogging: true },
        messageTransform: { enabled: false, rolloutPercentage: 0, enableLogging: true },
        statsAggregation: { enabled: false, rolloutPercentage: 0, enableLogging: true },
    }),
    // Phase 1: 10% rollout (initial testing)
    phase1_10percent: () => ({
        global: {
            enabled: true,
            fallbackOnError: true,
            enablePerformanceTracking: true,
        },
        timestamp: { enabled: true, rolloutPercentage: 10, enableLogging: true },
        hybridSearch: { enabled: true, rolloutPercentage: 10, enableLogging: true },
        messageTransform: { enabled: true, rolloutPercentage: 10, enableLogging: true },
        statsAggregation: { enabled: true, rolloutPercentage: 10, enableLogging: true },
    }),
    // Phase 2: 50% rollout (expanded testing)
    phase2_50percent: () => ({
        global: {
            enabled: true,
            fallbackOnError: true,
            enablePerformanceTracking: true,
        },
        timestamp: { enabled: true, rolloutPercentage: 50, enableLogging: true },
        hybridSearch: { enabled: true, rolloutPercentage: 50, enableLogging: true },
        messageTransform: { enabled: true, rolloutPercentage: 50, enableLogging: true },
        statsAggregation: { enabled: true, rolloutPercentage: 50, enableLogging: true },
    }),
    // Phase 3: 100% rollout (full migration)
    phase3_100percent: () => ({
        global: {
            enabled: true,
            fallbackOnError: true,
            enablePerformanceTracking: true,
        },
        timestamp: { enabled: true, rolloutPercentage: 100, enableLogging: false },
        hybridSearch: { enabled: true, rolloutPercentage: 100, enableLogging: false },
        messageTransform: { enabled: true, rolloutPercentage: 100, enableLogging: false },
        statsAggregation: { enabled: true, rolloutPercentage: 100, enableLogging: false },
    }),
    // Phase 4: Production (no fallback, minimal logging)
    production: () => ({
        global: {
            enabled: true,
            fallbackOnError: false, // Fail fast if ReScript has issues
            enablePerformanceTracking: false,
        },
        timestamp: { enabled: true, rolloutPercentage: 100, enableLogging: false },
        hybridSearch: { enabled: true, rolloutPercentage: 100, enableLogging: false },
        messageTransform: { enabled: true, rolloutPercentage: 100, enableLogging: false },
        statsAggregation: { enabled: true, rolloutPercentage: 100, enableLogging: false },
    }),
};
/**
 * Apply a rollout preset
 */
export function applyRolloutPreset(preset) {
    const config = ROLLOUT_PRESETS[preset]();
    updateFeatureFlags(config);
    console.log(`[ReScript Feature Flags] Applied preset: ${preset}`);
}
/**
 * Get current rollout phase
 */
export function getCurrentPhase() {
    const flags = getFeatureFlags();
    if (!flags.global.enabled) {
        return 'disabled';
    }
    // Check if all features are at same percentage
    const percentages = [
        flags.timestamp.rolloutPercentage,
        flags.hybridSearch.rolloutPercentage,
        flags.messageTransform.rolloutPercentage,
        flags.statsAggregation.rolloutPercentage,
    ];
    const allSame = percentages.every(p => p === percentages[0]);
    if (!allSame) {
        return 'mixed';
    }
    const pct = percentages[0];
    if (pct === 0)
        return 'disabled';
    if (pct === 10)
        return 'phase1_10percent';
    if (pct === 50)
        return 'phase2_50percent';
    if (pct === 100) {
        return flags.global.fallbackOnError ? 'phase3_100percent' : 'production';
    }
    return `custom_${pct}percent`;
}
/**
 * Get feature flag statistics
 */
export function getFeatureFlagStats() {
    const flags = getFeatureFlags();
    return {
        phase: getCurrentPhase(),
        globalEnabled: flags.global.enabled,
        features: {
            timestamp: {
                enabled: flags.timestamp.enabled,
                rollout: flags.timestamp.rolloutPercentage,
            },
            hybridSearch: {
                enabled: flags.hybridSearch.enabled,
                rollout: flags.hybridSearch.rolloutPercentage,
            },
            messageTransform: {
                enabled: flags.messageTransform.enabled,
                rollout: flags.messageTransform.rolloutPercentage,
            },
            statsAggregation: {
                enabled: flags.statsAggregation.enabled,
                rollout: flags.statsAggregation.rolloutPercentage,
            },
        },
    };
}
//# sourceMappingURL=ReScriptFeatureFlags.js.map