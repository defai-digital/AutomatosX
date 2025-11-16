/**
 * AgentExecutionConfig.ts
 * REFACTORING #19: Load agent execution configuration from YAML
 * Replaces hard-coded retry/timeout constants in AgentBase
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
// BUG FIX #36: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// BUG FIX #32: Cache configuration to avoid redundant file reads
// All 21 AgentBase subclasses load this config in their constructor
let cachedConfig = null;
/**
 * Load agent execution configuration from YAML (with caching)
 */
export function loadAgentExecutionConfig() {
    // Return cached config if available
    if (cachedConfig) {
        return cachedConfig;
    }
    const configPath = join(__dirname, 'yaml', 'agent-execution-config.yaml');
    try {
        const yamlContent = readFileSync(configPath, 'utf-8');
        const config = YAML.parse(yamlContent);
        // Validate config
        if (!config.version || !config.backoff || !config.errors) {
            throw new Error('Invalid agent execution config: missing required fields');
        }
        // Validate ranges
        if (config.maxRetries < 1 || config.maxRetries > 10) {
            throw new Error('maxRetries must be between 1 and 10');
        }
        if (config.timeoutMs < 30000 || config.timeoutMs > 600000) {
            throw new Error('timeoutMs must be between 30000 and 600000');
        }
        if (config.backoff.baseMs < 100 || config.backoff.baseMs > 5000) {
            throw new Error('backoff.baseMs must be between 100 and 5000');
        }
        if (config.backoff.maxMs < 5000 || config.backoff.maxMs > 60000) {
            throw new Error('backoff.maxMs must be between 5000 and 60000');
        }
        if (config.backoff.multiplier < 1 || config.backoff.multiplier > 10) {
            throw new Error('backoff.multiplier must be between 1 and 10');
        }
        // Cache for future calls
        cachedConfig = config;
        return config;
    }
    catch (error) {
        // BUG FIX #37: Only cache default config for ENOENT errors
        // For validation/parse errors, don't cache so user can fix and retry
        const shouldCache = error instanceof Error && 'code' in error && error.code === 'ENOENT';
        console.warn('Failed to load agent execution config, using defaults:', error);
        const defaultConfig = getDefaultAgentExecutionConfig();
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
export function clearAgentExecutionConfigCache() {
    cachedConfig = null;
}
/**
 * Get default configuration (fallback if YAML fails to load)
 */
function getDefaultAgentExecutionConfig() {
    return {
        version: '1.0',
        maxRetries: 3,
        timeoutMs: 300000,
        backoff: {
            baseMs: 1000,
            maxMs: 10000,
            multiplier: 2,
        },
        errors: {
            logTraces: true,
            emitEvents: true,
        },
    };
}
//# sourceMappingURL=AgentExecutionConfig.js.map