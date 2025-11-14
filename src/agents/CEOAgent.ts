/**
 * CEOAgent.ts
 * Business leadership and strategic vision specialist
 * Phase 7: Agent System Implementation - Day 3
 */

import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions, TaskArtifact } from '../types/agents.types.js';

export class CEOAgent extends AgentBase {
  constructor() {
    super({
      type: 'ceo',
      name: 'CEO (Eric)',
      description: 'Expert in business strategy, company vision, and executive leadership. Provides high-level business guidance and strategic direction.',
      capabilities: [
        { name: 'Business Strategy', description: 'Define business strategy and vision', keywords: ['business strategy', 'vision', 'mission', 'strategic planning'] },
        { name: 'Market Analysis', description: 'Analyze market and competition', keywords: ['market', 'competition', 'market analysis', 'competitive advantage'] },
        { name: 'Stakeholder Management', description: 'Manage stakeholder relationships', keywords: ['stakeholder', 'investor', 'board', 'communication'] },
        { name: 'Growth Strategy', description: 'Plan growth and expansion', keywords: ['growth', 'expansion', 'scaling', 'revenue'] },
        { name: 'Company Culture', description: 'Build company culture and values', keywords: ['culture', 'values', 'mission', 'vision'] },
      ],
      specializations: ['Business Strategy', 'Market Analysis', 'Leadership', 'Growth Planning', 'Stakeholder Management', 'Company Culture', 'Strategic Partnerships', 'Financial Planning'],
      temperature: 0.7,
      maxTokens: 4000,
    });
  }

  protected async executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      return { success: false, message: `Outside CEO specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
    }

    context.monitoring.log('info', `CEO agent handling: ${task.description}`);

    try {
      const relevantCode = await context.codeIntelligence.searchCode('business strategy vision mission');
      const pastSolutions = await context.memory.search('business strategy growth vision');
      const prompt = this.buildCEOPrompt(task, context, relevantCode.slice(0, 3), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseCEOArtifacts(response);

      await context.memory.store({ type: 'ceo_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });

      return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'leadership' } };
    } catch (error) {
      context.monitoring.log('error', `CEO agent failed: ${error}`);
      throw error;
    }
  }

  private buildCEOPrompt(task: Task, context: AgentContext, codeContext: any[], pastSolutions: any[]): string {
    let prompt = this.buildPrompt(task, context);
    prompt += '\n\nProvide comprehensive business leadership guidance with:\n1. Business vision and strategic direction\n2. Market analysis and competitive positioning\n3. Growth strategy and revenue opportunities\n4. Stakeholder communication plan\n5. Company culture and values\n6. Strategic partnerships and alliances\n7. Risk assessment from business perspective\n8. Financial planning and resource allocation\n9. Key business metrics and OKRs';
    return prompt;
  }

  private parseCEOArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();
      let name = 'business-document';

      if (language === 'markdown' || language === 'md') {
        if (content.includes('# Business Strategy') || content.includes('# Strategic Plan')) name = 'business-strategy';
        else if (content.includes('# Vision') || content.includes('# Mission')) name = 'vision-document';
        else if (content.includes('# Market Analysis') || content.includes('# Competitive')) name = 'market-analysis';
        else if (content.includes('# Growth') || content.includes('# Expansion')) name = 'growth-plan';
        else if (content.includes('# OKR') || content.includes('# Objectives')) name = 'okr-document';
      } else if (language === 'mermaid') {
        name = 'business-diagram';
      }

      artifacts.push({ type: 'document', name, content, metadata: { language, category: 'leadership' } });
    }
    return artifacts;
  }

  protected getContextPrompt(): string {
    return '\nCEO Leadership Context:\n- Align all decisions with company vision and mission\n- Balance short-term execution with long-term strategy\n- Focus on sustainable growth and value creation\n- Build strong relationships with stakeholders (investors, board, partners)\n- Foster positive company culture and values\n- Make data-driven decisions while considering market dynamics\n- Communicate vision clearly to all stakeholders\n- Manage risk while pursuing opportunities\n- Lead by example and inspire teams\n- Prioritize customer success and market fit';
  }
}
