/**
 * Test Analyzer
 *
 * Week 3-4 Implementation - Day 5
 * Analyzes workflows to determine test requirements
 */
import type { WorkflowDefinition, TestAnalysis } from '../types/speckit.types.js';
/**
 * Test Analyzer
 *
 * Analyzes workflow definitions to extract testable components,
 * identify dependencies, determine required mocks, and calculate coverage needs.
 */
export declare class TestAnalyzer {
    /**
     * Analyze workflow for test generation
     */
    analyze(workflow: WorkflowDefinition): TestAnalysis;
    /**
     * Extract testable steps from workflow
     */
    private extractTestableSteps;
    /**
     * Identify execution phases for integration tests
     */
    private identifyPhases;
    /**
     * Topological sort to find execution levels
     */
    private topologicalSort;
    /**
     * Build dependency map
     */
    private buildDependencyMap;
    /**
     * Identify required mocks for all steps
     */
    private identifyRequiredMocks;
    /**
     * Calculate coverage requirements
     */
    private calculateCoverageNeeds;
    /**
     * Detect if step has side effects
     */
    private detectSideEffects;
    /**
     * Determine required mocks for a step
     */
    private determineRequiredMocks;
    /**
     * Estimate step duration in milliseconds
     */
    private estimateStepDuration;
}
//# sourceMappingURL=TestAnalyzer.d.ts.map