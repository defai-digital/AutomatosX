/**
 * WorkflowOptimizer.ts
 *
 * Optimize workflow execution plans for performance
 * Phase 5 Week 1: Performance Optimization
 */
import { WorkflowDefinition } from '../types/schemas/workflow.schema.js';
/**
 * Optimization strategy
 */
export declare enum OptimizationStrategy {
    MINIMIZE_LATENCY = "minimize_latency",// Execute as fast as possible
    MINIMIZE_COST = "minimize_cost",// Minimize provider costs
    BALANCED = "balanced",// Balance speed and cost
    MINIMIZE_MEMORY = "minimize_memory"
}
/**
 * Execution plan node
 */
export interface ExecutionPlanNode {
    stepKey: string;
    level: number;
    estimatedDurationMs: number;
    estimatedCost: number;
    dependencies: string[];
    canParallelize: boolean;
    resourceRequirements: {
        memory: 'low' | 'medium' | 'high';
        cpu: 'low' | 'medium' | 'high';
    };
}
/**
 * Optimized execution plan
 */
export interface OptimizedExecutionPlan {
    workflowId: string;
    strategy: OptimizationStrategy;
    levels: ExecutionPlanNode[][];
    estimatedTotalDurationMs: number;
    estimatedTotalCost: number;
    parallelismFactor: number;
    optimizations: string[];
    criticalPath: string[];
}
/**
 * Optimization result
 */
export interface OptimizationResult {
    original: {
        levels: number;
        totalDuration: number;
        totalCost: number;
    };
    optimized: {
        levels: number;
        totalDuration: number;
        totalCost: number;
    };
    improvement: {
        durationPercent: number;
        costPercent: number;
    };
    appliedOptimizations: string[];
}
/**
 * WorkflowOptimizer - Optimize workflow execution plans
 */
export declare class WorkflowOptimizer {
    private parser;
    constructor();
    /**
     * Optimize workflow execution plan
     */
    optimize(workflowDef: WorkflowDefinition, strategy?: OptimizationStrategy): OptimizedExecutionPlan;
    /**
     * Analyze workflow structure
     */
    private analyzeWorkflow;
    /**
     * Find critical path (longest path through DAG)
     */
    private findCriticalPath;
    /**
     * Estimate step duration (placeholder - can be improved with historical data)
     */
    private estimateStepDuration;
    /**
     * Calculate total duration for a path
     */
    private calculatePathDuration;
    /**
     * Estimate critical path duration
     */
    private estimateCriticalPathDuration;
    /**
     * Apply optimization strategies
     */
    private applyOptimizations;
    /**
     * Optimize for minimum latency
     */
    private optimizeForLatency;
    /**
     * Optimize for minimum cost
     */
    private optimizeForCost;
    /**
     * Optimize for minimum memory
     */
    private optimizeForMemory;
    /**
     * Balanced optimization
     */
    private optimizeBalanced;
    /**
     * Estimate step cost (placeholder)
     */
    private estimateStepCost;
    /**
     * Estimate resource requirements
     */
    private estimateResourceRequirements;
    /**
     * Calculate total duration (considering parallelism)
     */
    private calculateTotalDuration;
    /**
     * Calculate total cost
     */
    private calculateTotalCost;
    /**
     * Calculate parallelism factor
     */
    private calculateParallelismFactor;
    /**
     * Compare optimization results
     */
    compareOptimizations(workflowDef: WorkflowDefinition, originalPlan: OptimizedExecutionPlan, optimizedPlan: OptimizedExecutionPlan): OptimizationResult;
}
//# sourceMappingURL=WorkflowOptimizer.d.ts.map