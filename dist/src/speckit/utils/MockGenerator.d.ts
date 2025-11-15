/**
 * Mock Generator
 *
 * Week 3-4 Implementation - Day 5
 * Generates mock files for testing
 */
import type { MockRequirement, MockFile, TestFramework } from '../types/speckit.types.js';
/**
 * Mock Generator
 *
 * Generates mock implementations for agents, providers, database, and filesystem.
 */
export declare class MockGenerator {
    private framework;
    private templates;
    constructor(framework?: TestFramework);
    /**
     * Generate all mocks from requirements
     */
    generateMocks(requirements: MockRequirement[], workflowName: string): MockFile[];
    /**
     * Generate a single mock file
     */
    private generateMock;
    /**
     * Register Handlebars templates
     */
    private registerTemplates;
    /**
     * Register Handlebars helpers
     */
    private registerHelpers;
    /**
     * Convert string to PascalCase
     */
    private pascalCase;
    /**
     * Convert string to kebab-case
     */
    private kebabCase;
}
//# sourceMappingURL=MockGenerator.d.ts.map