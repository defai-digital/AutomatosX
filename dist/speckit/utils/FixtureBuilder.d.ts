/**
 * Fixture Builder
 *
 * Week 3-4 Implementation - Day 5
 * Generates test fixtures and sample data
 */
import type { WorkflowDefinition, TestableStep, FixtureFile } from '../types/speckit.types.js';
/**
 * Fixture Builder
 *
 * Generates test data fixtures for workflows, steps, errors, and edge cases.
 */
export declare class FixtureBuilder {
    /**
     * Generate all fixtures for a workflow
     */
    generateFixtures(workflow: WorkflowDefinition, steps: TestableStep[]): FixtureFile[];
    /**
     * Build workflow fixture
     */
    private buildWorkflowFixture;
    /**
     * Build steps fixture
     */
    private buildStepsFixture;
    /**
     * Build error fixtures
     */
    private buildErrorFixtures;
    /**
     * Build edge case fixtures
     */
    private buildEdgeCaseFixtures;
    /**
     * Estimate total duration
     */
    private estimateTotalDuration;
    /**
     * Estimate total cost
     */
    private estimateTotalCost;
    /**
     * Convert string to kebab-case
     */
    private kebabCase;
}
//# sourceMappingURL=FixtureBuilder.d.ts.map