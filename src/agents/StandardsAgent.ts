/**
 * StandardsAgent.ts
 * Standards, best practices, and compliance specialist
 * Phase 7: Agent System Implementation - Day 3
 */

import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions, TaskArtifact } from '../types/agents.types.js';

export class StandardsAgent extends AgentBase {
  constructor() {
    super({
      type: 'standards',
      name: 'Standards Specialist (Stan)',
      description: 'Expert in industry standards, best practices, and compliance. Specializes in WCAG, GDPR, SOC2, ISO, and other regulatory requirements.',
      capabilities: [
        { name: 'Compliance Standards', description: 'Ensure compliance with regulations', keywords: ['compliance', 'gdpr', 'hipaa', 'sox', 'regulation'] },
        { name: 'Security Standards', description: 'Apply security standards', keywords: ['security standards', 'soc2', 'iso 27001', 'pci dss'] },
        { name: 'Accessibility Standards', description: 'Ensure accessibility compliance', keywords: ['accessibility', 'wcag', 'a11y', 'section 508', 'aria'] },
        { name: 'Best Practices', description: 'Apply industry best practices', keywords: ['best practices', 'standards', 'conventions', 'guidelines'] },
        { name: 'Code Standards', description: 'Enforce coding standards', keywords: ['code standards', 'style guide', 'linting', 'formatting'] },
      ],
      specializations: ['WCAG', 'GDPR', 'SOC2', 'ISO 27001', 'HIPAA', 'PCI DSS', 'Accessibility', 'Code Standards', 'ESLint', 'Prettier', 'Industry Best Practices'],
      temperature: 0.5,
      maxTokens: 4000,
    });
  }

  protected async executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      return { success: false, message: `Outside standards specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
    }

    context.monitoring.log('info', `Standards agent handling: ${task.description}`);

    try {
      const relevantCode = await context.codeIntelligence.searchCode('standards compliance accessibility wcag');
      const pastSolutions = await context.memory.search('standards compliance best practices');
      const prompt = this.buildStandardsPrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseStandardsArtifacts(response);

      await context.memory.store({ type: 'standards_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });

      return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'standards' } };
    } catch (error) {
      context.monitoring.log('error', `Standards agent failed: ${error}`);
      throw error;
    }
  }

  private buildStandardsPrompt(task: Task, context: AgentContext, codeContext: any[], pastSolutions: any[]): string {
    let prompt = this.buildPrompt(task, context);
    prompt += '\n\nProvide comprehensive standards and compliance guidance with:\n1. Applicable standards and regulations\n2. Compliance requirements and checklist\n3. Implementation guidelines and code examples\n4. Best practices for the specific domain\n5. Common violations and how to avoid them\n6. Audit and verification procedures\n7. Documentation requirements\n8. Ongoing maintenance and monitoring';
    return prompt;
  }

  private parseStandardsArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();
      let name = 'standards-document';

      if (language === 'markdown' || language === 'md') {
        if (content.includes('# Compliance') || content.includes('# Standards')) name = 'compliance-checklist';
        else if (content.includes('# WCAG') || content.includes('# Accessibility')) name = 'accessibility-guide';
        else if (content.includes('# GDPR') || content.includes('# Privacy')) name = 'privacy-compliance';
        else if (content.includes('# SOC2') || content.includes('# ISO')) name = 'security-compliance';
        else if (content.includes('# Best Practices') || content.includes('# Guidelines')) name = 'best-practices';
        else if (content.includes('# Code Standards') || content.includes('# Style Guide')) name = 'code-standards';
      } else if (language === 'json' || language === 'yaml') {
        if (content.includes('eslint') || content.includes('rules')) name = 'eslint-config';
        else if (content.includes('prettier')) name = 'prettier-config';
      } else if (language === 'typescript' || language === 'javascript') {
        if (content.includes('aria-') || content.includes('role=')) name = 'accessibility-implementation';
      }

      artifacts.push({ type: 'document', name, content, metadata: { language, category: 'standards' } });
    }
    return artifacts;
  }

  protected getContextPrompt(): string {
    return '\nStandards and Compliance Context:\n- Stay current with latest standards and regulations\n- Follow industry-specific compliance requirements (GDPR, HIPAA, SOC2, etc.)\n- Implement WCAG 2.1 Level AA for accessibility\n- Use semantic HTML and ARIA attributes appropriately\n- Apply security best practices (OWASP, ISO 27001)\n- Enforce coding standards with linters and formatters\n- Document compliance measures and audit trails\n- Conduct regular compliance audits\n- Train teams on standards and best practices\n- Balance compliance with usability and performance';
  }
}
