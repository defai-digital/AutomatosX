/**
 * AgentCollaborator.ts
 * Multi-agent workflow orchestration
 * Phase 7: Agent System Implementation - Day 4
 */
import { EventEmitter } from 'events';
import { AgentRegistry } from './AgentRegistry.js';
import { Task, TaskResult, AgentContext, TaskStatus, AgentType } from '../types/agents.types.js';
export interface SubTask {
    id: string;
    description: string;
    agentType: AgentType;
    dependsOn?: string[];
    priority: number;
    status: TaskStatus;
    result?: TaskResult;
}
export interface WorkflowResult {
    success: boolean;
    subtasks: SubTask[];
    aggregatedResult: TaskResult;
    executionTime: number;
    strategy: 'sequential' | 'parallel';
}
export type WorkflowStrategy = 'sequential' | 'parallel' | 'auto';
export declare class AgentCollaborator extends EventEmitter {
    private registry;
    constructor(registry: AgentRegistry);
    /**
     * Execute a complex task that requires multiple agents
     */
    collaborate(task: Task, context: AgentContext, strategy?: WorkflowStrategy): Promise<WorkflowResult>;
    /**
     * Decompose a complex task into subtasks
     */
    decomposeTask(task: Task, context: AgentContext): Promise<SubTask[]>;
    /**
     * Determine optimal execution strategy based on subtasks
     */
    private determineStrategy;
    /**
     * Execute workflow with given strategy
     */
    private executeWorkflow;
    /**
     * Execute subtasks sequentially (respects dependencies)
     */
    private executeSequential;
    /**
     * Execute subtasks in parallel (no dependencies)
     */
    private executeParallel;
    /**
     * Aggregate results from multiple agents
     */
    private aggregateResults;
    /**
     * Check if description contains any of the keywords
     */
    private containsKeywords;
}
//# sourceMappingURL=AgentCollaborator.d.ts.map