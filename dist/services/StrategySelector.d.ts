/**
 * AutomatosX v8.0.0 - Strategy Selector
 *
 * Selects and adapts execution strategies based on failure patterns
 */
import type { Strategy, FailureAnalysis, IterationResult } from '../types/iterate.types.js';
/**
 * Built-in retry strategies
 */
export declare const BUILTIN_STRATEGIES: Strategy[];
/**
 * Strategy Selector
 *
 * Intelligently selects execution strategies based on:
 * - Failure patterns
 * - Historical success rates
 * - Error types
 * - Strategy priority
 */
export declare class StrategySelector {
    private strategyHistory;
    private mode;
    constructor(mode?: 'auto' | 'conservative' | 'aggressive');
    /**
     * Select initial strategy for first iteration
     */
    selectInitial(): Promise<Strategy>;
    /**
     * Select next strategy based on failure analysis
     */
    selectNext(previousStrategy: Strategy, failureAnalysis: FailureAnalysis, iterationHistory: IterationResult[]): Promise<Strategy>;
    /**
     * Record successful strategy for learning
     */
    recordSuccess(strategy: Strategy): void;
    /**
     * Get strategy history
     */
    getHistory(): Map<string, number>;
    /**
     * Reset strategy history
     */
    resetHistory(): void;
    /**
     * Find strategies applicable to error type
     */
    private findApplicableStrategies;
    /**
     * Select fallback strategy when no specific match
     */
    private selectFallbackStrategy;
    /**
     * Sort candidates by success history and priority
     */
    private sortCandidates;
    /**
     * Apply mode-specific selection logic
     */
    private applyModeSelection;
    /**
     * Get strategy by name
     */
    getStrategy(name: string): Strategy | undefined;
    /**
     * List all available strategies
     */
    listStrategies(): Strategy[];
}
//# sourceMappingURL=StrategySelector.d.ts.map