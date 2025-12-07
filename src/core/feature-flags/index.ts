/**
 * Feature Flags Module
 *
 * Exports feature flag management for gradual rollout of new features.
 *
 * @module core/feature-flags
 */

export {
  FeatureFlagManager,
  type FeatureFlag,
  type FlagContext,
  type FlagMetrics
} from './flag-manager.js';

export {
  getFlagManager,
  getDefaultFlagManager,
  clearFlagManagerInstances,
  PROVIDER_ARCHITECTURE_FLAGS,
  isSDKFirstModeEnabled,
  isMCPBidirectionalEnabled,
  isSDKFallbackEnabled,
  shouldShowDeprecationWarnings,
  shouldCollectProviderMetrics
} from './flags.js';
