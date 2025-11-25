/**
 * TypeScript bindings for ReScript Routing module
 *
 * @module @ax/algorithms/routing
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Routing Algorithm Constants
// =============================================================================

/** Priority scoring parameters */
const PRIORITY_MIN = 1;
const PRIORITY_MAX = 10;
const PRIORITY_BASE_SCORE = 100;
const PRIORITY_SCORE_MULTIPLIER = 10;

/** Rate limit scoring */
const RATE_LIMIT_SCORE_MULTIPLIER = 50;

/** Latency scoring parameters */
const LATENCY_BASELINE_MS = 5000;
const LATENCY_SCORE_DIVISOR = 100;

/** Success rate scoring */
const SUCCESS_RATE_MULTIPLIER = 100;

/** MCP preference bonus */
const MCP_PREFERENCE_BONUS = 25;

/** Complexity threshold and bonus */
const COMPLEXITY_HIGH_THRESHOLD = 7;
const COMPLEXITY_BONUS_MULTIPLIER = 20;

/** Score thresholds for reason categorization */
const SCORE_THRESHOLD_EXCELLENT = 200;
const SCORE_THRESHOLD_GOOD = 150;
const SCORE_THRESHOLD_ACCEPTABLE = 100;

/** Unhealthy provider penalty */
const UNHEALTHY_PROVIDER_PENALTY = -1000;

/** Forced provider score */
const FORCED_PROVIDER_SCORE = 1000;

/** Default complexity value */
const DEFAULT_COMPLEXITY = 5;

/** Integration mode constant */
const INTEGRATION_MODE_MCP = 'mcp';

/** Maximum number of alternative providers to return */
const MAX_ALTERNATIVES = 3;

// =============================================================================
// Types
// =============================================================================

// Types that mirror ReScript types
export interface Provider {
  id: string;
  priority: number;
  healthy: boolean;
  rateLimit: number; // 0.0 - 1.0
  latencyMs: number;
  successRate: number; // 0.0 - 1.0
  integrationMode: 'mcp' | 'sdk' | 'bash';
}

export interface RoutingContext {
  taskType: string;
  complexity: number; // 1-10
  preferMcp: boolean;
  excludeProviders: string[];
  forceProvider?: string;
}

export interface RoutingResult {
  provider: Provider | null;
  score: number;
  reason: string;
  alternatives: Array<{
    provider: Provider;
    score: number;
    reason: string;
  }>;
}

/**
 * Clamp a number between min and max bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Default context
export const defaultRoutingContext: RoutingContext = {
  taskType: 'general',
  complexity: DEFAULT_COMPLEXITY,
  preferMcp: true,
  excludeProviders: [],
};

/**
 * Calculate routing score for a provider
 */
export function calculateScore(provider: Provider, ctx: RoutingContext): number {
  if (!provider.healthy) {
    return UNHEALTHY_PROVIDER_PENALTY;
  }

  // Base priority score (lower priority number = higher score)
  const normalizedPriority = clamp(provider.priority, PRIORITY_MIN, PRIORITY_MAX);
  const priorityScore = PRIORITY_BASE_SCORE - normalizedPriority * PRIORITY_SCORE_MULTIPLIER;

  // Rate limit score (lower usage = higher score)
  const clampedRateLimit = clamp(provider.rateLimit, 0, 1);
  const rateLimitScore = (1 - clampedRateLimit) * RATE_LIMIT_SCORE_MULTIPLIER;

  // Latency score (lower latency = higher score)
  const latencyScore = Math.max(0, LATENCY_BASELINE_MS - provider.latencyMs) / LATENCY_SCORE_DIVISOR;

  // Success rate score
  const successScore = provider.successRate * SUCCESS_RATE_MULTIPLIER;

  // MCP preference bonus
  const mcpBonus = ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP ? MCP_PREFERENCE_BONUS : 0;

  // Complexity adjustment (high complexity tasks benefit from reliable providers)
  const complexityFactor = ctx.complexity > COMPLEXITY_HIGH_THRESHOLD
    ? provider.successRate * COMPLEXITY_BONUS_MULTIPLIER
    : 0;

  return priorityScore + rateLimitScore + latencyScore + successScore + mcpBonus + complexityFactor;
}

/**
 * Get reason for score
 */
function getScoreReason(provider: Provider, score: number, ctx: RoutingContext): string {
  if (!provider.healthy) {
    return 'Provider is unhealthy';
  }
  if (score > SCORE_THRESHOLD_EXCELLENT) {
    return 'Excellent: high success rate, low latency';
  }
  if (score > SCORE_THRESHOLD_GOOD) {
    if (ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP) {
      return 'Good: MCP provider with good metrics';
    }
    return 'Good: balanced performance metrics';
  }
  if (score > SCORE_THRESHOLD_ACCEPTABLE) {
    return 'Acceptable: meets minimum requirements';
  }
  return 'Fallback: other providers unavailable';
}

/**
 * Select the best provider based on context
 */
export function selectProvider(providers: Provider[], ctx: RoutingContext = defaultRoutingContext): RoutingResult {
  // Handle forced provider
  if (ctx.forceProvider) {
    const forced = providers.find((p) => p.id === ctx.forceProvider);
    if (forced) {
      return {
        provider: forced,
        score: FORCED_PROVIDER_SCORE,
        reason: 'Forced provider selection',
        alternatives: [],
      };
    }
    return {
      provider: null,
      score: 0,
      reason: `Forced provider '${ctx.forceProvider}' not found`,
      alternatives: [],
    };
  }

  // Filter out excluded providers
  const available = providers.filter((p) => !ctx.excludeProviders.includes(p.id));

  // Calculate scores
  const scored = available.map((p) => {
    const score = calculateScore(p, ctx);
    const reason = getScoreReason(p, score, ctx);
    return { provider: p, score, reason };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Filter out unhealthy (negative scores)
  const valid = scored.filter((s) => s.score > 0);

  if (valid.length === 0) {
    return {
      provider: null,
      score: 0,
      reason: 'No healthy providers available',
      alternatives: [],
    };
  }

  const best = valid[0]!;
  return {
    provider: best.provider,
    score: best.score,
    reason: best.reason,
    alternatives: valid.slice(1, 1 + MAX_ALTERNATIVES),
  };
}

/**
 * Get providers sorted by preference for fallback
 */
export function getFallbackOrder(providers: Provider[], ctx: RoutingContext = defaultRoutingContext): Provider[] {
  return providers
    .filter((p) => p.healthy && !ctx.excludeProviders.includes(p.id))
    .map((p) => ({ provider: p, score: calculateScore(p, ctx) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.provider);
}
