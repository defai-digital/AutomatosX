/**
 * StandardsAgent.ts
 * Standards, best practices, and compliance specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class StandardsAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildStandardsPrompt;
    private parseStandardsArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=StandardsAgent.d.ts.map