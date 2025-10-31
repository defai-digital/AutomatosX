/**
 * Provider Metadata Registry
 *
 * Central registry of provider metadata including cost, latency, reliability,
 * cloud/region information, and feature support.
 *
 * @module core/provider-metadata-registry
 */

import type { ProviderMetadata, ProviderMetadataRegistry } from '@/types/provider-metadata.js';

/**
 * Provider metadata registry
 *
 * Contains metadata for all supported providers. Metadata is used for
 * policy-driven routing decisions (cost, latency, privacy, reliability).
 *
 * **Cost data**: Based on official pricing as of Oct 2024
 * **Latency data**: Based on empirical measurements (P50/P95/P99)
 * **Reliability data**: Based on published SLAs and monitoring
 */
export const PROVIDER_METADATA: ProviderMetadataRegistry = {
  /**
   * OpenAI (gpt-4o via codex CLI)
   * - Priority: 1 (highest)
   * - Best for: Performance, streaming, low latency
   * - Cost: Medium ($2.50-$10.00 per 1M tokens)
   */
  'openai': {
    name: 'openai',
    cloud: 'azure',  // OpenAI runs on Azure infrastructure
    regions: ['us-east', 'us-west', 'eu-west', 'ap-southeast'],
    costPerToken: {
      input: 0.0025,   // $2.50 per 1M input tokens (gpt-4o)
      output: 0.0100   // $10.00 per 1M output tokens
    },
    latencyEstimate: {
      p50: 800,   // 0.8 seconds
      p95: 2000,  // 2.0 seconds
      p99: 4000   // 4.0 seconds
    },
    reliability: {
      availability: 0.999,  // 99.9% uptime
      errorRate: 0.001      // 0.1% error rate
    },
    features: {
      streaming: true,
      vision: true,
      functionCalling: true
    }
  },

  /**
   * Google Gemini (gemini-2.0-flash-exp via gemini CLI)
   * - Priority: 2
   * - Best for: Low cost, large context, vision
   * - Cost: Low ($0.125-$0.375 per 1M tokens)
   */
  'gemini-cli': {
    name: 'gemini-cli',
    cloud: 'gcp',
    regions: ['us-central', 'us-east', 'europe-west', 'asia-northeast'],
    costPerToken: {
      input: 0.000125,  // $0.125 per 1M input tokens (Gemini 2.0 Flash)
      output: 0.000375  // $0.375 per 1M output tokens
    },
    latencyEstimate: {
      p50: 1200,  // 1.2 seconds
      p95: 3000,  // 3.0 seconds
      p99: 5000   // 5.0 seconds
    },
    reliability: {
      availability: 0.995,  // 99.5% uptime
      errorRate: 0.005      // 0.5% error rate
    },
    features: {
      streaming: false,  // No native streaming in CLI
      vision: true,
      functionCalling: true
    }
  },

  /**
   * Anthropic Claude (via claude CLI)
   * - Priority: 3
   * - Best for: Long-form content, reasoning, code analysis
   * - Cost: Medium-High (varies by model)
   *
   * Model-specific pricing (per 1M tokens):
   * - claude-3-5-haiku-20241022:  $0.80 input / $4.00 output (fastest, cheapest)
   * - claude-3-5-sonnet-20241022: $3.00 input / $15.00 output (balanced, default)
   * - claude-3-opus-20240229:     $15.00 input / $75.00 output (best reasoning)
   *
   * Default pricing below reflects Sonnet (most commonly used).
   * Actual cost varies by selected model (use --model flag).
   */
  'claude-code': {
    name: 'claude-code',
    cloud: 'aws',
    regions: ['us-east-1', 'us-west-2', 'eu-central-1'],
    costPerToken: {
      input: 0.0030,   // $3.00 per 1M input tokens (Sonnet default)
      output: 0.0150   // $15.00 per 1M output tokens
    },
    latencyEstimate: {
      p50: 1000,  // 1.0 seconds
      p95: 2500,  // 2.5 seconds
      p99: 4500   // 4.5 seconds
    },
    reliability: {
      availability: 0.999,  // 99.9% uptime
      errorRate: 0.001      // 0.1% error rate
    },
    features: {
      streaming: true,  // v6.1.0: Streaming support added
      vision: false,
      functionCalling: false
    }
  },

  /**
   * OpenAI SDK (future support)
   * - Same as 'openai' but via SDK instead of CLI
   */
  'openai-sdk': {
    name: 'openai-sdk',
    cloud: 'azure',
    regions: ['us-east', 'us-west', 'eu-west', 'ap-southeast'],
    costPerToken: {
      input: 0.0025,
      output: 0.0100
    },
    latencyEstimate: {
      p50: 700,   // Slightly faster than CLI
      p95: 1800,
      p99: 3500
    },
    reliability: {
      availability: 0.999,
      errorRate: 0.001
    },
    features: {
      streaming: true,
      vision: true,
      functionCalling: true
    }
  },

  /**
   * Google Gemini SDK (future support)
   * - Same as 'gemini-cli' but via SDK
   */
  'gemini-sdk': {
    name: 'gemini-sdk',
    cloud: 'gcp',
    regions: ['us-central', 'us-east', 'europe-west', 'asia-northeast'],
    costPerToken: {
      input: 0.000125,
      output: 0.000375
    },
    latencyEstimate: {
      p50: 1000,  // Slightly faster than CLI
      p95: 2500,
      p99: 4500
    },
    reliability: {
      availability: 0.995,
      errorRate: 0.005
    },
    features: {
      streaming: true,  // SDK has streaming
      vision: true,
      functionCalling: true
    }
  },

  /**
   * Anthropic Claude SDK (future support)
   * - Same as 'claude-code' but via SDK instead of CLI
   * - Slightly better latency due to native SDK integration
   *
   * Model-specific pricing (per 1M tokens):
   * - claude-3-5-haiku-20241022:  $0.80 input / $4.00 output (fastest, cheapest)
   * - claude-3-5-sonnet-20241022: $3.00 input / $15.00 output (balanced, default)
   * - claude-3-opus-20240229:     $15.00 input / $75.00 output (best reasoning)
   */
  'claude-sdk': {
    name: 'claude-sdk',
    cloud: 'aws',
    regions: ['us-east-1', 'us-west-2', 'eu-central-1'],
    costPerToken: {
      input: 0.0030,   // $3.00 per 1M input tokens (Sonnet default)
      output: 0.0150   // $15.00 per 1M output tokens
    },
    latencyEstimate: {
      p50: 900,   // Slightly faster than CLI
      p95: 2200,
      p99: 4000
    },
    reliability: {
      availability: 0.999,
      errorRate: 0.001
    },
    features: {
      streaming: true,  // SDK has native streaming support
      vision: false,
      functionCalling: false
    }
  }
};

