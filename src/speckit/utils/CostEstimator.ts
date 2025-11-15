/**
 * CostEstimator Utility
 *
 * Week 3-4 Implementation - Day 2
 * Estimates costs for workflow execution based on provider pricing,
 * token counts, and API call estimates
 */

import type {
  WorkflowDefinition,
  WorkflowStep,
  CostEstimate,
  CostBreakdown,
} from '../types/speckit.types.js';

/**
 * Provider pricing configuration (as of 2025-01)
 * Prices in USD per 1M tokens
 */
const PROVIDER_PRICING = {
  claude: {
    'claude-3-5-sonnet-20241022': {
      input: 3.0, // $3 per 1M input tokens
      output: 15.0, // $15 per 1M output tokens
    },
    'claude-3-5-haiku-20241022': {
      input: 1.0, // $1 per 1M input tokens
      output: 5.0, // $5 per 1M output tokens
    },
    'claude-3-opus-20240229': {
      input: 15.0, // $15 per 1M input tokens
      output: 75.0, // $75 per 1M output tokens
    },
  },
  gemini: {
    'gemini-2.0-flash-exp': {
      input: 0.0, // Free tier
      output: 0.0,
    },
    'gemini-1.5-pro': {
      input: 1.25, // $1.25 per 1M input tokens
      output: 5.0, // $5 per 1M output tokens
    },
    'gemini-1.5-flash': {
      input: 0.075, // $0.075 per 1M input tokens
      output: 0.3, // $0.30 per 1M output tokens
    },
  },
  openai: {
    'gpt-4o': {
      input: 2.5, // $2.50 per 1M input tokens
      output: 10.0, // $10 per 1M output tokens
    },
    'gpt-4o-mini': {
      input: 0.15, // $0.15 per 1M input tokens
      output: 0.6, // $0.60 per 1M output tokens
    },
    'gpt-4-turbo': {
      input: 10.0, // $10 per 1M input tokens
      output: 30.0, // $30 per 1M output tokens
    },
  },
} as const;

/**
 * Default models for each provider
 */
const DEFAULT_MODELS = {
  claude: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
} as const;

/**
 * Token estimation heuristics
 */
const TOKEN_ESTIMATES = {
  // Base prompt overhead (system message, instructions)
  basePrompt: 500,

  // Per step overhead (step description, context)
  perStepOverhead: 200,

  // Average prompt tokens per step
  avgPromptTokens: 1500,

  // Average completion tokens per step
  avgCompletionTokens: 800,

  // Multiplier for complex tasks
  complexityMultiplier: {
    low: 1.0,
    medium: 1.5,
    high: 2.0,
  },
} as const;

/**
 * CostEstimator calculates workflow execution costs based on
 * provider pricing and estimated token usage
 */
export class CostEstimator {
  /**
   * Estimate cost for a single workflow step
   */
  estimateStepCost(
    step: WorkflowStep,
    provider: string = 'claude',
    model?: string,
    complexity: 'low' | 'medium' | 'high' = 'medium'
  ): CostEstimate {
    // Get provider and model pricing
    const providerKey = provider.toLowerCase() as keyof typeof PROVIDER_PRICING;
    const providerPricing = PROVIDER_PRICING[providerKey];

    if (!providerPricing) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const modelKey = model || DEFAULT_MODELS[providerKey];
    const modelPricing = providerPricing[modelKey as keyof typeof providerPricing];

    if (!modelPricing) {
      throw new Error(`Unknown model: ${modelKey} for provider ${provider}`);
    }

    // Estimate tokens
    const complexityMult = TOKEN_ESTIMATES.complexityMultiplier[complexity];

    const inputTokens = Math.round(
      (TOKEN_ESTIMATES.basePrompt +
        TOKEN_ESTIMATES.perStepOverhead +
        TOKEN_ESTIMATES.avgPromptTokens) *
        complexityMult
    );

    const outputTokens = Math.round(
      TOKEN_ESTIMATES.avgCompletionTokens * complexityMult
    );

    const totalTokens = inputTokens + outputTokens;

    // Calculate costs
    const inputCost = (inputTokens / 1_000_000) * (modelPricing as any).input;
    const outputCost = (outputTokens / 1_000_000) * (modelPricing as any).output;
    const cost = inputCost + outputCost;

    const breakdown: CostBreakdown = {
      inputCost,
      outputCost,
      apiCalls: 1,
    };

    return {
      provider,
      model: modelKey,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      breakdown,
    };
  }

  /**
   * Estimate total cost for entire workflow
   */
  estimateWorkflowCost(
    workflow: WorkflowDefinition,
    provider: string = 'claude',
    model?: string
  ): CostEstimate {
    // Determine workflow complexity
    const complexity = this.determineWorkflowComplexity(workflow);

    // Estimate cost for each step
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalInputCost = 0;
    let totalOutputCost = 0;

    for (const step of workflow.steps) {
      const stepCost = this.estimateStepCost(step, provider, model, complexity);

      totalInputTokens += stepCost.inputTokens;
      totalOutputTokens += stepCost.outputTokens;
      totalCost += stepCost.cost;
      totalInputCost += stepCost.breakdown.inputCost;
      totalOutputCost += stepCost.breakdown.outputCost;
    }

    const breakdown: CostBreakdown = {
      inputCost: totalInputCost,
      outputCost: totalOutputCost,
      apiCalls: workflow.steps.length,
    };

    return {
      provider,
      model: model || DEFAULT_MODELS[provider.toLowerCase() as keyof typeof DEFAULT_MODELS],
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      cost: totalCost,
      breakdown,
    };
  }

