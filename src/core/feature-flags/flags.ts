/**
 * Feature Flag Definitions
 *
 * Central registry of all feature flags in AutomatosX.
 *
 * v12.0.0: Added provider architecture feature flags for SDK-first
 * and MCP bidirectional communication patterns.
 *
 * @module core/feature-flags/flags
 */

import { FeatureFlagManager, type FeatureFlag } from './flag-manager.js';
import { logger } from '@/shared/logging/logger.js';

// Global flag manager instances per workspace
const flagManagerInstances = new Map<string, FeatureFlagManager>();

/**
 * v12.0.0 Provider Architecture Feature Flags
 *
 * These flags control the gradual rollout of the new provider architecture:
 * - SDK-first execution for GLM, Grok, and Codex
 * - MCP bidirectional communication for Claude and Gemini
 */
export const PROVIDER_ARCHITECTURE_FLAGS = {
  /** Enable SDK-first execution pattern (SDK primary, CLI fallback) */
  SDK_FIRST_MODE: 'sdk_first_mode',

  /** Enable MCP bidirectional communication for agentic providers */
  MCP_BIDIRECTIONAL: 'mcp_bidirectional',

  /** Auto-inject MCP server config into provider config files */
  AUTO_INJECT_MCP_CONFIG: 'auto_inject_mcp_config',

  /** Allow CLI fallback when SDK fails */
  SDK_FALLBACK_ENABLED: 'sdk_fallback_enabled',

  /** Show deprecation warnings (legacy providers, etc.) */
  DEPRECATION_WARNINGS: 'deprecation_warnings',

  /** Enable provider metrics collection */
  PROVIDER_METRICS: 'provider_metrics',
} as const;

/**
 * Default flag definitions for v12.0.0 provider architecture
 */
const DEFAULT_PROVIDER_FLAGS: FeatureFlag[] = [
  {
    name: PROVIDER_ARCHITECTURE_FLAGS.SDK_FIRST_MODE,
    description: 'Enable SDK-first execution pattern (SDK primary, CLI fallback) for GLM, Grok, and Codex providers',
    enabled: false,  // Disabled by default, enable in v11.7.0
    rolloutPercentage: 0,
    metadata: {
      owner: 'platform-team',
      expectedImpact: 'Lower latency (~5ms vs ~200ms), better type safety'
    }
  },
  {
    name: PROVIDER_ARCHITECTURE_FLAGS.MCP_BIDIRECTIONAL,
    description: 'Enable MCP bidirectional communication for Claude and Gemini agents',
    enabled: false,  // Disabled by default, enable in v11.8.0
    rolloutPercentage: 0,
    metadata: {
      owner: 'platform-team',
      expectedImpact: 'Faster agent communication via MCP instead of stdout parsing'
    }
  },
  {
    name: PROVIDER_ARCHITECTURE_FLAGS.AUTO_INJECT_MCP_CONFIG,
    description: 'Automatically inject AutomatosX MCP server config into provider config files',
    enabled: false,  // Disabled by default, requires careful testing
    rolloutPercentage: 0,
    metadata: {
      owner: 'platform-team',
      expectedImpact: 'Seamless MCP setup for agents'
    }
  },
  {
    name: PROVIDER_ARCHITECTURE_FLAGS.SDK_FALLBACK_ENABLED,
    description: 'Allow CLI fallback when SDK execution fails',
    enabled: true,   // Enabled by default for safety
    rolloutPercentage: 100,
    metadata: {
      owner: 'platform-team',
      expectedImpact: 'Graceful degradation when SDK unavailable'
    }
  },
  {
    name: PROVIDER_ARCHITECTURE_FLAGS.DEPRECATION_WARNINGS,
    description: 'Show deprecation warnings for legacy features',
    enabled: true,   // Enabled by default to warn users
    rolloutPercentage: 100,
    metadata: {
      owner: 'platform-team',
      expectedImpact: 'v13.0.0: ax-cli removed, GLM/Grok are SDK-first'
    }
  },
  {
    name: PROVIDER_ARCHITECTURE_FLAGS.PROVIDER_METRICS,
    description: 'Enable provider metrics collection (SDK/CLI usage, fallback rate, MCP connections)',
    enabled: true,   // Enabled by default for observability
    rolloutPercentage: 100,
    metadata: {
      owner: 'platform-team',
      expectedImpact: 'Better visibility into provider performance'
    }
  }
];

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

  // Initialize existing Gemini streaming flag
  initializeGeminiStreamingFlag(manager);

  // Initialize v12.0.0 provider architecture flags
  initializeProviderArchitectureFlags(manager);
}

