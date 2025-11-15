/**
 * WorkflowDAO.ts
 *
 * Data Access Object for workflow tables
 * Provides CRUD operations for workflows, executions, steps, and checkpoints
 * Phase 4 Week 1: Foundation & State Machine
 */
import Database from 'better-sqlite3';
import { Workflow, WorkflowExecution, WorkflowCheckpoint, WorkflowStepExecution, WorkflowEvent, WorkflowDefinition, WorkflowContext, WorkflowState, StepExecutionState, WorkflowStats } from '../../types/schemas/workflow.schema.js';
/**
 * Workflow input for insertion
 */
export interface WorkflowInput {
    name: string;
    description?: string;
    definition: WorkflowDefinition;
    author?: string;
    tags?: string[];
}
/**
 * Workflow execution input
 */
export interface WorkflowExecutionInput {
    workflowId: string;
    context?: WorkflowContext;
    triggeredBy?: string;
    priority?: number;
    parentExecutionId?: string;
}
/**
 * Checkpoint input
 */
export interface CheckpointInput {
    executionId: string;
    state: WorkflowState;
    context: WorkflowContext;
    completedSteps: string[];
    pendingSteps: string[];
    createdBy?: string;
    label?: string;
}
/**
 * Step execution input
 */
export interface StepExecutionInput {
    executionId: string;
    stepId: string;
    state: StepExecutionState;
    agentUsed?: string;
}
/**
 * Workflow event input
 */
export interface WorkflowEventInput {
    executionId: string;
    eventType: string;
    eventData?: Record<string, unknown>;
}
/**
 * WorkflowDAO - Data Access Object for workflow tables
 */
export declare class WorkflowDAO {
    private db;
    constructor(db?: Database.Database);
    /**
     * Create a new workflow definition
     */
    createWorkflow(input: WorkflowInput): Workflow;
    /**
     * Get workflow by ID
     */
    getWorkflowById(id: string): Workflow | null;
    /**
     * Get workflow by name
     */
    getWorkflowByName(name: string): Workflow | null;
    /**
     * List all active workflows
     */
    listWorkflows(): Workflow[];
    /**
     * Update workflow definition
     */
    updateWorkflow(id: string, definition: WorkflowDefinition): void;
    /**
     * Archive a workflow (soft delete)
     */
    archiveWorkflow(id: string): void;
    /**
     * Create a new workflow execution
     */
    createExecution(input: WorkflowExecutionInput): WorkflowExecution;
    /**
     * Get execution by ID
     */
    getExecutionById(id: string): WorkflowExecution | null;
    /**
     * List executions for a workflow
     */
    listExecutions(workflowId: string, limit?: number): WorkflowExecution[];
    /**
     * List active executions (not completed/failed/cancelled)
     */
    listActiveExecutions(): WorkflowExecution[];
    /**
     * Update execution state
     */
    updateExecutionState(id: string, state: WorkflowState, error?: string): void;
    /**
     * Update execution context
     */
    updateExecutionContext(id: string, context: WorkflowContext): void;
    /**
     * Increment resume count
     */
    incrementResumeCount(id: string): void;
    /**
     * Create step execution
     */
    createStepExecution(input: StepExecutionInput): WorkflowStepExecution;
    /**
     * Get step execution by ID
     */
    getStepExecutionById(id: string): WorkflowStepExecution | null;
    /**
     * List step executions for an execution
     */
    listStepExecutions(executionId: string): WorkflowStepExecution[];
    /**
     * Update step execution state
     */
    updateStepExecutionState(id: string, state: StepExecutionState, result?: unknown, error?: string): void;
    /**
     * Increment retry count for step execution
     */
    incrementStepRetryCount(id: string, error: string): void;
    /**
     * Create checkpoint
     */
    createCheckpoint(input: CheckpointInput): WorkflowCheckpoint;
    /**
     * Get checkpoint by ID
     */
    getCheckpointById(id: string): WorkflowCheckpoint | null;
    /**
     * List checkpoints for execution
     */
    listCheckpoints(executionId: string, limit?: number): WorkflowCheckpoint[];
    /**
     * Get latest checkpoint for execution
     */
    getLatestCheckpoint(executionId: string): WorkflowCheckpoint | null;
    /**
     * Delete checkpoint
     */
    deleteCheckpoint(id: string): void;
    /**
     * Prune old checkpoints
     */
    pruneOldCheckpoints(retentionDays?: number): number;
    /**
     * Log workflow event
     */
    logEvent(input: WorkflowEventInput): void;
    /**
     * Get events for execution
     */
    getEvents(executionId: string, limit?: number): WorkflowEvent[];
    /**
     * Get workflow statistics
     */
    getWorkflowStats(workflowId?: string): WorkflowStats[];
    private rowToWorkflow;
    private rowToExecution;
    private rowToStepExecution;
    private rowToCheckpoint;
    private rowToEvent;
    private rowToStats;
}
//# sourceMappingURL=WorkflowDAO.d.ts.map