/**
 * Get provider metadata by name
 */
export function getProviderMetadata(providerName: string): ProviderMetadata | null {
  return PROVIDER_METADATA[providerName] || null;
}

/**
 * Get all available providers
 */
export function getAllProviders(): string[] {
  return Object.keys(PROVIDER_METADATA);
}

/**
 * Check if provider exists in registry
 */
export function isProviderRegistered(providerName: string): boolean {
  return providerName in PROVIDER_METADATA;
}

/**
 * Get providers by cloud
 */
export function getProvidersByCloud(cloud: 'aws' | 'gcp' | 'azure' | 'on-prem'): string[] {
  return Object.values(PROVIDER_METADATA)
    .filter(p => p.cloud === cloud)
    .map(p => p.name);
}

/**
 * Get providers by region
 */
export function getProvidersByRegion(region: string): string[] {
  return Object.values(PROVIDER_METADATA)
    .filter(p => p.regions.includes(region))
    .map(p => p.name);
}

/**
 * Get cheapest provider (by average cost)
 */
export function getCheapestProvider(): string | null {
  let cheapest: string | null = null;
  let lowestCost = Infinity;

  for (const [name, metadata] of Object.entries(PROVIDER_METADATA)) {
    const avgCost = (metadata.costPerToken.input + metadata.costPerToken.output) / 2;
    if (avgCost < lowestCost) {
      lowestCost = avgCost;
      cheapest = name;
    }
  }

  return cheapest;
}

/**
 * Get fastest provider (by P95 latency)
 */
export function getFastestProvider(): string | null {
  let fastest: string | null = null;
  let lowestLatency = Infinity;

  for (const [name, metadata] of Object.entries(PROVIDER_METADATA)) {
    if (metadata.latencyEstimate.p95 < lowestLatency) {
      lowestLatency = metadata.latencyEstimate.p95;
      fastest = name;
    }
  }

  return fastest;
}

/**
 * Get most reliable provider (by availability)
 */
export function getMostReliableProvider(): string | null {
  let mostReliable: string | null = null;
  let highestAvailability = 0;

  for (const [name, metadata] of Object.entries(PROVIDER_METADATA)) {
    if (metadata.reliability.availability > highestAvailability) {
      highestAvailability = metadata.reliability.availability;
      mostReliable = name;
    }
  }

  return mostReliable;
}
