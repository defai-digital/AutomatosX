/**
 * AutomatosX v8.0.0 - Iterate Engine
 *
 * Core engine for autonomous retry loops with adaptive strategies
 */
import type { WorkflowEngineV2 } from './WorkflowEngineV2.js';
import type { CheckpointServiceV2 } from './CheckpointServiceV2.js';
import { StrategySelector } from './StrategySelector.js';
import { FailureAnalyzer } from './FailureAnalyzer.js';
import { SafetyEvaluator } from './SafetyEvaluator.js';
import type { IterateOptions, IterateResult } from '../types/iterate.types.js';
/**
 * Iterate Engine
 *
 * Manages autonomous retry loops with:
 * - Strategy adaptation
 * - Failure analysis
 * - Safety constraints
 * - Progress tracking
 * - Checkpointing
 */
export declare class IterateEngine {
    private workflowEngine;
    private checkpointService;
    private strategySelector;
    private failureAnalyzer;
    private safetyEvaluator;
    constructor(workflowEngine: WorkflowEngineV2, checkpointService: CheckpointServiceV2, strategyMode?: 'auto' | 'conservative' | 'aggressive');
    /**
     * Execute workflow with autonomous retry loop
     */
    iterate(workflowPath: string, options: IterateOptions): Promise<IterateResult>;
    /**
     * Execute single iteration
     */
    private executeIteration;
    /**
     * Create checkpoint
     *
     * TODO: Checkpointing in IterateEngine requires access to the WorkflowStateMachine
     * which is only available inside WorkflowEngineV2. For now, checkpointing is disabled
     * in iterate mode. Future improvement: expose checkpoint API on WorkflowEngineV2.
     */
    private createCheckpoint;
    /**
     * Capture progress snapshot
     */
    private captureProgress;
    /**
     * Calculate total cost
     */
    private calculateTotalCost;
    /**
     * Log message (respects verbose flag)
     */
    private log;
    /**
     * Get strategy selector (for testing)
     */
    getStrategySelector(): StrategySelector;
    /**
     * Get failure analyzer (for testing)
     */
    getFailureAnalyzer(): FailureAnalyzer;
    /**
     * Get safety evaluator (for testing)
     */
    getSafetyEvaluator(): SafetyEvaluator;
}
//# sourceMappingURL=IterateEngine.d.ts.map