import {
  validateRoutingInput,
  type RoutingInput,
  type RoutingDecision,
  type RoutingRecord,
} from '@automatosx/contracts';
import type {
  RoutingEngineConfig,
  RoutingContext,
  ModelDefinition,
  ScoredModel,
} from './types.js';
import { RoutingErrorCodes } from './types.js';
import { DEFAULT_MODELS, createModelRegistry } from './models.js';
import { scoreModel, sortScoredModels } from './scorer.js';

/**
 * Error thrown when routing fails
 */
export class RoutingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

/**
 * Routing engine that selects models following contract invariants
 *
 * Invariants enforced:
 * - INV-RT-001: Determinism - identical inputs yield identical outputs
 * - INV-RT-002: Budget respect - lower budgets don't select higher-cost models
 * - INV-RT-003: Risk gating - high risk never selects experimental models
 * - INV-RT-004: Reasoning requirement - all decisions include reasoning
 * - INV-RT-005: Fallback consistency - fallbacks satisfy same constraints
 */
export class RoutingEngine {
  private readonly models: Map<string, ModelDefinition>;
  private readonly modelList: ModelDefinition[];

  constructor(config: RoutingEngineConfig = { models: DEFAULT_MODELS }) {
    this.models = createModelRegistry(config.models);
    this.modelList = config.models;
  }

  /**
   * Routes a request to the best model
   * INV-RT-001: Deterministic - same input always produces same output
   * INV-RT-004: All decisions include reasoning
   */
  route(input: RoutingInput): RoutingDecision {
    // Validate input
    const validatedInput = validateRoutingInput(input);

    // Build routing context
    const context = this.buildContext(validatedInput);

    // Score all models
    const scoredModels = this.modelList.map((model) =>
      scoreModel(model, context)
    );

    // Sort by score (INV-RT-001: deterministic sorting)
    const sorted = sortScoredModels(scoredModels);

    // Find eligible models (not disqualified)
    const eligible = sorted.filter((m) => !m.disqualified);

    if (eligible.length === 0) {
      throw new RoutingError(
        RoutingErrorCodes.NO_SUITABLE_MODEL,
        'No suitable model found for the given constraints',
        {
          context,
          disqualifications: sorted
            .filter((m) => m.disqualified)
            .map((m) => ({
              modelId: m.model.id,
              reason: m.disqualificationReason,
            })),
        }
      );
    }

    const selected = eligible[0];
    if (selected === undefined) {
      throw new RoutingError(
        RoutingErrorCodes.NO_SUITABLE_MODEL,
        'No suitable model found'
      );
    }

    // Build fallback list (INV-RT-005: same constraints apply)
    const fallbacks = eligible
      .slice(1, 4) // Up to 3 fallbacks
      .map((m) => m.model.id);

    // INV-RT-004: Build reasoning
    const reasoning = this.buildReasoning(selected, context);

    // Estimate cost
    const estimatedCostUsd =
      (selected.model.costPerMillionTokens / 1000000) * 1000;

    return {
      selectedModel: selected.model.id,
      provider: selected.model.provider,
      isExperimental: selected.model.isExperimental,
      estimatedCostUsd,
      reasoning,
      fallbackModels: fallbacks.length > 0 ? fallbacks : undefined,
    };
  }

  /**
   * Creates a complete routing record with request ID and timestamp
   */
  createRoutingRecord(input: RoutingInput): RoutingRecord {
    const decision = this.route(input);

    return {
      requestId: crypto.randomUUID(),
      input,
      decision,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Builds routing context from validated input
   */
  private buildContext(input: RoutingInput): RoutingContext {
    return {
      taskType: input.taskType,
      budgetMaxCost: input.budget?.maxCostUsd,
      budgetMaxTokens: input.budget?.maxTokens,
      budgetMaxLatency: input.budget?.maxLatencyMs,
      riskLevel: input.riskLevel,
      requiredCapabilities: input.requirements?.capabilities ?? [],
      preferredProviders: input.requirements?.preferredProviders ?? [],
      excludedModels: input.requirements?.excludedModels ?? [],
      minContextLength: input.requirements?.minContextLength,
    };
  }

  /**
   * Builds human-readable reasoning for the decision
   * INV-RT-004: Reasoning is required and must reference input factors
   */
  private buildReasoning(selected: ScoredModel, context: RoutingContext): string {
    const parts: string[] = [];

    parts.push(
      `Selected ${selected.model.displayName} (score: ${selected.score.toFixed(0)}/100)`
    );
    parts.push(`for ${context.taskType} task`);

    if (context.riskLevel !== 'medium') {
      parts.push(`with ${context.riskLevel} risk level`);
    }

    if (selected.reasons.length > 0) {
      parts.push(`- ${selected.reasons.slice(0, 3).join(', ')}`);
    }

    return parts.join(' ');
  }

  /**
   * Gets a model by ID
   */
  getModel(id: string): ModelDefinition | undefined {
    return this.models.get(id);
  }

  /**
   * Lists all available models
   */
  listModels(): ModelDefinition[] {
    return [...this.modelList];
  }
}

/**
 * Creates a routing engine with the given configuration
 */
export function createRoutingEngine(
  config?: RoutingEngineConfig
): RoutingEngine {
  return new RoutingEngine(config);
}
