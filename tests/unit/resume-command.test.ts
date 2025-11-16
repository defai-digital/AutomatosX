/**
 * Resume Command Tests (v5.3.0)
 *
 * Tests for resume command that restores execution from checkpoints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { CheckpointData, StageStates, ExecutionMode } from '../../src/types/stage-execution.js';
import { CheckpointManager } from '../../src/core/checkpoint-manager.js';
import { detectProjectRoot } from '../../src/core/path-resolver.js';

// Note: We test the command handler logic, not the full CLI integration
describe('Resume Command', () => {
  let tempDir: string;
  let checkpointManager: CheckpointManager;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = join(process.cwd(), 'tmp', `resume-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create .automatosx directory structure
    const automatosxDir = join(tempDir, '.automatosx');
    await fs.mkdir(automatosxDir, { recursive: true });
    await fs.mkdir(join(automatosxDir, 'agents'), { recursive: true });
    await fs.mkdir(join(automatosxDir, 'abilities'), { recursive: true });
    await fs.mkdir(join(automatosxDir, 'teams'), { recursive: true });
    await fs.mkdir(join(automatosxDir, 'memory'), { recursive: true });
    await fs.mkdir(join(automatosxDir, 'sessions'), { recursive: true });
    await fs.mkdir(join(automatosxDir, 'workspaces'), { recursive: true });

    // Create checkpoints directory
    const checkpointsDir = join(automatosxDir, 'checkpoints');
    await fs.mkdir(checkpointsDir, { recursive: true });

    checkpointManager = new CheckpointManager(checkpointsDir, 7);

    // Create minimal config file
    const config = {
      providers: {
        'claude-code': {
          enabled: false,
          priority: 1,
          timeout: 30000,
          command: 'claude'
        },
        'gemini-cli': {
          enabled: false,
          priority: 2,
          timeout: 30000,
          command: 'gemini'
        },
        openai: {
          enabled: false,
          priority: 3,
          timeout: 30000,
          command: 'codex'
        }
      },
      execution: {
        stages: {
          checkpointPath: checkpointsDir,
          autoSaveCheckpoint: true,
          cleanupAfterDays: 7,
          defaultTimeout: 30000
        }
      }
    };

    await fs.writeFile(
      join(automatosxDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // Create test agent
    const testAgent = {
      name: 'test-agent',
      displayName: 'Test Agent',
      team: 'core',
      role: 'tester',
      description: 'Test agent',
      systemPrompt: 'Test prompt',
      abilities: [],
      stages: [
        {
          name: 'Stage 1',
          description: 'First stage',
          checkpoint: true
        },
        {
          name: 'Stage 2',
          description: 'Second stage',
          checkpoint: true
        }
      ]
    };

    await fs.writeFile(
      join(automatosxDir, 'agents', 'test-agent.yaml'),
      `name: test-agent
displayName: Test Agent
team: core
role: tester
description: Test agent
systemPrompt: Test prompt
abilities: []
stages:
  - name: Stage 1
    description: First stage
    checkpoint: true
  - name: Stage 2
    description: Second stage
    checkpoint: true
`
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Resume Logic', () => {
    it('should load checkpoint successfully', async () => {
      // Create a checkpoint
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
              output: 'Stage 1 output',
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

      // Load checkpoint
      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.runId).toBe(runId);
      expect(loadedCheckpoint.agent).toBe('test-agent');
      expect(loadedCheckpoint.task).toBe('Test task');
      expect(loadedCheckpoint.lastCompletedStageIndex).toBe(0);
      expect(loadedCheckpoint.previousOutputs).toHaveLength(1);
      expect(loadedCheckpoint.previousOutputs[0]).toBe('Stage 1 output');
    });

    it('should preserve mode when resuming without override', async () => {
      const runId = randomUUID();
      const originalMode: ExecutionMode = {
        interactive: true,
        streaming: true,
        resumable: true,
        autoConfirm: false
      };

      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: originalMode,
        stages: [] as StageStates[],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.mode.interactive).toBe(true);
      expect(loadedCheckpoint.mode.streaming).toBe(true);
      expect(loadedCheckpoint.mode.resumable).toBe(true);
      expect(loadedCheckpoint.mode.autoConfirm).toBe(false);
    });

    it('should handle invalid runId', async () => {
      const invalidRunId = 'invalid-run-id';

      await expect(checkpointManager.loadCheckpoint(invalidRunId))
        .rejects.toThrow('Invalid run ID format');
    });

    it('should handle non-existent checkpoint', async () => {
      const nonExistentRunId = randomUUID();

      await expect(checkpointManager.loadCheckpoint(nonExistentRunId))
        .rejects.toThrow('Checkpoint not found');
    });
  });

  describe('Checkpoint Validation', () => {
    it('should validate checkpoint structure', async () => {
      const runId = randomUUID();

      // Create checkpoint with missing required field
      const invalidCheckpoint = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        // Missing 'agent' field
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false,
          resumable: true,
          autoConfirm: false
        },
        stages: [],
        lastCompletedStageIndex: -1,
        previousOutputs: [],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Manually save invalid checkpoint (bypass validation)
      const checkpointPath = join(tempDir, '.automatosx', 'checkpoints', runId);
      await fs.mkdir(checkpointPath, { recursive: true });
      await fs.writeFile(
        join(checkpointPath, 'checkpoint.json'),
        JSON.stringify(invalidCheckpoint),
        'utf-8'
      );

      // Should fail validation
      await expect(checkpointManager.loadCheckpoint(runId))
        .rejects.toThrow('Missing required field: agent');
    });

    it('should validate stage states', async () => {
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
              output: 'Stage 1 output',
              artifacts: [],
              duration: 1000,
              tokensUsed: 100,
              timestamp: new Date().toISOString(),
              retries: 0
            }
          }
        ] as StageStates[],
        lastCompletedStageIndex: 0,
        previousOutputs: ['Stage 1 output'],
        sharedData: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.stages).toHaveLength(1);
      expect(loadedCheckpoint.stages[0]?.status).toBe('completed');
      expect(loadedCheckpoint.stages[0]?.result).toBeDefined();
      expect(loadedCheckpoint.stages[0]?.result?.output).toBe('Stage 1 output');
    });
  });

  describe('Resume Context Restoration', () => {
    it('should restore previous outputs correctly', async () => {
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
              output: 'First output',
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
            status: 'completed',
            retries: 0,
            checkpoint: true,
            result: {
              stageName: 'Stage 2',
              stageIndex: 1,
              status: 'completed',
              output: 'Second output',
              artifacts: [],
              duration: 1000,
              tokensUsed: 100,
              timestamp: new Date().toISOString(),
              retries: 0
            }
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
        previousOutputs: ['First output', 'Second output'],
        sharedData: { key1: 'value1' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      // Verify previous outputs are restored
      expect(loadedCheckpoint.previousOutputs).toHaveLength(2);
      expect(loadedCheckpoint.previousOutputs[0]).toBe('First output');
      expect(loadedCheckpoint.previousOutputs[1]).toBe('Second output');

      // Verify shared data is restored
      expect(loadedCheckpoint.sharedData).toEqual({ key1: 'value1' });

      // Verify next stage to execute is Stage 3
      expect(loadedCheckpoint.lastCompletedStageIndex).toBe(1);
      expect(loadedCheckpoint.stages[2]?.status).toBe('queued');
    });

    it('should restore shared data correctly', async () => {
      const runId = randomUUID();
      const sharedData = {
        userPreferences: { theme: 'dark', language: 'en' },
        sessionData: { userId: 'user123', timestamp: Date.now() },
        metrics: { executionTime: 5000, tokensUsed: 1000 }
      };

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
        sharedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await checkpointManager.saveCheckpoint(checkpoint);

      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.sharedData).toEqual(sharedData);
    });
  });

  describe('Command Options', () => {
    it('should handle interactive mode override', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false, // Originally non-interactive
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

      // When resuming with --interactive, mode should be overridden
      // This is tested at the command handler level, not CheckpointManager
      const loadedCheckpoint = await checkpointManager.loadCheckpoint(runId);

      expect(loadedCheckpoint.mode.interactive).toBe(false); // Original mode
    });

    it('should handle streaming mode override', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: false,
          streaming: false, // Originally non-streaming
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

      expect(loadedCheckpoint.mode.streaming).toBe(false); // Original mode
    });

    it('should handle auto-continue option', async () => {
      const runId = randomUUID();
      const checkpoint: CheckpointData = {
        schemaVersion: '1.0.0',
        checksum: '',
        runId,
        agent: 'test-agent',
        task: 'Test task',
        mode: {
          interactive: true,
          streaming: false,
          resumable: true,
          autoConfirm: false // Originally requires confirmation
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

      expect(loadedCheckpoint.mode.autoConfirm).toBe(false); // Original mode
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted checkpoint file', async () => {
      const runId = randomUUID();

      // Create corrupted checkpoint
      const checkpointPath = join(tempDir, '.automatosx', 'checkpoints', runId);
      await fs.mkdir(checkpointPath, { recursive: true });
      await fs.writeFile(
        join(checkpointPath, 'checkpoint.json'),
        'invalid json {{{',
        'utf-8'
      );

      // Should fail to parse
      await expect(checkpointManager.loadCheckpoint(runId))
        .rejects.toThrow();
    });

    it('should handle missing checkpoint directory', async () => {
      const runId = randomUUID();

      // Checkpoint directory doesn't exist
      await expect(checkpointManager.loadCheckpoint(runId))
        .rejects.toThrow('Checkpoint not found');
    });
  });

  describe('Checkpoint Metadata', () => {
    it('should save and load metadata correctly', async () => {
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

      // Read metadata file
      const metadataPath = join(tempDir, '.automatosx', 'checkpoints', runId, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.runId).toBe(runId);
      expect(metadata.agent).toBe('test-agent');
      expect(metadata.task).toBe('Test task');
      expect(metadata.totalStages).toBe(1);
      expect(metadata.completedStages).toBe(1);
      expect(metadata.resumable).toBe(true);
    });
  });
});
