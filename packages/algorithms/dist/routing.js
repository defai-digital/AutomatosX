// src/bindings/routing.ts
var PRIORITY_MIN = 1;
var PRIORITY_MAX = 10;
var PRIORITY_BASE_SCORE = 100;
var PRIORITY_SCORE_MULTIPLIER = 10;
var RATE_LIMIT_SCORE_MULTIPLIER = 50;
var LATENCY_BASELINE_MS = 5e3;
var LATENCY_SCORE_DIVISOR = 100;
var SUCCESS_RATE_MULTIPLIER = 100;
var MCP_PREFERENCE_BONUS = 25;
var COMPLEXITY_HIGH_THRESHOLD = 7;
var COMPLEXITY_BONUS_MULTIPLIER = 20;
var SCORE_THRESHOLD_EXCELLENT = 200;
var SCORE_THRESHOLD_GOOD = 150;
var SCORE_THRESHOLD_ACCEPTABLE = 100;
var UNHEALTHY_PROVIDER_PENALTY = -1e3;
var FORCED_PROVIDER_SCORE = 1e3;
var DEFAULT_COMPLEXITY = 5;
var INTEGRATION_MODE_MCP = "mcp";
var MAX_ALTERNATIVES = 3;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var defaultRoutingContext = {
  taskType: "general",
  complexity: DEFAULT_COMPLEXITY,
  preferMcp: true,
  excludeProviders: []
};
function calculateScore(provider, ctx) {
  if (!provider.healthy) {
    return UNHEALTHY_PROVIDER_PENALTY;
  }
  const normalizedPriority = clamp(provider.priority, PRIORITY_MIN, PRIORITY_MAX);
  const priorityScore = PRIORITY_BASE_SCORE - normalizedPriority * PRIORITY_SCORE_MULTIPLIER;
  const clampedRateLimit = clamp(provider.rateLimit, 0, 1);
  const rateLimitScore = (1 - clampedRateLimit) * RATE_LIMIT_SCORE_MULTIPLIER;
  const latencyScore = Math.max(0, LATENCY_BASELINE_MS - provider.latencyMs) / LATENCY_SCORE_DIVISOR;
  const successScore = provider.successRate * SUCCESS_RATE_MULTIPLIER;
  const mcpBonus = ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP ? MCP_PREFERENCE_BONUS : 0;
  const complexityFactor = ctx.complexity > COMPLEXITY_HIGH_THRESHOLD ? provider.successRate * COMPLEXITY_BONUS_MULTIPLIER : 0;
  return priorityScore + rateLimitScore + latencyScore + successScore + mcpBonus + complexityFactor;
}
function getScoreReason(provider, score, ctx) {
  if (!provider.healthy) {
    return "Provider is unhealthy";
  }
  if (score > SCORE_THRESHOLD_EXCELLENT) {
    return "Excellent: high success rate, low latency";
  }
  if (score > SCORE_THRESHOLD_GOOD) {
    if (ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP) {
      return "Good: MCP provider with good metrics";
    }
    return "Good: balanced performance metrics";
  }
  if (score > SCORE_THRESHOLD_ACCEPTABLE) {
    return "Acceptable: meets minimum requirements";
  }
  return "Fallback: other providers unavailable";
}
function selectProvider(providers, ctx = defaultRoutingContext) {
  if (ctx.forceProvider) {
    const forced = providers.find((p) => p.id === ctx.forceProvider);
    if (forced) {
      return {
        provider: forced,
        score: FORCED_PROVIDER_SCORE,
        reason: "Forced provider selection",
        alternatives: []
      };
    }
    return {
      provider: null,
      score: 0,
      reason: `Forced provider '${ctx.forceProvider}' not found`,
      alternatives: []
    };
  }
  const available = providers.filter((p) => !ctx.excludeProviders.includes(p.id));
  const scored = available.map((p) => {
    const score = calculateScore(p, ctx);
    const reason = getScoreReason(p, score, ctx);
    return { provider: p, score, reason };
  });
  scored.sort((a, b) => b.score - a.score);
  const valid = scored.filter((s) => s.score > 0);
  if (valid.length === 0) {
    return {
      provider: null,
      score: 0,
      reason: "No healthy providers available",
      alternatives: []
    };
  }
  const best = valid[0];
  return {
    provider: best.provider,
    score: best.score,
    reason: best.reason,
    alternatives: valid.slice(1, 1 + MAX_ALTERNATIVES)
  };
}
function getFallbackOrder(providers, ctx = defaultRoutingContext) {
  return providers.filter((p) => p.healthy && !ctx.excludeProviders.includes(p.id)).map((p) => ({ provider: p, score: calculateScore(p, ctx) })).sort((a, b) => b.score - a.score).map((s) => s.provider);
}
export {
  calculateScore,
  defaultRoutingContext,
  getFallbackOrder,
  selectProvider
};
/**
 * TypeScript bindings for ReScript Routing module
 *
 * @module @ax/algorithms/routing
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=routing.js.map