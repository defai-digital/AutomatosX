/**
 * StageExecutionController Tests (v5.3.0)
 *
 * Comprehensive tests for stage-based execution orchestration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { StageExecutionController } from '../../src/core/stage-execution-controller.js';
import { CheckpointManager } from '../../src/core/checkpoint-manager.js';
import type { AgentExecutor, ExecutionResult } from '../../src/agents/executor.js';
import type { ContextManager } from '../../src/agents/context-manager.js';
import type { ProfileLoader } from '../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../src/types/agent.js';
import type {
  ExecutionMode,
  StageExecutionConfig,
  StageExecutionOptions,
  CheckpointData,
  StageStates
} from '../../src/types/stage-execution.js';
import type { ExecutionResponse, Provider } from '../../src/types/provider.js';
import type { ExecutionContext } from '../../src/types/agent.js';
import type { IMemoryManager } from '../../src/types/memory.js';

describe('StageExecutionController', () => {
  let tempDir: string;
  let controller: StageExecutionController;
  let mockAgentExecutor: AgentExecutor;
  let mockContextManager: ContextManager;
  let mockProfileLoader: ProfileLoader;
  let mockMemoryManager: IMemoryManager;
  let config: StageExecutionConfig;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = join(process.cwd(), 'tmp', `stage-exec-test-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Mock agent executor
    mockAgentExecutor = {
      execute: vi.fn().mockResolvedValue({
        response: {
          content: 'Stage completed successfully',
          tokensUsed: {
            prompt: 10,
            completion: 20,
            total: 30
          },
          latencyMs: 100,
          model: 'test-model',
          finishReason: 'stop'
        } as ExecutionResponse,
        duration: 100,
        context: {} as ExecutionContext
      } as ExecutionResult)
    } as unknown as AgentExecutor;

    // Create mock provider
    const mockProvider: Provider = {
      name: 'mock',
      version: '1.0.0',
      priority: 1,
      capabilities: {
        supportsStreaming: false,
        supportsEmbedding: false,
        supportsVision: false,
        maxContextTokens: 4096,
        supportedModels: ['mock-model']
      },
      isAvailable: vi.fn().mockResolvedValue(true),
      getHealth: vi.fn().mockResolvedValue({
        available: true,
        latencyMs: 100,
        errorRate: 0,
        consecutiveFailures: 0
      }),
      checkRateLimit: vi.fn().mockResolvedValue({
        hasCapacity: true,
        requestsRemaining: 100,
        tokensRemaining: 10000,
        resetAtMs: Date.now() + 60000
      }),
      waitForCapacity: vi.fn().mockResolvedValue(undefined),
      estimateCost: vi.fn().mockResolvedValue({
        estimatedUsd: 0.01,
        tokensUsed: 30
      }),
      getUsageStats: vi.fn().mockResolvedValue({
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatencyMs: 0,
        errorCount: 0
      }),
      shouldRetry: vi.fn().mockReturnValue(false),
      getRetryDelay: vi.fn().mockReturnValue(1000),
      execute: vi.fn(),
      supportsStreaming: vi.fn().mockReturnValue(false),
      generateEmbedding: vi.fn()
    } as unknown as Provider;

    // Mock context manager
    mockContextManager = {
      createContext: vi.fn().mockResolvedValue({
        agent: {
          name: 'test-agent',
          role: 'tester',
          description: 'Test agent',
          systemPrompt: 'Test prompt',
          abilities: [],
          provider: 'mock'
        },
        task: 'Test task',
        memory: [],
        projectDir: tempDir,
        workingDir: tempDir,
        agentWorkspace: join(tempDir, '.automatosx', 'workspaces', 'test-agent'),
        provider: mockProvider,
        abilities: 'Test abilities',
        createdAt: new Date()
      } as ExecutionContext)
    } as unknown as ContextManager;

    // Mock profile loader
    mockProfileLoader = {
      loadProfile: vi.fn().mockResolvedValue({
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            key_questions: ['Question 1'],
            outputs: ['Output 1'],
            checkpoint: true
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            key_questions: ['Question 2'],
            outputs: ['Output 2'],
            checkpoint: true
          }
        ]
      } as AgentProfile)
    } as unknown as ProfileLoader;

    // Mock memory manager
    mockMemoryManager = {
      add: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    } as unknown as IMemoryManager;

    // Stage execution config
    config = {
      checkpointPath: join(tempDir, 'checkpoints'),
      autoSaveCheckpoint: true,
      cleanupAfterDays: 7,
      defaultStageTimeout: 30000,
      userDecisionTimeout: 10000,
      defaultMaxRetries: 1,
      defaultRetryDelay: 1000,
      progressUpdateInterval: 100,
      syntheticProgress: false,
      promptTimeout: 10000,
      autoConfirm: false
    };

    // Create controller
    controller = new StageExecutionController(
      mockAgentExecutor,
      mockContextManager,
      mockProfileLoader,
      config,
      undefined, // hooks
      mockMemoryManager
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

  describe('execute', () => {
    it('should execute all stages successfully in non-interactive mode', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            checkpoint: false
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      const options: StageExecutionOptions = {
        verbose: false,
        quiet: true,
        showPlan: false
      };

      const result = await controller.execute(agent, 'Test task', mode, options);

      expect(result.success).toBe(true);
      expect(result.stages).toHaveLength(2);
      expect(result.stages.every(s => s.status === 'completed')).toBe(true);
      expect(mockAgentExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it('should throw error if agent has no stages', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [] // No stages
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      await expect(controller.execute(agent, 'Test task', mode, { quiet: true }))
        .rejects.toThrow('has no stages configured');
    });

    it('should save checkpoints when resumable mode enabled', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            checkpoint: true
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: true,
        autoConfirm: false
      };

      const result = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(result.checkpointPath).toBeDefined();
      expect(result.success).toBe(true);

      // Verify checkpoint was saved
      const checkpointManager = new CheckpointManager(config.checkpointPath, config.cleanupAfterDays);
      const exists = await checkpointManager.checkpointExists(result.runId);
      expect(exists).toBe(true);
    });

    it('should handle stage execution errors in non-interactive mode', async () => {
      // Mock executor to always fail on first stage (even after retries)
      mockAgentExecutor.execute = vi.fn()
        .mockRejectedValue(new Error('Stage 1 failed'));

      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            maxRetries: 0, // Disable retries for this test
            checkpoint: false
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      const result = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(result.success).toBe(false);
      expect(result.failedStageIndex).toBe(0);
      expect(result.stages[0]?.status).toBe('error');
      expect(result.stages[0]?.error?.message).toBe('Stage 1 failed');
      // Second stage should not have been executed
      expect(result.stages.length).toBe(1);
    });

    it('should include retry count in stage results', async () => {
      let callCount = 0;
      mockAgentExecutor.execute = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve({
          response: {
            content: 'Success on retry',
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        });
      });

      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            maxRetries: 1, // Allow 1 retry
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      const result = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(result.success).toBe(true);
      expect(result.stages[0]?.retries).toBe(1); // 1 retry was performed
    });

    it('should validate stage graph for duplicate names', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage'
          },
          {
            name: 'Stage 1', // Duplicate name
            description: 'Second stage'
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      await expect(controller.execute(agent, 'Test task', mode, { quiet: true }))
        .rejects.toThrow('Duplicate stage name');
    });

    it('should accumulate previous outputs for context', async () => {
      let executionCount = 0;
      mockAgentExecutor.execute = vi.fn().mockImplementation(() => {
        executionCount++;
        return Promise.resolve({
          response: {
            content: `Stage ${executionCount} output`,
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        });
      });

      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            checkpoint: false
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      const result = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(result.success).toBe(true);
      expect(result.stages[0]?.output).toBe('Stage 1 output');
      expect(result.stages[1]?.output).toBe('Stage 2 output');
    });

    it('should save stage results to memory when saveToMemory is true', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            saveToMemory: true, // Enable memory persistence
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      const result = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(result.success).toBe(true);
      expect(mockMemoryManager.add).toHaveBeenCalledWith(
        expect.stringContaining('[test-agent] Stage: Stage 1'),
        null,
        expect.objectContaining({
          type: 'task',
          source: 'test-agent',
          stage: 'Stage 1'
        })
      );
    });
  });

  describe('resume', () => {
    it('should resume execution from checkpoint', async () => {
      // First, create a checkpoint
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
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

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: true,
        autoConfirm: false
      };

      // Execute first stage only (mock executor will complete all stages, but we'll manually save checkpoint)
      mockAgentExecutor.execute = vi.fn()
        .mockResolvedValueOnce({
          response: {
            content: 'Stage 1 output',
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        })
        .mockResolvedValueOnce({
          response: {
            content: 'Stage 2 output',
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        });

      const initialResult = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(initialResult.success).toBe(true);
      expect(initialResult.runId).toBeDefined();

      // Load and verify checkpoint
      const checkpointManager = new CheckpointManager(config.checkpointPath, config.cleanupAfterDays);
      const checkpoint = await checkpointManager.loadCheckpoint(initialResult.runId);

      expect(checkpoint.runId).toBe(initialResult.runId);
      expect(checkpoint.agent).toBe('test-agent');
      expect(checkpoint.lastCompletedStageIndex).toBe(1); // Both stages completed
    });

    it('should preserve runId when resuming', async () => {
      // Create a checkpoint manually
      const checkpointManager = new CheckpointManager(config.checkpointPath, config.cleanupAfterDays);
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
            status: 'completed' as const,
            retries: 0,
            checkpoint: true,
            result: {
              stageName: 'Stage 1',
              stageIndex: 0,
              status: 'completed' as const,
              output: 'Stage 1 output',
              artifacts: [],
              duration: 1000,
              tokensUsed: 30,
              timestamp: new Date().toISOString(),
              retries: 0
            }
          },
          {
            name: 'Stage 2',
            description: 'Second stage',
            index: 1,
            status: 'queued' as const,
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

      // Resume execution
      const result = await controller.resume(runId, undefined, { quiet: true });

      expect(result.runId).toBe(runId); // Should preserve original runId
      expect(result.success).toBe(true);
    });

    it('should throw error if checkpoint not found', async () => {
      const nonExistentRunId = randomUUID();

      await expect(controller.resume(nonExistentRunId, undefined, { quiet: true }))
        .rejects.toThrow('Checkpoint not found');
    });

    it('should save correct lastCompletedStageIndex when execution fails mid-workflow', async () => {
      // Create agent with 3 stages
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            checkpoint: true
          },
          {
            name: 'Stage 2',
            description: 'Second stage (will fail)',
            checkpoint: true
          },
          {
            name: 'Stage 3',
            description: 'Third stage (never reached)',
            checkpoint: true
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: true,
        autoConfirm: false
      };

      // Mock executor: Stage 1 succeeds, Stage 2 fails
      mockAgentExecutor.execute = vi.fn()
        .mockResolvedValueOnce({
          response: {
            content: 'Stage 1 completed successfully',
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        })
        .mockRejectedValueOnce(new Error('Stage 2 failed'));

      // Execute - should stop after stage 2 fails
      const result = await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      expect(result.success).toBe(false);
      expect(result.failedStageIndex).toBe(1); // Stage 2 (index 1) failed
      expect(result.checkpointPath).toBeDefined();

      // Load checkpoint and verify lastCompletedStageIndex
      const checkpointManager = new CheckpointManager(config.checkpointPath, config.cleanupAfterDays);
      const checkpoint = await checkpointManager.loadCheckpoint(result.runId);

      // BUG FIX VERIFICATION: lastCompletedStageIndex should be 0 (only Stage 1 completed)
      // NOT 2 (stageStates.length - 1), which would skip all remaining work
      expect(checkpoint.lastCompletedStageIndex).toBe(0); // Only Stage 1 (index 0) completed
      expect(checkpoint.stages[0]?.status).toBe('completed');
      expect(checkpoint.stages[1]?.status).toBe('error');
      expect(checkpoint.stages[2]?.status).toBe('queued'); // Never reached

      // Resume should start from Stage 2 (index 1)
      mockAgentExecutor.execute = vi.fn()
        .mockResolvedValueOnce({
          response: {
            content: 'Stage 2 retry succeeded',
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        })
        .mockResolvedValueOnce({
          response: {
            content: 'Stage 3 completed',
            tokensUsed: { total: 30 }
          },
          duration: 100,
          context: {} as ExecutionContext
        });

      const resumeResult = await controller.resume(result.runId, undefined, { quiet: true });
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.stages).toHaveLength(3); // All 3 stages in final result
    });
  });

  describe('Stage Configuration', () => {
    it('should respect stage-specific timeout', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage with custom timeout',
            timeout: 60000, // Custom timeout
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      // Verify executor was called with correct timeout
      expect(mockAgentExecutor.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeout: 60000
        })
      );
    });

    it('should use default timeout when not specified in stage', async () => {
      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage without timeout',
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      await controller.execute(agent, 'Test task', mode, { quiet: true, showPlan: false });

      // Should use config default
      expect(mockAgentExecutor.execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeout: config.defaultStageTimeout
        })
      );
    });
  });

  describe('Stage Task Building', () => {
    it('should build stage task with all context', async () => {
      let capturedContext: ExecutionContext | undefined;

      // Create mock provider for task building test
      const mockProviderForTask: Provider = {
        name: 'mock',
        version: '1.0.0',
        priority: 1,
        capabilities: {
          supportsStreaming: false,
          supportsEmbedding: false,
          supportsVision: false,
          maxContextTokens: 4096,
          supportedModels: ['mock-model']
        },
        isAvailable: vi.fn().mockResolvedValue(true),
        getHealth: vi.fn().mockResolvedValue({
          available: true,
          latencyMs: 100,
          errorRate: 0,
          consecutiveFailures: 0
        }),
        checkRateLimit: vi.fn().mockResolvedValue({
          hasCapacity: true,
          requestsRemaining: 100,
          tokensRemaining: 10000,
          resetAtMs: Date.now() + 60000
        }),
        waitForCapacity: vi.fn().mockResolvedValue(undefined),
        estimateCost: vi.fn().mockResolvedValue({
          estimatedUsd: 0.01,
          tokensUsed: 30
        }),
        getUsageStats: vi.fn().mockResolvedValue({
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          averageLatencyMs: 0,
          errorCount: 0
        }),
        shouldRetry: vi.fn().mockReturnValue(false),
        getRetryDelay: vi.fn().mockReturnValue(1000),
        execute: vi.fn(),
        supportsStreaming: vi.fn().mockReturnValue(false),
        generateEmbedding: vi.fn()
      } as unknown as Provider;

      mockContextManager.createContext = vi.fn().mockImplementation(async (agentName, task) => {
        capturedContext = {
          agent: {
            name: agentName,
            role: 'tester',
            description: 'Test agent',
            systemPrompt: 'Test prompt',
            abilities: [],
            provider: 'mock'
          },
          task,
          memory: [],
          projectDir: tempDir,
          workingDir: tempDir,
          agentWorkspace: join(tempDir, '.automatosx', 'workspaces', agentName),
          provider: mockProviderForTask,
          abilities: 'Test abilities',
          createdAt: new Date()
        } as ExecutionContext;
        return capturedContext;
      });

      const agent: AgentProfile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        role: 'tester',
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        abilities: [],
        provider: 'mock',
        stages: [
          {
            name: 'Stage 1',
            description: 'First stage',
            key_questions: ['Question 1', 'Question 2'],
            outputs: ['Output 1', 'Output 2'],
            checkpoint: false
          }
        ]
      };

      const mode: ExecutionMode = {
        interactive: false,
        streaming: false,
        resumable: false,
        autoConfirm: false
      };

      await controller.execute(agent, 'Original task', mode, { quiet: true, showPlan: false });

      expect(capturedContext?.task).toContain('# Stage: Stage 1');
      expect(capturedContext?.task).toContain('## Stage Description');
      expect(capturedContext?.task).toContain('First stage');
      expect(capturedContext?.task).toContain('## Original Task');
      expect(capturedContext?.task).toContain('Original task');
      expect(capturedContext?.task).toContain('## Key Questions to Address');
      expect(capturedContext?.task).toContain('Question 1');
      expect(capturedContext?.task).toContain('Question 2');
      expect(capturedContext?.task).toContain('## Expected Outputs');
      expect(capturedContext?.task).toContain('Output 1');
      expect(capturedContext?.task).toContain('Output 2');
    });
  });
});
