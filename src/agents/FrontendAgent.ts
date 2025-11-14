/**
 * FrontendAgent.ts
 *
 * Frontend development specialist
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
 * FrontendAgent - Frontend development specialist
 *
 * Specializes in:
 * - React/Next.js component development
 * - UI/UX implementation
 * - State management (Redux, Context, Zustand)
 * - Responsive design and accessibility
 * - Frontend performance optimization
 */
export class FrontendAgent extends AgentBase {
  constructor() {
    super({
      type: 'frontend',
      name: 'Frontend Specialist (Frank)',
      description:
        'Expert in frontend development, React/Next.js, UI/UX, state management, and modern frontend frameworks. Specializes in building responsive, accessible user interfaces.',
      capabilities: [
        {
          name: 'Component Development',
          description: 'Build React/Next.js components with TypeScript',
          keywords: ['component', 'react', 'next', 'jsx', 'tsx', 'hook', 'useState', 'useEffect'],
        },
        {
          name: 'UI/UX Implementation',
          description: 'Implement designs with CSS, Tailwind, Material-UI',
          keywords: ['ui', 'ux', 'design', 'css', 'tailwind', 'material', 'styled', 'theme'],
        },
        {
          name: 'State Management',
          description: 'Implement state management with Redux, Context, Zustand',
          keywords: ['state', 'redux', 'context', 'zustand', 'store', 'action', 'reducer'],
        },
        {
          name: 'Responsive Design',
          description: 'Create responsive, mobile-first designs',
          keywords: ['responsive', 'mobile', 'breakpoint', 'media', 'grid', 'flex'],
        },
        {
          name: 'Accessibility',
          description: 'Ensure WCAG compliance and accessibility',
          keywords: ['accessibility', 'a11y', 'wcag', 'aria', 'semantic', 'screen reader'],
        },
      ],
      specializations: [
        'React',
        'Next.js',
        'TypeScript',
        'Tailwind CSS',
        'Material-UI',
        'Redux',
        'React Query',
        'Responsive Design',
        'Accessibility',
        'Performance',
      ],
      temperature: 0.7,
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
        message: `This task is outside my frontend specialization. Consider @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `Frontend agent handling task: ${task.description}`);

    try {
      const relevantCode = await context.codeIntelligence.searchCode(
        task.description + ' component react'
      );
      const pastSolutions = await context.memory.search(task.description);

      const prompt = this.buildFrontendPrompt(task, context, relevantCode.slice(0, 3), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseArtifacts(response);

      await context.memory.store({
        type: 'agent_solution',
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
        metadata: { agent: this.metadata.type, capabilityScore: capability },
      };
    } catch (error) {
      context.monitoring.log('error', `Frontend agent failed: ${error}`);
      throw error;
    }
  }

  private buildFrontendPrompt(task: Task, context: AgentContext, codeContext: any[], memoryContext: any[]): string {
    let prompt = this.buildPrompt(task, context);

    if (codeContext.length > 0) {
      prompt += '\n\nExisting components in codebase:\n';
      codeContext.forEach((code, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(code).slice(0, 150)}...\n`;
      });
    }

    prompt += '\n\nProvide a complete frontend solution with:';
    prompt += '\n1. React/TypeScript component code with proper types';
    prompt += '\n2. CSS/Tailwind styling (responsive and accessible)';
    prompt += '\n3. State management if needed';
    prompt += '\n4. Event handlers and hooks';
    prompt += '\n5. Accessibility considerations (ARIA labels, semantic HTML)';
    prompt += '\n6. Mobile-first responsive design';

    return prompt;
  }

  private parseArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      artifacts.push({
        type: 'code',
        name: `${language}-component`,
        content: code,
        metadata: { language, framework: 'react' },
      });
    }

    return artifacts;
  }

  protected getContextPrompt(context: AgentContext): string {
    return `
Frontend Development Context:
- Focus on React/Next.js best practices
- Ensure responsive, mobile-first design
- Follow WCAG accessibility guidelines
- Use TypeScript for type safety
- Consider performance (code splitting, lazy loading)
- Use modern CSS (Tailwind, CSS Modules, or styled-components)
`;
  }
}
