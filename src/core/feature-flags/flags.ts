/**
 * Feature Flag Definitions
 *
 * Central registry of all feature flags in AutomatosX.
 *
 * @module core/feature-flags/flags
 */

import { FeatureFlagManager } from './flag-manager.js';
import { logger } from '@/utils/logger.js';

// Global flag manager instances per workspace
const flagManagerInstances = new Map<string, FeatureFlagManager>();

/**
 * Get or create flag manager instance
 */
export function getFlagManager(workspacePath?: string): FeatureFlagManager {
  const path = workspacePath || process.cwd();

  if (!flagManagerInstances.has(path)) {
    const manager = new FeatureFlagManager(path);
    initializeFlags(manager);
    flagManagerInstances.set(path, manager);
  }

  return flagManagerInstances.get(path)!;
}

/**
 * Initialize all feature flags
 */
function initializeFlags(manager: FeatureFlagManager): void {
  if (!manager.hasStorage()) {
    logger.debug('Skipping feature flag initialization; workspace not initialized', {
      workspacePath: manager.getWorkspacePath()
    });
    return;
  }

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
