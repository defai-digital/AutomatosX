/**
 * WorkflowEngineV2.ts
 *
 * Next-generation workflow orchestration using ReScript state machine
 * Day 2: ReScript Integration - Deterministic state transitions
 *
 * Key Improvements over V1:
 * - Formal state machine with type-safe transitions (ReScript)
 * - Deterministic execution with checkpoint/resume support
 * - Agent integration via WorkflowAgentBridge
 * - Comprehensive error handling with Result types
 */
import { WorkflowDefinition, WorkflowExecution, WorkflowState, WorkflowResult, WorkflowExecutionOptions } from '../types/schemas/workflow.schema.js';
import Database from 'better-sqlite3';
import { WorkflowCache } from '../cache/WorkflowCache.js';
import { WorkflowAgentBridge } from '../bridge/WorkflowAgentBridge.js';
/**
 * Step execution result (compatible with V1)
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
 * Workflow execution summary (compatible with V1)
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
 * WorkflowEngineV2 - Next-generation workflow orchestrator
 *
 * Uses ReScript state machine for deterministic execution.
 * Maintains backward compatibility with V1 API.
 */
export declare class WorkflowEngineV2 {
    private dao;
    private parser;
    private checkpointService;
    private agentBridge;
    private db;
    private optimizer;
    private cache;
    constructor(db?: Database.Database, cache?: WorkflowCache, agentBridge?: WorkflowAgentBridge);
    /**
     * Get cache instance (for external access)
     */
    getCache(): WorkflowCache;
    /**
     * Execute a workflow from definition using ReScript state machine
     *
     * State transition flow:
     * Idle -> Parsing -> Validating -> Executing -> Completed/Failed/Cancelled
     */
    executeWorkflow(workflowDef: WorkflowDefinition, options?: WorkflowExecutionOptions): Promise<WorkflowResult>;
    /**
     * Execute workflow from file
     */
    executeWorkflowFromFile(filePath: string, options?: WorkflowExecutionOptions): Promise<WorkflowResult>;
    /**
     * Resume workflow execution from checkpoint using ReScript state machine
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
     * Core workflow execution logic using ReScript state machine
     *
     * Manages state transitions through the workflow lifecycle:
     * 1. Idle -> Start -> Parsing
     * 2. Parsing -> Parse -> Validating
     * 3. Validating -> Validate -> Executing
     * 4. Executing -> Execute steps -> Completed/Failed
     *
     * Creates checkpoints after each level for resumability.
     */
    private runWorkflowWithStateMachine;
    /**
     * Execute workflow steps level-by-level with state machine tracking
     *
     * Each level contains steps that can run in parallel (no dependencies between them).
     * Creates checkpoint after each level for resumability.
     */
    private executeStepsWithStateMachine;
    /**
     * Execute a single step using WorkflowAgentBridge
     *
     * Routes the step to appropriate agent based on step type and @agent directive.
     * Falls back to simulated execution if no agent can handle the step.
     */
    private executeStepWithAgent;
    /**
     * Get workflow execution summary
     */
    getExecutionSummary(executionId: string): WorkflowExecutionSummary | null;
    /**
     * List all workflow executions
     */
    listExecutions(limit?: number, offset?: number): WorkflowExecution[];
    /**
     * Get execution by ID
     */
    getExecution(executionId: string): WorkflowExecution | null;
}
//# sourceMappingURL=WorkflowEngineV2.d.ts.map