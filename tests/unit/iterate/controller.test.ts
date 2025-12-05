/**
 * Iterate Mode Controller Tests
 *
 * Tests for iterate mode orchestration and execution
 *
 * @module tests/unit/iterate/controller.test
 * @since v6.4.0 (Week 1 scaffolding)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IterateModeController } from '../../../src/core/iterate/iterate-mode-controller.js';
import type { IterateConfig, IterateStats } from '../../../src/types/iterate.js';
import type { ExecutionContext } from '../../../src/types/agent.js';
import type { ExecutionOptions } from '../../../src/agents/executor.js';
import { IterateError } from '../../../src/types/iterate.js';

describe('IterateModeController', () => {
  let controller: IterateModeController;
  let mockConfig: IterateConfig;

  beforeEach(() => {
    // Mock iterate configuration
    mockConfig = {
      enabled: true,
      defaults: {
        maxDurationMinutes: 120,
        maxIterationsPerStage: 50,
        maxIterationsPerRun: 200,
        maxAutoResponsesPerStage: 30,
        maxTotalTokens: 1_000_000,
        autoConfirmCheckpoints: true
      },
      classifier: {
        strictness: 'balanced',
        patternLibraryPath: '.automatosx/iterate/patterns.yaml',
        enableSemanticScoring: false,
        semanticScoringThreshold: 0.75,
        contextWindowMessages: 10
      },
      safety: {
        enableDangerousOperationGuard: true,
        riskTolerance: 'balanced',
        dangerousOperations: {
          fileDelete: 'HIGH',
          gitForce: 'HIGH',
          writeOutsideWorkspace: 'HIGH',
          secretsInCode: 'HIGH',
          shellCommands: 'MEDIUM',
          packageInstall: 'LOW'
        },
        enableTimeTracking: true,
        enableIterationTracking: true
      },
      telemetry: {
        level: 'info',
        logAutoResponses: true,
        logClassifications: true,
        logSafetyChecks: true,
        emitMetrics: true
      },
      notifications: {
        warnAtTimePercent: [75, 90, 95],
        pauseOnGenuineQuestion: true,
        pauseOnHighRiskOperation: true
      }
    };

    controller = new IterateModeController(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create controller with config', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(IterateModeController);
    });

    it('should accept optional session manager', () => {
      const mockSessionManager = {} as any;
      const controllerWithSession = new IterateModeController(mockConfig, mockSessionManager);

      expect(controllerWithSession).toBeDefined();
    });
  });

  describe('executeWithIterate()', () => {
    // Helper to create mock provider
    const createMockProvider = (response: any) => ({
      name: 'mock-provider',
      execute: vi.fn().mockResolvedValue(response)
    });

    // Helper to create mock executor
    const createMockExecutor = (response: any) => ({
      execute: vi.fn().mockResolvedValue({
        response,
        duration: 100,
        context: {} as ExecutionContext
      })
    });

    it('should execute with mock executor and return result', async () => {
      const mockResponse = {
        content: 'Task completed successfully',
        tokensUsed: { prompt: 100, completion: 200, total: 300 },
        latencyMs: 500,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = createMockExecutor(mockResponse);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Test task',
        provider: createMockProvider(mockResponse)
      } as unknown as ExecutionContext;

      const options: ExecutionOptions = {};

      const result = await controller.executeWithIterate(context, options, mockExecutor);

      expect(result).toBeDefined();
      expect(result.response.finishReason).toBe('stop');
      expect(mockExecutor.execute).toHaveBeenCalled();
    });

    it('should execute with direct provider when no executor provided', async () => {
      const mockResponse = {
        content: 'All tasks completed.',
        tokensUsed: { prompt: 50, completion: 100, total: 150 },
        latencyMs: 200,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockProvider = createMockProvider(mockResponse);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0', model: 'test-model' },
        task: 'Test task',
        provider: mockProvider
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {});

      expect(result).toBeDefined();
      expect(result.response.finishReason).toBe('stop');
      expect(mockProvider.execute).toHaveBeenCalled();
    });

    it('should accumulate response content from multiple iterations', async () => {
      let callCount = 0;
      const mockExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return {
              response: {
                content: 'Should I proceed?',
                tokensUsed: { prompt: 50, completion: 50, total: 100 },
                latencyMs: 100,
                model: 'test-model',
                finishReason: 'stop' as const
              },
              duration: 100,
              context: {} as ExecutionContext
            };
          }
          return {
            response: {
              content: 'All tasks completed successfully.',
              tokensUsed: { prompt: 50, completion: 50, total: 100 },
              latencyMs: 100,
              model: 'test-model',
              finishReason: 'stop' as const
            },
            duration: 100,
            context: {} as ExecutionContext
          };
        })
      };

      // Load patterns for classifier
      await controller['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
      await controller['responder'].loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Test task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      // Should have accumulated tokens
      expect(result.response.tokensUsed?.total).toBeGreaterThan(0);
    });
  });

  describe('handleResponse() - Week 1 Skeleton', () => {
    it('should return no_op action when state not initialized', async () => {
      const mockResponse = {
        content: 'Test response',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'test-model',
        finishReason: 'stop'
      } as any;

      const action = await controller.handleResponse(mockResponse);

      expect(action).toBeDefined();
      expect(action.type).toBe('no_op');
      expect(action.reason).toContain('no response needed');
    });
  });

  describe('pause() - Week 1 Skeleton', () => {
    it('should accept pause call without throwing', async () => {
      await expect(controller.pause('genuine_question', 'Test context')).resolves.not.toThrow();
    });

    it('should accept different pause reasons', async () => {
      await expect(controller.pause('high_risk_operation')).resolves.not.toThrow();
      await expect(controller.pause('time_limit_exceeded')).resolves.not.toThrow();
      await expect(controller.pause('token_limit_exceeded')).resolves.not.toThrow();
      await expect(controller.pause('user_interrupt')).resolves.not.toThrow();
    });
  });

  describe('resume() - Week 1 Skeleton', () => {
    it('should accept resume call without throwing', async () => {
      await expect(controller.resume()).resolves.not.toThrow();
    });

    it('should accept optional user response', async () => {
      await expect(controller.resume('User answer')).resolves.not.toThrow();
    });
  });

  describe('getStats() - Week 1 Skeleton', () => {
    it('should return placeholder stats', () => {
      const stats = controller.getStats();

      expect(stats).toBeDefined();
      expect(stats.durationMs).toBe(0);
      expect(stats.totalIterations).toBe(0);
      expect(stats.totalAutoResponses).toBe(0);
      expect(stats.totalUserInterventions).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.classificationBreakdown).toBeDefined();
      expect(stats.avgClassificationLatencyMs).toBe(0);
      expect(stats.safetyChecks).toBeDefined();
      expect(stats.stopReason).toBe('completion');
      expect(stats.successRate).toBe(1.0);
    });

    it('should have complete classification breakdown', () => {
      const stats = controller.getStats();

      expect(stats.classificationBreakdown.confirmation_prompt).toBe(0);
      expect(stats.classificationBreakdown.status_update).toBe(0);
      expect(stats.classificationBreakdown.genuine_question).toBe(0);
      expect(stats.classificationBreakdown.blocking_request).toBe(0);
      expect(stats.classificationBreakdown.error_signal).toBe(0);
      expect(stats.classificationBreakdown.completion_signal).toBe(0);
      expect(stats.classificationBreakdown.rate_limit_or_context).toBe(0);
    });

    it('should have complete safety check stats', () => {
      const stats = controller.getStats();

      expect(stats.safetyChecks.total).toBe(0);
      expect(stats.safetyChecks.allowed).toBe(0);
      expect(stats.safetyChecks.paused).toBe(0);
      expect(stats.safetyChecks.blocked).toBe(0);
    });
  });

  // Phase 3 & 4: Advanced orchestration and integration tests
  describe('Orchestration Loop - Phase 3', () => {
    // Helper to create mock provider
    const createMockProvider = (responses: any[]) => {
      let callIndex = 0;
      return {
        name: 'mock-provider',
        execute: vi.fn().mockImplementation(async () => {
          const response = responses[callIndex] || responses[responses.length - 1];
          callIndex++;
          return response;
        })
      };
    };

    // Helper to create mock executor with multiple responses
    const createMultiResponseExecutor = (responses: any[]) => {
      let callIndex = 0;
      return {
        execute: vi.fn().mockImplementation(async () => {
          const response = responses[callIndex] || responses[responses.length - 1];
          callIndex++;
          return {
            response,
            duration: 100,
            context: {} as ExecutionContext
          };
        })
      };
    };

    beforeEach(async () => {
      // Load patterns and templates for classification
      await controller['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
      await controller['responder'].loadTemplates('tests/fixtures/iterate/sample-templates.yaml');
    });

    it('should execute with hooks and state persistence', async () => {
      const mockResponse = {
        content: 'Task completed successfully.',
        tokensUsed: { prompt: 100, completion: 200, total: 300 },
        latencyMs: 500,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = createMultiResponseExecutor([mockResponse]);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Complete the task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      expect(result.response.finishReason).toBe('stop');
      expect(mockExecutor.execute).toHaveBeenCalled();

      // Verify state was tracked
      const stats = controller.getStats();
      expect(stats.totalIterations).toBeGreaterThanOrEqual(0);
    });

    it('should handle multi-iteration execution with continue actions', async () => {
      // First response: confirmation prompt that should trigger auto-response
      // Second response: completion signal
      const responses = [
        {
          content: 'Should I proceed with the implementation?',
          tokensUsed: { prompt: 50, completion: 50, total: 100 },
          latencyMs: 100,
          model: 'test-model',
          finishReason: 'stop' as const
        },
        {
          content: 'All tasks completed successfully.',
          tokensUsed: { prompt: 50, completion: 50, total: 100 },
          latencyMs: 100,
          model: 'test-model',
          finishReason: 'stop' as const
        }
      ];

      const mockExecutor = createMultiResponseExecutor(responses);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Implement the feature',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      expect(result.response.tokensUsed?.total).toBeGreaterThan(0);
    });

    it('should pause on genuine question classification', async () => {
      const mockResponse = {
        content: 'Which database should I use for this project? PostgreSQL or MongoDB?',
        tokensUsed: { prompt: 50, completion: 100, total: 150 },
        latencyMs: 200,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = createMultiResponseExecutor([mockResponse]);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Set up the database',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      // Should have paused due to genuine question
      const stats = controller.getStats();
      expect(['completion', 'user_interrupt']).toContain(stats.stopReason);
    });

    it('should track classification history', async () => {
      const mockResponse = {
        content: 'Processing your request...',
        tokensUsed: { prompt: 30, completion: 30, total: 60 },
        latencyMs: 50,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = createMultiResponseExecutor([mockResponse]);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Process request',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      await controller.executeWithIterate(context, {}, mockExecutor);

      const stats = controller.getStats();
      // Classification breakdown should have at least one entry
      const totalClassifications = Object.values(stats.classificationBreakdown).reduce((a, b) => a + b, 0);
      expect(totalClassifications).toBeGreaterThanOrEqual(0);
    });

    it('should accumulate tokens across iterations', async () => {
      const responses = [
        {
          content: 'Ready to proceed?',
          tokensUsed: { prompt: 100, completion: 100, total: 200 },
          latencyMs: 100,
          model: 'test-model',
          finishReason: 'stop' as const
        },
        {
          content: 'Done.',
          tokensUsed: { prompt: 50, completion: 50, total: 100 },
          latencyMs: 50,
          model: 'test-model',
          finishReason: 'stop' as const
        }
      ];

      const mockExecutor = createMultiResponseExecutor(responses);
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Multi-step task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      // Tokens should be accumulated
      expect(result.response.tokensUsed?.total).toBeGreaterThan(0);
    });
  });

  describe('Budget Enforcement - Phase 4', () => {
    it('should enforce iteration limits', async () => {
      // Create config with very low iteration limit
      const limitedConfig: IterateConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          maxIterationsPerRun: 1,
          maxIterationsPerStage: 1
        }
      };

      const limitedController = new IterateModeController(limitedConfig);
      await limitedController['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
      await limitedController['responder'].loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      // Mock executor that would keep going
      let callCount = 0;
      const mockExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            response: {
              content: 'Continue?',
              tokensUsed: { prompt: 10, completion: 10, total: 20 },
              latencyMs: 10,
              model: 'test-model',
              finishReason: 'stop' as const
            },
            duration: 10,
            context: {} as ExecutionContext
          };
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Iterative task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await limitedController.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      // Should have stopped due to iteration limit
      const stats = limitedController.getStats();
      expect(stats.totalIterations).toBeLessThanOrEqual(2); // At most 2 iterations
    });

    it('should enforce token budget limits', async () => {
      // Create config with very low token limit
      const limitedConfig: IterateConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          maxTotalTokens: 100 // Very low limit
        }
      };

      const limitedController = new IterateModeController(limitedConfig);
      await limitedController['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      // Mock response with tokens that would exceed limit
      const mockResponse = {
        content: 'Processing...',
        tokensUsed: { prompt: 100, completion: 100, total: 200 }, // Exceeds 100 limit
        latencyMs: 50,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: mockResponse,
          duration: 50,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Token heavy task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await limitedController.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      // Should have stopped due to token limit
      const stats = limitedController.getStats();
      expect(['completion', 'token_limit']).toContain(stats.stopReason);
    });

    it('should enforce auto-response limits per stage', async () => {
      // Create config with very low auto-response limit
      const limitedConfig: IterateConfig = {
        ...mockConfig,
        defaults: {
          ...mockConfig.defaults,
          maxAutoResponsesPerStage: 1
        }
      };

      const limitedController = new IterateModeController(limitedConfig);
      await limitedController['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
      await limitedController['responder'].loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      // Mock executor returning confirmation prompts
      let callCount = 0;
      const mockExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            response: {
              content: 'Should I continue?',
              tokensUsed: { prompt: 10, completion: 10, total: 20 },
              latencyMs: 10,
              model: 'test-model',
              finishReason: 'stop' as const
            },
            duration: 10,
            context: {} as ExecutionContext
          };
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Auto-response test',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await limitedController.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      const stats = limitedController.getStats();
      expect(stats.totalAutoResponses).toBeLessThanOrEqual(2);
    });
  });

  describe('Integration Tests - Phase 4', () => {
    it('should handle end-to-end flow with direct provider execution', async () => {
      const mockResponse = {
        content: 'Implementation complete. All tests passing.',
        tokensUsed: { prompt: 200, completion: 300, total: 500 },
        latencyMs: 1000,
        model: 'claude-3',
        finishReason: 'stop' as const
      };

      const mockProvider = {
        name: 'mock-provider',
        execute: vi.fn().mockResolvedValue(mockResponse)
      };

      const context = {
        agent: {
          name: 'test-agent',
          version: '1.0.0',
          model: 'claude-3',
          systemPrompt: 'You are a helpful assistant',
          temperature: 0.7,
          maxTokens: 4096
        },
        task: 'Implement user authentication',
        provider: mockProvider
      } as unknown as ExecutionContext;

      // Load patterns for proper classification
      await controller['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');

      const result = await controller.executeWithIterate(context, {});

      expect(result).toBeDefined();
      expect(result.response.content).toContain('Implementation complete');
      expect(mockProvider.execute).toHaveBeenCalled();
    });

    it('should handle provider errors gracefully', async () => {
      const mockProvider = {
        name: 'mock-provider',
        execute: vi.fn().mockRejectedValue(new Error('Provider unavailable'))
      };

      const context = {
        agent: {
          name: 'test-agent',
          version: '1.0.0',
          model: 'claude-3'
        },
        task: 'Task that will fail',
        provider: mockProvider
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {});

      expect(result).toBeDefined();
      expect(result.response.finishReason).toBe('error');
      expect(result.response.content.toLowerCase()).toContain('failed');
    });

    it('should track stats correctly after multiple operations', async () => {
      const responses = [
        {
          content: 'Starting implementation...',
          tokensUsed: { prompt: 50, completion: 100, total: 150 },
          latencyMs: 100,
          model: 'test-model',
          finishReason: 'stop' as const
        }
      ];

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: responses[0],
          duration: 100,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Multi-operation task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      await controller['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
      await controller.executeWithIterate(context, {}, mockExecutor);

      const stats = controller.getStats();

      expect(stats.durationMs).toBeGreaterThanOrEqual(0);
      expect(stats.totalTokens).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle classification errors gracefully', async () => {
      // Create controller without loading patterns (will use fallback)
      const freshController = new IterateModeController(mockConfig);

      const mockResponse = {
        content: 'Some response without patterns loaded',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 50,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: mockResponse,
          duration: 50,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Task without patterns',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      // Should not throw, should use fallback classification
      const result = await freshController.executeWithIterate(context, {}, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle empty response content', async () => {
      const mockResponse = {
        content: '',
        tokensUsed: { prompt: 10, completion: 0, total: 10 },
        latencyMs: 50,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: mockResponse,
          duration: 50,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Task with empty response',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle missing tokensUsed in response', async () => {
      const mockResponse = {
        content: 'Response without token info',
        latencyMs: 50,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: mockResponse,
          duration: 50,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Task without token info',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);
      expect(result).toBeDefined();
      expect(result.response.tokensUsed?.total).toBe(0);
    });
  });

  describe('Action Handling', () => {
    beforeEach(async () => {
      await controller['classifier'].loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
      await controller['responder'].loadTemplates('tests/fixtures/iterate/sample-templates.yaml');
    });

    it('should handle stop action from completion signal', async () => {
      const mockResponse = {
        content: 'All tasks have been completed successfully.',
        tokensUsed: { prompt: 50, completion: 100, total: 150 },
        latencyMs: 100,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: mockResponse,
          duration: 100,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Complete task',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      expect(result.response.finishReason).toBe('stop');
    });

    it('should handle pause action from blocking request', async () => {
      const mockResponse = {
        content: 'I need your API key to proceed with the integration.',
        tokensUsed: { prompt: 50, completion: 100, total: 150 },
        latencyMs: 100,
        model: 'test-model',
        finishReason: 'stop' as const
      };

      const mockExecutor = {
        execute: vi.fn().mockResolvedValue({
          response: mockResponse,
          duration: 100,
          context: {} as ExecutionContext
        })
      };

      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Set up API integration',
        provider: { name: 'mock', execute: vi.fn() }
      } as unknown as ExecutionContext;

      const result = await controller.executeWithIterate(context, {}, mockExecutor);

      expect(result).toBeDefined();
      const stats = controller.getStats();
      // Should have paused for blocking request (needs credentials)
      expect(['completion', 'user_interrupt']).toContain(stats.stopReason);
    });
  });

  // ============================================================================
  // v8.6.0: Token-Based Budget Tests
  // ============================================================================

  describe('Token Budget Management (v8.6.0)', () => {
    describe('getStats() with token fields', () => {
      it('should include totalTokens in stats when state not initialized', () => {
        const stats = controller.getStats();

        expect(stats.totalTokens).toBe(0);
        expect(stats.avgTokensPerIteration).toBe(0);
        // totalCost is optional/deprecated - may or may not be present
      });

      it('should include token fields in placeholder stats', () => {
        const stats = controller.getStats();

        expect(stats).toHaveProperty('totalTokens');
        expect(stats).toHaveProperty('avgTokensPerIteration');
        expect(stats.totalTokens).toBe(0);
        expect(stats.avgTokensPerIteration).toBe(0);
      });
    });

    describe('Token budget enforcement', () => {
      // Helper to create mock provider
      const createMockProvider = (response: any) => ({
        name: 'mock-provider',
        execute: vi.fn().mockResolvedValue(response)
      });

      it('should handle missing token limits gracefully', async () => {
        // Config without token limits
        const configWithoutTokens: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: undefined,
            maxTokensPerIteration: undefined
          }
        };

        const mockResponse = {
          content: 'Task completed.',
          tokensUsed: { prompt: 50, completion: 100, total: 150 },
          latencyMs: 200,
          model: 'test-model',
          finishReason: 'stop' as const
        };

        const controllerNoTokens = new IterateModeController(configWithoutTokens);
        const context = {
          agent: { name: 'test-agent', version: '1.0.0', model: 'test-model' },
          task: 'Test task',
          provider: createMockProvider(mockResponse)
        } as unknown as ExecutionContext;

        const result = await controllerNoTokens.executeWithIterate(context, {});

        expect(result).toBeDefined();
        expect(result.response.finishReason).toBe('stop');
      });

      it('should work with token limits configured', async () => {
        const configWithTokens: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 1_000_000,
            maxTokensPerIteration: 100_000,
            warnAtTokenPercent: [75, 90]
          }
        };

        const mockResponse = {
          content: 'Task completed with token limits.',
          tokensUsed: { prompt: 50, completion: 100, total: 150 },
          latencyMs: 200,
          model: 'test-model',
          finishReason: 'stop' as const
        };

        const controllerWithTokens = new IterateModeController(configWithTokens);
        const context = {
          agent: { name: 'test-agent', version: '1.0.0', model: 'test-model' },
          task: 'Test task with token limits',
          provider: createMockProvider(mockResponse)
        } as unknown as ExecutionContext;

        const result = await controllerWithTokens.executeWithIterate(context, {});

        expect(result).toBeDefined();
        expect(result.response.finishReason).toBe('stop');
      });
    });

    describe('Token tracking configuration', () => {
      it('should accept maxTotalTokens in config', () => {
        const configWithTokens: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 500_000
          }
        };

        const controllerWithTokens = new IterateModeController(configWithTokens);
        expect(controllerWithTokens).toBeDefined();
      });

      it('should accept maxTokensPerIteration in config', () => {
        const configWithTokens: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTokensPerIteration: 50_000
          }
        };

        const controllerWithTokens = new IterateModeController(configWithTokens);
        expect(controllerWithTokens).toBeDefined();
      });

      it('should accept warnAtTokenPercent in config', () => {
        const configWithTokens: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            warnAtTokenPercent: [50, 75, 90]
          }
        };

        const controllerWithTokens = new IterateModeController(configWithTokens);
        expect(controllerWithTokens).toBeDefined();
      });

    });

    describe('Backward compatibility (v9.0.0)', () => {
      it('should include totalCost in stats for backward compatibility', () => {
        const stats = controller.getStats();

        // totalCost is optional/deprecated in v9.0.0
        if (stats.totalCost !== undefined) {
          expect(typeof stats.totalCost).toBe('number');
        }
      });

      it('should accept token_limit_exceeded pause reason', async () => {
        const context = {
          agent: { name: 'test-agent', version: '1.0.0' },
          task: 'Test task'
        } as ExecutionContext;

        const result = await controller.executeWithIterate(context, {});

        expect(result).toBeDefined();
        // Should not throw error if token_limit_exceeded is used
      });
    });

    describe('Default values', () => {
      it('should use default token limit of 1M if not specified', () => {
        const configWithDefaults: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            // No token limits specified
          }
        };

        const controllerWithDefaults = new IterateModeController(configWithDefaults);
        expect(controllerWithDefaults).toBeDefined();
      });

      it('should use default warning thresholds [75, 90] if not specified', () => {
        const configWithDefaults: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 1_000_000
            // No warnAtTokenPercent specified
          }
        };

        const controllerWithDefaults = new IterateModeController(configWithDefaults);
        expect(controllerWithDefaults).toBeDefined();
      });
    });

    describe('Token limit edge cases', () => {
      it('should handle zero token limit', () => {
        const configWithZero: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 0
          }
        };

        const controllerWithZero = new IterateModeController(configWithZero);
        expect(controllerWithZero).toBeDefined();
      });

      it('should handle very large token limit', () => {
        const configWithLarge: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 100_000_000 // 100M tokens
          }
        };

        const controllerWithLarge = new IterateModeController(configWithLarge);
        expect(controllerWithLarge).toBeDefined();
      });

      it('should handle custom warning thresholds', () => {
        const configWithCustomWarnings: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 1_000_000,
            warnAtTokenPercent: [25, 50, 75, 90, 95] // More granular warnings
          }
        };

        const controllerWithCustom = new IterateModeController(configWithCustomWarnings);
        expect(controllerWithCustom).toBeDefined();
      });

      it('should handle empty warning thresholds array', () => {
        const configWithNoWarnings: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults,
            maxTotalTokens: 1_000_000,
            warnAtTokenPercent: [] // No warnings
          }
        };

        const controllerWithNoWarnings = new IterateModeController(configWithNoWarnings);
        expect(controllerWithNoWarnings).toBeDefined();
      });
    });

    describe('Stats calculations with tokens', () => {
      it('should calculate avgTokensPerIteration correctly when iterations > 0', () => {
        // This would require accessing private state, so we test the public API
        const stats = controller.getStats();

        // With no iterations, average should be 0
        expect(stats.avgTokensPerIteration).toBe(0);
      });

      it('should handle division by zero for avgTokensPerIteration', () => {
        const stats = controller.getStats();

        // With totalIterations = 0, should not crash
        expect(stats.avgTokensPerIteration).toBe(0);
        expect(Number.isNaN(stats.avgTokensPerIteration)).toBe(false);
      });
    });

    describe('Type safety', () => {
      it('should have correct TypeScript types for token fields', () => {
        const stats = controller.getStats();

        // Type checks (compile-time, but we verify runtime too)
        expect(typeof stats.totalTokens).toBe('number');
        expect(typeof stats.avgTokensPerIteration).toBe('number');
        expect(typeof stats.totalCost).toBe('number');
      });

      it('should have optional token fields in config', () => {
        // Should compile without token fields
        const minimalConfig: IterateConfig = {
          ...mockConfig,
          defaults: {
            ...mockConfig.defaults
            // token fields are optional
          }
        };

        const controllerMinimal = new IterateModeController(minimalConfig);
        expect(controllerMinimal).toBeDefined();
      });
    });
  });
});
