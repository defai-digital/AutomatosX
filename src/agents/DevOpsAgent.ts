/**
 * DevOpsAgent.ts
 *
 * DevOps and infrastructure specialist
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
 * DevOpsAgent - DevOps specialist
 *
 * Specializes in:
 * - CI/CD pipeline design and implementation
 * - Infrastructure as code (Terraform, CloudFormation)
 * - Container orchestration (Docker, Kubernetes)
 * - Cloud platforms (AWS, GCP, Azure)
 * - Monitoring and logging
 */
export class DevOpsAgent extends AgentBase {
  constructor() {
    super({
      type: 'devops',
      name: 'DevOps Specialist (Oliver)',
      description:
        'Expert in DevOps, CI/CD, infrastructure automation, containerization, and cloud platforms. Specializes in building scalable, reliable deployment pipelines.',
      capabilities: [
        {
          name: 'CI/CD Pipelines',
          description: 'Design and implement CI/CD pipelines',
          keywords: ['ci', 'cd', 'pipeline', 'github actions', 'jenkins', 'gitlab', 'deploy', 'build'],
        },
        {
          name: 'Infrastructure as Code',
          description: 'Write IaC with Terraform, CloudFormation, Pulumi',
          keywords: ['terraform', 'cloudformation', 'iac', 'infrastructure', 'provision'],
        },
        {
          name: 'Containerization',
          description: 'Docker, Kubernetes, container orchestration',
          keywords: ['docker', 'kubernetes', 'k8s', 'container', 'pod', 'helm'],
        },
        {
          name: 'Cloud Platforms',
          description: 'Deploy and manage on AWS, GCP, Azure',
          keywords: ['aws', 'gcp', 'azure', 'cloud', 'ec2', 's3', 'lambda', 'cloudflare'],
        },
        {
          name: 'Monitoring',
          description: 'Set up monitoring, logging, and alerting',
          keywords: ['monitoring', 'logging', 'prometheus', 'grafana', 'datadog', 'alert'],
        },
      ],
      specializations: [
        'GitHub Actions',
        'Docker',
        'Kubernetes',
        'Terraform',
        'AWS',
        'CI/CD',
        'Monitoring',
        'Infrastructure Automation',
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
        message: `This task is outside my DevOps specialization. Consider @${suggestion} agent.`,
        metadata: { capabilityScore: capability, suggestedAgent: suggestion },
      };
    }

    context.monitoring.log('info', `DevOps agent handling: ${task.description}`);

    try {
      // Search for existing infrastructure config
      const infraCode = await context.codeIntelligence.searchCode(
        'docker terraform github actions'
      );

      // Check past deployment strategies
      const pastDeployments = await context.memory.search('deployment infrastructure ci/cd');

      const prompt = this.buildDevOpsPrompt(task, context, infraCode.slice(0, 5), pastDeployments.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseInfraArtifacts(response);

      await context.memory.store({
        type: 'devops_solution',
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
          category: 'infrastructure',
        },
      };
    } catch (error) {
      context.monitoring.log('error', `DevOps agent failed: ${error}`);
      throw error;
    }
  }

  private buildDevOpsPrompt(
    task: Task,
    context: AgentContext,
    infraContext: any[],
    pastDeployments: any[]
  ): string {
    let prompt = this.buildPrompt(task, context);

    if (infraContext.length > 0) {
      prompt += '\n\nExisting infrastructure:\n';
      infraContext.forEach((infra, idx) => {
        prompt += `${idx + 1}. ${JSON.stringify(infra).slice(0, 200)}...\n`;
      });
    }

    prompt += '\n\nProvide complete DevOps solution with:';
    prompt += '\n1. Infrastructure as code (Terraform/Docker/Kubernetes configs)';
    prompt += '\n2. CI/CD pipeline configuration (GitHub Actions/GitLab CI)';
    prompt += '\n3. Deployment strategy (blue-green, rolling, canary)';
    prompt += '\n4. Monitoring and logging setup';
    prompt += '\n5. Security considerations (secrets, IAM, network)';
    prompt += '\n6. Scaling and performance optimization';

    return prompt;
  }

  private parseInfraArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      // Detect infrastructure file types
      let fileType = 'code';
      let fileName = `${language}-config`;

      if (language === 'yaml' || language === 'yml') {
        if (code.includes('apiVersion') && code.includes('kind:')) {
          fileName = 'kubernetes-manifest';
        } else if (code.includes('name:') && (code.includes('on:') || code.includes('jobs:'))) {
          fileName = 'github-actions-workflow';
        }
      } else if (language === 'hcl' || language === 'terraform') {
        fileName = 'terraform-config';
      } else if (code.includes('FROM ') || code.includes('RUN ')) {
        fileName = 'Dockerfile';
      }

      artifacts.push({
        type: fileType as any,
        name: fileName,
        content: code,
        metadata: { language, category: 'infrastructure' },
      });
    }

    return artifacts;
  }

  protected getContextPrompt(context: AgentContext): string {
    return `
DevOps Context:
- Design for scalability, reliability, and security
- Use infrastructure as code (IaC) best practices
- Implement automated CI/CD pipelines
- Consider cost optimization
- Set up proper monitoring and alerting
- Follow 12-factor app principles
- Ensure zero-downtime deployments
`;
  }
}
