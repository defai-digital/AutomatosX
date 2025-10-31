/**
 * Feature Flag Definitions
 *
 * Central registry of all feature flags in AutomatosX.
 *
 * @module core/feature-flags/flags
 */

import { FeatureFlagManager } from './flag-manager.js';
import { logger } from '@/utils/logger.js';

// Global flag manager instance
let flagManagerInstance: FeatureFlagManager | null = null;

/**
 * Get or create flag manager instance
 */
export function getFlagManager(): FeatureFlagManager {
  if (!flagManagerInstance) {
    flagManagerInstance = new FeatureFlagManager();
    initializeFlags(flagManagerInstance);
  }
  return flagManagerInstance;
}

/**
 * Initialize all feature flags
 */
function initializeFlags(manager: FeatureFlagManager): void {
  // Gemini streaming flag
  manager.defineFlag({
    name: 'gemini_streaming',
    description: 'Enable Gemini as a valid option for streaming workloads',
    enabled: true,
    rolloutPercentage: 0, // Start at 0%, increase gradually
    metadata: {
      owner: 'platform-team',
      jiraTicket: 'AUTO-1234',
      expectedImpact: '96% cost reduction on streaming tasks'
    }
  });

  logger.info('Feature flags initialized');
}

// Export for convenience
export const flagManager = getFlagManager();
