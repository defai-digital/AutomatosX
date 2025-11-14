/**
 * PerformanceAgent.ts
 * Performance optimization and profiling specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class PerformanceAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildPerformancePrompt;
    private parsePerformanceArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=PerformanceAgent.d.ts.map