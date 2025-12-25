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
} from '@defai.digital/routing-engine';
import type { RoutingInput } from '@defai.digital/contracts';

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

  describe('INV-RT-002: Risk Gating', () => {
    it('should never select experimental models for high risk', () => {
      const mixedModels: ModelDefinition[] = [
        {
          id: 'experimental',
          provider: 'google',
          displayName: 'Experimental',
          isExperimental: true,
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
      expect(result.constraints.riskCompliant).toBe(true);
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

  describe('INV-RT-003: Reasoning Requirement', () => {
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

  describe('INV-RT-004: Fallback Consistency', () => {
    it('should provide fallback models', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'medium',
      };

      const result = engine.route(input);
      // fallbackModels is now required (may be empty array)
      expect(result.fallbackModels).toBeDefined();
      expect(Array.isArray(result.fallbackModels)).toBe(true);
      // Should have fallbacks if multiple models are available
      if (DEFAULT_MODELS.length > 1) {
        expect(result.fallbackModels.length).toBeGreaterThan(0);
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
      for (const fallbackId of result.fallbackModels) {
        const model = engine.getModel(fallbackId);
        expect(model?.isExperimental).toBe(false);
      }
    });
  });

  describe('INV-RT-005: Capability Match', () => {
    it('should return constraints object with capabilitiesMet', () => {
      const engine = createRoutingEngine();
      const input: RoutingInput = {
        taskType: 'chat',
        riskLevel: 'medium',
        requirements: {
          capabilities: ['streaming'],
        },
      };

      const result = engine.route(input);
      expect(result.constraints).toBeDefined();
      expect(result.constraints.capabilitiesMet).toBe(true);
      expect(result.constraints.riskCompliant).toBe(true);
    });

    it('should disqualify models missing required capabilities', () => {
      const model: ModelDefinition = {
        id: 'no-vision',
        provider: 'anthropic',
        displayName: 'No Vision',
        isExperimental: false,
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

  describe('Model Scoring', () => {
    it('should score models based on task optimization', () => {
      const model: ModelDefinition = {
        id: 'test-model',
        provider: 'anthropic',
        displayName: 'Test',
        isExperimental: false,
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
      expect(record.decision.constraints).toBeDefined();
      expect(record.timestamp).toBeDefined();
    });
  });
});
