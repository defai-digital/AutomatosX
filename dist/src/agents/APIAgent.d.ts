/**
 * APIAgent.ts
 * API design and documentation specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class APIAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildAPIPrompt;
    private parseAPIArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=APIAgent.d.ts.map