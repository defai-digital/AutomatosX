/**
 * TestingAgent.ts
 * Advanced testing strategies and frameworks specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class TestingAgent extends AgentBase {
    constructor() {
        super({
            type: 'testing',
            name: 'Testing Specialist (Tessa)',
            description: 'Expert in test architecture, advanced testing strategies, and test frameworks. Specializes in comprehensive test coverage and quality assurance.',
            capabilities: [
                { name: 'Test Architecture', description: 'Design comprehensive test strategies', keywords: ['test architecture', 'test strategy', 'test plan', 'testing pyramid'] },
                { name: 'Test Frameworks', description: 'Select and configure test frameworks', keywords: ['jest', 'vitest', 'pytest', 'junit', 'testing framework'] },
                { name: 'Coverage Analysis', description: 'Analyze and improve test coverage', keywords: ['coverage', 'code coverage', 'branch coverage', 'istanbul'] },
                { name: 'Test Automation', description: 'Automate testing workflows', keywords: ['automation', 'ci/cd testing', 'test automation', 'continuous testing'] },
                { name: 'Test Data Management', description: 'Manage test data and fixtures', keywords: ['test data', 'fixtures', 'mocks', 'stubs', 'test doubles'] },
            ],
            specializations: ['Test Strategy', 'Jest', 'Vitest', 'Pytest', 'JUnit', 'Playwright', 'Cypress', 'Testing Library', 'Mocking', 'TDD/BDD'],
            temperature: 0.6,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside testing specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
        }
        context.monitoring.log('info', `Testing agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('test spec describe it expect');
            const pastSolutions = await context.memory.search('testing test strategy coverage');
            const prompt = this.buildTestingPrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseTestingArtifacts(response);
            await context.memory.store({ type: 'testing_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'testing' } };
        }
        catch (error) {
            context.monitoring.log('error', `Testing agent failed: ${error}`);
            throw error;
        }
    }
    buildTestingPrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide complete testing solution with:\n1. Test strategy and architecture (unit, integration, e2e)\n2. Test framework configuration\n3. Comprehensive test cases with AAA pattern\n4. Mock/stub setup for dependencies\n5. Test data and fixtures\n6. Coverage targets and measurement\n7. CI/CD integration for automated testing\n8. Performance and load testing considerations';
        return prompt;
    }
    parseTestingArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = 'test-code';
            if (language === 'typescript' || language === 'javascript') {
                if (content.includes('describe(') && content.includes('it(')) {
                    if (content.includes('vitest') || content.includes('from \'vitest\''))
                        name = 'vitest-test';
                    else if (content.includes('jest') || content.includes('from \'@jest'))
                        name = 'jest-test';
                    else
                        name = 'unit-test';
                }
                else if (content.includes('test(') && content.includes('expect(')) {
                    name = 'unit-test';
                }
                else if (content.includes('page.') || content.includes('playwright')) {
                    name = 'playwright-test';
                }
                else if (content.includes('cy.') || content.includes('cypress')) {
                    name = 'cypress-test';
                }
            }
            else if (language === 'python') {
                if (content.includes('def test_') || content.includes('import pytest'))
                    name = 'pytest-test';
                else if (content.includes('import unittest'))
                    name = 'unittest-test';
            }
            else if (language === 'java') {
                if (content.includes('@Test') || content.includes('import org.junit'))
                    name = 'junit-test';
            }
            else if (language === 'json') {
                if (content.includes('jest') || content.includes('coverage'))
                    name = 'jest-config';
                else if (content.includes('playwright'))
                    name = 'playwright-config';
            }
            artifacts.push({ type: 'code', name, content, metadata: { language, category: 'testing' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nTesting Context:\n- Follow testing pyramid (many unit tests, fewer integration, few e2e)\n- Use AAA pattern (Arrange, Act, Assert)\n- Aim for high coverage (>80% for critical paths)\n- Mock external dependencies for unit tests\n- Use realistic test data and fixtures\n- Test edge cases and error scenarios\n- Integrate tests into CI/CD pipeline\n- Balance test speed with comprehensiveness\n- Follow TDD/BDD principles when appropriate';
    }
}
//# sourceMappingURL=TestingAgent.js.map