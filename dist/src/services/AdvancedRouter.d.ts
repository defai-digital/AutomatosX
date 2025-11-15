/**
 * AdvancedRouter.ts
 *
 * Advanced routing strategies for intelligent provider selection.
 * Implements latency-based, cost-based, and adaptive routing.
 *
 * Phase 3 Week 2 Day 6-7: Advanced Routing Strategies
 */
import type { ProviderType, ProviderRequest } from '../types/schemas/provider.schema.js';
import { type AdvancedRoutingConfig } from '../config/routing.js';
/**
 * Routing Decision
 */
export interface RoutingDecision {
    provider: ProviderType;
    model: string;
    reason: string;
    estimatedCost: number;
    estimatedLatency: number;
    confidence: number;
    alternatives: Array<{
        provider: ProviderType;
        model: string;
        score: number;
    }>;
}
/**
 * AdvancedRouter provides intelligent provider selection
 */
export declare class AdvancedRouter {
    private db;
    private config;
    private metricsCache;
    private readonly cacheTTL;
    constructor(config?: Partial<AdvancedRoutingConfig>);
    /**
     * Select best provider based on routing strategy
     */
    selectProvider(request: ProviderRequest): Promise<RoutingDecision>;
    /**
     * Latency-based routing - select fastest provider
     */
    private selectByLatency;
    /**
     * Cost-based routing - select cheapest provider
     */
    private selectByCost;
    /**
     * Weighted routing - combine latency and cost
     */
    private selectByWeight;
    /**
     * Model-specific routing - match request requirements to model capabilities
     */
    private selectByModel;
    /**
     * Round-robin routing
     */
    private selectRoundRobin;
    /**
     * Failover routing - use primary with fallbacks
     */
    private selectFailover;
    /**
     * Get provider metrics
     */
    private getProviderMetrics;
    /**
     * Get all provider metrics
     */
    private getAllProviderMetrics;
    /**
     * Helper methods
     */
    private getDefaultModel;
    private estimateInputTokens;
    private getTotalRequestCount;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<AdvancedRoutingConfig>): void;
    /**
     * Clear metrics cache
     */
    clearCache(): void;
}
//# sourceMappingURL=AdvancedRouter.d.ts.map