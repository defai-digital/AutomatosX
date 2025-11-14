/**
 * DatabaseAgent.ts
 * Database design and optimization specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class DatabaseAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildDatabasePrompt;
    private parseDatabaseArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=DatabaseAgent.d.ts.map