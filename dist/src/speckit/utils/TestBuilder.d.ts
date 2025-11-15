/**
 * Test Builder
 *
 * Week 3-4 Implementation - Day 5
 * Builds test code from templates for different frameworks
 */
import type { WorkflowDefinition, TestableStep, TestPhase, TestFramework, TestFile } from '../types/speckit.types.js';
/**
 * Test Builder
 *
 * Generates test code using Handlebars templates.
 * Supports Vitest, Jest, and Mocha frameworks.
 */
export declare class TestBuilder {
    private framework;
    private templates;
    constructor(framework?: TestFramework);
    /**
     * Build unit test file
     */
    buildUnitTests(workflow: WorkflowDefinition, steps: TestableStep[]): TestFile;
    /**
     * Build integration test file
     */
    buildIntegrationTests(workflow: WorkflowDefinition, phases: TestPhase[]): TestFile;
    /**
     * Build E2E test file
     */
    buildE2ETests(workflow: WorkflowDefinition, steps: TestableStep[], phases: TestPhase[]): TestFile;
    /**
     * Register Handlebars templates
     */
    private registerTemplates;
    /**
     * Register Handlebars helpers
     */
    private registerHelpers;
    /**
     * Convert string to kebab-case
     */
    private kebabCase;
}
//# sourceMappingURL=TestBuilder.d.ts.map