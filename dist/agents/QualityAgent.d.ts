/**
 * QualityAgent.ts
 *
 * Quality assurance and testing specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
/**
 * QualityAgent - QA and testing specialist
 *
 * Specializes in:
 * - Test strategy and planning
 * - Unit, integration, and E2E testing
 * - Code quality reviews
 * - Test automation
 * - Performance testing
 */
export declare class QualityAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    private detectTestType;
    private buildTestingPrompt;
    private parseTestArtifacts;
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=QualityAgent.d.ts.map