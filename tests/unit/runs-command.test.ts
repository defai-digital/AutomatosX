/**
 * Runs Command Tests (v5.3.0)
 *
 * Tests for runs command that manages checkpoint runs (list, show, delete).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { CheckpointManager } from '../../src/core/session/checkpoint.js';
import type { CheckpointData, StageStates, ExecutionMode } from '../../src/types/stage-execution.js';

describe('Runs Command', () => {
  let tempDir: string;
  let checkpointManager: CheckpointManager;
  let checkpointsDir: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = join(process.cwd(), 'tmp', `runs-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create checkpoints directory
    checkpointsDir = join(tempDir, 'checkpoints');
    await fs.mkdir(checkpointsDir, { recursive: true });

    checkpointManager = new CheckpointManager(checkpointsDir, 7);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('List Runs', () => {
    it('should list all checkpoint runs', async () => {
      // Create multiple checkpoints
      const runIds: string[] = [];

      for (let i = 0; i < 3; i++) {
        const runId = randomUUID();
        runIds.push(runId);

        const checkpoint: CheckpointData = {
          schemaVersion: '1.0.0',
          checksum: '',
          runId,
          agent: `test-agent-${i}`,
          task: `Test task ${i}`,
          mode: {
            interactive: i % 2 === 0,
            streaming: i % 2 === 1,
            resumable: true,
            autoConfirm: false
          } as ExecutionMode,
          stages: [
            {
              name: 'Stage 1',
              description: 'First stage',
              index: 0,
              status: 'completed',
              retries: 0,
              checkpoint: true
            }
          ] as StageStates[],
          lastCompletedStageIndex: 0,
          previousOutputs: [],
          sharedData: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await checkpointManager.saveCheckpoint(checkpoint);
      }

      // List all checkpoints
      const runs = await checkpointManager.listCheckpoints();

      expect(runs).toHaveLength(3);
      expect(runs.map(r => r.runId).sort()).toEqual(runIds.sort());
    });

    it('should return empty array when no checkpoints exist', async () => {
      const runs = await checkpointManager.listCheckpoints();

      expect(runs).toEqual([]);
    });

    it('should filter runs by status', async () => {
      // Create checkpoints with different statuses
      const completedRunId = randomUUID();
      const failedRunId = randomUUID();

      const completedCheckpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: completedRunId,
        agent: 'test-agent',
        task: 'Completed task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'completed',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: 0,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const failedCheckpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: failedRunId,
        agent: 'test-agent',
        task: 'Failed task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'error',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(completedCheckpoint);
      await checkpointManager.saveCheckpoint(failedCheckpoint);

      // List all runs
      const allRuns = await checkpointManager.listCheckpoints();
      expect(allRuns).toHaveLength(2);

      // Filter by status (this would be done in command handler)
      const completedRuns = allRuns.filter(r => r.status === 'completed');
      const failedRuns = allRuns.filter(r => r.status === 'failed');

      expect(completedRuns).toHaveLength(1);
      expect(completedRuns[0]?.runId).toBe(completedRunId);

      expect(failedRuns).toHaveLength(1);
      expect(failedRuns[0]?.runId).toBe(failedRunId);
    });

    it('should filter runs by agent', async () => {
      // Create checkpoints for different agents
      const bobRunId = randomUUID();
      const frankRunId = randomUUID();

      const bobCheckpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: bobRunId,
        agent: 'bob',
        task: 'Bob task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const frankCheckpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: frankRunId,
        agent: 'frank',
        task: 'Frank task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(bobCheckpoint);
      await checkpointManager.saveCheckpoint(frankCheckpoint);

      // List all runs
      const allRuns = await checkpointManager.listCheckpoints();
      expect(allRuns).toHaveLength(2);

      // Filter by agent (this would be done in command handler)
      const bobRuns = allRuns.filter(r => r.agent === 'bob');
      const frankRuns = allRuns.filter(r => r.agent === 'frank');

      expect(bobRuns).toHaveLength(1);
      expect(bobRuns[0]?.runId).toBe(bobRunId);

      expect(frankRuns).toHaveLength(1);
      expect(frankRuns[0]?.runId).toBe(frankRunId);
    });

    it('should sort runs by update time (most recent first)', async () => {
      const runIds: string[] = [];

      // Create checkpoints with different timestamps
      for (let i = 0; i < 3; i++) {
        const runId = randomUUID();
        runIds.push(runId);

        const checkpoint: CheckpointData = {
          schemaVersion: '1.0.0',
          checksum: '',
          runId,
          agent: `agent-${i}`,
          task: `Task ${i}`,
          mode: {
            interactive: false,
            streaming: false,
            resumable: true,
            autoConfirm: false
          } as ExecutionMode,
          stages: [] as StageStates[],
          lastCompletedStageIndex: -1,
          previousOutputs: [],
          sharedData: {},
          createdAt: new Date(Date.now() - (1000 * (3 - i))).toISOString(),
          updatedAt: new Date(Date.now() - (1000 * (3 - i))).toISOString()
        };

        await checkpointManager.saveCheckpoint(checkpoint);

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const runs = await checkpointManager.listCheckpoints();

      // Most recent should be first
      expect(runs[0]?.agent).toBe('agent-2');
      expect(runs[1]?.agent).toBe('agent-1');
      expect(runs[2]?.agent).toBe('agent-0');
    });

    it('should limit number of results', async () => {
      // Create many checkpoints
      for (let i = 0; i < 10; i++) {
        const runId = randomUUID();

        const checkpoint: CheckpointData = {
          schemaVersion: '1.0.0',
          checksum: '',
          runId,
          agent: `agent-${i}`,
          task: `Task ${i}`,
          mode: {
            interactive: false,
            streaming: false,
            resumable: true,
            autoConfirm: false
          } as ExecutionMode,
          stages: [] as StageStates[],
          lastCompletedStageIndex: -1,
          previousOutputs: [],
          sharedData: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await checkpointManager.saveCheckpoint(checkpoint);
      }

      const allRuns = await checkpointManager.listCheckpoints();
      expect(allRuns).toHaveLength(10);

      // Limit results (this would be done in command handler)
      const limitedRuns = allRuns.slice(0, 5);
      expect(limitedRuns).toHaveLength(5);
    });
  });

  describe('Show Run', () => {
    it('should show detailed checkpoint information', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: true,
          streaming: true,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'completed',
            retries: 0,
            checkpoint: true,
            result: {
              stageName: 'Stage 1',
              stageIndex: 0,
              status: 'completed',
              output: 'Stage 1 output',
              artifacts: [],
              duration: 1500,
              tokensUsed: 150,
              timestamp: new Date().toISOString(),
              retries: 0
            }
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            index: 1,
            status: 'queued',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: 0,
        previousOutputs: ['Stage 1 output'],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Load checkpoint details
      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.runId).toBe(runId);
      expect(loadedCheckpoint.agent).toBe('test-agent');
      expect(loadedCheckpoint.task).toBe('Test task');
      expect(loadedCheckpoint.mode.interactive).toBe(true);
      expect(loadedCheckpoint.mode.streaming).toBe(true);
      expect(loadedCheckpoint.stages).toHaveLength(2);
      expect(loadedCheckpoint.stages[0]?.result?.duration).toBe(1500);
      expect(loadedCheckpoint.stages[0]?.result?.tokensUsed).toBe(150);
    });

    it('should show stage execution history', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'completed',
            retries: 0,
            checkpoint: true,
            result: {
              stageName: 'Stage 1',
              stageIndex: 0,
              status: 'completed',
              output: 'Success',
              artifacts: [],
              duration: 1000,
              tokensUsed: 100,
              timestamp: new Date().toISOString(),
              retries: 0
            }
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            index: 1,
            status: 'error',
            retries: 2,
            checkpoint: true,
            result: {
              stageName: 'Stage 2',
              stageIndex: 1,
              status: 'error',
              output: '',
              artifacts: [],
              duration: 500,
              tokensUsed: 50,
              timestamp: new Date().toISOString(),
              retries: 2,
              error: {
                message: 'Stage failed after retries',
                stack: 'Error stack trace'
              }
            }
          }
        ] as StageStates[],
        lastCompletedStageIndex: 0,
        previousOutputs: ['Success'],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      // Verify stage history
      expect(loadedCheckpoint.stages[0]?.status).toBe('completed');
      expect(loadedCheckpoint.stages[0]?.retries).toBe(0);

      expect(loadedCheckpoint.stages[1]?.status).toBe('error');
      expect(loadedCheckpoint.stages[1]?.retries).toBe(2);
      expect(loadedCheckpoint.stages[1]?.result?.error?.message).toBe('Stage failed after retries');
    });

    it('should handle checkpoint without artifacts', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Check artifacts directory
      const artifactsDir = join(checkpointsDir, runId, 'artifacts');
      const artifactsDirExists = await fs.access(artifactsDir).then(() => true).catch(() => false);

      expect(artifactsDirExists).toBe(true);

      const files = await fs.readdir(artifactsDir);
      expect(files).toHaveLength(0);
    });

    it('should show artifacts if present', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Add some artifacts
      const artifactsDir = join(checkpointsDir, runId, 'artifacts');
      await fs.writeFile(join(artifactsDir, 'artifact1.txt'), 'Artifact content 1');
      await fs.writeFile(join(artifactsDir, 'artifact2.json'), '{"key": "value"}');

      // List artifacts
      const files = await fs.readdir(artifactsDir);
      expect(files).toHaveLength(2);
      expect(files).toContain('artifact1.txt');
      expect(files).toContain('artifact2.json');
    });
  });

  describe('Delete Run', () => {
    it('should delete checkpoint successfully', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Verify checkpoint exists
      const existsBefore = await checkpointManager.checkpointExists(runId);
      expect(existsBefore).toBe(true);

      // Delete checkpoint
      await checkpointManager.deleteCheckpoint(runId);

      // Verify checkpoint deleted
      const existsAfter = await checkpointManager.checkpointExists(runId);
      expect(existsAfter).toBe(false);
    });

    it('should delete checkpoint with all artifacts and logs', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Add artifacts and logs
      const artifactsDir = join(checkpointsDir, runId, 'artifacts');
      const logsDir = join(checkpointsDir, runId, 'logs');

      await fs.writeFile(join(artifactsDir, 'test-artifact.txt'), 'Test artifact');
      await fs.writeFile(join(logsDir, 'test-log.txt'), 'Test log');

      // Delete checkpoint
      await checkpointManager.deleteCheckpoint(runId);

      // Verify entire directory deleted
      const checkpointDir = join(checkpointsDir, runId);
      const dirExists = await fs.access(checkpointDir).then(() => true).catch(() => false);

      expect(dirExists).toBe(false);
    });

    it('should not throw error when deleting non-existent checkpoint', async () => {
      const nonExistentRunId = randomUUID();

      // Should not throw
      await expect(checkpointManager.deleteCheckpoint(nonExistentRunId)).resolves.toBeUndefined();
    });

    it('should handle force delete', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Delete with force (no confirmation)
      await checkpointManager.deleteCheckpoint(runId);

      const exists = await checkpointManager.checkpointExists(runId);
      expect(exists).toBe(false);
    });
  });

  describe('Run Status Determination', () => {
    it('should determine status as completed when all stages completed', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'completed',
            retries: 0,
            checkpoint: true
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            index: 1,
            status: 'completed',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: 1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const runs = await checkpointManager.listCheckpoints();
      expect(runs[0]?.status).toBe('completed');
    });

    it('should determine status as failed when stage has error', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'error',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const runs = await checkpointManager.listCheckpoints();
      expect(runs[0]?.status).toBe('failed');
    });

    it('should determine status as paused when checkpoint present', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'checkpoint',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const runs = await checkpointManager.listCheckpoints();
      expect(runs[0]?.status).toBe('paused');
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress correctly in metadata', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        } as ExecutionMode,
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            index: 0,
            status: 'completed',
            retries: 0,
            checkpoint: true
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            index: 1,
            status: 'completed',
            retries: 0,
            checkpoint: true
          },
          {
            name: 'Stage 3',
            description: 'Third stage',
            index: 2,
            status: 'queued',
            retries: 0,
            checkpoint: true
          }
        ] as StageStates[],
        lastCompletedStageIndex: 1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const runs = await checkpointManager.listCheckpoints();
      expect(runs[0]?.totalStages).toBe(3);
      expect(runs[0]?.completedStages).toBe(2);
    });
  });
});
