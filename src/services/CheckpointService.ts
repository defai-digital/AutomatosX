/**
 * CheckpointService.ts
 *
 * Manage workflow state snapshots for pause/resume functionality
 * Phase 4 Week 2: Workflow Engine & Orchestration
 */

import { WorkflowDAO } from '../database/dao/WorkflowDAO.js';
import {
  WorkflowCheckpoint,
  WorkflowState,
  WorkflowContext,
  parseWorkflowContext,
} from '../types/schemas/workflow.schema.js';
import { getDatabase } from '../database/connection.js';
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
  oldestCheckpointAge: number; // milliseconds
}

/**
 * CheckpointService - Manage workflow state snapshots
 */
export class CheckpointService {
  private dao: WorkflowDAO;
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
    this.dao = new WorkflowDAO(this.db);
  }

  /**
   * Create a checkpoint for workflow execution
   *
   * Saves complete execution state including:
   * - Current state machine state
   * - Execution context (variables, step outputs)
   * - Completed steps
   * - Pending steps
   */
  async createCheckpoint(
    executionId: string,
    state: WorkflowState,
    context: WorkflowContext,
    completedSteps: string[],
    pendingSteps: string[],
    options: CheckpointOptions = {}
  ): Promise<WorkflowCheckpoint> {
    // Validate inputs
    if (!executionId) {
      throw new Error('Execution ID is required');
    }

    if (!state) {
      throw new Error('Workflow state is required');
    }

    // Create checkpoint via DAO
    const checkpoint = this.dao.createCheckpoint({
      executionId,
      state,
      context,
      completedSteps,
      pendingSteps,
      createdBy: options.createdBy || 'automatic',
      label: options.label,
    });

    // Log checkpoint creation event
    this.dao.logEvent({
      executionId,
      eventType: 'checkpoint_created',
      eventData: {
        checkpointId: checkpoint.id,
        state,
        completedSteps: completedSteps.length,
        pendingSteps: pendingSteps.length,
        label: options.label,
      },
    });

    return checkpoint;
  }

  /**
   * Restore workflow execution from checkpoint
   *
   * Returns the saved state ready for resumption
   */
  async restoreCheckpoint(checkpointId: string): Promise<{
    state: WorkflowState;
    context: WorkflowContext;
    completedSteps: string[];
    pendingSteps: string[];
    checkpoint: WorkflowCheckpoint;
  }> {
    // Get checkpoint from database
    const checkpoint = this.dao.getCheckpointById(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Parse JSON strings back to objects
    const context = parseWorkflowContext(checkpoint.context);
    const completedSteps = JSON.parse(checkpoint.completedSteps) as string[];
    const pendingSteps = JSON.parse(checkpoint.pendingSteps) as string[];

    // Log checkpoint restoration event
    this.dao.logEvent({
      executionId: checkpoint.executionId,
      eventType: 'checkpoint_restored',
      eventData: {
        checkpointId: checkpoint.id,
        state: checkpoint.state,
        completedSteps: completedSteps.length,
        pendingSteps: pendingSteps.length,
      },
    });

    return {
      state: checkpoint.state,
      context,
      completedSteps,
      pendingSteps,
      checkpoint,
    };
  }

  /**
   * List all checkpoints for an execution
   */
  async listCheckpoints(executionId: string, limit: number = 10): Promise<WorkflowCheckpoint[]> {
    return this.dao.listCheckpoints(executionId, limit);
  }

  /**
   * Get the most recent checkpoint for an execution
   */
  async getLatestCheckpoint(executionId: string): Promise<WorkflowCheckpoint | null> {
    return this.dao.getLatestCheckpoint(executionId);
  }

  /**
   * Get checkpoint by ID
   */
  async getCheckpointById(checkpointId: string): Promise<WorkflowCheckpoint | null> {
    return this.dao.getCheckpointById(checkpointId);
  }

  /**
   * Delete a specific checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.dao.getCheckpointById(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Log deletion event
    this.dao.logEvent({
      executionId: checkpoint.executionId,
      eventType: 'checkpoint_created', // Using existing event type
      eventData: {
        checkpointId,
        action: 'deleted',
      },
    });

    this.dao.deleteCheckpoint(checkpointId);
  }

  /**
   * Prune old checkpoints based on retention policy
   *
   * @param retentionDays - Keep checkpoints newer than this many days (default: 7)
   * @returns Number of checkpoints deleted
   */
  async pruneOldCheckpoints(retentionDays: number = 7): Promise<number> {
    if (retentionDays < 1) {
      throw new Error('Retention days must be at least 1');
    }

    const deletedCount = this.dao.pruneOldCheckpoints(retentionDays);

    return deletedCount;
  }

  /**
   * Get checkpoint statistics for an execution
   */
  async getCheckpointStats(executionId: string): Promise<CheckpointStats> {
    const checkpoints = await this.listCheckpoints(executionId, 100); // Get all checkpoints

    if (checkpoints.length === 0) {
      return {
        executionId,
        totalCheckpoints: 0,
        totalSizeBytes: 0,
        oldestCheckpointAge: 0,
      };
    }

    const totalSizeBytes = checkpoints.reduce(
      (sum, cp) => sum + (cp.sizeBytes || 0),
      0
    );

    const oldestCheckpoint = checkpoints[checkpoints.length - 1];
    const oldestCheckpointAge = Date.now() - oldestCheckpoint.createdAt;

    return {
      executionId,
      totalCheckpoints: checkpoints.length,
      latestCheckpoint: checkpoints[0],
      totalSizeBytes,
      oldestCheckpointAge,
    };
  }

  /**
   * Create automatic checkpoint at regular intervals
   *
   * Should be called during workflow execution to save state periodically
   */
  async createAutomaticCheckpoint(
    executionId: string,
    state: WorkflowState,
    context: WorkflowContext,
    completedSteps: string[],
    pendingSteps: string[]
  ): Promise<WorkflowCheckpoint | null> {
    // Get execution to check interval
    const execution = this.dao.getExecutionById(executionId);

    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Get latest checkpoint
    const latestCheckpoint = await this.getLatestCheckpoint(executionId);

    // Determine if we should create a new checkpoint
    // Default interval: 60 seconds (60000ms)
    const checkpointInterval = 60000; // TODO: Get from workflow config

    if (!latestCheckpoint) {
      // No checkpoint yet, create first one
      return this.createCheckpoint(
        executionId,
        state,
        context,
        completedSteps,
        pendingSteps,
        {
          createdBy: 'automatic',
          label: 'Auto-checkpoint (first)',
        }
      );
    }

    // Check if enough time has passed
    const timeSinceLastCheckpoint = Date.now() - latestCheckpoint.createdAt;

    if (timeSinceLastCheckpoint >= checkpointInterval) {
      return this.createCheckpoint(
        executionId,
        state,
        context,
        completedSteps,
        pendingSteps,
        {
          createdBy: 'automatic',
          label: `Auto-checkpoint (${Math.floor(timeSinceLastCheckpoint / 1000)}s)`,
        }
      );
    }

    // Not enough time passed, skip checkpoint
    return null;
  }

  /**
   * Validate checkpoint integrity
   *
   * Ensures checkpoint data is valid and can be restored
   */
  async validateCheckpoint(checkpointId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get checkpoint
    const checkpoint = this.dao.getCheckpointById(checkpointId);

    if (!checkpoint) {
      errors.push(`Checkpoint not found: ${checkpointId}`);
      return { valid: false, errors };
    }

    // Validate execution exists
    const execution = this.dao.getExecutionById(checkpoint.executionId);

    if (!execution) {
      errors.push(`Execution not found: ${checkpoint.executionId}`);
    }

    // Validate JSON parsing
    try {
      parseWorkflowContext(checkpoint.context);
    } catch (error) {
      errors.push(`Invalid context JSON: ${error}`);
    }

    try {
      JSON.parse(checkpoint.completedSteps);
    } catch (error) {
      errors.push(`Invalid completedSteps JSON: ${error}`);
    }

    try {
      JSON.parse(checkpoint.pendingSteps);
    } catch (error) {
      errors.push(`Invalid pendingSteps JSON: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
