/**
 * FrontendAgent.ts
 *
 * Frontend development specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
/**
 * FrontendAgent - Frontend development specialist
 *
 * Specializes in:
 * - React/Next.js component development
 * - UI/UX implementation
 * - State management (Redux, Context, Zustand)
 * - Responsive design and accessibility
 * - Frontend performance optimization
 */
export declare class FrontendAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private buildFrontendPrompt;
    private parseArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=FrontendAgent.d.ts.map