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
  // Gemini streaming flag - only define if not already defined
  const existingFlag = manager.getFlag('gemini_streaming');
  if (!existingFlag) {
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
    logger.info('Feature flag gemini_streaming initialized at 0%');
  } else {
    logger.info('Feature flag gemini_streaming already exists', {
      rolloutPercentage: existingFlag.rolloutPercentage
    });
  }
}

// Export for convenience
export const flagManager = getFlagManager();
