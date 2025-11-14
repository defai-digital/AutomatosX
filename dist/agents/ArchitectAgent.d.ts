/**
 * ArchitectAgent.ts
 *
 * System architecture and design specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
/**
 * ArchitectAgent - Architecture specialist
 *
 * Specializes in:
 * - System architecture design
 * - Architecture Decision Records (ADRs)
 * - Design patterns and best practices
 * - Scalability and performance architecture
 * - Technology stack selection
 */
export declare class ArchitectAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildArchitecturePrompt;
    private parseArchitectureArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=ArchitectAgent.d.ts.map