  /**
   * Compare costs across different providers
   */
  compareProviders(
    workflow: WorkflowDefinition
  ): Record<string, CostEstimate> {
    const providers = ['claude', 'gemini', 'openai'];
    const results: Record<string, CostEstimate> = {};

    for (const provider of providers) {
      try {
        results[provider] = this.estimateWorkflowCost(workflow, provider);
      } catch (error) {
        // Skip providers that fail
        continue;
      }
    }

    return results;
  }

  /**
   * Get cheapest provider option
   */
  getCheapestProvider(workflow: WorkflowDefinition): {
    provider: string;
    estimate: CostEstimate;
  } {
    const comparison = this.compareProviders(workflow);
    const entries = Object.entries(comparison);

    if (entries.length === 0) {
      throw new Error('No valid provider estimates available');
    }

    const [cheapestProvider, cheapestEstimate] = entries.reduce((min, current) => {
      return current[1].cost < min[1].cost ? current : min;
    });

    return {
      provider: cheapestProvider,
      estimate: cheapestEstimate,
    };
  }

  /**
   * Get fastest provider option (based on typical latency)
   */
  getFastestProvider(workflow: WorkflowDefinition): {
    provider: string;
    estimate: CostEstimate;
  } {
    // Gemini Flash is typically fastest, followed by Claude Haiku, then GPT-4o-mini
    const providerSpeed = {
      gemini: 1, // Fastest
      claude: 2,
      openai: 3,
    };

    const comparison = this.compareProviders(workflow);
    const entries = Object.entries(comparison);

    if (entries.length === 0) {
      throw new Error('No valid provider estimates available');
    }

    const [fastestProvider, fastestEstimate] = entries.reduce((min, current) => {
      const currentSpeed = providerSpeed[current[0] as keyof typeof providerSpeed] || 999;
      const minSpeed = providerSpeed[min[0] as keyof typeof providerSpeed] || 999;
      return currentSpeed < minSpeed ? current : min;
    });

    return {
      provider: fastestProvider,
      estimate: fastestEstimate,
    };
  }

  /**
   * Get balanced provider option (good price/performance ratio)
   */
  getBalancedProvider(workflow: WorkflowDefinition): {
    provider: string;
    estimate: CostEstimate;
  } {
    // Score = normalized_cost * 0.6 + normalized_speed * 0.4
    const comparison = this.compareProviders(workflow);
    const entries = Object.entries(comparison);

    if (entries.length === 0) {
      throw new Error('No valid provider estimates available');
    }

    const costs = entries.map(([_, est]) => est.cost);
    const maxCost = Math.max(...costs);
    const minCost = Math.min(...costs);
    const costRange = maxCost - minCost || 1;

    const providerSpeed = { gemini: 1, claude: 2, openai: 3 };
    const maxSpeed = 3;
    const minSpeed = 1;
    const speedRange = maxSpeed - minSpeed;

    const [balancedProvider, balancedEstimate] = entries.reduce((best, current) => {
      const [provider, estimate] = current;

      // Normalize cost (0 = cheapest, 1 = most expensive)
      const normalizedCost = (estimate.cost - minCost) / costRange;

      // Normalize speed (0 = fastest, 1 = slowest)
      const speed = providerSpeed[provider as keyof typeof providerSpeed] || maxSpeed;
      const normalizedSpeed = (speed - minSpeed) / speedRange;

      // Calculate score (lower is better)
      const score = normalizedCost * 0.6 + normalizedSpeed * 0.4;

      // Calculate best score
      const [bestProvider, bestEstimate] = best;
      const bestSpeed = providerSpeed[bestProvider as keyof typeof providerSpeed] || maxSpeed;
      const bestNormalizedCost = (bestEstimate.cost - minCost) / costRange;
      const bestNormalizedSpeed = (bestSpeed - minSpeed) / speedRange;
      const bestScore = bestNormalizedCost * 0.6 + bestNormalizedSpeed * 0.4;

      return score < bestScore ? current : best;
    });

    return {
      provider: balancedProvider,
      estimate: balancedEstimate,
    };
  }

  /**
   * Determine workflow complexity based on step count and dependencies
   */
  private determineWorkflowComplexity(
    workflow: WorkflowDefinition
  ): 'low' | 'medium' | 'high' {
    const stepCount = workflow.steps.length;
    const maxDeps = Math.max(
      ...workflow.steps.map(s => s.dependsOn?.length || 0)
    );

    if (stepCount > 10 || maxDeps > 3) {
      return 'high';
    } else if (stepCount > 5 || maxDeps > 1) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Format cost as USD string
   */
  formatCost(cost: number): string {
    if (cost < 0.001) {
      return '<$0.001';
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * Format token count with K/M suffixes
   */
  formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(2)}M`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`;
    } else {
      return `${tokens}`;
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Object.keys(PROVIDER_PRICING);
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: string): string[] {
    const providerKey = provider.toLowerCase() as keyof typeof PROVIDER_PRICING;
    const providerPricing = PROVIDER_PRICING[providerKey];

    if (!providerPricing) {
      return [];
    }

    return Object.keys(providerPricing);
  }

  /**
   * Get pricing for a specific model
   */
  getModelPricing(provider: string, model: string): {
    input: number;
    output: number;
  } | null {
    const providerKey = provider.toLowerCase() as keyof typeof PROVIDER_PRICING;
    const providerPricing = PROVIDER_PRICING[providerKey];

    if (!providerPricing) {
      return null;
    }

    const modelPricing = providerPricing[model as keyof typeof providerPricing];
    return modelPricing || null;
  }
}
