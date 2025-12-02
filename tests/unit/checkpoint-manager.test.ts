/**
 * CheckpointManager Tests (v5.3.0)
 *
 * Comprehensive tests for checkpoint persistence, validation, and lifecycle management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { CheckpointManager, CheckpointValidationError } from '../../src/core/checkpoint-manager.js';
import type { CheckpointData, StageStates, ExecutionMode } from '../../src/types/stage-execution.js';

describe('CheckpointManager', () => {
  let tempDir: string;
  let checkpointManager: CheckpointManager;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = join(process.cwd(), 'tmp', `checkpoint-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    checkpointManager = new CheckpointManager(tempDir, 7);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('saveCheckpoint', () => {
    it('should save checkpoint with correct structure', async () => {
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
              output: 'Stage output',
              artifacts: [],
              duration: 1000,
              tokensUsed: 100,
              timestamp: new Date().toISOString(),
              retries: 0
            }
          }
        ] as StageStates[],
        lastCompletedStageIndex: 0,
        previousOutputs: ['Stage output'],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const checkpointPath = await checkpointManager.saveCheckpoint(checkpoint);

      // Verify checkpoint file exists
      const checkpointExists = await fs.access(checkpointPath).then(() => true).catch(() => false);
      expect(checkpointExists).toBe(true);

      // Verify metadata file exists
      const metadataPath = join(tempDir, runId, 'metadata.json');
      const metadataExists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(metadataExists).toBe(true);

      // Verify artifacts directory exists
      const artifactsDir = join(tempDir, runId, 'artifacts');
      const artifactsExists = await fs.access(artifactsDir).then(() => true).catch(() => false);
      expect(artifactsExists).toBe(true);

      // Verify logs directory exists
      const logsDir = join(tempDir, runId, 'logs');
      const logsExists = await fs.access(logsDir).then(() => true).catch(() => false);
      expect(logsExists).toBe(true);
    });

    it('should calculate checksum correctly', async () => {
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

      // Load and verify checksum exists
      const savedCheckpoint = await checkpointManager.loadCheckpoint(runId);
      expect(savedCheckpoint.checksum).toBeDefined();
      expect(savedCheckpoint.checksum).not.toBe('');
    });

    it('should throw error for invalid runId with path traversal attempt', async () => {
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: '../../../etc/passwd',
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

      await expect(checkpointManager.saveCheckpoint(checkpoint)).rejects.toThrow(CheckpointValidationError);
    });

    it('should update metadata correctly', async () => {
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
          }
        ] as StageStates[],
        lastCompletedStageIndex: 0,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      // Read metadata
      const metadataPath = join(tempDir, runId, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.runId).toBe(runId);
      expect(metadata.agent).toBe('test-agent');
      expect(metadata.task).toBe('Test task');
      expect(metadata.totalStages).toBe(1);
      expect(metadata.completedStages).toBe(1);
    });
  });

  describe('loadCheckpoint', () => {
    it('should load checkpoint successfully', async () => {
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
      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.runId).toBe(runId);
      expect(loadedCheckpoint.agent).toBe('test-agent');
      expect(loadedCheckpoint.task).toBe('Test task');
    });

    it('should throw error if checkpoint not found', async () => {
      const nonExistentRunId = randomUUID();

      await expect(checkpointManager.loadCheckpoint(nonExistentRunId)).rejects.toThrow(CheckpointValidationError);
      await expect(checkpointManager.loadCheckpoint(nonExistentRunId)).rejects.toThrow('Checkpoint not found');
    });

    it('should throw error for invalid runId format', async () => {
      await expect(checkpointManager.loadCheckpoint('invalid-id')).rejects.toThrow(CheckpointValidationError);
      await expect(checkpointManager.loadCheckpoint('invalid-id')).rejects.toThrow('Invalid run ID format');
    });

    it('should validate checksum on load', async () => {
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

      // Tamper with checkpoint
      const checkpointPath = join(tempDir, runId, 'checkpoint.json');
      const savedContent = await fs.readFile(checkpointPath, 'utf-8');
      const savedCheckpoint = JSON.parse(savedContent);
      savedCheckpoint.task = 'Tampered task';
      await fs.writeFile(checkpointPath, JSON.stringify(savedCheckpoint), 'utf-8');

      // Should fail checksum validation
      await expect(checkpointManager.loadCheckpoint(runId)).rejects.toThrow(CheckpointValidationError);
      await expect(checkpointManager.loadCheckpoint(runId)).rejects.toThrow('Checksum mismatch');
    });
  });

  describe('validateCheckpoint', () => {
    it('should validate required fields', async () => {
      const invalidCheckpoint = {
        schemaVersion: '1.0.0',
        checksum: 'test-checksum',
        // Missing runId
        agent: 'test-agent',
        task: 'Test task'
      } as unknown as CheckpointData;

      await expect(checkpointManager['validateCheckpoint'](invalidCheckpoint)).rejects.toThrow('Missing required field: runId');
    });

    it('should validate schema version compatibility', async () => {
      const runId = randomUUID();
      const futureCheckpoint: CheckpointData = {
        schemaVersion: '999.0.0', // Future version
        checksum: 'test-checksum',
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

      await expect(checkpointManager['validateCheckpoint'](futureCheckpoint)).rejects.toThrow('Incompatible schema version');
    });
  });

  describe('listCheckpoints', () => {
    it('should return empty array if no checkpoints exist', async () => {
      const checkpoints = await checkpointManager.listCheckpoints();
      expect(checkpoints).toEqual([]);
    });

    it('should list all checkpoints', async () => {
      // Create multiple checkpoints
      for (let i = 0; i < 3; i++) {
        const runId = randomUUID();
        const checkpoint: CheckpointData = {
          schemaVersion: '1.0.0',
          checksum: '',
          runId,
          agent: `test-agent-${i}`,
          task: `Test task ${i}`,
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

      const checkpoints = await checkpointManager.listCheckpoints();
      expect(checkpoints).toHaveLength(3);
    });

    it('should sort checkpoints by updatedAt (most recent first)', async () => {
      const runIds: string[] = [];

      // Create checkpoints with different timestamps
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

      const checkpoints = await checkpointManager.listCheckpoints();

      // Most recent should be first
      expect(checkpoints[0]?.agent).toBe('test-agent-2');
      expect(checkpoints[1]?.agent).toBe('test-agent-1');
      expect(checkpoints[2]?.agent).toBe('test-agent-0');
    });
  });

  describe('deleteCheckpoint', () => {
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

    it('should not throw error when deleting non-existent checkpoint', async () => {
      const nonExistentRunId = randomUUID();

      // Should not throw
      await expect(checkpointManager.deleteCheckpoint(nonExistentRunId)).resolves.toBeUndefined();
    });
  });

  describe('cleanupOldCheckpoints', () => {
    it('should delete checkpoints older than cleanupAfterDays', async () => {
      // Create manager with 5 day cleanup window
      const cleanupManager = new CheckpointManager(tempDir, 5);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days old (older than 5 days)

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days old (within 5 days)

      // Create old checkpoint
      const oldRunId = randomUUID();
      const oldCheckpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: oldRunId,
        agent: 'test-agent',
        task: 'Old task',
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
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString()
      };

      // Create recent checkpoint
      const recentRunId = randomUUID();
      const recentCheckpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId: recentRunId,
        agent: 'test-agent',
        task: 'Recent task',
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
        createdAt: recentDate.toISOString(),
        updatedAt: recentDate.toISOString()
      };

      await cleanupManager.saveCheckpoint(oldCheckpoint);
      await cleanupManager.saveCheckpoint(recentCheckpoint);

      // Manually update metadata updatedAt to old date (since saveCheckpoint overwrites it)
      const oldMetadataPath = join(tempDir, oldRunId, 'metadata.json');
      const oldMetadataContent = await fs.readFile(oldMetadataPath, 'utf-8');
      const oldMetadata = JSON.parse(oldMetadataContent);
      oldMetadata.updatedAt = oldDate.toISOString();
      await fs.writeFile(oldMetadataPath, JSON.stringify(oldMetadata, null, 2));

      // Cleanup
      const deletedCount = await cleanupManager.cleanupOldCheckpoints();

      // Old checkpoint should be deleted
      expect(deletedCount).toBe(1);

      // Verify old checkpoint deleted
      const oldExists = await cleanupManager.checkpointExists(oldRunId);
      expect(oldExists).toBe(false);

      // Verify recent checkpoint still exists
      const recentExists = await cleanupManager.checkpointExists(recentRunId);
      expect(recentExists).toBe(true);
    });
  });

  describe('checkpointExists', () => {
    it('should return true for existing checkpoint', async () => {
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

      const exists = await checkpointManager.checkpointExists(runId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent checkpoint', async () => {
      const nonExistentRunId = randomUUID();

      const exists = await checkpointManager.checkpointExists(nonExistentRunId);
      expect(exists).toBe(false);
    });
  });

  describe('getCheckpointDir', () => {
    it('should return correct checkpoint directory path', () => {
      const runId = randomUUID();
      const checkpointDir = checkpointManager.getCheckpointDir(runId);

      expect(checkpointDir).toBe(join(tempDir, runId));
    });

    it('should throw error for invalid runId', () => {
      expect(() => checkpointManager.getCheckpointDir('invalid-id')).toThrow(CheckpointValidationError);
    });
  });

  describe('Security', () => {
    it('should prevent path traversal in runId', async () => {
      const maliciousRunId = '../../../etc/passwd';

      await expect(checkpointManager.checkpointExists(maliciousRunId)).rejects.toThrow(CheckpointValidationError);
      await expect(checkpointManager.checkpointExists(maliciousRunId)).rejects.toThrow('Invalid run ID format');
    });

    it('should validate runId format strictly', async () => {
      const invalidRunIds = [
        'not-a-uuid',
        '12345',
        'abc-def-ghi',
        '../relative/path',
        '/absolute/path'
      ];

      for (const invalidRunId of invalidRunIds) {
        await expect(checkpointManager.checkpointExists(invalidRunId)).rejects.toThrow(CheckpointValidationError);
      }
    });
  });
});
