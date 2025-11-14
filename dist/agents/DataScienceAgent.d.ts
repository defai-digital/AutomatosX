/**
 * DataScienceAgent.ts
 * Data science and machine learning specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class DataScienceAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildMLPrompt;
    private parseMLArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=DataScienceAgent.d.ts.map