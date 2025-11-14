/**
 * CostEstimator Utility
 *
 * Week 3-4 Implementation - Day 2
 * Estimates costs for workflow execution based on provider pricing,
 * token counts, and API call estimates
 */
import type { WorkflowDefinition, WorkflowStep, CostEstimate } from '../types/speckit.types.js';
/**
 * CostEstimator calculates workflow execution costs based on
 * provider pricing and estimated token usage
 */
export declare class CostEstimator {
    /**
     * Estimate cost for a single workflow step
     */
    estimateStepCost(step: WorkflowStep, provider?: string, model?: string, complexity?: 'low' | 'medium' | 'high'): CostEstimate;
    /**
     * Estimate total cost for entire workflow
     */
    estimateWorkflowCost(workflow: WorkflowDefinition, provider?: string, model?: string): CostEstimate;
    /**
     * Compare costs across different providers
     */
    compareProviders(workflow: WorkflowDefinition): Record<string, CostEstimate>;
    /**
     * Get cheapest provider option
     */
    getCheapestProvider(workflow: WorkflowDefinition): {
        provider: string;
        estimate: CostEstimate;
    };
    /**
     * Get fastest provider option (based on typical latency)
     */
    getFastestProvider(workflow: WorkflowDefinition): {
        provider: string;
        estimate: CostEstimate;
    };
    /**
     * Get balanced provider option (good price/performance ratio)
     */
    getBalancedProvider(workflow: WorkflowDefinition): {
        provider: string;
        estimate: CostEstimate;
    };
    /**
     * Determine workflow complexity based on step count and dependencies
     */
    private determineWorkflowComplexity;
    /**
     * Format cost as USD string
     */
    formatCost(cost: number): string;
    /**
     * Format token count with K/M suffixes
     */
    formatTokens(tokens: number): string;
    /**
     * Get available providers
     */
    getAvailableProviders(): string[];
    /**
     * Get available models for a provider
     */
    getAvailableModels(provider: string): string[];
    /**
     * Get pricing for a specific model
     */
    getModelPricing(provider: string, model: string): {
        input: number;
        output: number;
    } | null;
}
//# sourceMappingURL=CostEstimator.d.ts.map