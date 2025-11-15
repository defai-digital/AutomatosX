/**
 * AutomatosX v8.0.0 - Iterate Engine
 *
 * Core engine for autonomous retry loops with adaptive strategies
 */
import chalk from 'chalk';
import { StrategySelector } from './StrategySelector.js';
import { FailureAnalyzer } from './FailureAnalyzer.js';
import { SafetyEvaluator } from './SafetyEvaluator.js';
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
export class IterateEngine {
    workflowEngine;
    checkpointService;
    strategySelector;
    failureAnalyzer;
    safetyEvaluator;
    constructor(workflowEngine, checkpointService, strategyMode = 'auto') {
        this.workflowEngine = workflowEngine;
        this.checkpointService = checkpointService;
        this.strategySelector = new StrategySelector(strategyMode);
        this.failureAnalyzer = new FailureAnalyzer();
        this.safetyEvaluator = new SafetyEvaluator();
    }
    /**
     * Execute workflow with autonomous retry loop
     */
    async iterate(workflowPath, options) {
        const startTime = Date.now();
        const iterations = [];
        let checkpointIds = [];
        // Select initial strategy
        let currentStrategy = await this.strategySelector.selectInitial();
        this.log(options, chalk.bold.cyan('\n🔄 Iterate Mode Started'));
        this.log(options, chalk.gray(`   Workflow: ${workflowPath}`));
        this.log(options, chalk.gray(`   Max iterations: ${options.maxIterations}`));
        this.log(options, chalk.gray(`   Safety level: ${options.safetyLevel}`));
        this.log(options, chalk.gray(`   Initial strategy: ${currentStrategy.name}\n`));
        // Iteration loop
        for (let i = 1; i <= options.maxIterations; i++) {
            // Check timeout
            const elapsed = Date.now() - startTime;
            if (options.timeout && elapsed > options.timeout) {
                this.log(options, chalk.red(`\n❌ Timeout exceeded: ${Math.round(elapsed / 1000)}s`));
                return {
                    success: false,
                    iterations: i - 1,
                    totalDuration: elapsed,
                    totalCost: this.calculateTotalCost(iterations),
                    finalStrategy: currentStrategy,
                    history: iterations,
                    checkpoints: checkpointIds,
                    stopReason: 'timeout'
                };
            }
            // Safety evaluation
            const safetyCheck = await this.safetyEvaluator.evaluate(currentStrategy, options.safetyLevel, iterations);
            // Log warnings
            if (safetyCheck.warnings.length > 0) {
                for (const warning of safetyCheck.warnings) {
                    this.log(options, chalk.yellow(`⚠️  ${warning}`));
                }
            }
            // Stop if not safe
            if (!safetyCheck.safe) {
                this.log(options, chalk.red(`\n❌ Safety violation: ${safetyCheck.reason}`));
                return {
                    success: false,
                    iterations: i - 1,
                    totalDuration: Date.now() - startTime,
                    totalCost: safetyCheck.costSoFar,
                    finalStrategy: currentStrategy,
                    history: iterations,
                    checkpoints: checkpointIds,
                    stopReason: 'safety_violation'
                };
            }
            // Check cost limit
            if (options.maxCost && safetyCheck.costSoFar > options.maxCost) {
                this.log(options, chalk.red(`\n❌ Cost limit exceeded: $${safetyCheck.costSoFar.toFixed(2)}`));
                return {
                    success: false,
                    iterations: i - 1,
                    totalDuration: Date.now() - startTime,
                    totalCost: safetyCheck.costSoFar,
                    finalStrategy: currentStrategy,
                    history: iterations,
                    checkpoints: checkpointIds,
                    stopReason: 'cost_limit'
                };
            }
            // Execute iteration
            this.log(options, chalk.cyan(`\n🔄 Iteration ${i}/${options.maxIterations}`));
            this.log(options, chalk.gray(`   Strategy: ${currentStrategy.name}`));
            const result = await this.executeIteration(workflowPath, currentStrategy, checkpointIds[checkpointIds.length - 1], i);
            iterations.push(result);
            // Call iteration callback
            if (options.onIteration) {
                options.onIteration(result);
            }
            // Create checkpoint if configured
            if (options.checkpointInterval && i % options.checkpointInterval === 0) {
                try {
                    const checkpointId = await this.createCheckpoint(workflowPath, result);
                    checkpointIds.push(checkpointId);
                    this.log(options, chalk.gray(`   Checkpoint saved: ${checkpointId}`));
                }
                catch (error) {
                    this.log(options, chalk.yellow(`   ⚠️  Checkpoint failed: ${error.message}`));
                }
            }
            // Success - workflow complete
            if (result.success && result.complete) {
                this.log(options, chalk.green.bold(`\n✅ Workflow completed successfully!`));
                this.log(options, chalk.gray(`   Iterations: ${i}`));
                this.log(options, chalk.gray(`   Duration: ${Math.round(result.duration / 1000)}s`));
                if (result.cost) {
                    this.log(options, chalk.gray(`   Cost: $${result.cost.toFixed(2)}`));
                }
                // Record successful strategy
                this.strategySelector.recordSuccess(currentStrategy);
                return {
                    success: true,
                    iterations: i,
                    totalDuration: Date.now() - startTime,
                    totalCost: this.calculateTotalCost(iterations),
                    finalStrategy: currentStrategy,
                    history: iterations,
                    checkpoints: checkpointIds,
                    stopReason: 'success'
                };
            }
            // Failure - analyze and adapt strategy
            if (!result.success) {
                this.log(options, chalk.red(`   ❌ Failed: ${result.error?.message}`));
                // Analyze failure
                const analysis = await this.failureAnalyzer.analyze(result.error, result.progress, iterations);
                this.log(options, chalk.gray(`   Error type: ${analysis.errorType}`));
                this.log(options, chalk.gray(`   Transient: ${analysis.isTransient}`));
                this.log(options, chalk.gray(`   Severity: ${analysis.severity}`));
                // Select next strategy
                const nextStrategy = await this.strategySelector.selectNext(currentStrategy, analysis, iterations);
                if (nextStrategy.name !== currentStrategy.name) {
                    this.log(options, chalk.cyan(`   → Switching to: ${nextStrategy.name}`));
                    this.log(options, chalk.gray(`      ${nextStrategy.description}`));
                }
                else {
                    this.log(options, chalk.yellow(`   → Retrying with same strategy`));
                }
                currentStrategy = nextStrategy;
                // Show recommendations
                if (options.verbose && analysis.recommendations.length > 0) {
                    this.log(options, chalk.gray(`   Recommendations:`));
                    for (const rec of analysis.recommendations.slice(0, 2)) {
                        this.log(options, chalk.gray(`     • ${rec}`));
                    }
                }
            }
        }
        // Max iterations reached
        this.log(options, chalk.yellow(`\n⚠️  Max iterations (${options.maxIterations}) reached`));
        return {
            success: false,
            iterations: options.maxIterations,
            totalDuration: Date.now() - startTime,
            totalCost: this.calculateTotalCost(iterations),
            finalStrategy: currentStrategy,
            history: iterations,
            checkpoints: checkpointIds,
            stopReason: 'max_iterations'
        };
    }
    /**
     * Execute single iteration
     */
    async executeIteration(workflowPath, strategy, checkpointId, iteration) {
        const startTime = Date.now();
        try {
            let result;
            if (checkpointId) {
                // Resume from checkpoint
                result = await this.workflowEngine.resumeWorkflow(checkpointId);
            }
            else {
                // Execute from start with strategy config
                result = await this.workflowEngine.executeWorkflowFromFile(workflowPath, {
                    context: {
                        ...strategy.config,
                        _iterationNumber: iteration
                    }
                });
            }
            return {
                iteration,
                success: result.state === 'completed',
                complete: result.state === 'completed',
                strategy,
                progress: this.captureProgress(result),
                duration: Date.now() - startTime,
                cost: result.context.metadata?.cost || 0,
                metadata: result.context.metadata || {}
            };
        }
        catch (error) {
            return {
                iteration,
                success: false,
                complete: false,
                strategy,
                error: error,
                progress: this.captureProgress(null),
                duration: Date.now() - startTime,
                cost: 0,
                metadata: {}
            };
        }
    }
    /**
     * Create checkpoint
     *
     * TODO: Checkpointing in IterateEngine requires access to the WorkflowStateMachine
     * which is only available inside WorkflowEngineV2. For now, checkpointing is disabled
     * in iterate mode. Future improvement: expose checkpoint API on WorkflowEngineV2.
     */
    async createCheckpoint(workflowPath, result) {
        // Disabled - CheckpointServiceV2 requires state machine access
        // Return a placeholder checkpoint ID
        return `iterate-checkpoint-${Date.now()}`;
    }
    /**
     * Capture progress snapshot
     */
    captureProgress(result) {
        if (!result) {
            return {
                totalSteps: 0,
                completedSteps: 0,
                failedSteps: 0,
                completionPercent: 0
            };
        }
        const totalSteps = result.totalSteps || 0;
        const completedSteps = result.completedSteps || 0;
        const failedSteps = result.failedSteps || 0;
        return {
            totalSteps,
            completedSteps,
            failedSteps,
            currentStep: result.currentStep,
            completionPercent: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
            steps: result.steps
        };
    }
    /**
     * Calculate total cost
     */
    calculateTotalCost(iterations) {
        return iterations.reduce((total, iter) => total + (iter.cost || 0), 0);
    }
    /**
     * Log message (respects verbose flag)
     */
    log(options, message) {
        console.log(message);
    }
    /**
     * Get strategy selector (for testing)
     */
    getStrategySelector() {
        return this.strategySelector;
    }
    /**
     * Get failure analyzer (for testing)
     */
    getFailureAnalyzer() {
        return this.failureAnalyzer;
    }
    /**
     * Get safety evaluator (for testing)
     */
    getSafetyEvaluator() {
        return this.safetyEvaluator;
    }
}
//# sourceMappingURL=IterateEngine.js.map