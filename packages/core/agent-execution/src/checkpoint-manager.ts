/**
 * Checkpoint Manager Implementation
 *
 * Manages agent execution checkpoints for resumable workflows.
 * Enables recovery from failures by persisting execution state.
 *
 * Invariants:
 * - INV-CP-001: Checkpoint contains all data needed to resume
 * - INV-CP-002: Resumed execution starts from step after checkpoint
 */

import {
  type Checkpoint,
  type CheckpointConfig,
  type ResumeContext,
  type MemorySnapshotItem,
  createDefaultCheckpointConfig,
  CheckpointErrorCodes,
} from '@defai.digital/contracts';

/**
 * Checkpoint storage interface - allows different storage backends
 */
export interface CheckpointStorage {
  /** Save a checkpoint */
  save(checkpoint: Checkpoint): Promise<void>;

  /** Load a checkpoint by ID */
  load(checkpointId: string): Promise<Checkpoint | null>;

  /** Load latest checkpoint for an agent */
  loadLatest(agentId: string, sessionId?: string): Promise<Checkpoint | null>;

  /** List checkpoints for an agent */
  list(agentId: string, sessionId?: string): Promise<Checkpoint[]>;

  /** Delete a checkpoint */
  delete(checkpointId: string): Promise<boolean>;

  /** Delete expired checkpoints */
  deleteExpired(): Promise<number>;
}

/**
 * Checkpoint manager for a single agent
 */
export interface CheckpointManager {
  /** Get configuration */
  getConfig(): CheckpointConfig;

  /** Create a checkpoint from current execution state */
  createCheckpoint(
    stepIndex: number,
    completedStepId: string,
    stepOutputs: Record<string, unknown>,
    context: Record<string, unknown>,
    memorySnapshot?: MemorySnapshotItem[]
  ): Promise<Checkpoint>;

  /** Get resume context from a checkpoint */
  getResumeContext(checkpointId: string): Promise<ResumeContext | null>;

  /** Get latest checkpoint */
  getLatestCheckpoint(): Promise<Checkpoint | null>;

  /** List all checkpoints */
  listCheckpoints(): Promise<Checkpoint[]>;

  /** Delete a checkpoint */
  deleteCheckpoint(checkpointId: string): Promise<boolean>;

  /** Clean up expired checkpoints */
  cleanupExpired(): Promise<number>;

  /** Check if a step should be checkpointed */
  shouldCheckpoint(stepIndex: number): boolean;
}

/**
 * In-memory checkpoint storage (for development/testing)
 */
