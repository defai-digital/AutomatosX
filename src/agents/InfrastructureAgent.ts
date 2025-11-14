/**
 * InfrastructureAgent.ts
 * Cloud infrastructure and platform specialist
 * Phase 7: Agent System Implementation - Day 3
 */

import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions, TaskArtifact } from '../types/agents.types.js';

export class InfrastructureAgent extends AgentBase {
  constructor() {
    super({
      type: 'infrastructure',
      name: 'Infrastructure Specialist (Iris)',
      description: 'Expert in cloud platforms, Kubernetes, scaling, and infrastructure architecture. Specializes in AWS, GCP, Azure, and container orchestration.',
      capabilities: [
        { name: 'Cloud Architecture', description: 'Design cloud infrastructure', keywords: ['cloud', 'aws', 'gcp', 'azure', 'architecture'] },
        { name: 'Kubernetes', description: 'Deploy and manage Kubernetes', keywords: ['kubernetes', 'k8s', 'pods', 'deployments', 'helm'] },
        { name: 'Infrastructure as Code', description: 'Write IaC configs', keywords: ['terraform', 'cloudformation', 'pulumi', 'iac'] },
        { name: 'Auto-Scaling', description: 'Design scaling strategies', keywords: ['scaling', 'autoscaling', 'load balancer', 'horizontal scaling'] },
        { name: 'Cost Optimization', description: 'Optimize cloud costs', keywords: ['cost', 'optimization', 'savings', 'reserved instances'] },
      ],
      specializations: ['AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform', 'Helm', 'Service Mesh', 'Istio', 'Cloud Architecture'],
      temperature: 0.6,
      maxTokens: 4000,
    });
  }

  protected async executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult> {
    const capability = this.canHandle(task);
    if (capability < 0.3) {
      return { success: false, message: `Outside infrastructure specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
    }

    context.monitoring.log('info', `Infrastructure agent handling: ${task.description}`);

    try {
      const relevantCode = await context.codeIntelligence.searchCode('kubernetes terraform docker cloud infrastructure');
      const pastSolutions = await context.memory.search('infrastructure cloud kubernetes deployment');
      const prompt = this.buildInfrastructurePrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
      const response = await this.callProvider(prompt, context, options);
      const artifacts = this.parseInfrastructureArtifacts(response);

      await context.memory.store({ type: 'infrastructure_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });

      return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'infrastructure' } };
    } catch (error) {
      context.monitoring.log('error', `Infrastructure agent failed: ${error}`);
      throw error;
    }
  }

  private buildInfrastructurePrompt(task: Task, context: AgentContext, codeContext: any[], pastSolutions: any[]): string {
    let prompt = this.buildPrompt(task, context);
    prompt += '\n\nProvide complete infrastructure solution with:\n1. Cloud architecture diagram and design\n2. Infrastructure as Code (Terraform/CloudFormation)\n3. Kubernetes manifests (Deployments, Services, Ingress)\n4. Auto-scaling and load balancing configuration\n5. Security groups, IAM roles, and networking\n6. Monitoring and observability setup\n7. Cost optimization recommendations\n8. Disaster recovery and high availability';
    return prompt;
  }

  private parseInfrastructureArtifacts(response: string): TaskArtifact[] {
    const artifacts: TaskArtifact[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();
      let name = 'infrastructure-code';

      if (language === 'hcl' || language === 'terraform') {
        if (content.includes('resource "aws_')) name = 'terraform-aws';
        else if (content.includes('resource "google_')) name = 'terraform-gcp';
        else if (content.includes('resource "azurerm_')) name = 'terraform-azure';
        else name = 'terraform-config';
      } else if (language === 'yaml' || language === 'yml') {
        if (content.includes('apiVersion') && content.includes('kind:')) {
          if (content.includes('kind: Deployment')) name = 'k8s-deployment';
          else if (content.includes('kind: Service')) name = 'k8s-service';
          else if (content.includes('kind: Ingress')) name = 'k8s-ingress';
          else if (content.includes('kind: ConfigMap')) name = 'k8s-configmap';
          else name = 'k8s-manifest';
        } else if (content.includes('AWSTemplateFormatVersion')) {
          name = 'cloudformation-template';
        }
      } else if (language === 'dockerfile' || (language === 'docker' && content.includes('FROM'))) {
        name = 'dockerfile';
      }

      artifacts.push({ type: 'code', name, content, metadata: { language, category: 'infrastructure' } });
    }
    return artifacts;
  }

  protected getContextPrompt(): string {
    return '\nInfrastructure Context:\n- Design for high availability and fault tolerance\n- Use managed services when possible to reduce operational overhead\n- Implement auto-scaling based on metrics\n- Follow cloud provider best practices\n- Use Infrastructure as Code for reproducibility\n- Implement proper security (least privilege, network segmentation)\n- Monitor costs and optimize resource usage\n- Plan for disaster recovery and backup strategies\n- Use container orchestration (Kubernetes) for microservices';
  }
}
