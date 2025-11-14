/**
 * CheckpointService.ts
 *
 * Manage workflow state snapshots for pause/resume functionality
 * Phase 4 Week 2: Workflow Engine & Orchestration
 */
import { WorkflowCheckpoint, WorkflowState, WorkflowContext } from '../types/schemas/workflow.schema.js';
import Database from 'better-sqlite3';
/**
 * Checkpoint options
 */
export interface CheckpointOptions {
    label?: string;
    createdBy?: string;
}
/**
 * Checkpoint statistics
 */
export interface CheckpointStats {
    executionId: string;
    totalCheckpoints: number;
    latestCheckpoint?: WorkflowCheckpoint;
    totalSizeBytes: number;
    oldestCheckpointAge: number;
}
/**
 * CheckpointService - Manage workflow state snapshots
 */
export declare class CheckpointService {
    private dao;
    private db;
    constructor(db?: Database.Database);
    /**
     * Create a checkpoint for workflow execution
     *
     * Saves complete execution state including:
     * - Current state machine state
     * - Execution context (variables, step outputs)
     * - Completed steps
     * - Pending steps
     */
    createCheckpoint(executionId: string, state: WorkflowState, context: WorkflowContext, completedSteps: string[], pendingSteps: string[], options?: CheckpointOptions): Promise<WorkflowCheckpoint>;
    /**
     * Restore workflow execution from checkpoint
     *
     * Returns the saved state ready for resumption
     */
    restoreCheckpoint(checkpointId: string): Promise<{
        state: WorkflowState;
        context: WorkflowContext;
        completedSteps: string[];
        pendingSteps: string[];
        checkpoint: WorkflowCheckpoint;
    }>;
    /**
     * List all checkpoints for an execution
     */
    listCheckpoints(executionId: string, limit?: number): Promise<WorkflowCheckpoint[]>;
    /**
     * Get the most recent checkpoint for an execution
     */
    getLatestCheckpoint(executionId: string): Promise<WorkflowCheckpoint | null>;
    /**
     * Get checkpoint by ID
     */
    getCheckpointById(checkpointId: string): Promise<WorkflowCheckpoint | null>;
    /**
     * Delete a specific checkpoint
     */
    deleteCheckpoint(checkpointId: string): Promise<void>;
    /**
     * Prune old checkpoints based on retention policy
     *
     * @param retentionDays - Keep checkpoints newer than this many days (default: 7)
     * @returns Number of checkpoints deleted
     */
    pruneOldCheckpoints(retentionDays?: number): Promise<number>;
    /**
     * Get checkpoint statistics for an execution
     */
    getCheckpointStats(executionId: string): Promise<CheckpointStats>;
    /**
     * Create automatic checkpoint at regular intervals
     *
     * Should be called during workflow execution to save state periodically
     */
    createAutomaticCheckpoint(executionId: string, state: WorkflowState, context: WorkflowContext, completedSteps: string[], pendingSteps: string[]): Promise<WorkflowCheckpoint | null>;
    /**
     * Validate checkpoint integrity
     *
     * Ensures checkpoint data is valid and can be restored
     */
    validateCheckpoint(checkpointId: string): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
//# sourceMappingURL=CheckpointService.d.ts.map