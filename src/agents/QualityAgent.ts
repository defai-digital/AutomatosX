/**
 * QualityAgent.ts
 *
 * Quality assurance and testing specialist
 * Phase 7: Agent System Implementation - Day 2
 */

import { AgentBase } from './AgentBase.js';
import {
  Task,
  TaskResult,
  AgentContext,
  AgentExecutionOptions,
  TaskArtifact,
} from '../types/agents.types.js';

/**
 * QualityAgent - QA and testing specialist
 *
 * Specializes in:
 * - Test strategy and planning
 * - Unit, integration, and E2E testing
 * - Code quality reviews
 * - Test automation
 * - Performance testing
 */
export class QualityAgent extends AgentBase {
  constructor() {
    super({
      type: 'quality',
      name: 'Quality Specialist (Queenie)',
      description:
        'Expert in quality assurance, testing strategies, code reviews, and test automation. Specializes in ensuring code quality and test coverage.',
      capabilities: [
        {
          name: 'Test Strategy',
          description: 'Design comprehensive test strategies',
          keywords: ['test', 'testing', 'strategy', 'plan', 'qa', 'quality'],
        },
        {
          name: 'Unit Testing',
          description: 'Write unit tests with Jest, Vitest, pytest',
          keywords: ['unit', 'test', 'jest', 'vitest', 'pytest', 'mock', 'spy'],
        },
        {
          name: 'Integration Testing',
          description: 'Design and implement integration tests',
          keywords: ['integration', 'test', 'api', 'database', 'service'],
        },
        {
          name: 'E2E Testing',
          description: 'Implement end-to-end tests with Playwright, Cypress',
          keywords: ['e2e', 'end-to-end', 'playwright', 'cypress', 'selenium'],
        },
        {
          name: 'Code Review',
          description: 'Perform code quality reviews',
          keywords: ['review', 'code review', 'quality', 'refactor', 'clean code'],
        },
      ],
      specializations: [
        'Jest',
        'Vitest',
        'Playwright',
        'Cypress',
        'pytest',
        'Testing Library',
        'TDD',
        'BDD',
        'Code Quality',
        'Test Automation',
      ],
      temperature: 0.6,
      maxTokens: 4000,
    });
  }

  protected async executeTask(
    task: Task,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      const suggestion = this.suggestDelegation(task);
      return {
        success: false,
        message: `This task is outside my QA specialization. Consider @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `Quality agent handling: ${task.description}`);

    try {
      // Find code to test
      const codeToTest = await context.codeIntelligence.searchCode(
        task.description.replace(/test|spec/gi, '')
      );

      // Check past test strategies
      const pastTests = await context.memory.search('test strategy coverage');

      const prompt = this.buildTestingPrompt(task, context, codeToTest.slice(0, 5), pastTests.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseTestArtifacts(response);

      await context.memory.store({
        type: 'test_strategy',
        agent: this.metadata.type,
        task: task.description,
        response,
        artifacts: artifacts.map((a) => ({ type: a.type, name: a.name })),
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: response,
        artifacts,
        metadata: {
          agent: this.metadata.type,
          capabilityScore: capability,
          testType: this.detectTestType(task.description),
        },
      };
    } catch (error) {
      context.monitoring.log('error', `Quality agent failed: ${error}`);
      throw error;
    }
  }

  private detectTestType(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('e2e') || lower.includes('end-to-end')) return 'e2e';
    if (lower.includes('integration')) return 'integration';
    if (lower.includes('unit')) return 'unit';
    return 'general';
  }

  private buildTestingPrompt(
    task: Task,
    context: AgentContext,
    codeContext: any[],
    pastTests: any[]
  ): string {
    let prompt = this.buildPrompt(task, context);

    if (codeContext.length > 0) {
      prompt += '\n\nCode to test:\n';
      codeContext.forEach((code, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(code).slice(0, 200)}...\n`;
      });
    }

    prompt += '\n\nProvide comprehensive testing solution with:';
    prompt += '\n1. Test strategy and coverage plan';
    prompt += '\n2. Test cases (unit/integration/e2e as appropriate)';
    prompt += '\n3. Mocking strategy for dependencies';
    prompt += '\n4. Edge cases and error scenarios';
    prompt += '\n5. Assertions and expectations';
    prompt += '\n6. Setup and teardown logic';

    return prompt;
  }

  private parseTestArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      // Determine if this is a test file
      const isTest = code.includes('describe(') || code.includes('it(') || code.includes('test(') || code.includes('expect(');

      artifacts.push({
        type: 'code',
        name: isTest ? `test-${language}` : `code-${language}`,
        content: code,
        metadata: { language, category: 'testing', isTest },
      });
    }

    return artifacts;
  }

  protected getContextPrompt(context: AgentContext): string {
    return `
Testing Context:
- Write comprehensive test cases (happy path + edge cases)
- Follow TDD/BDD best practices
- Use proper mocking for dependencies
- Ensure high code coverage (aim for 80%+)
- Test error handling and edge cases
- Use descriptive test names and assertions
- Follow AAA pattern (Arrange, Act, Assert)
`;
  }
}
