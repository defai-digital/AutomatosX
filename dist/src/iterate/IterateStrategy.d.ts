/**
 * AutomatosX v8.0.0 - Iterate Strategy System
 *
 * Advanced strategies for autonomous task execution with adaptive retry logic
 * Supports 8 different strategies for different failure patterns
 */
/**
 * Task definition for iteration
 */
export interface Task {
    id: string;
    description: string;
    complexity: 'low' | 'medium' | 'high';
    provider?: string;
    agent?: string;
    timeout?: number;
    context?: Record<string, unknown>;
}
/**
 * Failure pattern classification
 */
export interface FailurePattern {
    type: 'timeout' | 'permission' | 'complexity' | 'rate-limit' | 'api-error' | 'unknown';
    count: number;
    consecutiveFailures: number;
    lastError?: string;
    averageLatency?: number;
}
/**
 * Strategy interface
 */
export interface Strategy {
    name: string;
    description: string;
    priority: number;
    /**
     * Check if strategy is applicable for given failure pattern
     */
    isApplicable(pattern: FailurePattern, task: Task): boolean;
    /**
     * Apply strategy to modify task
     */
    apply(task: Task, pattern: FailurePattern): Task;
    /**
     * Estimate success probability (0-1)
     */
    estimateSuccess(pattern: FailurePattern): number;
}
/**
 * Base strategy class
 */
export declare abstract class BaseStrategy implements Strategy {
    abstract name: string;
    abstract description: string;
    abstract priority: number;
    abstract isApplicable(pattern: FailurePattern, task: Task): boolean;
    abstract apply(task: Task, pattern: FailurePattern): Task;
    abstract estimateSuccess(pattern: FailurePattern): number;
    protected log(message: string): void;
}
/**
 * Strategy 1: Simple Retry
 * Just retry without modifications (good for transient errors)
 */
export declare class SimpleRetryStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern): boolean;
    apply(task: Task): Task;
    estimateSuccess(pattern: FailurePattern): number;
}
/**
 * Strategy 2: Exponential Backoff
 * Add delays between retries (good for rate limits, timeouts)
 */
export declare class ExponentialBackoffStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    private baseDelay;
    isApplicable(pattern: FailurePattern): boolean;
    apply(task: Task, pattern: FailurePattern): Task;
    estimateSuccess(pattern: FailurePattern): number;
}
/**
 * Strategy 3: Different Provider
 * Switch to different AI provider (Claude → Gemini → OpenAI)
 */
export declare class DifferentProviderStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    private providers;
    isApplicable(pattern: FailurePattern, task: Task): boolean;
    apply(task: Task): Task;
    estimateSuccess(): number;
}
/**
 * Strategy 4: Different Agent
 * Try different specialized agent
 */
export declare class DifferentAgentStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern, task: Task): boolean;
    apply(task: Task): Task;
    estimateSuccess(): number;
}
/**
 * Strategy 5: Simplify Task
 * Break complex task into smaller steps
 */
export declare class SimplifyTaskStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern, task: Task): boolean;
    apply(task: Task): Task;
    private simplifyDescription;
    estimateSuccess(pattern: FailurePattern): number;
}
/**
 * Strategy 6: Incremental Retry (NEW)
 * Process task in smaller increments instead of all-at-once
 */
export declare class IncrementalRetryStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern, task: Task): boolean;
    apply(task: Task): Task;
    estimateSuccess(): number;
}
/**
 * Strategy 7: Adaptive Parallelism (NEW)
 * Adjust concurrency based on failure patterns
 */
export declare class AdaptiveParallelismStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern): boolean;
    apply(task: Task, pattern: FailurePattern): Task;
    estimateSuccess(): number;
}
/**
 * Strategy 8: Circuit Breaker (NEW)
 * Temporarily disable failing components
 */
export declare class CircuitBreakerStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern): boolean;
    apply(task: Task): Task;
    estimateSuccess(): number;
}
/**
 * Strategy 9: Gradual Relaxation (NEW)
 * Gradually relax constraints (timeouts, quality thresholds)
 */
export declare class GradualRelaxationStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern): boolean;
    apply(task: Task): Task;
    estimateSuccess(pattern: FailurePattern): number;
}
/**
 * Strategy 10: Hybrid Approach (NEW)
 * Combine multiple strategies
 */
export declare class HybridApproachStrategy extends BaseStrategy {
    name: string;
    description: string;
    priority: number;
    isApplicable(pattern: FailurePattern): boolean;
    apply(task: Task, pattern: FailurePattern): Task;
    estimateSuccess(): number;
}
//# sourceMappingURL=IterateStrategy.d.ts.map