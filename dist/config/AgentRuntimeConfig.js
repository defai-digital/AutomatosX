/**
 * AgentRuntimeConfig.ts
 * REFACTORING #33: Load agent runtime settings from YAML
 * Replaces hard-coded configuration in AgentExecutor, AgentRuntime, TeamManager, provider-config
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
// BUG FIX #36: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// BUG FIX #32: Cache configuration to avoid redundant file reads
// TeamManager and AgentExecutor both load this config, causing duplicate file reads
let cachedConfig = null;
/**
 * Load agent runtime configuration from YAML (with caching)
 */
export function loadAgentRuntimeConfig() {
    // Return cached config if available
    if (cachedConfig) {
        return cachedConfig;
    }
    const configPath = join(__dirname, 'yaml', 'agent-runtime-config.yaml');
    try {
        const yamlContent = readFileSync(configPath, 'utf-8');
        const config = YAML.parse(yamlContent);
        // Validate config
        // REFACTORING #36: Add validation for new temperature profiles and token limits
        if (!config.version || !config.execution || !config.runtime || !config.temperatureProfiles || !config.tokenLimits || !config.team || !config.registry || !config.providers) {
            throw new Error('Invalid agent runtime config: missing required fields');
        }
        // Cache for future calls
        cachedConfig = config;
        return config;
    }
    catch (error) {
        // BUG FIX #37: Only cache default config for ENOENT errors
        // For validation/parse errors, don't cache so user can fix and retry
        const shouldCache = error instanceof Error && 'code' in error && error.code === 'ENOENT';
        console.warn('Failed to load agent runtime config, using defaults:', error);
        const defaultConfig = getDefaultAgentRuntimeConfig();
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
export function clearAgentRuntimeConfigCache() {
    cachedConfig = null;
}
/**
 * Get default configuration (fallback if YAML fails to load)
 */
function getDefaultAgentRuntimeConfig() {
    return {
        version: '1.0',
        execution: {
            maxTaskLogLength: 100,
            defaultTemperature: 0.7,
            defaultMaxTokens: 8000,
        },
        runtime: {
            defaultMaxTokens: 4096,
            defaultTemperature: 1.0,
            defaultProviderTimeout: 60000,
        },
        // REFACTORING #36: Add default temperature profiles
        temperatureProfiles: {
            creative: 0.7,
            balanced: 0.6,
            precise: 0.5,
        },
        // REFACTORING #36: Add default token limits
        tokenLimits: {
            standard: 4000,
            fallback: 4000,
        },
        team: {
            maxDelegationDepth: 2,
            canWriteToShared: false,
        },
        registry: {
            searchScoring: {
                nameMatch: 3,
                descriptionMatch: 2,
                capabilityMatch: 2,
                keywordMatch: 1,
                specializationMatch: 2,
            },
            requiredAgents: ['backend', 'frontend', 'security', 'quality', 'devops', 'architecture', 'data', 'product'],
        },
        providers: {
            defaults: {
                maxRetries: 3,
                timeout: 60000,
                rateLimitPerMinute: 50,
            },
            gemini: {
                rateLimitPerMinute: 60,
            },
            models: {
                claude: 'claude-3-5-sonnet-20241022',
                gemini: 'gemini-2.0-flash-exp',
                openai: 'gpt-4-turbo-preview',
                codex: 'gpt-4-turbo-preview',
            },
        },
    };
}
//# sourceMappingURL=AgentRuntimeConfig.js.map