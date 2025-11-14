/**
 * DevOpsAgent.ts
 *
 * DevOps and infrastructure specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
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
export declare class DevOpsAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildDevOpsPrompt;
    private parseInfraArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=DevOpsAgent.d.ts.map