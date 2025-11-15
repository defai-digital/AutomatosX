/**
 * Integration Test Validator
 * Sprint 6 Day 59: Comprehensive integration testing and validation
 */
import { EventEmitter } from 'events';
/**
 * Integration test result
 */
export interface IntegrationTestResult {
    testId: string;
    name: string;
    category: 'plugin-marketplace' | 'operations' | 'migration-onboarding' | 'cross-component';
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    assertions: number;
    errors?: string[];
    warnings?: string[];
}
/**
 * Test scenario
 */
export interface TestScenario {
    id: string;
    name: string;
    description: string;
    category: 'plugin-marketplace' | 'operations' | 'migration-onboarding' | 'cross-component';
    steps: TestStep[];
    assertions: TestAssertion[];
}
/**
 * Test step
 */
export interface TestStep {
    action: string;
    component: string;
    parameters?: Record<string, unknown>;
    expectedOutput?: unknown;
}
/**
 * Test assertion
 */
export interface TestAssertion {
    description: string;
    validator: () => boolean | Promise<boolean>;
}
/**
 * Validation report
 */
export interface ValidationReport {
    id: string;
    startTime: number;
    endTime: number;
    duration: number;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
    results: IntegrationTestResult[];
    summary: {
        pluginMarketplace: {
            passed: number;
            failed: number;
        };
        operations: {
            passed: number;
            failed: number;
        };
        migrationOnboarding: {
            passed: number;
            failed: number;
        };
        crossComponent: {
            passed: number;
            failed: number;
        };
    };
}
/**
 * Integration Test Validator
 */
export declare class IntegrationTestValidator extends EventEmitter {
    private scenarios;
    private results;
    private reports;
    private reportCounter;
    constructor();
    /**
     * Register default integration test scenarios
     */
    private registerDefaultScenarios;
    /**
     * Register integration test scenario
     */
    registerScenario(scenario: TestScenario): void;
    /**
     * Run integration test scenario
     */
    runScenario(scenarioId: string): Promise<IntegrationTestResult>;
    /**
     * Execute test step
     */
    private executeStep;
    /**
     * Run assertion
     */
    private runAssertion;
    /**
     * Run all integration tests
     */
    runAllTests(): Promise<ValidationReport>;
    /**
     * Get category summary
     */
    private getCategorySummary;
    /**
     * Get scenario
     */
    getScenario(scenarioId: string): TestScenario | undefined;
    /**
     * Get all scenarios
     */
    getAllScenarios(): TestScenario[];
    /**
     * Get scenarios by category
     */
    getScenariosByCategory(category: 'plugin-marketplace' | 'operations' | 'migration-onboarding' | 'cross-component'): TestScenario[];
    /**
     * Get test result
     */
    getResult(testId: string): IntegrationTestResult | undefined;
    /**
     * Get all results
     */
    getAllResults(): IntegrationTestResult[];
    /**
     * Get report
     */
    getReport(reportId: string): ValidationReport | undefined;
    /**
     * Get all reports
     */
    getAllReports(): ValidationReport[];
    /**
     * Clear all results and reports
     */
    clearAll(): void;
}
/**
 * Create integration test validator
 */
export declare function createIntegrationTestValidator(): IntegrationTestValidator;
/**
 * Get global integration test validator
 */
export declare function getGlobalIntegrationTestValidator(): IntegrationTestValidator;
/**
 * Reset global integration test validator
 */
export declare function resetGlobalIntegrationTestValidator(): void;
//# sourceMappingURL=IntegrationTestValidator.d.ts.map