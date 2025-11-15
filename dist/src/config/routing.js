/**
 * routing.ts
 *
 * Advanced routing configuration for intelligent provider selection.
 * Supports latency-based, cost-based, and model-specific routing.
 *
 * Phase 3 Week 2 Day 6-7: Advanced Routing Strategies
 */
/**
 * Model Capabilities Registry
 */
export const MODEL_CAPABILITIES = {
    // Claude models
    'claude-3-5-sonnet-20241022': {
        maxTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsJson: true,
        contextWindow: 200000,
    },
    'claude-3-opus-20240229': {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsJson: true,
        contextWindow: 200000,
    },
    'claude-3-haiku-20240307': {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        supportsJson: true,
        contextWindow: 200000,
    },
    // Gemini models
    'gemini-1.5-pro-latest': {
        maxTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsJson: true,
        contextWindow: 2000000,
    },
    'gemini-1.5-flash-latest': {
        maxTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsJson: true,
        contextWindow: 1000000,
    },
    // OpenAI models
    'gpt-4-turbo-preview': {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        supportsJson: true,
        contextWindow: 128000,
    },
    'gpt-4': {
        maxTokens: 8192,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        supportsJson: true,
        contextWindow: 8192,
    },
    'gpt-3.5-turbo': {
        maxTokens: 4096,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        supportsJson: true,
        contextWindow: 16385,
    },
};
export const PROVIDER_PRICING = {
    claude: {
        'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
        'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
        'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    },
    gemini: {
        'gemini-1.5-pro-latest': { input: 1.25, output: 5.00 },
        'gemini-1.5-flash-latest': { input: 0.075, output: 0.30 },
        'gemini-1.0-pro': { input: 0.50, output: 1.50 },
    },
    openai: {
        'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
        'gpt-4': { input: 30.00, output: 60.00 },
        'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    },
};
/**
 * Default Routing Configuration
 */
export const DEFAULT_ROUTING_CONFIG = {
    strategy: 'latency-based',
    latencyWeightPercentage: 50,
    costWeightPercentage: 50,
    enableAdaptiveRouting: true,
    minSampleSize: 100,
    rules: [
        // Budget-conscious routing
        {
            name: 'budget',
            condition: {
                maxCost: 0.001, // $0.001 per request
            },
            preferredProviders: [
                { provider: 'gemini', model: 'gemini-1.5-flash-latest', weight: 60 },
                { provider: 'claude', model: 'claude-3-haiku-20240307', weight: 30 },
                { provider: 'openai', model: 'gpt-3.5-turbo', weight: 10 },
            ],
            fallbackProviders: ['gemini', 'claude', 'openai'],
        },
        // High-quality routing
        {
            name: 'quality',
            condition: {
                maxTokens: 4096,
            },
            preferredProviders: [
                { provider: 'claude', model: 'claude-3-5-sonnet-20241022', weight: 50 },
                { provider: 'openai', model: 'gpt-4-turbo-preview', weight: 30 },
                { provider: 'gemini', model: 'gemini-1.5-pro-latest', weight: 20 },
            ],
            fallbackProviders: ['claude', 'openai', 'gemini'],
        },
        // Vision-required routing
        {
            name: 'vision',
            condition: {
                requiresVision: true,
            },
            preferredProviders: [
                { provider: 'claude', model: 'claude-3-5-sonnet-20241022', weight: 40 },
                { provider: 'gemini', model: 'gemini-1.5-pro-latest', weight: 35 },
                { provider: 'openai', model: 'gpt-4-turbo-preview', weight: 25 },
            ],
            fallbackProviders: ['claude', 'gemini', 'openai'],
        },
        // Fast response routing
        {
            name: 'fast',
            condition: {
                maxLatency: 2000, // 2 seconds
            },
            preferredProviders: [
                { provider: 'gemini', model: 'gemini-1.5-flash-latest', weight: 50 },
                { provider: 'claude', model: 'claude-3-haiku-20240307', weight: 30 },
                { provider: 'openai', model: 'gpt-3.5-turbo', weight: 20 },
            ],
            fallbackProviders: ['gemini', 'claude', 'openai'],
        },
    ],
};
export const GEOGRAPHIC_ROUTING = [
    {
        region: 'us-east',
        preferredProviders: ['openai', 'claude', 'gemini'],
        latencyBonus: 0,
    },
    {
        region: 'us-west',
        preferredProviders: ['openai', 'claude', 'gemini'],
        latencyBonus: 0,
    },
    {
        region: 'eu-west',
        preferredProviders: ['claude', 'openai', 'gemini'],
        latencyBonus: 10,
    },
    {
        region: 'asia-pacific',
        preferredProviders: ['gemini', 'openai', 'claude'],
        latencyBonus: 15,
    },
];
/**
 * Helper Functions
 */
export function getModelCapabilities(model) {
    return MODEL_CAPABILITIES[model];
}
export function getProviderPricing(provider, model) {
    return PROVIDER_PRICING[provider]?.[model];
}
export function calculateRequestCost(provider, model, inputTokens, outputTokens) {
    const pricing = getProviderPricing(provider, model);
    if (!pricing)
        return 0;
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
}
export function matchesRoutingRule(rule, request) {
    const { condition } = rule;
    if (condition.maxTokens && request.maxTokens && request.maxTokens > condition.maxTokens) {
        return false;
    }
    if (condition.requiresVision && !request.requiresVision) {
        return false;
    }
    if (condition.requiresTools && !request.requiresTools) {
        return false;
    }
    if (condition.maxCost && request.estimatedCost && request.estimatedCost > condition.maxCost) {
        return false;
    }
    if (condition.maxLatency && request.maxLatency && request.maxLatency > condition.maxLatency) {
        return false;
    }
    return true;
}
export function selectProviderByWeight(providers) {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    for (const provider of providers) {
        random -= provider.weight;
        if (random <= 0) {
            return provider;
        }
    }
    return providers[providers.length - 1];
}
//# sourceMappingURL=routing.js.map