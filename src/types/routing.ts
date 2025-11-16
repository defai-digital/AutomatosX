/**
 * Routing Types for Multi-Factor Provider Selection
 *
 * Phase 3: Advanced routing based on cost, latency, quality, and availability
 *
 * @module types/routing
 */

/**
 * Routing Strategy - Defines weights for provider scoring
 */
export interface RoutingStrategy {
  name: string;
  weights: RoutingWeights;
}

/**
 * Routing Weights - Factor importance (0-1, must sum to ≤ 1)
 */
export interface RoutingWeights {
  cost: number;        // Cost optimization (0-1)
  latency: number;     // Speed optimization (0-1)
  quality: number;     // Quality/reliability optimization (0-1)
  availability: number; // Availability optimization (0-1)
}

/**
 * Provider Score - Overall score and breakdown
 */
export interface ProviderScore {
  provider: string;
  totalScore: number;  // Weighted total (0-1)
  breakdown: {
    costScore: number;         // 0-1 (1 = cheapest)
    latencyScore: number;      // 0-1 (1 = fastest)
    qualityScore: number;      // 0-1 (1 = highest quality)
    availabilityScore: number; // 0-1 (1 = most available)
  };
  healthMultiplier: number;  // Circuit breaker adjustment (0-1)
  metadata?: {
    avgLatencyMs?: number;
    avgCostPer1M?: number;
    successRate?: number;
    lastUsed?: number;
  };
}

/**
 * Provider Metrics - Real-time performance tracking
 */
export interface ProviderMetrics {
  provider: string;
  window: number;  // Number of recent requests tracked

  // Latency metrics
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };

  // Quality metrics
  quality: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;  // 0-1
    stopFinishes: number;  // Normal completions
    lengthFinishes: number;  // Max token limit
    errorFinishes: number;  // Errors
    properStopRate: number;  // stopFinishes / successfulRequests
  };

  // Cost metrics
  cost: {
    totalCostUsd: number;
    avgCostPerRequest: number;
    avgCostPer1MTokens: number;
  };

  // Availability metrics
  availability: {
    uptime: number;  // 0-1
    lastSuccess: number;  // timestamp
    lastFailure: number;  // timestamp
    consecutiveFailures: number;
  };

  // Timestamps
  firstRequest: number;
  lastRequest: number;
  lastUpdated: number;
}

/**
 * Pre-configured Routing Strategies
 */
export type StrategyName = 'fast' | 'cheap' | 'balanced' | 'quality' | 'custom';

/**
 * Routing Strategy Map
 */
export const ROUTING_STRATEGIES: Record<StrategyName, RoutingStrategy> = {
  /**
   * Fast Strategy - Minimize latency
   * Best for: Real-time applications, user-facing features
   */
  fast: {
    name: 'fast',
    weights: {
      latency: 0.70,
      quality: 0.20,
      cost: 0.10,
      availability: 0.00
    }
  },

  /**
   * Cheap Strategy - Minimize cost
   * Best for: Batch processing, non-critical tasks
   */
  cheap: {
    name: 'cheap',
    weights: {
      cost: 0.70,
      quality: 0.20,
      latency: 0.10,
      availability: 0.00
    }
  },

  /**
   * Balanced Strategy - Balance all factors equally
   * Best for: General-purpose use
   */
  balanced: {
    name: 'balanced',
    weights: {
      cost: 0.33,
      latency: 0.33,
      quality: 0.33,
      availability: 0.01
    }
  },

  /**
   * Quality Strategy - Maximize quality and reliability
   * Best for: Production systems, critical tasks
   */
  quality: {
    name: 'quality',
    weights: {
      quality: 0.60,
      latency: 0.30,
      cost: 0.10,
      availability: 0.00
    }
  },

  /**
   * Custom Strategy - User-defined weights
   * Weights must be provided in config
   */
  custom: {
    name: 'custom',
    weights: {
      cost: 0.25,
      latency: 0.25,
      quality: 0.25,
      availability: 0.25
    }
  }
};

/**
 * Model Pricing - Cost per 1M tokens (input, output)
 */
export interface ModelPricing {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

/**
 * Provider Pricing Map
 */
export const PROVIDER_PRICING: Record<string, Record<string, ModelPricing>> = {
  'openai': {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'o1-preview': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 }
  },
  'claude-code': {
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
  },
  'gemini-cli': {
    'gemini-1.5-pro': { input: 3.50, output: 10.50 },
    'gemini-1.5-flash': { input: 0.35, output: 1.05 },
    'gemini-1.0-pro': { input: 0.50, output: 1.50 },
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-pro-vision': { input: 0.50, output: 1.50 }
  }
};

/**
 * Routing Decision - Result of provider selection
 */
export interface RoutingDecision {
  selectedProvider: string;
  strategy: StrategyName;
  scores: ProviderScore[];
  reason: string;
  timestamp: number;
}

/**
 * Routing Configuration
 */
export interface RoutingConfig {
  strategy: StrategyName;
  customWeights?: RoutingWeights;
  metricsWindow?: number;  // Number of requests for rolling metrics (default: 100)
  minRequestsForScoring?: number;  // Minimum requests before using metrics (default: 10)
  enableLogging?: boolean;  // Log routing decisions (default: false)
}
