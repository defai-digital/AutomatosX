/**
 * AgentScoringConfig.ts
 * REFACTORING #18: Load agent scoring configuration from YAML
 * Replaces hard-coded scoring weights in AgentBase
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

// BUG FIX #36: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// BUG FIX #32: Cache configuration to avoid redundant file reads
// All 21 AgentBase subclasses load this config in their constructor
let cachedConfig: AgentScoringConfig | null = null;

/**
 * Load agent scoring configuration from YAML (with caching)
 */
export function loadAgentScoringConfig(): AgentScoringConfig {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = join(__dirname, 'yaml', 'agent-scoring-config.yaml');

  try {
    const yamlContent = readFileSync(configPath, 'utf-8');
    const config = YAML.parse(yamlContent) as AgentScoringConfig;

    // Validate config
    if (!config.version || config.minCapabilityScore === undefined) {
      throw new Error('Invalid agent scoring config: missing required fields');
    }

    // Validate ranges
    if (config.minCapabilityScore < 0 || config.minCapabilityScore > 1) {
      throw new Error('minCapabilityScore must be between 0 and 1');
    }

    // Cache for future calls
    cachedConfig = config;
    return config;
  } catch (error) {
    // BUG FIX #37: Only cache default config for ENOENT errors
    // For validation/parse errors, don't cache so user can fix and retry
    const shouldCache = error instanceof Error && 'code' in error && error.code === 'ENOENT';

    console.warn('Failed to load agent scoring config, using defaults:', error);
    const defaultConfig = getDefaultAgentScoringConfig();

    if (shouldCache) {
      cachedConfig = defaultConfig;
    }

    return defaultConfig;
  }
}

/**
 * Clear cached configuration (useful for testing and hot reload)
 * BUG FIX #34: Add cache invalidation for configuration loaders
 */
export function clearAgentScoringConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get default configuration (fallback if YAML fails to load)
 */
function getDefaultAgentScoringConfig(): AgentScoringConfig {
  return {
    version: '1.0',
    minCapabilityScore: 0.3,
    keywordMatchWeight: 1,
    specializationMatchWeight: 2,
    scoreNormalizationDivisor: 10,
    messages: {
      outsideSpecialization: 'Outside {specialization} specialization. Consider @{suggestion} agent.',
    },
  };
}
