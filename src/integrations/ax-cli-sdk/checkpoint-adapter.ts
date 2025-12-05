/**
 * CheckpointAdapter - Resumable workflow support via ax-cli SDK (v10.4.0)
 *
 * Provides checkpoint/resume capabilities for long-running agent tasks.
 * Leverages ax-cli SDK's CheckpointManager for persistent state management.
 *
 * Benefits:
 * - Fault tolerance for long-running tasks
 * - Resume interrupted workflows
 * - Progress persistence across sessions
 * - Cost savings (no re-execution of completed phases)
 *
 * @module integrations/ax-cli-sdk/checkpoint-adapter
 */

import { logger } from '../../shared/logging/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Checkpoint data structure
 */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;

  /** Workflow/task identifier */
  workflowId: string;

  /** Current phase index */
  phase: number;

  /** Total phases in workflow */
  totalPhases: number;

  /** Completed task identifiers */
  completedTasks: string[];

  /** Accumulated context from completed phases */
  context: string;

  /** Checkpoint creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Workflow-specific metadata */
  metadata?: Record<string, unknown>;

  /** Token usage accumulated */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Checkpoint manager options
 */
export interface CheckpointOptions {
  /** Directory for checkpoint storage */
  checkpointDir?: string;

  /** Auto-save interval in ms (0 = manual only) */
  autoSaveInterval?: number;

  /** Maximum checkpoints to retain per workflow */
  maxCheckpoints?: number;

  /** Enable compression for large contexts */
  compress?: boolean;
}

/**
 * Workflow phase definition
 */
export interface WorkflowPhase {
  /** Phase identifier */
  id: string;

  /** Phase description */
  description: string;

  /** Task to execute */
  task: string;

  /** Dependencies (phase IDs that must complete first) */
  dependencies?: string[];

  /** Estimated tokens for this phase */
  estimatedTokens?: number;
}

/**
 * Workflow definition
 */
export interface Workflow {
  /** Unique workflow identifier */
  id: string;

  /** Workflow name */
  name: string;

  /** Ordered phases */
  phases: WorkflowPhase[];

  /** Workflow metadata */
  metadata?: Record<string, unknown>;
}

/**
 * CheckpointAdapter - Manages workflow checkpoints for resumable execution
 *
 * Features:
 * - Automatic checkpoint creation after each phase
 * - Resume from any checkpoint
 * - Context accumulation across phases
 * - Token usage tracking
 *
 * @example
 * ```typescript
 * const adapter = new CheckpointAdapter();
 *
 * // Create checkpoint after phase completion
 * await adapter.save('auth-workflow', {
 *   phase: 2,
 *   completedTasks: ['design', 'implement'],
 *   context: 'OAuth integration complete...'
 * });
 *
 * // Resume from checkpoint
 * const checkpoint = await adapter.load('auth-workflow');
 * if (checkpoint) {
 *   await resumeFromPhase(checkpoint.phase + 1);
 * }
 * ```
 */
export class CheckpointAdapter {
  private checkpointDir: string;
  private sdkCheckpointManager: any = null;
  private sdkAvailable: boolean | null = null;
  private readonly options: CheckpointOptions;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private pendingCheckpoint: Checkpoint | null = null;

  constructor(options: CheckpointOptions = {}) {
    this.options = {
      checkpointDir: options.checkpointDir ?? '.automatosx/checkpoints',
      autoSaveInterval: options.autoSaveInterval ?? 0,
      maxCheckpoints: options.maxCheckpoints ?? 10,
      compress: options.compress ?? false
    };

    this.checkpointDir = this.options.checkpointDir!;

    logger.debug('CheckpointAdapter initialized', { options: this.options });

    // Setup auto-save if enabled
    if (this.options.autoSaveInterval && this.options.autoSaveInterval > 0) {
      this.setupAutoSave();
    }
  }

