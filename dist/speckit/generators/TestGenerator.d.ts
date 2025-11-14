/**
 * Test Generator
 *
 * Week 3-4 Implementation - Day 5
 * Generates comprehensive test suites from workflow definitions
 */
import type { WorkflowDefinition, TestOptions, TestResult } from '../types/speckit.types.js';
/**
 * Test Generator
 *
 * Main orchestrator for generating comprehensive test suites.
 * Coordinates analysis, building, and writing of test files.
 */
export declare class TestGenerator {
    private analyzer;
    private builder;
    private mockGenerator;
    private fixtureBuilder;
    constructor();
    /**
     * Generate comprehensive test suite for workflow
     */
    generateTests(workflow: WorkflowDefinition, options?: TestOptions): Promise<TestResult>;
    /**
     * Write all files to disk
     */
    private writeFiles;
    /**
     * Ensure directory exists
     */
    private ensureDirectory;
    /**
     * Calculate estimated coverage percentage
     */
    private calculateCoverage;
    /**
     * Build summary message
     */
    private buildSummary;
    /**
     * Convert string to kebab-case
     */
    private kebabCase;
}
//# sourceMappingURL=TestGenerator.d.ts.map