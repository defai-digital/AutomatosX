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
export type RoutingStrategy = 'round-robin' | 'latency-based' | 'cost-based' | 'weighted' | 'model-specific' | 'failover';
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
export declare const MODEL_CAPABILITIES: Record<string, ProviderCapabilities>;
/**
 * Provider Pricing (per 1M tokens)
 */
export interface ProviderPricing {
    input: number;
    output: number;
}
export declare const PROVIDER_PRICING: Record<string, Record<string, ProviderPricing>>;
/**
 * Weighted Routing Configuration
 */
export interface WeightedProvider {
    provider: ProviderType;
    model?: string;
    weight: number;
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
    latencyWeightPercentage: number;
    costWeightPercentage: number;
    enableAdaptiveRouting: boolean;
    minSampleSize: number;
}
/**
 * Default Routing Configuration
 */
export declare const DEFAULT_ROUTING_CONFIG: AdvancedRoutingConfig;
/**
 * Geographic Routing Configuration
 */
export interface GeographicRouting {
    region: string;
    preferredProviders: ProviderType[];
    latencyBonus: number;
}
export declare const GEOGRAPHIC_ROUTING: GeographicRouting[];
/**
 * Helper Functions
 */
export declare function getModelCapabilities(model: string): ProviderCapabilities | undefined;
export declare function getProviderPricing(provider: ProviderType, model: string): ProviderPricing | undefined;
export declare function calculateRequestCost(provider: ProviderType, model: string, inputTokens: number, outputTokens: number): number;
export declare function matchesRoutingRule(rule: RoutingRule, request: {
    maxTokens?: number;
    requiresVision?: boolean;
    requiresTools?: boolean;
    estimatedCost?: number;
    maxLatency?: number;
}): boolean;
export declare function selectProviderByWeight(providers: WeightedProvider[]): WeightedProvider;
//# sourceMappingURL=routing.d.ts.map