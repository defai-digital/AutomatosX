/**
 * ArchitectAgent.ts
 *
 * System architecture and design specialist
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
 * ArchitectAgent - Architecture specialist
 *
 * Specializes in:
 * - System architecture design
 * - Architecture Decision Records (ADRs)
 * - Design patterns and best practices
 * - Scalability and performance architecture
 * - Technology stack selection
 */
export class ArchitectAgent extends AgentBase {
  constructor() {
    super({
      type: 'architecture',
      name: 'Architecture Specialist (Avery)',
      description:
        'Expert in system architecture, design patterns, ADRs, and technology stack decisions. Specializes in designing scalable, maintainable systems.',
      capabilities: [
        {
          name: 'System Design',
          description: 'Design system architecture and components',
          keywords: ['architecture', 'design', 'system', 'component', 'module', 'layer'],
        },
        {
          name: 'ADRs',
          description: 'Create Architecture Decision Records',
          keywords: ['adr', 'decision', 'architecture decision', 'record'],
        },
        {
          name: 'Design Patterns',
          description: 'Apply design patterns and best practices',
          keywords: ['pattern', 'design pattern', 'solid', 'dry', 'kiss', 'yagni'],
        },
        {
          name: 'Scalability',
          description: 'Design for scale and performance',
          keywords: ['scalability', 'scale', 'performance', 'distributed', 'microservices'],
        },
        {
          name: 'Tech Stack',
          description: 'Select and evaluate technology stacks',
          keywords: ['technology', 'stack', 'framework', 'library', 'tool', 'evaluation'],
        },
      ],
      specializations: [
        'System Design',
        'Microservices',
        'Event-Driven Architecture',
        'Domain-Driven Design',
        'SOLID Principles',
        'ADRs',
        'Scalability',
        'Design Patterns',
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
        message: `This task is outside my architecture specialization. Consider @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `Architecture agent handling: ${task.description}`);

    try {
      // Search for existing architecture
      const existingArch = await context.codeIntelligence.searchCode(
        'architecture design pattern'
      );

      // Check past ADRs and decisions
      const pastDecisions = await context.memory.search('adr architecture decision');

      const prompt = this.buildArchitecturePrompt(task, context, existingArch.slice(0, 5), pastDecisions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseArchitectureArtifacts(response);

      await context.memory.store({
        type: 'architecture_decision',
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
          category: 'architecture',
        },
      };
    } catch (error) {
      context.monitoring.log('error', `Architecture agent failed: ${error}`);
      throw error;
    }
  }

  private buildArchitecturePrompt(
    task: Task,
    context: AgentContext,
    existingArch: any[],
    pastDecisions: any[]
  ): string {
    let prompt = this.buildPrompt(task, context);

    if (existingArch.length > 0) {
      prompt += '\n\nExisting architecture:\n';
      existingArch.forEach((arch, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(arch).slice(0, 200)}...\n`;
      });
    }

    if (pastDecisions.length > 0) {
      prompt += '\n\nPast architecture decisions:\n';
      pastDecisions.forEach((decision, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(decision).slice(0, 150)}...\n`;
      });
    }

    prompt += '\n\nProvide comprehensive architecture solution with:';
    prompt += '\n1. System design overview (components, layers, boundaries)';
    prompt += '\n2. Architecture Decision Record (ADR) if applicable';
    prompt += '\n3. Design patterns and principles applied';
    prompt += '\n4. Technology stack recommendations';
    prompt += '\n5. Scalability and performance considerations';
    prompt += '\n6. Trade-offs and alternatives considered';
    prompt += '\n7. Diagrams (Mermaid or ASCII art)';

    return prompt;
  }

  private parseArchitectureArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();

      let artifactType: 'code' | 'diagram' | 'document' = 'code';
      let artifactName = `${language}-artifact`;

      if (language === 'mermaid' || content.includes('graph') || content.includes('flowchart')) {
        artifactType = 'diagram';
        artifactName = 'architecture-diagram';
      } else if (language === 'markdown' || language === 'md') {
        artifactType = 'document';
        artifactName = 'architecture-doc';
      }

      artifacts.push({
        type: artifactType,
        name: artifactName,
        content,
        metadata: { language, category: 'architecture' },
      });
    }

    // Check if response contains ADR structure
    if (response.includes('# ADR') || response.includes('## Context') || response.includes('## Decision')) {
      artifacts.push({
        type: 'document',
        name: 'architecture-decision-record',
        content: response,
        metadata: { format: 'adr' },
      });
    }

    return artifacts;
  }

  protected getContextPrompt(context: AgentContext): string {
    return `
Architecture Context:
- Design for scalability, maintainability, and extensibility
- Follow SOLID principles and design patterns
- Document decisions with ADRs (Architecture Decision Records)
- Consider trade-offs (complexity vs. simplicity, performance vs. cost)
- Think long-term (maintainability, evolution, technical debt)
- Use diagrams to communicate design (Mermaid, C4, UML)
- Evaluate alternatives and justify choices
`;
  }
}
