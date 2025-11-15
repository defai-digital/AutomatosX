/**
 * WorkflowOptimizer.ts
 *
 * Optimize workflow execution plans for performance
 * Phase 5 Week 1: Performance Optimization
 */
import { WorkflowParser } from '../services/WorkflowParser.js';
/**
 * Optimization strategy
 */
export var OptimizationStrategy;
(function (OptimizationStrategy) {
    OptimizationStrategy["MINIMIZE_LATENCY"] = "minimize_latency";
    OptimizationStrategy["MINIMIZE_COST"] = "minimize_cost";
    OptimizationStrategy["BALANCED"] = "balanced";
    OptimizationStrategy["MINIMIZE_MEMORY"] = "minimize_memory";
})(OptimizationStrategy || (OptimizationStrategy = {}));
/**
 * WorkflowOptimizer - Optimize workflow execution plans
 */
export class WorkflowOptimizer {
    parser;
    constructor() {
        this.parser = new WorkflowParser();
    }
    /**
     * Optimize workflow execution plan
     */
    optimize(workflowDef, strategy = OptimizationStrategy.BALANCED) {
        // Build dependency graph
        const graph = this.parser.buildDependencyGraph(workflowDef);
        // Analyze workflow
        const analysis = this.analyzeWorkflow(workflowDef, graph);
        // Apply optimization strategy
        const optimized = this.applyOptimizations(workflowDef, graph, analysis, strategy);
        return optimized;
    }
    /**
     * Analyze workflow structure
     */
    analyzeWorkflow(workflowDef, graph) {
        const totalSteps = workflowDef.steps.length;
        const maxParallelism = Math.max(...graph.levels.map(level => level.length));
        // Find critical path (longest path through the DAG)
        const criticalPath = this.findCriticalPath(workflowDef, graph);
        const criticalPathDuration = this.estimateCriticalPathDuration(workflowDef, criticalPath);
        const hasOptionalSteps = workflowDef.steps.some(step => step.optional);
        const hasRetryPolicy = workflowDef.steps.some(step => step.retryPolicy);
        return {
            totalSteps,
            maxParallelism,
            criticalPath,
            criticalPathDuration,
            hasOptionalSteps,
            hasRetryPolicy,
        };
    }
    /**
     * Find critical path (longest path through DAG)
     */
    findCriticalPath(workflowDef, graph) {
        const stepDurations = new Map();
        const longestPaths = new Map();
        // Initialize durations
        for (const step of workflowDef.steps) {
            stepDurations.set(step.key, this.estimateStepDuration(step));
            longestPaths.set(step.key, [step.key]);
        }
        // Process levels in topological order
        for (const level of graph.levels) {
            for (const stepKey of level) {
                const step = workflowDef.steps.find(s => s.key === stepKey);
                const stepDuration = stepDurations.get(stepKey);
                // Find longest path to this step
                let maxDuration = 0;
                let longestPath = [];
                for (const depKey of step.dependencies) {
                    const depPath = longestPaths.get(depKey);
                    const depPathDuration = this.calculatePathDuration(workflowDef, depPath);
                    if (depPathDuration > maxDuration) {
                        maxDuration = depPathDuration;
                        longestPath = [...depPath];
                    }
                }
                // Update longest path for this step
                longestPaths.set(stepKey, [...longestPath, stepKey]);
            }
        }
        // Find overall longest path
        let criticalPath = [];
        let maxTotalDuration = 0;
        for (const [stepKey, path] of longestPaths) {
            const pathDuration = this.calculatePathDuration(workflowDef, path);
            if (pathDuration > maxTotalDuration) {
                maxTotalDuration = pathDuration;
                criticalPath = path;
            }
        }
        return criticalPath;
    }
    /**
     * Estimate step duration (placeholder - can be improved with historical data)
     */
    estimateStepDuration(step) {
        // Base duration on timeout or use default
        if (step.timeoutMs) {
            return step.timeoutMs * 0.5; // Assume 50% of timeout on average
        }
        // Default estimates based on agent type
        const agentDurations = {
            'backend': 5000,
            'frontend': 3000,
            'security': 2000,
            'quality': 4000,
            'devops': 6000,
        };
        return agentDurations[step.agent] || 3000; // Default 3 seconds
    }
    /**
     * Calculate total duration for a path
     */
    calculatePathDuration(workflowDef, path) {
        return path.reduce((total, stepKey) => {
            const step = workflowDef.steps.find(s => s.key === stepKey);
            return total + this.estimateStepDuration(step);
        }, 0);
    }
    /**
     * Estimate critical path duration
     */
    estimateCriticalPathDuration(workflowDef, criticalPath) {
        return this.calculatePathDuration(workflowDef, criticalPath);
    }
    /**
     * Apply optimization strategies
     */
    applyOptimizations(workflowDef, graph, analysis, strategy) {
        const optimizations = [];
        const nodes = [];
        // Build execution plan nodes
        for (const step of workflowDef.steps) {
            const node = graph.nodes.find(n => n.stepKey === step.key);
            nodes.push({
                stepKey: step.key,
                level: node.level,
                estimatedDurationMs: this.estimateStepDuration(step),
                estimatedCost: this.estimateStepCost(step),
                dependencies: step.dependencies,
                canParallelize: step.parallel,
                resourceRequirements: this.estimateResourceRequirements(step),
            });
        }
        // Group by levels
        const levels = [];
        for (const level of graph.levels) {
            const levelNodes = nodes.filter(node => level.includes(node.stepKey));
            levels.push(levelNodes);
        }
        // Apply strategy-specific optimizations
        switch (strategy) {
            case OptimizationStrategy.MINIMIZE_LATENCY:
                this.optimizeForLatency(levels, optimizations);
                break;
            case OptimizationStrategy.MINIMIZE_COST:
                this.optimizeForCost(levels, optimizations);
                break;
            case OptimizationStrategy.MINIMIZE_MEMORY:
                this.optimizeForMemory(levels, optimizations);
                break;
            case OptimizationStrategy.BALANCED:
            default:
                this.optimizeBalanced(levels, optimizations);
                break;
        }
        // Calculate totals
        const estimatedTotalDurationMs = this.calculateTotalDuration(levels);
        const estimatedTotalCost = this.calculateTotalCost(levels);
        const parallelismFactor = this.calculateParallelismFactor(levels);
        return {
            workflowId: workflowDef.name,
            strategy,
            levels,
            estimatedTotalDurationMs,
            estimatedTotalCost,
            parallelismFactor,
            optimizations,
            criticalPath: analysis.criticalPath,
        };
    }
    /**
     * Optimize for minimum latency
     */
    optimizeForLatency(levels, optimizations) {
        optimizations.push('maximize_parallelism');
        optimizations.push('prioritize_critical_path');
        // Enable parallelization for all non-dependent steps
        for (const level of levels) {
            for (const node of level) {
                node.canParallelize = true;
            }
        }
    }
    /**
     * Optimize for minimum cost
     */
    optimizeForCost(levels, optimizations) {
        optimizations.push('minimize_provider_calls');
        optimizations.push('batch_operations');
        // Reduce parallelism to minimize concurrent provider costs
        for (const level of levels) {
            if (level.length > 2) {
                optimizations.push(`reduce_concurrency_level_${levels.indexOf(level)}`);
            }
        }
    }
    /**
     * Optimize for minimum memory
     */
    optimizeForMemory(levels, optimizations) {
        optimizations.push('sequential_execution');
        optimizations.push('garbage_collection_hints');
        // Force sequential execution to minimize memory
        for (const level of levels) {
            for (const node of level) {
                node.canParallelize = false;
            }
        }
    }
    /**
     * Balanced optimization
     */
    optimizeBalanced(levels, optimizations) {
        optimizations.push('balanced_parallelism');
        optimizations.push('smart_batching');
        // Allow parallelism up to a reasonable limit
        for (const level of levels) {
            if (level.length > 5) {
                optimizations.push(`limit_concurrency_level_${levels.indexOf(level)}`);
            }
        }
    }
    /**
     * Estimate step cost (placeholder)
     */
    estimateStepCost(step) {
        // Rough cost estimates per agent call (in cents)
        const agentCosts = {
            'backend': 5,
            'frontend': 3,
            'security': 4,
            'quality': 6,
            'devops': 5,
        };
        return agentCosts[step.agent] || 3;
    }
    /**
     * Estimate resource requirements
     */
    estimateResourceRequirements(step) {
        // Simple heuristic based on agent type
        const resourceMap = {
            'backend': { memory: 'medium', cpu: 'medium' },
            'frontend': { memory: 'low', cpu: 'low' },
            'security': { memory: 'medium', cpu: 'high' },
            'quality': { memory: 'high', cpu: 'medium' },
            'devops': { memory: 'medium', cpu: 'high' },
        };
        return resourceMap[step.agent] || { memory: 'medium', cpu: 'medium' };
    }
    /**
     * Calculate total duration (considering parallelism)
     */
    calculateTotalDuration(levels) {
        return levels.reduce((total, level) => {
            // In a level, the longest step determines the level duration
            const maxDuration = Math.max(...level.map(node => node.estimatedDurationMs));
            return total + maxDuration;
        }, 0);
    }
    /**
     * Calculate total cost
     */
    calculateTotalCost(levels) {
        return levels.reduce((total, level) => {
            const levelCost = level.reduce((sum, node) => sum + node.estimatedCost, 0);
            return total + levelCost;
        }, 0);
    }
    /**
     * Calculate parallelism factor
     */
    calculateParallelismFactor(levels) {
        const totalSteps = levels.reduce((sum, level) => sum + level.length, 0);
        const totalLevels = levels.length;
        return totalLevels > 0 ? totalSteps / totalLevels : 1;
    }
    /**
     * Compare optimization results
     */
    compareOptimizations(workflowDef, originalPlan, optimizedPlan) {
        const durationImprovement = ((originalPlan.estimatedTotalDurationMs - optimizedPlan.estimatedTotalDurationMs) /
            originalPlan.estimatedTotalDurationMs) * 100;
        const costImprovement = ((originalPlan.estimatedTotalCost - optimizedPlan.estimatedTotalCost) /
            originalPlan.estimatedTotalCost) * 100;
        return {
            original: {
                levels: originalPlan.levels.length,
                totalDuration: originalPlan.estimatedTotalDurationMs,
                totalCost: originalPlan.estimatedTotalCost,
            },
            optimized: {
                levels: optimizedPlan.levels.length,
                totalDuration: optimizedPlan.estimatedTotalDurationMs,
                totalCost: optimizedPlan.estimatedTotalCost,
            },
            improvement: {
                durationPercent: durationImprovement,
                costPercent: costImprovement,
            },
            appliedOptimizations: optimizedPlan.optimizations,
        };
    }
}
//# sourceMappingURL=WorkflowOptimizer.js.map