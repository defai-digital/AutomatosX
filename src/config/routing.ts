/**
 * routing.ts
 *
 * Advanced routing configuration for intelligent provider selection.
 * Supports latency-based, cost-based, and model-specific routing.
 *
 * Phase 3 Week 2 Day 6-7: Advanced Routing Strategies
 */

import type { ProviderType } from '../types/schemas/provider.schema.js';

/**
 * Routing Strategy Types
 */
export type RoutingStrategy =
  | 'round-robin'
  | 'latency-based'
  | 'cost-based'
  | 'weighted'
  | 'model-specific'
  | 'failover';

/**
 * Provider Capabilities
 */
export interface ProviderCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  contextWindow: number;
}

/**
 * Model Capabilities Registry
 */
export const MODEL_CAPABILITIES: Record<string, ProviderCapabilities> = {
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

/**
 * Provider Pricing (per 1M tokens)
 */
export interface ProviderPricing {
  input: number;  // Cost per 1M input tokens
  output: number; // Cost per 1M output tokens
}

export const PROVIDER_PRICING: Record<string, Record<string, ProviderPricing>> = {
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
 * Weighted Routing Configuration
 */
export interface WeightedProvider {
  provider: ProviderType;
  model?: string;
  weight: number; // 0-100
}

/**
 * Routing Rule
 */
export interface RoutingRule {
  name: string;
  condition: {
    maxTokens?: number;
    requiresVision?: boolean;
    requiresTools?: boolean;
    maxCost?: number;
    maxLatency?: number;
  };
  preferredProviders: WeightedProvider[];
  fallbackProviders?: ProviderType[];
}

/**
 * Advanced Routing Configuration
 */
export interface AdvancedRoutingConfig {
  strategy: RoutingStrategy;
  rules: RoutingRule[];
  latencyWeightPercentage: number; // 0-100, how much to weight latency vs cost
  costWeightPercentage: number;    // 0-100, how much to weight cost vs latency
  enableAdaptiveRouting: boolean;  // Learn from past performance
  minSampleSize: number;            // Minimum requests before adaptive routing
}

/**
 * Default Routing Configuration
 */
export const DEFAULT_ROUTING_CONFIG: AdvancedRoutingConfig = {
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

/**
 * Geographic Routing Configuration
 */
export interface GeographicRouting {
  region: string;
  preferredProviders: ProviderType[];
  latencyBonus: number; // Percentage reduction in estimated latency
}

export const GEOGRAPHIC_ROUTING: GeographicRouting[] = [
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

export function getModelCapabilities(model: string): ProviderCapabilities | undefined {
  return MODEL_CAPABILITIES[model];
}

export function getProviderPricing(provider: ProviderType, model: string): ProviderPricing | undefined {
  return PROVIDER_PRICING[provider]?.[model];
}

export function calculateRequestCost(
  provider: ProviderType,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getProviderPricing(provider, model);
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function matchesRoutingRule(rule: RoutingRule, request: {
  maxTokens?: number;
  requiresVision?: boolean;
  requiresTools?: boolean;
  estimatedCost?: number;
  maxLatency?: number;
}): boolean {
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

export function selectProviderByWeight(providers: WeightedProvider[]): WeightedProvider {
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
