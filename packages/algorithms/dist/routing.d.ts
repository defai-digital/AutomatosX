/**
 * TypeScript bindings for ReScript Routing module
 *
 * @module @ax/algorithms/routing
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
interface Provider {
    id: string;
    priority: number;
    healthy: boolean;
    rateLimit: number;
    latencyMs: number;
    successRate: number;
    integrationMode: 'mcp' | 'sdk' | 'bash';
}
interface RoutingContext {
    taskType: string;
    complexity: number;
    preferMcp: boolean;
    excludeProviders: string[];
    forceProvider?: string;
}
interface RoutingResult {
    provider: Provider | null;
    score: number;
    reason: string;
    alternatives: Array<{
        provider: Provider;
        score: number;
        reason: string;
    }>;
}
declare const defaultRoutingContext: RoutingContext;
/**
 * Calculate routing score for a provider
 */
declare function calculateScore(provider: Provider, ctx: RoutingContext): number;
/**
 * Select the best provider based on context
 */
declare function selectProvider(providers: Provider[], ctx?: RoutingContext): RoutingResult;
/**
 * Get providers sorted by preference for fallback
 */
declare function getFallbackOrder(providers: Provider[], ctx?: RoutingContext): Provider[];

export { type Provider, type RoutingContext, type RoutingResult, calculateScore, defaultRoutingContext, getFallbackOrder, selectProvider };
