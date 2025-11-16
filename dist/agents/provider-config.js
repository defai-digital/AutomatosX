/**
 * Provider configuration and constants
 * Centralized configuration for AI provider integration
 */
import { loadAgentRuntimeConfig } from '../config/AgentRuntimeConfig.js';
/**
 * Provider name constants
 */
export const PROVIDERS = {
    CLAUDE: 'claude',
    GEMINI: 'gemini',
    OPENAI: 'openai',
    CODEX: 'codex'
};
/**
 * REFACTORING #33: Load model names and provider config from YAML
 * This allows users to customize model versions without code changes
 */
const runtimeConfig = loadAgentRuntimeConfig();
/**
 * Model name constants (loaded from YAML)
 */
export const MODELS = {
    [PROVIDERS.CLAUDE]: runtimeConfig.providers.models.claude,
    [PROVIDERS.GEMINI]: runtimeConfig.providers.models.gemini,
    [PROVIDERS.OPENAI]: runtimeConfig.providers.models.openai,
    [PROVIDERS.CODEX]: runtimeConfig.providers.models.codex
};
/**
 * Get default provider router configuration
 * REFACTORING #33: Use YAML-configured provider settings
 */
export function getDefaultProviderConfig() {
    const defaults = runtimeConfig.providers.defaults;
    return {
        providers: {
            [PROVIDERS.CLAUDE]: {
                enabled: true,
                priority: 1,
                apiKey: process.env.ANTHROPIC_API_KEY || '',
                defaultModel: MODELS[PROVIDERS.CLAUDE],
                maxRetries: defaults.maxRetries,
                timeout: defaults.timeout,
                rateLimitPerMinute: defaults.rateLimitPerMinute
            },
            [PROVIDERS.GEMINI]: {
                enabled: true,
                priority: 2,
                apiKey: process.env.GEMINI_API_KEY || '',
                defaultModel: MODELS[PROVIDERS.GEMINI],
                maxRetries: defaults.maxRetries,
                timeout: defaults.timeout,
                rateLimitPerMinute: runtimeConfig.providers.gemini.rateLimitPerMinute
            },
            [PROVIDERS.OPENAI]: {
                enabled: true,
                priority: 3,
                apiKey: process.env.OPENAI_API_KEY || '',
                defaultModel: MODELS[PROVIDERS.OPENAI],
                maxRetries: defaults.maxRetries,
                timeout: defaults.timeout,
                rateLimitPerMinute: defaults.rateLimitPerMinute
            }
        },
        defaultProvider: PROVIDERS.CLAUDE,
        chaosMode: false
    };
}
/**
 * Get model name for a provider
 */
export function getModelForProvider(providerName) {
    return MODELS[providerName] || MODELS[PROVIDERS.CLAUDE];
}
//# sourceMappingURL=provider-config.js.map