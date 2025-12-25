/**
 * Stub Checkpoint Implementation
 *
 * Provides minimal checkpoint storage and manager for when no real
 * implementation is provided via AgentDomainConfig factories.
 *
 * Uses in-memory storage (data lost between invocations).
 * For production use, provide real implementations via config.
 */

import type { CheckpointConfig } from '@defai.digital/contracts';
import type {
  CheckpointStoragePort,
  CheckpointManagerPort,
  Checkpoint,
  CheckpointStorageFactory,
  CheckpointManagerFactory,
} from './types.js';

let _warnedOnce = false;

/**
 * In-memory checkpoint storage (stub)
 */
function createInMemoryCheckpointStorage(): CheckpointStoragePort {
  const checkpoints = new Map<string, Checkpoint>();

  return {
    async save(checkpoint: Checkpoint): Promise<void> {
      checkpoints.set(checkpoint.checkpointId, { ...checkpoint });
    },

    async load(checkpointId: string): Promise<Checkpoint | null> {
      return checkpoints.get(checkpointId) ?? null;
    },

    async loadLatest(agentId: string, sessionId?: string): Promise<Checkpoint | null> {
      let latest: Checkpoint | null = null;
      let latestTime = 0;

      for (const cp of checkpoints.values()) {
        if (cp.agentId !== agentId) continue;
        if (sessionId !== undefined && cp.sessionId !== sessionId) continue;

        const time = new Date(cp.createdAt).getTime();
        if (time > latestTime) {
          latestTime = time;
          latest = cp;
        }
      }

      return latest;
    },

    async list(agentId: string, sessionId?: string): Promise<Checkpoint[]> {
      const results: Checkpoint[] = [];

      for (const cp of checkpoints.values()) {
        if (cp.agentId !== agentId) continue;
        if (sessionId !== undefined && cp.sessionId !== sessionId) continue;
        results.push({ ...cp });
      }

      return results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },

    async delete(checkpointId: string): Promise<boolean> {
      return checkpoints.delete(checkpointId);
    },

    async deleteExpired(): Promise<number> {
      const now = Date.now();
      let count = 0;

      for (const [id, cp] of checkpoints.entries()) {
        if (cp.expiresAt && new Date(cp.expiresAt).getTime() < now) {
          checkpoints.delete(id);
          count++;
        }
      }

      return count;
    },
  };
}

/**
 * Creates a stub checkpoint manager
 */
function createStubCheckpointManager(
  agentId: string,
  sessionId: string | undefined,
  storage: CheckpointStoragePort,
  config: CheckpointConfig
): CheckpointManagerPort {
  return {
    getConfig(): CheckpointConfig {
      return { ...config };
    },

    shouldCheckpoint(stepIndex: number): boolean {
      if (!config.enabled) return false;
      return (stepIndex + 1) % config.intervalSteps === 0;
    },

    async createCheckpoint(
      stepIndex: number,
      stepId: string,
      previousOutputs: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ): Promise<Checkpoint> {
      const now = new Date();
      const checkpoint: Checkpoint = {
        checkpointId: crypto.randomUUID(),
        agentId,
        sessionId,
        stepIndex,
        stepId,
        previousOutputs: { ...previousOutputs },
        metadata,
        createdAt: now.toISOString(),
        expiresAt: config.retentionHours
          ? new Date(now.getTime() + config.retentionHours * 3600 * 1000).toISOString()
          : undefined,
      };

      await storage.save(checkpoint);
      return checkpoint;
    },

    async getLatestCheckpoint(): Promise<Checkpoint | null> {
      return storage.loadLatest(agentId, sessionId);
    },

    async getResumeContext(checkpointId: string): Promise<{
      startFromStep: number;
      previousOutputs: Record<string, unknown>;
    } | null> {
      const checkpoint = await storage.load(checkpointId);
      if (!checkpoint) return null;

      return {
        startFromStep: checkpoint.stepIndex + 1,
        previousOutputs: { ...checkpoint.previousOutputs },
      };
    },

    async cleanup(): Promise<number> {
      return storage.deleteExpired();
    },
  };
}

/**
 * Stub checkpoint storage factory
 */
export const stubCheckpointStorageFactory: CheckpointStorageFactory = () => {
  if (!_warnedOnce) {
    console.warn(
      '[agent-domain] Using stub checkpoint storage. ' +
      'For persistent checkpoints, provide checkpointStorageFactory in config.'
    );
    _warnedOnce = true;
  }
  return createInMemoryCheckpointStorage();
};

/**
 * Stub checkpoint manager factory
 */
export const stubCheckpointManagerFactory: CheckpointManagerFactory = (
  agentId: string,
  sessionId: string | undefined,
  storage: CheckpointStoragePort,
  config: CheckpointConfig
) => {
  return createStubCheckpointManager(agentId, sessionId, storage, config);
};

/**
 * Reset the warning flag (for testing)
 */
export function resetCheckpointStubWarning(): void {
  _warnedOnce = false;
}
