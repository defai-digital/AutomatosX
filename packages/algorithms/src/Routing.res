/**
 * Multi-factor Provider Routing Algorithm
 *
 * Selects the optimal provider based on multiple factors:
 * - Priority
 * - Health status
 * - Rate limit usage
 * - Latency
 * - Success rate
 * - Integration mode preference
 *
 * @module Routing
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Types
// =============================================================================

type provider = {
  id: string,
  priority: int,
  healthy: bool,
  rateLimit: float,  // 0.0 - 1.0 (usage ratio)
  latencyMs: int,
  successRate: float, // 0.0 - 1.0
  integrationMode: string, // "mcp" | "sdk" | "bash"
}

type routingContext = {
  taskType: string,
  complexity: int,  // 1-10
  preferMcp: bool,  // Prefer MCP providers
  excludeProviders: array<string>,
  forceProvider: option<string>,
}

type scoredProvider = {
  provider: provider,
  score: float,
  reason: string,
}

type routingResult = {
  provider: option<provider>,
  score: float,
  reason: string,
  alternatives: array<scoredProvider>,
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate routing score for a provider
 * Higher score = better choice
 */
let calculateScore = (provider: provider, ctx: routingContext): float => {
  // Unhealthy providers get negative score
  if !provider.healthy {
    -1000.0
  } else {
    // Base priority score (lower priority number = higher score)
    let priorityScore = 100.0 -. Int.toFloat(provider.priority) *. 10.0

    // Rate limit score (lower usage = higher score)
    let rateLimitScore = (1.0 -. provider.rateLimit) *. 50.0

    // Latency score (lower latency = higher score)
    let latencyScore = Float.fromInt(Math.Int.max(0, 5000 - provider.latencyMs)) /. 100.0

    // Success rate score
    let successScore = provider.successRate *. 100.0

    // MCP preference bonus
    let mcpBonus = if ctx.preferMcp && provider.integrationMode == "mcp" {
      25.0
    } else {
      0.0
    }

    // Complexity adjustment (complex tasks favor high-success providers)
    let complexityFactor = if ctx.complexity > 7 {
      provider.successRate *. 20.0
    } else {
      0.0
    }

    priorityScore +. rateLimitScore +. latencyScore +. successScore +. mcpBonus +. complexityFactor
  }
}

/**
 * Get reason for provider score
 */
let getScoreReason = (provider: provider, score: float, ctx: routingContext): string => {
  if !provider.healthy {
    "Provider is unhealthy"
  } else if score > 200.0 {
    "Excellent: high success rate, low latency"
  } else if score > 150.0 {
    if ctx.preferMcp && provider.integrationMode == "mcp" {
      "Good: MCP provider with good metrics"
    } else {
      "Good: balanced performance metrics"
    }
  } else if score > 100.0 {
    "Acceptable: meets minimum requirements"
  } else {
    "Fallback: other providers unavailable"
  }
}

// =============================================================================
// Provider Selection
// =============================================================================

/**
 * Select the best provider based on context
 */
let selectProvider = (providers: array<provider>, ctx: routingContext): routingResult => {
  // Handle forced provider
  switch ctx.forceProvider {
  | Some(forcedId) =>
    switch providers->Array.find(p => p.id == forcedId) {
    | Some(p) => {
        provider: Some(p),
        score: 1000.0,
        reason: "Forced provider selection",
        alternatives: [],
      }
    | None => {
        provider: None,
        score: 0.0,
        reason: `Forced provider '${forcedId}' not found`,
        alternatives: [],
      }
    }
  | None =>
    // Filter out excluded providers
    let available = providers->Array.filter(p =>
      !(ctx.excludeProviders->Array.includes(p.id))
    )

    // Calculate scores for all providers
    let scored = available->Array.map(p => {
      let score = calculateScore(p, ctx)
      let reason = getScoreReason(p, score, ctx)
      {provider: p, score, reason}
    })

    // Sort by score descending
    let sorted = scored->Array.toSorted((a, b) =>
      if a.score > b.score { -1.0 } else if a.score < b.score { 1.0 } else { 0.0 }
    )

    // Filter out negative scores (unhealthy)
    let valid = sorted->Array.filter(sp => sp.score > 0.0)

    switch valid->Array.get(0) {
    | Some(best) => {
        provider: Some(best.provider),
        score: best.score,
        reason: best.reason,
        alternatives: valid->Array.sliceToEnd(~start=1)->Array.slice(~start=0, ~end=3),
      }
    | None => {
        provider: None,
        score: 0.0,
        reason: "No healthy providers available",
        alternatives: [],
      }
    }
  }
}

/**
 * Get providers sorted by preference for fallback
 */
let getFallbackOrder = (providers: array<provider>, ctx: routingContext): array<provider> => {
  providers
  ->Array.filter(p => p.healthy && !(ctx.excludeProviders->Array.includes(p.id)))
  ->Array.map(p => (p, calculateScore(p, ctx)))
  ->Array.toSorted(((_, a), (_, b)) =>
    if a > b { -1.0 } else if a < b { 1.0 } else { 0.0 }
  )
  ->Array.map(((p, _)) => p)
}
