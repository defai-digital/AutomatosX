// ============================================================================
// ReScriptFeatureFlags.test.ts - Feature flag system tests
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { getFeatureFlags, updateFeatureFlags, resetFeatureFlags, shouldUseReScript, applyRolloutPreset, getCurrentPhase, getFeatureFlagStats, } from '../../bridge/ReScriptFeatureFlags.js';
describe('ReScriptFeatureFlags', () => {
    beforeEach(() => {
        // Reset to defaults before each test
        resetFeatureFlags();
    });
    describe('Default Configuration', () => {
        it('should start with all features disabled', () => {
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(false);
            expect(flags.timestamp.enabled).toBe(false);
            expect(flags.hybridSearch.enabled).toBe(false);
            expect(flags.messageTransform.enabled).toBe(false);
            expect(flags.statsAggregation.enabled).toBe(false);
        });
        it('should have 0% rollout by default', () => {
            const flags = getFeatureFlags();
            expect(flags.timestamp.rolloutPercentage).toBe(0);
            expect(flags.hybridSearch.rolloutPercentage).toBe(0);
            expect(flags.messageTransform.rolloutPercentage).toBe(0);
            expect(flags.statsAggregation.rolloutPercentage).toBe(0);
        });
        it('should have fallbackOnError enabled by default', () => {
            const flags = getFeatureFlags();
            expect(flags.global.fallbackOnError).toBe(true);
        });
    });
    describe('Feature Flag Updates', () => {
        it('should update global flags', () => {
            updateFeatureFlags({
                global: {
                    enabled: true,
                    fallbackOnError: false,
                    enablePerformanceTracking: true,
                },
            });
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(true);
            expect(flags.global.fallbackOnError).toBe(false);
        });
        it('should update individual feature flags', () => {
            updateFeatureFlags({
                timestamp: {
                    enabled: true,
                    rolloutPercentage: 50,
                    enableLogging: false,
                },
            });
            const flags = getFeatureFlags();
            expect(flags.timestamp.enabled).toBe(true);
            expect(flags.timestamp.rolloutPercentage).toBe(50);
            expect(flags.timestamp.enableLogging).toBe(false);
        });
        it('should preserve other flags when updating partial config', () => {
            updateFeatureFlags({
                hybridSearch: {
                    enabled: true,
                    rolloutPercentage: 25,
                    enableLogging: true,
                },
            });
            const flags = getFeatureFlags();
            expect(flags.hybridSearch.enabled).toBe(true);
            expect(flags.timestamp.enabled).toBe(false); // Should remain unchanged
        });
    });
    describe('shouldUseReScript', () => {
        beforeEach(() => {
            // Enable global flag
            updateFeatureFlags({
                global: { enabled: true, fallbackOnError: true, enablePerformanceTracking: true },
            });
        });
        it('should return false when global flag is disabled', () => {
            updateFeatureFlags({
                global: { enabled: false, fallbackOnError: true, enablePerformanceTracking: true },
            });
            const useRs = shouldUseReScript('hybridSearch');
            expect(useRs).toBe(false);
        });
        it('should return false when feature is disabled', () => {
            updateFeatureFlags({
                hybridSearch: { enabled: false, rolloutPercentage: 100, enableLogging: false },
            });
            const useRs = shouldUseReScript('hybridSearch');
            expect(useRs).toBe(false);
        });
        it('should return false when rollout is 0%', () => {
            updateFeatureFlags({
                hybridSearch: { enabled: true, rolloutPercentage: 0, enableLogging: false },
            });
            const useRs = shouldUseReScript('hybridSearch');
            expect(useRs).toBe(false);
        });
        it('should return true when rollout is 100%', () => {
            updateFeatureFlags({
                hybridSearch: { enabled: true, rolloutPercentage: 100, enableLogging: false },
            });
            const useRs = shouldUseReScript('hybridSearch');
            expect(useRs).toBe(true);
        });
        it('should be deterministic for same userId', () => {
            updateFeatureFlags({
                hybridSearch: { enabled: true, rolloutPercentage: 50, enableLogging: false },
            });
            const result1 = shouldUseReScript('hybridSearch', 'user-123');
            const result2 = shouldUseReScript('hybridSearch', 'user-123');
            const result3 = shouldUseReScript('hybridSearch', 'user-123');
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });
        it('should assign users consistently at 50% rollout', () => {
            updateFeatureFlags({
                hybridSearch: { enabled: true, rolloutPercentage: 50, enableLogging: false },
            });
            const results = [];
            for (let i = 0; i < 100; i++) {
                results.push(shouldUseReScript('hybridSearch', `user-${i}`));
            }
            const trueCount = results.filter(r => r).length;
            // Should be approximately 50 (within reasonable variance)
            expect(trueCount).toBeGreaterThan(30);
            expect(trueCount).toBeLessThan(70);
        });
    });
    describe('Rollout Presets', () => {
        it('should apply disabled preset', () => {
            applyRolloutPreset('disabled');
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(false);
            expect(flags.hybridSearch.rolloutPercentage).toBe(0);
        });
        it('should apply phase1_10percent preset', () => {
            applyRolloutPreset('phase1_10percent');
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(true);
            expect(flags.timestamp.rolloutPercentage).toBe(10);
            expect(flags.hybridSearch.rolloutPercentage).toBe(10);
            expect(flags.messageTransform.rolloutPercentage).toBe(10);
            expect(flags.statsAggregation.rolloutPercentage).toBe(10);
            expect(flags.global.fallbackOnError).toBe(true);
        });
        it('should apply phase2_50percent preset', () => {
            applyRolloutPreset('phase2_50percent');
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(true);
            expect(flags.timestamp.rolloutPercentage).toBe(50);
            expect(flags.global.fallbackOnError).toBe(true);
        });
        it('should apply phase3_100percent preset', () => {
            applyRolloutPreset('phase3_100percent');
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(true);
            expect(flags.timestamp.rolloutPercentage).toBe(100);
            expect(flags.global.fallbackOnError).toBe(true);
            expect(flags.timestamp.enableLogging).toBe(false); // Logging disabled at 100%
        });
        it('should apply production preset', () => {
            applyRolloutPreset('production');
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(true);
            expect(flags.timestamp.rolloutPercentage).toBe(100);
            expect(flags.global.fallbackOnError).toBe(false); // No fallback in production
            expect(flags.timestamp.enableLogging).toBe(false);
        });
    });
    describe('getCurrentPhase', () => {
        it('should return "disabled" when global is disabled', () => {
            const phase = getCurrentPhase();
            expect(phase).toBe('disabled');
        });
        it('should return "phase1_10percent" at 10% rollout', () => {
            applyRolloutPreset('phase1_10percent');
            const phase = getCurrentPhase();
            expect(phase).toBe('phase1_10percent');
        });
        it('should return "phase2_50percent" at 50% rollout', () => {
            applyRolloutPreset('phase2_50percent');
            const phase = getCurrentPhase();
            expect(phase).toBe('phase2_50percent');
        });
        it('should return "phase3_100percent" at 100% with fallback', () => {
            applyRolloutPreset('phase3_100percent');
            const phase = getCurrentPhase();
            expect(phase).toBe('phase3_100percent');
        });
        it('should return "production" at 100% without fallback', () => {
            applyRolloutPreset('production');
            const phase = getCurrentPhase();
            expect(phase).toBe('production');
        });
        it('should return "mixed" when features have different percentages', () => {
            applyRolloutPreset('phase1_10percent');
            updateFeatureFlags({
                hybridSearch: { enabled: true, rolloutPercentage: 50, enableLogging: true },
            });
            const phase = getCurrentPhase();
            expect(phase).toBe('mixed');
        });
        it('should return custom percentage for non-standard rollouts', () => {
            updateFeatureFlags({
                global: { enabled: true, fallbackOnError: true, enablePerformanceTracking: true },
                timestamp: { enabled: true, rolloutPercentage: 75, enableLogging: false },
                hybridSearch: { enabled: true, rolloutPercentage: 75, enableLogging: false },
                messageTransform: { enabled: true, rolloutPercentage: 75, enableLogging: false },
                statsAggregation: { enabled: true, rolloutPercentage: 75, enableLogging: false },
            });
            const phase = getCurrentPhase();
            expect(phase).toBe('custom_75percent');
        });
    });
    describe('getFeatureFlagStats', () => {
        it('should return complete stats', () => {
            applyRolloutPreset('phase2_50percent');
            const stats = getFeatureFlagStats();
            expect(stats.phase).toBe('phase2_50percent');
            expect(stats.globalEnabled).toBe(true);
            expect(stats.features.timestamp.enabled).toBe(true);
            expect(stats.features.timestamp.rollout).toBe(50);
            expect(stats.features.hybridSearch.enabled).toBe(true);
            expect(stats.features.hybridSearch.rollout).toBe(50);
        });
        it('should reflect disabled state', () => {
            const stats = getFeatureFlagStats();
            expect(stats.phase).toBe('disabled');
            expect(stats.globalEnabled).toBe(false);
            expect(stats.features.timestamp.enabled).toBe(false);
        });
    });
    describe('resetFeatureFlags', () => {
        it('should reset to default configuration', () => {
            applyRolloutPreset('production');
            resetFeatureFlags();
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(false);
            expect(flags.timestamp.rolloutPercentage).toBe(0);
        });
        it('should reset all features', () => {
            updateFeatureFlags({
                global: { enabled: true, fallbackOnError: false, enablePerformanceTracking: false },
                timestamp: { enabled: true, rolloutPercentage: 100, enableLogging: false },
                hybridSearch: { enabled: true, rolloutPercentage: 100, enableLogging: false },
            });
            resetFeatureFlags();
            const flags = getFeatureFlags();
            expect(flags.global.enabled).toBe(false);
            expect(flags.timestamp.enabled).toBe(false);
            expect(flags.hybridSearch.enabled).toBe(false);
            expect(flags.timestamp.rolloutPercentage).toBe(0);
            expect(flags.hybridSearch.rolloutPercentage).toBe(0);
        });
    });
    describe('Edge Cases', () => {
        it('should handle rolloutPercentage boundaries', () => {
            updateFeatureFlags({
                global: { enabled: true, fallbackOnError: true, enablePerformanceTracking: true },
                hybridSearch: { enabled: true, rolloutPercentage: 0, enableLogging: false },
            });
            expect(shouldUseReScript('hybridSearch', 'user-1')).toBe(false);
            updateFeatureFlags({
                hybridSearch: { enabled: true, rolloutPercentage: 100, enableLogging: false },
            });
            expect(shouldUseReScript('hybridSearch', 'user-1')).toBe(true);
        });
        it('should handle missing userId gracefully', () => {
            updateFeatureFlags({
                global: { enabled: true, fallbackOnError: true, enablePerformanceTracking: true },
                hybridSearch: { enabled: true, rolloutPercentage: 50, enableLogging: false },
            });
            // Should not throw
            const result1 = shouldUseReScript('hybridSearch');
            const result2 = shouldUseReScript('hybridSearch');
            // Without userId, should use random (may differ)
            expect(typeof result1).toBe('boolean');
            expect(typeof result2).toBe('boolean');
        });
        it('should handle empty userId', () => {
            updateFeatureFlags({
                global: { enabled: true, fallbackOnError: true, enablePerformanceTracking: true },
                hybridSearch: { enabled: true, rolloutPercentage: 50, enableLogging: false },
            });
            const result = shouldUseReScript('hybridSearch', '');
            expect(typeof result).toBe('boolean');
        });
    });
    describe('Performance', () => {
        it('should handle rapid flag checks efficiently', () => {
            applyRolloutPreset('phase2_50percent');
            const startTime = performance.now();
            for (let i = 0; i < 10000; i++) {
                shouldUseReScript('hybridSearch', `user-${i}`);
            }
            const endTime = performance.now();
            const elapsed = endTime - startTime;
            // 10k checks should complete in under 100ms
            expect(elapsed).toBeLessThan(100);
        });
    });
});
//# sourceMappingURL=ReScriptFeatureFlags.test.js.map