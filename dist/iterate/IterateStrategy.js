/**
 * AutomatosX v8.0.0 - Iterate Strategy System
 *
 * Advanced strategies for autonomous task execution with adaptive retry logic
 * Supports 8 different strategies for different failure patterns
 */
import chalk from 'chalk';
/**
 * Base strategy class
 */
export class BaseStrategy {
    log(message) {
        console.log(chalk.gray(`  [${this.name}] ${message}`));
    }
}
/**
 * Strategy 1: Simple Retry
 * Just retry without modifications (good for transient errors)
 */
export class SimpleRetryStrategy extends BaseStrategy {
    name = 'simple-retry';
    description = 'Retry task without modifications';
    priority = 1; // Lowest priority
    isApplicable(pattern) {
        return pattern.consecutiveFailures < 2 && pattern.type === 'unknown';
    }
    apply(task) {
        this.log('Retrying task without modifications');
        return { ...task };
    }
    estimateSuccess(pattern) {
        return 0.3 - (pattern.count * 0.1);
    }
}
/**
 * Strategy 2: Exponential Backoff
 * Add delays between retries (good for rate limits, timeouts)
 */
export class ExponentialBackoffStrategy extends BaseStrategy {
    name = 'exponential-backoff';
    description = 'Add exponential delays between retries';
    priority = 5;
    baseDelay = 1000; // 1 second
    isApplicable(pattern) {
        return pattern.type === 'timeout' || pattern.type === 'rate-limit';
    }
    apply(task, pattern) {
        const delay = this.baseDelay * Math.pow(2, pattern.consecutiveFailures);
        this.log(`Adding ${delay}ms backoff delay`);
        return {
            ...task,
            timeout: (task.timeout || 30000) + delay,
            context: {
                ...task.context,
                backoffDelay: delay
            }
        };
    }
    estimateSuccess(pattern) {
        return 0.7 - (pattern.consecutiveFailures * 0.15);
    }
}
/**
 * Strategy 3: Different Provider
 * Switch to different AI provider (Claude → Gemini → OpenAI)
 */
export class DifferentProviderStrategy extends BaseStrategy {
    name = 'different-provider';
    description = 'Try different AI provider';
    priority = 6;
    providers = ['claude', 'gemini', 'openai'];
    isApplicable(pattern, task) {
        return (pattern.type === 'api-error' ||
            pattern.type === 'rate-limit' ||
            (pattern.consecutiveFailures >= 2 && task.provider !== undefined));
    }
    apply(task) {
        const currentProvider = task.provider || 'claude';
        const currentIndex = this.providers.indexOf(currentProvider);
        const nextIndex = (currentIndex + 1) % this.providers.length;
        const nextProvider = this.providers[nextIndex];
        this.log(`Switching provider: ${currentProvider} → ${nextProvider}`);
        return {
            ...task,
            provider: nextProvider
        };
    }
    estimateSuccess() {
        return 0.65;
    }
}
/**
 * Strategy 4: Different Agent
 * Try different specialized agent
 */
export class DifferentAgentStrategy extends BaseStrategy {
    name = 'different-agent';
    description = 'Switch to different specialized agent';
    priority = 5;
    isApplicable(pattern, task) {
        return pattern.type === 'permission' || (pattern.consecutiveFailures >= 2 && task.agent !== undefined);
    }
    apply(task) {
        // Rotate to next agent (simplified - in production would use AgentRegistry)
        const fallbackAgent = task.agent === 'backend' ? 'frontend' : 'backend';
        this.log(`Switching agent: ${task.agent} → ${fallbackAgent}`);
        return {
            ...task,
            agent: fallbackAgent
        };
    }
    estimateSuccess() {
        return 0.6;
    }
}
/**
 * Strategy 5: Simplify Task
 * Break complex task into smaller steps
 */
export class SimplifyTaskStrategy extends BaseStrategy {
    name = 'simplify-task';
    description = 'Break complex task into simpler steps';
    priority = 7;
    isApplicable(pattern, task) {
        return pattern.type === 'complexity' || (task.complexity === 'high' && pattern.consecutiveFailures >= 2);
    }
    apply(task) {
        this.log('Simplifying task complexity');
        return {
            ...task,
            description: this.simplifyDescription(task.description),
            complexity: task.complexity === 'high' ? 'medium' : 'low'
        };
    }
    simplifyDescription(desc) {
        // Extract first sentence or main clause
        const sentences = desc.split(/[.!?]\s+/);
        return sentences[0] + (sentences.length > 1 ? ' (simplified)' : '');
    }
    estimateSuccess(pattern) {
        return 0.75 - (pattern.consecutiveFailures * 0.1);
    }
}
/**
 * Strategy 6: Incremental Retry (NEW)
 * Process task in smaller increments instead of all-at-once
 */
