/**
 * SecurityAgent.ts
 *
 * Security and threat modeling specialist
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
 * SecurityAgent - Security specialist
 *
 * Specializes in:
 * - Security audits and vulnerability assessments
 * - Threat modeling and risk analysis
 * - Authentication and authorization security
 * - OWASP Top 10 mitigation
 * - Secure coding practices
 */
export class SecurityAgent extends AgentBase {
  constructor() {
    super({
      type: 'security',
      name: 'Security Specialist (Steve)',
      description:
        'Expert in security auditing, threat modeling, vulnerability assessment, and secure coding practices. Specializes in identifying and mitigating security risks.',
      capabilities: [
        {
          name: 'Security Audits',
          description: 'Perform comprehensive security audits',
          keywords: ['audit', 'security', 'vulnerability', 'scan', 'assessment', 'review'],
        },
        {
          name: 'Threat Modeling',
          description: 'Identify threats and create mitigation strategies',
          keywords: ['threat', 'risk', 'attack', 'mitigation', 'security model', 'threat model'],
        },
        {
          name: 'Authentication Security',
          description: 'Secure authentication and authorization systems',
          keywords: ['auth', 'authentication', 'authorization', 'jwt', 'oauth', 'session', 'token', 'password'],
        },
        {
          name: 'OWASP Mitigation',
          description: 'Address OWASP Top 10 vulnerabilities',
          keywords: ['owasp', 'injection', 'xss', 'csrf', 'sql injection', 'broken auth'],
        },
        {
          name: 'Secure Coding',
          description: 'Apply secure coding practices',
          keywords: ['secure', 'sanitize', 'validate', 'escape', 'encrypt', 'hash'],
        },
      ],
      specializations: [
        'Penetration Testing',
        'Threat Modeling',
        'OWASP Top 10',
        'Authentication Security',
        'Encryption',
        'Secure Coding',
        'Compliance',
        'Risk Assessment',
      ],
      temperature: 0.5, // Lower temperature for more precise security analysis
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
        message: `This task is outside my security specialization. Consider @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `Security agent analyzing: ${task.description}`);

    try {
      // Search for security-related code
      const relevantCode = await context.codeIntelligence.searchCode(
        task.description + ' security auth'
      );

      // Check for past security audits
      const pastAudits = await context.memory.search('security audit vulnerability');

      const prompt = this.buildSecurityPrompt(task, context, relevantCode.slice(0, 5), pastAudits.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseSecurityArtifacts(response);

      await context.memory.store({
        type: 'security_audit',
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
          auditType: 'security',
        },
      };
    } catch (error) {
      context.monitoring.log('error', `Security agent failed: ${error}`);
      throw error;
    }
  }

  private buildSecurityPrompt(
    task: Task,
    context: AgentContext,
    codeContext: any[],
    pastAudits: any[]
  ): string {
    let prompt = this.buildPrompt(task, context);

    if (codeContext.length > 0) {
      prompt += '\n\nCode to audit:\n';
      codeContext.forEach((code, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(code).slice(0, 200)}...\n`;
      });
    }

    prompt += '\n\nPerform a comprehensive security analysis and provide:';
    prompt += '\n1. Identified vulnerabilities (categorized by OWASP Top 10)';
    prompt += '\n2. Risk level (Critical/High/Medium/Low) for each issue';
    prompt += '\n3. Specific mitigation strategies';
    prompt += '\n4. Secure code examples';
    prompt += '\n5. Best practices recommendations';
    prompt += '\n6. Threat model if applicable';

    return prompt;
  }

  private parseSecurityArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];

    // Extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      artifacts.push({
        type: 'code',
        name: `secure-${language}-example`,
        content: code,
        metadata: { language, category: 'security' },
      });
    }

    // Extract vulnerabilities mentioned
    const vulnRegex = /(SQL Injection|XSS|CSRF|Broken Authentication|Security Misconfiguration|Sensitive Data Exposure)/gi;
    const vulnerabilities = response.match(vulnRegex) || [];

    if (vulnerabilities.length > 0) {
      artifacts.push({
        type: 'document',
        name: 'vulnerabilities-identified',
        content: [...new Set(vulnerabilities)].join(', '),
        metadata: { count: vulnerabilities.length },
      });
    }

    return artifacts;
  }

  protected getContextPrompt(context: AgentContext): string {
    return `
Security Analysis Context:
- Identify all security vulnerabilities (OWASP Top 10)
- Assess risk levels (Critical/High/Medium/Low)
- Provide specific, actionable mitigation strategies
- Focus on secure coding practices
- Consider authentication, authorization, data protection
- Address input validation, output encoding, secure communication
`;
  }
}
