/**
 * ResearcherAgent.ts
 * Research and analysis specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class ResearcherAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildResearcherPrompt;
    private parseResearcherArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=ResearcherAgent.d.ts.map