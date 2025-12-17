import type { ModelDefinition, RoutingContext, ScoredModel } from './types.js';

/**
 * Scores a model against routing context
 * Returns a score from 0-100 and reasons for the score
 *
 * Routing Invariants:
 * - INV-RT-001: Deterministic scoring - same inputs always produce same scores
 * - INV-RT-002: Risk gating - high risk never selects experimental models
 * - INV-RT-003: Reasoning required - all decisions include reasoning
 * - INV-RT-004: Fallback consistency - fallbacks satisfy same constraints
 * - INV-RT-005: Capability match - selected model has required capabilities
 *
 * Note: Cost-based routing is intentionally excluded by design.
 */
export function scoreModel(
  model: ModelDefinition,
  context: RoutingContext
): ScoredModel {
  const reasons: string[] = [];
  let score = 50; // Base score
  let disqualified = false;
  let disqualificationReason: string | undefined;

  // INV-RT-002: Risk gating - high risk never selects experimental
  if (context.riskLevel === 'high' && model.isExperimental) {
    disqualified = true;
    disqualificationReason = 'Experimental models not allowed for high-risk tasks';
    return {
      model,
      score: 0,
      reasons: [disqualificationReason],
      disqualified,
      disqualificationReason,
    };
  }

  // Check excluded models
  if (context.excludedModels.includes(model.id)) {
    disqualified = true;
    disqualificationReason = 'Model is in exclusion list';
    return {
      model,
      score: 0,
      reasons: [disqualificationReason],
      disqualified,
      disqualificationReason,
    };
  }

  // Check context length requirement
  if (
    context.minContextLength !== undefined &&
    model.contextLength < context.minContextLength
  ) {
    disqualified = true;
    disqualificationReason = `Context length (${String(model.contextLength)}) below required (${String(context.minContextLength)})`;
    return {
      model,
      score: 0,
      reasons: [disqualificationReason],
      disqualified,
      disqualificationReason,
    };
  }

  // Check required capabilities
  for (const cap of context.requiredCapabilities) {
    if (!model.capabilities.includes(cap)) {
      disqualified = true;
      disqualificationReason = `Missing required capability: ${cap}`;
      return {
        model,
        score: 0,
        reasons: [disqualificationReason],
        disqualified,
        disqualificationReason,
      };
    }
  }

  // Bonus for preferred providers
  if (context.preferredProviders.includes(model.provider)) {
    score += 15;
    reasons.push('Preferred provider');
  }

  // Bonus for task optimization
  if (model.optimizedFor.includes(context.taskType)) {
    score += 20;
    reasons.push(`Optimized for ${context.taskType} tasks`);
  }

  // Add base priority
  score += model.priority / 10;
  reasons.push(`Base priority: ${String(model.priority)}`);

  // Penalty for experimental in medium risk
  if (context.riskLevel === 'medium' && model.isExperimental) {
    score -= 10;
    reasons.push('Experimental model penalty for medium-risk');
  }

  // Bonus for non-experimental in any risk level
  if (!model.isExperimental) {
    score += 5;
    reasons.push('Stable model bonus');
  }

  // Normalize score to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    model,
    score,
    reasons,
    disqualified,
  };
}

/**
 * Sorts scored models by score (highest first)
 * INV-RT-001: Deterministic sorting - uses stable sort with id as tiebreaker
 */
export function sortScoredModels(models: ScoredModel[]): ScoredModel[] {
  return [...models].sort((a, b) => {
    // Primary: score descending
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Secondary: model id ascending (deterministic tiebreaker)
    return a.model.id.localeCompare(b.model.id);
  });
}
