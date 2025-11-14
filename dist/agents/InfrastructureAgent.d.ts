/**
 * InfrastructureAgent.ts
 * Cloud infrastructure and platform specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class InfrastructureAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildInfrastructurePrompt;
    private parseInfrastructureArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=InfrastructureAgent.d.ts.map