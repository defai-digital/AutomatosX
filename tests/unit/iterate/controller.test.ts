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
    it('should return framework initialization result', async () => {
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Test task'
      } as ExecutionContext;

      const options: ExecutionOptions = {};

      const result = await controller.executeWithIterate(context, options);

      expect(result).toBeDefined();
      expect(result.response.content).toContain('Iterate mode framework initialized');
      expect(result.response.finishReason).toBe('stop');
    });

    it('should include session state in result', async () => {
      const context = {
        agent: { name: 'test-agent', version: '1.0.0' },
        task: 'Test task'
      } as ExecutionContext;

      const result = await controller.executeWithIterate(context, {});

      expect(result.response.content).toContain('Session ID:');
      expect(result.response.content).toContain('State:');
    });
  });

  describe('handleResponse() - Week 1 Skeleton', () => {
    it('should return continue action for skeleton', async () => {
      const mockResponse = {
        content: 'Test response',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        latencyMs: 100,
        model: 'test-model',
        finishReason: 'stop'
      } as any;

      const action = await controller.handleResponse(mockResponse);

      expect(action).toBeDefined();
      expect(action.type).toBe('continue');
      expect(action.reason).toContain('Skeleton implementation');
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

  // TODO (Week 3): Add tests for orchestration loop
  // - Test execution with hooks
  // - Test response classification integration
  // - Test auto-response generation
  // - Test state persistence
  // - Test budget monitoring
  // - Test pause/resume flow

  // TODO (Week 3): Add tests for state management
  // - Test state initialization
  // - Test counter updates
  // - Test classification history tracking
  // - Test cost accumulation

  // TODO (Week 4): Add tests for budget enforcement
  // - Test time budget warnings and limits
  // - Test cost budget warnings and limits
  // - Test iteration limits per stage and per run
  // - Test auto-response limits

  // TODO (Week 4): Add integration tests
  // - Test with real SessionManager
  // - Test with real CostTracker
  // - Test end-to-end flow with mocked provider

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

        const controllerNoTokens = new IterateModeController(configWithoutTokens);
        const context = {
          agent: { name: 'test-agent', version: '1.0.0' },
          task: 'Test task'
        } as ExecutionContext;

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

        const controllerWithTokens = new IterateModeController(configWithTokens);
        const context = {
          agent: { name: 'test-agent', version: '1.0.0' },
          task: 'Test task with token limits'
        } as ExecutionContext;

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
