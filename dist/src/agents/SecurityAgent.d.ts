/**
 * SecurityAgent.ts
 *
 * Security and threat modeling specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
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
export declare class SecurityAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildSecurityPrompt;
    private parseSecurityArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=SecurityAgent.d.ts.map