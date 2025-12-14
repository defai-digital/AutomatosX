import { describe, it, expect } from 'vitest';
import {
  RoutingEngine,
  RoutingError,
  createRoutingEngine,
  scoreModel,
  sortScoredModels,
  DEFAULT_MODELS,
  RoutingErrorCodes,
  type ModelDefinition,
} from '@automatosx/routing-engine';
import type { RoutingInput } from '@automatosx/contracts';

describe('Routing Engine', () => {
  describe('INV-RT-001: Determinism', () => {
    it('should produce identical outputs for identical inputs', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'medium',
      };

      const result1 = engine.route(input);
      const result2 = engine.route(input);

      expect(result1.selectedModel).toBe(result2.selectedModel);
      expect(result1.provider).toBe(result2.provider);
      expect(result1.reasoning).toBe(result2.reasoning);
    });

    it('should use deterministic sorting with model ID as tiebreaker', () => {
      const models: ModelDefinition[] = [
        {
          id: 'model-b',
          provider: 'anthropic',
          displayName: 'Model B',
          isExperimental: false,
          costPerMillionTokens: 1,
          contextLength: 8000,
          capabilities: [],
          priority: 50,
          optimizedFor: ['chat'],
        },
        {
          id: 'model-a',
          provider: 'anthropic',
          displayName: 'Model A',
          isExperimental: false,
          costPerMillionTokens: 1,
          contextLength: 8000,
          capabilities: [],
          priority: 50,
          optimizedFor: ['chat'],
        },
      ];

      const context = {
        taskType: 'chat' as const,
        riskLevel: 'medium' as const,
        requiredCapabilities: [],
        preferredProviders: [],
        excludedModels: [],
      };

      const scored = models.map((m) => scoreModel(m, context));
      const sorted = sortScoredModels(scored);

      // Same score, should sort by ID ascending
      expect(sorted[0]?.model.id).toBe('model-a');
      expect(sorted[1]?.model.id).toBe('model-b');
    });
  });

  describe('INV-RT-002: Budget Respect', () => {
    it('should not select models exceeding budget', () => {
      const expensiveModels: ModelDefinition[] = [
        {
          id: 'cheap-model',
          provider: 'local',
          displayName: 'Cheap Model',
          isExperimental: false,
          costPerMillionTokens: 0.1,
          contextLength: 8000,
          capabilities: [],
          priority: 30,
          optimizedFor: ['chat'],
        },
        {
          id: 'expensive-model',
          provider: 'anthropic',
          displayName: 'Expensive Model',
          isExperimental: false,
          costPerMillionTokens: 100,
          contextLength: 200000,
          capabilities: ['vision'],
          priority: 100,
          optimizedFor: ['chat', 'code'],
        },
      ];

      const engine = createRoutingEngine({ models: expensiveModels });
      const input: RoutingInput = {
        taskType: 'chat',
        budget: { maxCostUsd: 0.001 }, // Very low budget
        riskLevel: 'medium',
      };

      const result = engine.route(input);
      expect(result.selectedModel).toBe('cheap-model');
    });

    it('should throw when no model fits budget', () => {
      const expensiveModels: ModelDefinition[] = [
        {
          id: 'expensive',
          provider: 'anthropic',
          displayName: 'Expensive',
          isExperimental: false,
          costPerMillionTokens: 1000,
          contextLength: 8000,
          capabilities: [],
          priority: 50,
          optimizedFor: ['chat'],
        },
      ];

      const engine = createRoutingEngine({ models: expensiveModels });
      const input: RoutingInput = {
        taskType: 'chat',
        budget: { maxCostUsd: 0.0000001 }, // Impossibly low
        riskLevel: 'medium',
      };

      expect(() => engine.route(input)).toThrow(RoutingError);
      try {
        engine.route(input);
      } catch (err) {
        expect((err as RoutingError).code).toBe(RoutingErrorCodes.NO_SUITABLE_MODEL);
      }
    });
  });

  describe('INV-RT-003: Risk Gating', () => {
    it('should never select experimental models for high risk', () => {
      const mixedModels: ModelDefinition[] = [
        {
          id: 'experimental',
          provider: 'google',
          displayName: 'Experimental',
          isExperimental: true,
          costPerMillionTokens: 0.1,
          contextLength: 128000,
          capabilities: ['vision', 'function_calling'],
          priority: 100, // Highest priority
          optimizedFor: ['chat', 'code', 'analysis'],
        },
        {
          id: 'stable',
          provider: 'anthropic',
          displayName: 'Stable',
          isExperimental: false,
          costPerMillionTokens: 5,
          contextLength: 8000,
          capabilities: [],
          priority: 30, // Lower priority
          optimizedFor: ['chat'],
        },
      ];

      const engine = createRoutingEngine({ models: mixedModels });
      const input: RoutingInput = {
        taskType: 'code',
        riskLevel: 'high',
      };

      const result = engine.route(input);
      expect(result.selectedModel).toBe('stable');
      expect(result.isExperimental).toBe(false);
    });

    it('should allow experimental for low risk', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'low',
      };

      // Should not throw even if experimental is selected
      const result = engine.route(input);
      expect(result.selectedModel).toBeDefined();
    });
  });

  describe('INV-RT-004: Reasoning Requirement', () => {
    it('should always include reasoning', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'medium',
      };

      const result = engine.route(input);
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should reference input factors in reasoning', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'code',
        riskLevel: 'high',
      };

      const result = engine.route(input);
      // Reasoning should mention the task type
      expect(result.reasoning.toLowerCase()).toContain('code');
    });
  });

  describe('INV-RT-005: Fallback Consistency', () => {
    it('should provide fallback models', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'medium',
      };

      const result = engine.route(input);
      // Should have fallbacks if multiple models are available
      if (DEFAULT_MODELS.length > 1) {
        expect(result.fallbackModels).toBeDefined();
        expect(result.fallbackModels?.length).toBeGreaterThan(0);
      }
    });

    it('fallbacks should not include experimental for high risk', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'high',
      };

      const result = engine.route(input);

      // Verify no fallback is experimental
      if (result.fallbackModels !== undefined) {
        for (const fallbackId of result.fallbackModels) {
          const model = engine.getModel(fallbackId);
          expect(model?.isExperimental).toBe(false);
        }
      }
    });
  });

  describe('Model Scoring', () => {
    it('should score models based on task optimization', () => {
      const model: ModelDefinition = {
        id: 'test-model',
        provider: 'anthropic',
        displayName: 'Test',
        isExperimental: false,
        costPerMillionTokens: 1,
        contextLength: 8000,
        capabilities: [],
        priority: 50,
        optimizedFor: ['code'],
      };

      const codeContext = {
        taskType: 'code' as const,
        riskLevel: 'medium' as const,
        requiredCapabilities: [],
        preferredProviders: [],
        excludedModels: [],
      };

      const chatContext = {
        taskType: 'chat' as const,
        riskLevel: 'medium' as const,
        requiredCapabilities: [],
        preferredProviders: [],
        excludedModels: [],
      };

      const codeScore = scoreModel(model, codeContext);
      const chatScore = scoreModel(model, chatContext);

      // Should score higher for optimized task
      expect(codeScore.score).toBeGreaterThan(chatScore.score);
    });

    it('should disqualify models missing required capabilities', () => {
      const model: ModelDefinition = {
        id: 'no-vision',
        provider: 'anthropic',
        displayName: 'No Vision',
        isExperimental: false,
        costPerMillionTokens: 1,
        contextLength: 8000,
        capabilities: ['function_calling'],
        priority: 50,
        optimizedFor: ['chat'],
      };

      const context = {
        taskType: 'chat' as const,
        riskLevel: 'medium' as const,
        requiredCapabilities: ['vision' as const],
        preferredProviders: [],
        excludedModels: [],
      };

      const scored = scoreModel(model, context);
      expect(scored.disqualified).toBe(true);
      expect(scored.disqualificationReason).toContain('vision');
    });
  });

  describe('Routing Record', () => {
    it('should create complete routing record', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'medium',
      };

      const record = engine.createRoutingRecord(input);

      expect(record.requestId).toBeDefined();
      expect(record.input).toEqual(input);
      expect(record.decision).toBeDefined();
      expect(record.timestamp).toBeDefined();
    });
  });
});
