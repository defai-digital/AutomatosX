/**
 * CheckpointServiceV2.ts
 *
 * Manage workflow state snapshots with ReScript state machine serialization
 * Day 2: ReScript Integration - Checkpoint support for WorkflowStateMachineBridge
 *
 * Key Improvements over V1:
 * - Native ReScript state machine serialization/deserialization
 * - Type-safe checkpoint restoration
 * - Maintains backward compatibility with V1 checkpoint format
 */
import { WorkflowCheckpoint, WorkflowState, WorkflowContext } from '../types/schemas/workflow.schema.js';
import Database from 'better-sqlite3';
import { WorkflowStateMachineBridge } from '../bridge/WorkflowStateMachineBridge.js';
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
 * Restored checkpoint with ReScript state machine
 */
export interface RestoredCheckpoint {
    state: WorkflowState;
    context: WorkflowContext;
    completedSteps: string[];
    pendingSteps: string[];
    checkpoint: WorkflowCheckpoint;
    machine: WorkflowStateMachineBridge;
}
/**
 * CheckpointServiceV2 - Manage workflow state snapshots with ReScript state machine
 *
 * Handles serialization and deserialization of WorkflowStateMachineBridge instances.
 * Maintains backward compatibility with V1 checkpoint format.
 */
export declare class CheckpointServiceV2 {
    private dao;
    private db;
    constructor(db?: Database.Database);
    /**
     * Create a checkpoint for workflow execution using ReScript state machine
     *
     * Serializes the entire state machine state including:
     * - Current state (Idle, Parsing, Validating, Executing, etc.)
     * - Workflow context (workflowId, workflowName, variables)
     * - Step states (pending, running, completed, failed, skipped)
     * - Execution history
     */
    createCheckpoint(executionId: string, machine: WorkflowStateMachineBridge, context: WorkflowContext, options?: CheckpointOptions): Promise<WorkflowCheckpoint>;
    /**
     * Restore workflow execution from checkpoint with ReScript state machine
     *
     * Deserializes the checkpoint and reconstructs the WorkflowStateMachineBridge.
     * Returns ready-to-use state machine for resuming workflow execution.
     */
    restoreCheckpoint(checkpointId: string): Promise<RestoredCheckpoint>;
    /**
     * List all checkpoints for an execution
     */
    listCheckpoints(executionId: string, limit?: number): Promise<WorkflowCheckpoint[]>;
    /**
     * Get latest checkpoint for an execution
     */
    getLatestCheckpoint(executionId: string): Promise<WorkflowCheckpoint | null>;
    /**
     * Delete a checkpoint
     */
    deleteCheckpoint(checkpointId: string): Promise<void>;
    /**
     * Delete all checkpoints for an execution
     */
    deleteAllCheckpoints(executionId: string): Promise<number>;
    /**
     * Invalidate all checkpoints for an execution (for failed workflows)
     *
     * Marks checkpoints as invalid without deleting them, so they can be
     * inspected for debugging but won't be used for resumption.
     *
     * This is safer than deletion as it preserves audit trail.
     */
    invalidateCheckpointsForExecution(executionId: string): Promise<number>;
    /**
     * Get checkpoint statistics for an execution
     */
    getCheckpointStats(executionId: string): Promise<CheckpointStats>;
    /**
     * Prune old checkpoints (keep only latest N checkpoints)
     */
    pruneCheckpoints(executionId: string, keepLatest?: number): Promise<number>;
    /**
     * Map ReScript state machine state to WorkflowState
     *
     * ReScript states: idle, parsing, validating, executing, paused, completed, failed, cancelled
     * Workflow states: idle, parsing, validating, executing, paused, completed, failed, cancelled
     *
     * States are 1:1 mapped.
     */
    private mapRescriptStateToWorkflowState;
    /**
     * Check if a checkpoint contains ReScript machine state
     *
     * Used to determine if checkpoint is V2 format (with machine state) or V1 format (legacy).
     */
    isRescriptCheckpoint(checkpoint: WorkflowCheckpoint): boolean;
    /**
     * Migrate V1 checkpoint to V2 format
     *
     * This is a best-effort migration. Some state machine history may be lost.
     * Use with caution.
     */
    migrateV1CheckpointToV2(checkpointId: string): Promise<WorkflowCheckpoint>;
}
//# sourceMappingURL=CheckpointServiceV2.d.ts.map