/**
 * Initialize Gemini streaming flag (legacy)
 */
function initializeGeminiStreamingFlag(manager: FeatureFlagManager): void {
  const existingFlag = manager.getFlag('gemini_streaming');
  if (!existingFlag) {
    manager.defineFlag({
      name: 'gemini_streaming',
      description: 'Enable Gemini as a valid option for streaming workloads',
      enabled: true,
      rolloutPercentage: 0,
      metadata: {
        owner: 'platform-team',
        jiraTicket: 'AUTO-1234',
        expectedImpact: '96% cost reduction on streaming tasks'
      }
    });
    logger.info('Feature flag gemini_streaming initialized at 0%');
  }
}

/**
 * Initialize v12.0.0 provider architecture flags
 */
function initializeProviderArchitectureFlags(manager: FeatureFlagManager): void {
  for (const flagDef of DEFAULT_PROVIDER_FLAGS) {
    const existingFlag = manager.getFlag(flagDef.name);
    if (!existingFlag) {
      manager.defineFlag(flagDef);
      logger.info(`Feature flag ${flagDef.name} initialized`, {
        enabled: flagDef.enabled,
        rolloutPercentage: flagDef.rolloutPercentage
      });
    }
  }
}

/**
 * Helper to check if SDK-first mode is enabled
 */
export function isSDKFirstModeEnabled(context?: { provider?: string }): boolean {
  const manager = getFlagManager();
  return manager.isEnabled(PROVIDER_ARCHITECTURE_FLAGS.SDK_FIRST_MODE, context);
}

/**
 * Helper to check if MCP bidirectional is enabled
 */
export function isMCPBidirectionalEnabled(context?: { provider?: string }): boolean {
  const manager = getFlagManager();
  return manager.isEnabled(PROVIDER_ARCHITECTURE_FLAGS.MCP_BIDIRECTIONAL, context);
}

/**
 * Helper to check if SDK fallback is enabled
 */
export function isSDKFallbackEnabled(): boolean {
  const manager = getFlagManager();
  return manager.isEnabled(PROVIDER_ARCHITECTURE_FLAGS.SDK_FALLBACK_ENABLED);
}

/**
 * Helper to check if auto-inject MCP config is enabled
 */
export function isAutoInjectMCPConfigEnabled(): boolean {
  const manager = getFlagManager();
  return manager.isEnabled(PROVIDER_ARCHITECTURE_FLAGS.AUTO_INJECT_MCP_CONFIG);
}

/**
 * Helper to check if deprecation warnings should be shown
 */
export function shouldShowDeprecationWarnings(): boolean {
  const manager = getFlagManager();
  return manager.isEnabled(PROVIDER_ARCHITECTURE_FLAGS.DEPRECATION_WARNINGS);
}

/**
 * Helper to check if provider metrics should be collected
 */
export function shouldCollectProviderMetrics(): boolean {
  const manager = getFlagManager();
  return manager.isEnabled(PROVIDER_ARCHITECTURE_FLAGS.PROVIDER_METRICS);
}

/**
 * Clear flag manager instances (for testing)
 */
export function clearFlagManagerInstances(): void {
  flagManagerInstances.clear();
}

/**
 * Get the default flag manager instance
 *
 * Note: Use getFlagManager() directly for most cases.
 * This getter is provided for convenience but initializes lazily.
 */
export function getDefaultFlagManager(): FeatureFlagManager {
  return getFlagManager();
}
