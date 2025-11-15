/**
 * AutomatosX v8.0.0 - Strategy Selector
 *
 * Intelligently selects the best retry strategy based on failure patterns
 * Uses priority-based selection with success probability estimation
 */
import type { Strategy, FailurePattern, Task } from './IterateStrategy.js';
/**
 * Strategy selection result
 */
export interface StrategySelection {
    strategy: Strategy;
    confidence: number;
    reason: string;
    alternatives: Array<{
        strategy: Strategy;
        confidence: number;
    }>;
}
/**
 * Strategy Selector
 *
 * Analyzes failure patterns and selects optimal recovery strategy
 */
export declare class StrategySelector {
    private strategies;
    constructor();
    /**
     * Select best strategy for given failure pattern and task
     */
    select(pattern: FailurePattern, task: Task, currentStrategy?: Strategy): StrategySelection;
    /**
     * Select initial strategy (before any failures)
     */
    selectInitial(task: Task): Strategy;
    /**
     * Score a strategy based on multiple factors
     */
    private scoreStrategy;
    /**
     * Check if strategy matches failure pattern
     */
    private isPatternMatch;
    /**
     * Check if strategy matches task complexity
     */
    private isComplexityMatch;
    /**
     * Get human-readable reason for strategy selection
     */
    private getSelectionReason;
    /**
     * Get all available strategies
     */
    getAllStrategies(): Strategy[];
    /**
     * Display strategy selection
     */
    displaySelection(selection: StrategySelection): void;
    /**
     * Format confidence percentage
     */
    private formatConfidence;
}
//# sourceMappingURL=StrategySelector.d.ts.map