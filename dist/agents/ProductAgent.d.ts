/**
 * ProductAgent.ts
 *
 * Product management specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
/**
 * ProductAgent - Product management specialist
 *
 * Specializes in:
 * - Product requirements (PRDs)
 * - Feature specifications
 * - User stories and acceptance criteria
 * - Product strategy and roadmap
 * - Stakeholder communication
 */
export declare class ProductAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildProductPrompt;
    private parseProductArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=ProductAgent.d.ts.map