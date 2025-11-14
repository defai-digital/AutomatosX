/**
 * CTOAgent.ts
 * Technical leadership and strategy specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class CTOAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildCTOPrompt;
    private parseCTOArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=CTOAgent.d.ts.map