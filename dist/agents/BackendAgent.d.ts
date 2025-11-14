/**
 * BackendAgent.ts
 *
 * Backend development specialist
 * Phase 7: Agent System Implementation - Day 2
 */
import { AgentBase } from './AgentBase.js';
import { Task, TaskResult, AgentContext, AgentExecutionOptions } from '../types/agents.types.js';
/**
 * BackendAgent - Backend development specialist
 *
 * Specializes in:
 * - REST/GraphQL API design and implementation
 * - Database schema design and optimization
 * - Authentication and authorization
 * - Server-side business logic
 * - Microservices architecture
 */
export declare class BackendAgent extends AgentBase {
    constructor();
    protected executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    /**
     * Gather relevant code context for the task
     */
    private gatherCodeContext;
    /**
     * Gather relevant memory context for the task
     */
    private gatherMemoryContext;
    /**
     * Extract keywords from task description
     */
    private extractKeywords;
    /**
     * Build enhanced prompt with context
     */
    private buildEnhancedPrompt;
    /**
     * Parse artifacts (code blocks, files) from response
     */
    private parseArtifacts;
    /**
     * Override context prompt to add backend-specific context
     */
    protected getContextPrompt(context: AgentContext): string;
}
//# sourceMappingURL=BackendAgent.d.ts.map