export function createInMemoryCheckpointStorage(): CheckpointStorage {
  const checkpoints = new Map<string, Checkpoint>();

  return {
    async save(checkpoint: Checkpoint): Promise<void> {
      checkpoints.set(checkpoint.checkpointId, checkpoint);
    },

    async load(checkpointId: string): Promise<Checkpoint | null> {
      return checkpoints.get(checkpointId) ?? null;
    },

    async loadLatest(
      agentId: string,
      sessionId?: string
    ): Promise<Checkpoint | null> {
      const agentCheckpoints = Array.from(checkpoints.values())
        .filter(
          (cp) =>
            cp.agentId === agentId &&
            (sessionId === undefined || cp.sessionId === sessionId)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      return agentCheckpoints[0] ?? null;
    },

    async list(agentId: string, sessionId?: string): Promise<Checkpoint[]> {
      return Array.from(checkpoints.values())
        .filter(
          (cp) =>
            cp.agentId === agentId &&
            (sessionId === undefined || cp.sessionId === sessionId)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },

    async delete(checkpointId: string): Promise<boolean> {
      return checkpoints.delete(checkpointId);
    },

    async deleteExpired(): Promise<number> {
      const now = Date.now();
      let deleted = 0;

      for (const [id, checkpoint] of checkpoints) {
        if (checkpoint.expiresAt) {
          const expiresAt = new Date(checkpoint.expiresAt).getTime();
          if (expiresAt < now) {
            checkpoints.delete(id);
            deleted++;
          }
        }
      }

      return deleted;
    },
  };
}

/**
 * Creates a checkpoint manager for an agent
 */
export function createCheckpointManager(
  agentId: string,
  sessionId: string | undefined,
  storage: CheckpointStorage,
  config: Partial<CheckpointConfig> = {}
): CheckpointManager {
  const cfg = { ...createDefaultCheckpointConfig(), ...config };

  return {
    getConfig(): CheckpointConfig {
      return { ...cfg };
    },

    async createCheckpoint(
      stepIndex: number,
      completedStepId: string,
      stepOutputs: Record<string, unknown>,
      context: Record<string, unknown>,
      memorySnapshot?: MemorySnapshotItem[]
    ): Promise<Checkpoint> {
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + cfg.retentionHours * 60 * 60 * 1000
      );

      // INV-CP-001: Checkpoint contains all data needed to resume
      const checkpoint: Checkpoint = {
        checkpointId: crypto.randomUUID(),
        agentId,
        sessionId,
        stepIndex,
        completedStepId,
        stepOutputs,
        context,
        memorySnapshot: cfg.includeMemory ? memorySnapshot : undefined,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await storage.save(checkpoint);

      // Enforce max checkpoints by querying actual storage state
      // (not relying on local counter which can get out of sync)
      const allCheckpoints = await storage.list(agentId, sessionId);
      if (allCheckpoints.length > cfg.maxCheckpoints) {
        // list() returns checkpoints sorted newest-first, so slice from maxCheckpoints
        // to get the oldest checkpoints that exceed the limit
        const toDelete = allCheckpoints.slice(cfg.maxCheckpoints);
        for (const cp of toDelete) {
          await storage.delete(cp.checkpointId);
        }
      }

      return checkpoint;
    },

    async getResumeContext(checkpointId: string): Promise<ResumeContext | null> {
      const checkpoint = await storage.load(checkpointId);

      if (!checkpoint) {
        return null;
      }

      // Check if expired
      if (checkpoint.expiresAt) {
        const expiresAt = new Date(checkpoint.expiresAt).getTime();
        if (expiresAt < Date.now()) {
          await storage.delete(checkpointId);
          return null;
        }
      }

      // INV-CP-002: Resumed execution starts from step after checkpoint
      return {
        startFromStep: checkpoint.stepIndex + 1,
        previousOutputs: checkpoint.stepOutputs,
        context: checkpoint.context,
        memorySnapshot: checkpoint.memorySnapshot,
      };
    },

    async getLatestCheckpoint(): Promise<Checkpoint | null> {
      return storage.loadLatest(agentId, sessionId);
    },

    async listCheckpoints(): Promise<Checkpoint[]> {
      return storage.list(agentId, sessionId);
    },

    async deleteCheckpoint(checkpointId: string): Promise<boolean> {
      return storage.delete(checkpointId);
    },

    async cleanupExpired(): Promise<number> {
      return storage.deleteExpired();
    },

    shouldCheckpoint(stepIndex: number): boolean {
      if (!cfg.enabled) return false;
      if (cfg.intervalSteps === 0) return true;
      return stepIndex % cfg.intervalSteps === 0;
    },
  };
}

/**
 * Checkpoint manager error
 */
export class CheckpointError extends Error {
  constructor(
    public readonly code: string,
    public readonly checkpointId?: string,
    message?: string
  ) {
    super(message ?? `Checkpoint error: ${code}`);
    this.name = 'CheckpointError';
  }

  static notFound(checkpointId: string): CheckpointError {
    return new CheckpointError(
      CheckpointErrorCodes.CHECKPOINT_NOT_FOUND,
      checkpointId,
      `Checkpoint not found: ${checkpointId}`
    );
  }

  static expired(checkpointId: string): CheckpointError {
    return new CheckpointError(
      CheckpointErrorCodes.CHECKPOINT_EXPIRED,
      checkpointId,
      `Checkpoint expired: ${checkpointId}`
    );
  }

  static saveFailed(checkpointId?: string): CheckpointError {
    return new CheckpointError(
      CheckpointErrorCodes.CHECKPOINT_SAVE_FAILED,
      checkpointId,
      'Failed to save checkpoint'
    );
  }
}
