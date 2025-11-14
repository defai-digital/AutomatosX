/**
 * CEOAgent.ts
 * Business leadership and strategic vision specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class CEOAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildCEOPrompt;
    private parseCEOArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=CEOAgent.d.ts.map