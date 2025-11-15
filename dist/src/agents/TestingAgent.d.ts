/**
 * TestingAgent.ts
 * Advanced testing strategies and frameworks specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class TestingAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildTestingPrompt;
    private parseTestingArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=TestingAgent.d.ts.map