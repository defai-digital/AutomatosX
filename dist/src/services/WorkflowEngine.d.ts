/**
 * WorkflowEngine.ts
 *
 * Orchestrate workflow execution with state machine management
 * Phase 4 Week 2: Workflow Engine & Orchestration
 */
import { WorkflowDefinition, WorkflowState, WorkflowResult, WorkflowExecutionOptions } from '../types/schemas/workflow.schema.js';
import Database from 'better-sqlite3';
import { WorkflowCache } from '../cache/WorkflowCache.js';
/**
 * Step execution result
 */
export interface StepResult {
    stepKey: string;
    success: boolean;
    result?: unknown;
    error?: string;
    duration: number;
    retries: number;
}
/**
 * Workflow execution summary
 */
export interface WorkflowExecutionSummary {
    executionId: string;
    workflowId: string;
    workflowName: string;
    state: WorkflowState;
    startedAt?: number;
    completedAt?: number;
    duration?: number;
    stepsCompleted: number;
    stepsFailed: number;
    stepsTotal: number;
    error?: string;
}
/**
 * WorkflowEngine - Orchestrate workflow execution
 */
export declare class WorkflowEngine {
    private dao;
    private parser;
    private checkpointService;
    private db;
    private optimizer;
    private cache;
    constructor(db?: Database.Database, cache?: WorkflowCache);
    /**
     * Get cache instance (for external access)
     */
    getCache(): WorkflowCache;
    /**
     * Execute a workflow from definition
     */
    executeWorkflow(workflowDef: WorkflowDefinition, options?: WorkflowExecutionOptions): Promise<WorkflowResult>;
    /**
     * Execute workflow from file
     */
    executeWorkflowFromFile(filePath: string, options?: WorkflowExecutionOptions): Promise<WorkflowResult>;
    /**
     * Resume workflow execution from checkpoint
     */
    resumeWorkflow(checkpointId: string): Promise<WorkflowResult>;
    /**
     * Pause workflow execution
     */
    pauseWorkflow(executionId: string): Promise<void>;
    /**
     * Cancel workflow execution
     */
    cancelWorkflow(executionId: string): Promise<void>;
    /**
     * Get execution status
     */
    getExecutionStatus(executionId: string): Promise<WorkflowExecutionSummary>;
    /**
     * Internal: Run workflow execution
     */
    private runWorkflow;
    /**
     * Execute a single workflow step
     */
    private executeStep;
    /**
     * Simulate step execution (placeholder for actual agent routing)
     */
    private simulateStepExecution;
}
//# sourceMappingURL=WorkflowEngine.d.ts.map