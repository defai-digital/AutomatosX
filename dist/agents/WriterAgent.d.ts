/**
 * WriterAgent.ts
 * Technical writing and documentation specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class WriterAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildWriterPrompt;
    private parseWriterArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=WriterAgent.d.ts.map