/**
 * MobileAgent.ts
 * Mobile development specialist (iOS, Android, cross-platform)
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
export declare class MobileAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildMobilePrompt;
    private parseMobileArtifacts;
    protected getContextPrompt(): string;
}
//# sourceMappingURL=MobileAgent.d.ts.map