export class IncrementalRetryStrategy extends BaseStrategy {
    name = 'incremental-retry';
    description = 'Process task incrementally in smaller chunks';
    priority = 6;
    isApplicable(pattern, task) {
        return (task.complexity === 'high' &&
            pattern.consecutiveFailures >= 2 &&
            !task.context?.incremental);
    }
    apply(task) {
        this.log('Enabling incremental processing');
        return {
            ...task,
            context: {
                ...task.context,
                incremental: true,
                chunkSize: 'small'
            }
        };
    }
    estimateSuccess() {
        return 0.7;
    }
}
/**
 * Strategy 7: Adaptive Parallelism (NEW)
 * Adjust concurrency based on failure patterns
 */
export class AdaptiveParallelismStrategy extends BaseStrategy {
    name = 'adaptive-parallelism';
    description = 'Adjust task parallelism based on failures';
    priority = 4;
    isApplicable(pattern) {
        return pattern.type === 'rate-limit' || (!!pattern.averageLatency && pattern.averageLatency > 5000);
    }
    apply(task, pattern) {
        // Reduce parallelism if rate limited, increase if slow
        const currentConcurrency = typeof task.context?.concurrency === 'number' ? task.context.concurrency : 3;
        const newConcurrency = pattern.type === 'rate-limit'
            ? Math.max(1, Math.floor(currentConcurrency / 2))
            : Math.min(10, currentConcurrency + 1);
        this.log(`Adjusting concurrency: ${currentConcurrency} → ${newConcurrency}`);
        return {
            ...task,
            context: {
                ...task.context,
                concurrency: newConcurrency
            }
        };
    }
    estimateSuccess() {
        return 0.65;
    }
}
/**
 * Strategy 8: Circuit Breaker (NEW)
 * Temporarily disable failing components
 */
export class CircuitBreakerStrategy extends BaseStrategy {
    name = 'circuit-breaker';
    description = 'Temporarily disable failing components';
    priority = 8;
    isApplicable(pattern) {
        return pattern.consecutiveFailures >= 5;
    }
    apply(task) {
        this.log('Enabling circuit breaker mode');
        return {
            ...task,
            context: {
                ...task.context,
                circuitBreaker: {
                    enabled: true,
                    threshold: 3,
                    timeout: 60000 // 1 minute
                }
            }
        };
    }
    estimateSuccess() {
        return 0.5;
    }
}
/**
 * Strategy 9: Gradual Relaxation (NEW)
 * Gradually relax constraints (timeouts, quality thresholds)
 */
export class GradualRelaxationStrategy extends BaseStrategy {
    name = 'gradual-relaxation';
    description = 'Gradually relax task constraints';
    priority = 3;
    isApplicable(pattern) {
        return pattern.consecutiveFailures >= 3;
    }
    apply(task) {
        const currentTimeout = task.timeout || 30000;
        const newTimeout = Math.min(currentTimeout * 1.5, 300000); // Max 5 minutes
        this.log(`Relaxing timeout: ${currentTimeout}ms → ${newTimeout}ms`);
        return {
            ...task,
            timeout: newTimeout,
            context: {
                ...task.context,
                relaxed: true
            }
        };
    }
    estimateSuccess(pattern) {
        return 0.55 - (pattern.consecutiveFailures * 0.05);
    }
}
/**
 * Strategy 10: Hybrid Approach (NEW)
 * Combine multiple strategies
 */
export class HybridApproachStrategy extends BaseStrategy {
    name = 'hybrid-approach';
    description = 'Combine multiple recovery strategies';
    priority = 9; // Highest priority
    isApplicable(pattern) {
        return pattern.consecutiveFailures >= 4;
    }
    apply(task, pattern) {
        this.log('Applying hybrid recovery approach');
        // Combine: simplify + backoff + different provider
        const simplified = task.complexity === 'high' ? 'medium' : 'low';
        const delay = 2000 * Math.pow(2, Math.min(pattern.consecutiveFailures, 4));
        return {
            ...task,
            complexity: simplified,
            timeout: (task.timeout || 30000) + delay,
            provider: task.provider === 'claude' ? 'gemini' : 'claude',
            context: {
                ...task.context,
                hybrid: true,
                strategies: ['simplify', 'backoff', 'provider-switch']
            }
        };
    }
    estimateSuccess() {
        return 0.8;
    }
}
//# sourceMappingURL=IterateStrategy.js.map