  /**
   * Save a checkpoint for the workflow
   *
   * @param workflowId - Workflow identifier
   * @param data - Checkpoint data to save
   * @returns Saved checkpoint
   */
  async save(workflowId: string, data: Partial<Checkpoint>): Promise<Checkpoint> {
    const now = new Date().toISOString();
    const checkpointId = `${workflowId}-${Date.now()}`;

    const checkpoint: Checkpoint = {
      id: checkpointId,
      workflowId,
      phase: data.phase ?? 0,
      totalPhases: data.totalPhases ?? 0,
      completedTasks: data.completedTasks ?? [],
      context: data.context ?? '',
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata,
      tokensUsed: data.tokensUsed
    };

    // Try SDK checkpoint manager first
    if (await this.ensureSDKAvailable()) {
      try {
        await this.saveWithSDK(checkpoint);
        logger.debug('Checkpoint saved via SDK', { workflowId, phase: checkpoint.phase });
        return checkpoint;
      } catch (error) {
        logger.warn('SDK checkpoint failed, falling back to file system', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Fallback: Save to file system
    await this.saveToFileSystem(checkpoint);

    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints(workflowId);

    logger.info('Checkpoint saved', {
      workflowId,
      phase: checkpoint.phase,
      completedTasks: checkpoint.completedTasks.length
    });

    return checkpoint;
  }

  /**
   * Load the latest checkpoint for a workflow
   *
   * @param workflowId - Workflow identifier
   * @returns Latest checkpoint or null if none exists
   */
  async load(workflowId: string): Promise<Checkpoint | null> {
    // Try SDK checkpoint manager first
    if (await this.ensureSDKAvailable()) {
      try {
        const checkpoint = await this.loadFromSDK(workflowId);
        if (checkpoint) {
          logger.debug('Checkpoint loaded via SDK', { workflowId });
          return checkpoint;
        }
      } catch (error) {
        logger.warn('SDK checkpoint load failed, trying file system', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Fallback: Load from file system
    const checkpoint = await this.loadFromFileSystem(workflowId);

    if (checkpoint) {
      logger.info('Checkpoint loaded', {
        workflowId,
        phase: checkpoint.phase,
        completedTasks: checkpoint.completedTasks.length
      });
    }

    return checkpoint;
  }

  /**
   * Check if a checkpoint exists for workflow
   */
  async exists(workflowId: string): Promise<boolean> {
    const checkpoint = await this.load(workflowId);
    return checkpoint !== null;
  }

  /**
   * Delete all checkpoints for a workflow
   */
  async delete(workflowId: string): Promise<void> {
    // Try SDK first
    if (await this.ensureSDKAvailable()) {
      try {
        await this.deleteFromSDK(workflowId);
      } catch (error) {
        logger.warn('SDK checkpoint delete failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Also clean file system
    await this.deleteFromFileSystem(workflowId);

    logger.info('Checkpoints deleted', { workflowId });
  }

  /**
   * List all checkpoints for a workflow
   */
  async list(workflowId: string): Promise<Checkpoint[]> {
    try {
      await fs.mkdir(this.checkpointDir, { recursive: true });
      const files = await fs.readdir(this.checkpointDir);

      // Filter matching files first
      const matchingFiles = files.filter(
        file => file.startsWith(workflowId) && file.endsWith('.json')
      );

      // Read all files in parallel for better performance
      const results = await Promise.all(
        matchingFiles.map(async (file) => {
          try {
            const content = await fs.readFile(
              path.join(this.checkpointDir, file),
              'utf-8'
            );
            return JSON.parse(content) as Checkpoint;
          } catch {
            return null; // Skip invalid files
          }
        })
      );

      // Filter out nulls and sort by creation time (newest first)
      const checkpoints = results.filter((cp): cp is Checkpoint => cp !== null);
      checkpoints.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return checkpoints;
    } catch (error) {
      logger.warn('Failed to list checkpoints', {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Create a workflow checkpoint incrementally
   * Call this after each phase completes
   */
  async savePhase(
    workflowId: string,
    phaseId: string,
    result: {
      content: string;
      success: boolean;
      tokensUsed?: { prompt: number; completion: number; total: number };
    },
    workflow: Workflow
  ): Promise<Checkpoint> {
    // Load existing checkpoint or create new
    let checkpoint = await this.load(workflowId);

    const phaseIndex = workflow.phases.findIndex(p => p.id === phaseId);

    if (!checkpoint) {
      checkpoint = {
        id: `${workflowId}-${Date.now()}`,
        workflowId,
        phase: 0,
        totalPhases: workflow.phases.length,
        completedTasks: [],
        context: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: workflow.metadata,
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }

    // Update checkpoint with phase result
    if (result.success) {
      checkpoint.completedTasks.push(phaseId);
      checkpoint.phase = phaseIndex + 1;
      checkpoint.context += `\n[Phase ${phaseIndex + 1}: ${phaseId}]\n${result.content.substring(0, 1000)}\n`;

      // Accumulate token usage
      if (result.tokensUsed && checkpoint.tokensUsed) {
        checkpoint.tokensUsed.prompt += result.tokensUsed.prompt;
        checkpoint.tokensUsed.completion += result.tokensUsed.completion;
        checkpoint.tokensUsed.total += result.tokensUsed.total;
      }
    }

    checkpoint.updatedAt = new Date().toISOString();

    // Save updated checkpoint
    return this.save(workflowId, checkpoint);
  }

  /**
   * Get remaining phases for a workflow based on checkpoint
   */
  async getRemainingPhases(workflowId: string, workflow: Workflow): Promise<WorkflowPhase[]> {
    const checkpoint = await this.load(workflowId);

    if (!checkpoint) {
      return workflow.phases;
    }

    // Filter out completed phases
    return workflow.phases.filter(phase =>
      !checkpoint.completedTasks.includes(phase.id)
    );
  }

  // Private methods

  private async saveWithSDK(checkpoint: Checkpoint): Promise<void> {
    if (!this.sdkCheckpointManager) {
      const { getCheckpointManager } = await import('@defai.digital/ax-cli/sdk');
      this.sdkCheckpointManager = getCheckpointManager();
    }

    await this.sdkCheckpointManager.save(checkpoint.workflowId, checkpoint);
  }

  private async loadFromSDK(workflowId: string): Promise<Checkpoint | null> {
    if (!this.sdkCheckpointManager) {
      const { getCheckpointManager } = await import('@defai.digital/ax-cli/sdk');
      this.sdkCheckpointManager = getCheckpointManager();
    }

    return this.sdkCheckpointManager.load(workflowId);
  }

  private async deleteFromSDK(workflowId: string): Promise<void> {
    if (!this.sdkCheckpointManager) {
      const { getCheckpointManager } = await import('@defai.digital/ax-cli/sdk');
      this.sdkCheckpointManager = getCheckpointManager();
    }

    await this.sdkCheckpointManager.delete(workflowId);
  }

  private async saveToFileSystem(checkpoint: Checkpoint): Promise<void> {
    await fs.mkdir(this.checkpointDir, { recursive: true });

    const filename = `${checkpoint.workflowId}-${checkpoint.phase}.json`;
    const filepath = path.join(this.checkpointDir, filename);

    const content = JSON.stringify(checkpoint, null, 2);
    await fs.writeFile(filepath, content, 'utf-8');
  }

  private async loadFromFileSystem(workflowId: string): Promise<Checkpoint | null> {
    try {
      const checkpoints = await this.list(workflowId);
      return checkpoints[0] ?? null; // Return newest
    } catch {
      return null;
    }
  }

  private async deleteFromFileSystem(workflowId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.checkpointDir);

      for (const file of files) {
        if (file.startsWith(workflowId) && file.endsWith('.json')) {
          await fs.unlink(path.join(this.checkpointDir, file));
        }
      }
    } catch (error) {
      logger.warn('Failed to delete checkpoints from file system', {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async cleanupOldCheckpoints(workflowId: string): Promise<void> {
    const checkpoints = await this.list(workflowId);
    const maxCheckpoints = this.options.maxCheckpoints!;

    if (checkpoints.length > maxCheckpoints) {
      // Delete oldest checkpoints beyond limit
      const toDelete = checkpoints.slice(maxCheckpoints);

      for (const checkpoint of toDelete) {
        try {
          const filename = `${checkpoint.workflowId}-${checkpoint.phase}.json`;
          await fs.unlink(path.join(this.checkpointDir, filename));
        } catch {
          // Ignore deletion errors
        }
      }

      logger.debug('Old checkpoints cleaned up', {
        workflowId,
        deleted: toDelete.length
      });
    }
  }

  private async ensureSDKAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      const sdk = await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = typeof sdk.getCheckpointManager === 'function';
      return this.sdkAvailable;
    } catch {
      this.sdkAvailable = false;
      return false;
    }
  }

  private setupAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (this.pendingCheckpoint) {
        try {
          await this.save(
            this.pendingCheckpoint.workflowId,
            this.pendingCheckpoint
          );
          this.pendingCheckpoint = null;
        } catch (error) {
          logger.warn('Auto-save failed', {
            error: error instanceof Error ? error.message : String(error)
          });
          // Keep pending checkpoint for retry
        }
      }
    }, this.options.autoSaveInterval!);
  }

  /**
   * Mark checkpoint for auto-save
   */
  setPendingCheckpoint(checkpoint: Checkpoint): void {
    this.pendingCheckpoint = checkpoint;
  }

  /**
   * Cleanup resources
   * BUG FIX: Flush pending checkpoint before destroying to prevent data loss
   */
  async destroy(): Promise<void> {
    // BUG FIX: Stop auto-save timer first
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // BUG FIX: Flush any pending checkpoint before destroying
    if (this.pendingCheckpoint) {
      try {
        await this.save(
          this.pendingCheckpoint.workflowId,
          this.pendingCheckpoint
        );
        logger.debug('Pending checkpoint flushed on destroy', {
          workflowId: this.pendingCheckpoint.workflowId
        });
      } catch (error) {
        logger.warn('Failed to flush pending checkpoint on destroy', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.pendingCheckpoint = null;
    }

    this.sdkCheckpointManager = null;

    logger.debug('CheckpointAdapter destroyed');
  }
}
