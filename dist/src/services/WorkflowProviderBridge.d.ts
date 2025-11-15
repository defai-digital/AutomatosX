/**
 * WorkflowProviderBridge.ts
 *
 * Bridge between workflow engine and AI providers
 * Phase 4 Week 3: Integration & Testing
 */
import { WorkflowStep } from '../types/schemas/workflow.schema.js';
import { EventEmitter } from 'events';
/**
 * Provider response
 */
export interface ProviderResponse {
    content: string;
    model: string;
    provider: string;
    tokensUsed?: number;
    cost?: number;
    duration: number;
    metadata?: Record<string, unknown>;
}
/**
 * Provider configuration
 */
export interface ProviderConfig {
    provider: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}
/**
 * WorkflowProviderBridge - Route workflow steps to AI providers
 */
export declare class WorkflowProviderBridge extends EventEmitter {
    /**
     * Execute workflow step with appropriate provider
     */
    executeStep(step: WorkflowStep, prompt: string, context: Record<string, unknown>): Promise<ProviderResponse>;
    /**
     * Get provider configuration for agent
     */
    private getProviderConfig;
    /**
     * Call AI provider (placeholder - integrate with actual provider service)
     */
    private callProvider;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Batch execute multiple steps in parallel
     */
    executeBatch(steps: Array<{
        step: WorkflowStep;
        prompt: string;
        context: Record<string, unknown>;
    }>): Promise<ProviderResponse[]>;
    /**
     * Get provider statistics
     */
    getStats(): {
        totalCalls: number;
        totalTokens: number;
        totalCost: number;
        averageDuration: number;
    };
}
//# sourceMappingURL=WorkflowProviderBridge.d.ts.map