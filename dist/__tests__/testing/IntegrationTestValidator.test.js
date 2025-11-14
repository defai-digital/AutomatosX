/**
 * Integration Test Validator Tests
 * Sprint 6 Day 59: Integration testing and validation tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegrationTestValidator, createIntegrationTestValidator, getGlobalIntegrationTestValidator, resetGlobalIntegrationTestValidator, } from '../../testing/IntegrationTestValidator.js';
describe('IntegrationTestValidator', () => {
    let validator;
    beforeEach(() => {
        validator = createIntegrationTestValidator();
    });
    describe('Default Scenarios', () => {
        it('should have plugin marketplace flow scenario', () => {
            const scenario = validator.getScenario('plugin-marketplace-flow');
            expect(scenario).toBeDefined();
            expect(scenario?.name).toBe('Plugin Marketplace Integration Flow');
            expect(scenario?.category).toBe('plugin-marketplace');
        });
        it('should have operations automation flow scenario', () => {
            const scenario = validator.getScenario('operations-automation-flow');
            expect(scenario).toBeDefined();
            expect(scenario?.name).toBe('Operations Automation Flow');
            expect(scenario?.category).toBe('operations');
        });
        it('should have migration onboarding flow scenario', () => {
            const scenario = validator.getScenario('migration-onboarding-flow');
            expect(scenario).toBeDefined();
            expect(scenario?.name).toBe('Migration and Onboarding Flow');
            expect(scenario?.category).toBe('migration-onboarding');
        });
        it('should have cross-component events scenario', () => {
            const scenario = validator.getScenario('cross-component-events');
            expect(scenario).toBeDefined();
            expect(scenario?.category).toBe('cross-component');
        });
        it('should have error handling integration scenario', () => {
            const scenario = validator.getScenario('error-handling-integration');
            expect(scenario).toBeDefined();
            expect(scenario?.name).toBe('Error Handling Integration');
        });
        it('should have performance integration scenario', () => {
            const scenario = validator.getScenario('performance-integration');
            expect(scenario).toBeDefined();
            expect(scenario?.name).toBe('Performance Under Load');
        });
        it('should have at least 6 default scenarios', () => {
            const allScenarios = validator.getAllScenarios();
            expect(allScenarios.length).toBeGreaterThanOrEqual(6);
        });
    });
    describe('Scenario Registration', () => {
        it('should register custom scenario', () => {
            const listener = vi.fn();
            validator.on('scenario-registered', listener);
            const customScenario = {
                id: 'custom',
                name: 'Custom Test',
                description: 'Test scenario',
                category: 'cross-component',
                steps: [],
                assertions: [],
            };
            validator.registerScenario(customScenario);
            const retrieved = validator.getScenario('custom');
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('Custom Test');
            expect(listener).toHaveBeenCalled();
        });
        it('should emit scenario-registered event', () => {
            const listener = vi.fn();
            validator.on('scenario-registered', listener);
            const scenario = {
                id: 'test',
                name: 'Test',
                description: 'Test',
                category: 'plugin-marketplace',
                steps: [],
                assertions: [],
            };
            validator.registerScenario(scenario);
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                scenarioId: 'test',
                name: 'Test',
                category: 'plugin-marketplace',
            }));
        });
    });
    describe('Scenario Execution', () => {
        it('should run scenario and return result', async () => {
            const listener = vi.fn();
            validator.on('scenario-started', listener);
            const result = await validator.runScenario('plugin-marketplace-flow');
            expect(result).toBeDefined();
            expect(result.testId).toBe('plugin-marketplace-flow');
            expect(result.status).toBe('passed');
            expect(result.duration).toBeGreaterThan(0);
            expect(listener).toHaveBeenCalled();
        });
        it('should emit scenario-completed event', async () => {
            const listener = vi.fn();
            validator.on('scenario-completed', listener);
            await validator.runScenario('operations-automation-flow');
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                scenarioId: 'operations-automation-flow',
                status: 'passed',
            }));
        });
        it('should throw error for non-existent scenario', async () => {
            await expect(validator.runScenario('non-existent')).rejects.toThrow('Scenario not found');
        });
        it('should track assertion count', async () => {
            const result = await validator.runScenario('plugin-marketplace-flow');
            expect(result.assertions).toBeGreaterThan(0);
        });
        it('should record execution duration', async () => {
            const result = await validator.runScenario('migration-onboarding-flow');
            expect(result.duration).toBeGreaterThan(0);
        });
    });
    describe('All Tests Execution', () => {
        it('should run all scenarios and generate report', async () => {
            const listener = vi.fn();
            validator.on('validation-started', listener);
            const report = await validator.runAllTests();
            expect(report).toBeDefined();
            expect(report.totalTests).toBeGreaterThanOrEqual(6);
            expect(report.passed).toBeGreaterThan(0);
            expect(report.coverage).toBeGreaterThan(0);
            expect(listener).toHaveBeenCalled();
        });
        it('should emit validation-completed event', async () => {
            const listener = vi.fn();
            validator.on('validation-completed', listener);
            await validator.runAllTests();
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                reportId: expect.any(String),
                passed: expect.any(Number),
                failed: expect.any(Number),
                skipped: expect.any(Number),
                coverage: expect.any(Number),
            }));
        });
        it('should calculate correct coverage', async () => {
            const report = await validator.runAllTests();
            expect(report.coverage).toBe((report.passed / report.totalTests) * 100);
        });
        it('should include all results in report', async () => {
            const report = await validator.runAllTests();
            expect(report.results.length).toBe(report.totalTests);
        });
        it('should categorize results correctly', async () => {
            const report = await validator.runAllTests();
            expect(report.summary.pluginMarketplace).toBeDefined();
            expect(report.summary.operations).toBeDefined();
            expect(report.summary.migrationOnboarding).toBeDefined();
            expect(report.summary.crossComponent).toBeDefined();
        });
        it('should track start and end times', async () => {
            const report = await validator.runAllTests();
            expect(report.startTime).toBeGreaterThan(0);
            expect(report.endTime).toBeGreaterThan(report.startTime);
            expect(report.duration).toBe(report.endTime - report.startTime);
        });
    });
    describe('Scenario Queries', () => {
        it('should get all scenarios', () => {
            const allScenarios = validator.getAllScenarios();
            expect(allScenarios.length).toBeGreaterThan(0);
            expect(allScenarios.some((s) => s.id === 'plugin-marketplace-flow')).toBe(true);
        });
        it('should get scenarios by category', () => {
            const pluginScenarios = validator.getScenariosByCategory('plugin-marketplace');
            expect(pluginScenarios.length).toBeGreaterThan(0);
            expect(pluginScenarios.every((s) => s.category === 'plugin-marketplace')).toBe(true);
        });
        it('should filter operations scenarios', () => {
            const operationsScenarios = validator.getScenariosByCategory('operations');
            expect(operationsScenarios.length).toBeGreaterThan(0);
            expect(operationsScenarios.some((s) => s.id === 'operations-automation-flow')).toBe(true);
        });
        it('should filter migration scenarios', () => {
            const migrationScenarios = validator.getScenariosByCategory('migration-onboarding');
            expect(migrationScenarios.length).toBeGreaterThan(0);
            expect(migrationScenarios.some((s) => s.id === 'migration-onboarding-flow')).toBe(true);
        });
        it('should filter cross-component scenarios', () => {
            const crossScenarios = validator.getScenariosByCategory('cross-component');
            expect(crossScenarios.length).toBeGreaterThan(0);
            expect(crossScenarios.some((s) => s.id === 'cross-component-events')).toBe(true);
        });
        it('should return undefined for non-existent scenario', () => {
            const scenario = validator.getScenario('non-existent');
            expect(scenario).toBeUndefined();
        });
    });
    describe('Result Queries', () => {
        it('should get test result after execution', async () => {
            await validator.runScenario('plugin-marketplace-flow');
            const result = validator.getResult('plugin-marketplace-flow');
            expect(result).toBeDefined();
            expect(result?.testId).toBe('plugin-marketplace-flow');
        });
        it('should get all results', async () => {
            await validator.runScenario('plugin-marketplace-flow');
            await validator.runScenario('operations-automation-flow');
            const allResults = validator.getAllResults();
            expect(allResults.length).toBe(2);
        });
        it('should return undefined for non-existent result', () => {
            const result = validator.getResult('non-existent');
            expect(result).toBeUndefined();
        });
    });
    describe('Report Queries', () => {
        it('should get report by ID', async () => {
            const generatedReport = await validator.runAllTests();
            const retrievedReport = validator.getReport(generatedReport.id);
            expect(retrievedReport).toBeDefined();
            expect(retrievedReport?.id).toBe(generatedReport.id);
        });
        it('should get all reports', async () => {
            await validator.runAllTests();
            await validator.runAllTests();
            const allReports = validator.getAllReports();
            expect(allReports.length).toBe(2);
        });
        it('should return undefined for non-existent report', () => {
            const report = validator.getReport('non-existent');
            expect(report).toBeUndefined();
        });
    });
    describe('Scenario Content', () => {
        it('should have test steps', () => {
            const scenario = validator.getScenario('plugin-marketplace-flow');
            expect(scenario?.steps).toBeDefined();
            expect(scenario?.steps.length).toBeGreaterThan(0);
        });
        it('should have assertions', () => {
            const scenario = validator.getScenario('operations-automation-flow');
            expect(scenario?.assertions).toBeDefined();
            expect(scenario?.assertions.length).toBeGreaterThan(0);
        });
        it('should have description', () => {
            const scenario = validator.getScenario('migration-onboarding-flow');
            expect(scenario?.description).toBeDefined();
            expect(scenario?.description.length).toBeGreaterThan(0);
        });
    });
    describe('Event Emission', () => {
        it('should emit step-executed events', async () => {
            const listener = vi.fn();
            validator.on('step-executed', listener);
            await validator.runScenario('plugin-marketplace-flow');
            expect(listener).toHaveBeenCalled();
        });
        it('should emit all-cleared event', () => {
            const listener = vi.fn();
            validator.on('all-cleared', listener);
            validator.clearAll();
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Clear Operations', () => {
        it('should clear all results and reports', async () => {
            await validator.runAllTests();
            await validator.runScenario('plugin-marketplace-flow');
            validator.clearAll();
            expect(validator.getAllResults().length).toBe(0);
            expect(validator.getAllReports().length).toBe(0);
        });
        it('should reset report counter', async () => {
            await validator.runAllTests();
            validator.clearAll();
            const report = await validator.runAllTests();
            expect(report.id).toBe('report-1');
        });
    });
    describe('Global Integration Test Validator', () => {
        beforeEach(() => {
            resetGlobalIntegrationTestValidator();
        });
        it('should get global validator', () => {
            const global = getGlobalIntegrationTestValidator();
            expect(global).toBeInstanceOf(IntegrationTestValidator);
        });
        it('should return same instance', () => {
            const validator1 = getGlobalIntegrationTestValidator();
            const validator2 = getGlobalIntegrationTestValidator();
            expect(validator1).toBe(validator2);
        });
        it('should reset global validator', () => {
            const validator1 = getGlobalIntegrationTestValidator();
            resetGlobalIntegrationTestValidator();
            const validator2 = getGlobalIntegrationTestValidator();
            expect(validator2).not.toBe(validator1);
        });
    });
});
//# sourceMappingURL=IntegrationTestValidator.test.js.map