/**
 * Policy Evaluator
 *
 * Evaluates providers based on policy constraints and optimization weights.
 * Filters providers that don't meet constraints, then scores remaining providers.
 *
 * @module core/spec/PolicyEvaluator
 */

import type { ParsedPolicy } from './PolicyParser.js';
import type {
  CostConstraint,
  LatencyConstraint,
  PrivacyConstraint,
  ReliabilityConstraint
} from '@/types/spec-yaml.js';
import type { ProviderMetadata, ProviderMetadataRegistry } from '@/types/provider-metadata.js';
import type { CostTracker } from '../cost-tracker.js';
import { logger } from '@/utils/logger.js';

/**
 * Provider score with explanation
 */
export interface ProviderScore {
  provider: string;
  totalScore: number;
  breakdown: {
    costScore: number;
    latencyScore: number;
    reliabilityScore: number;
  };
  metadata: ProviderMetadata;
}

/**
 * Filter result with reason
 */
export interface FilterResult {
  passed: string[];
  filtered: Array<{
    provider: string;
    reason: string;
  }>;
}

/**
 * Policy evaluator for provider selection
 */
export class PolicyEvaluator {
  constructor(
    private metadataRegistry: ProviderMetadataRegistry,
    private costTracker?: CostTracker
  ) {}

  /**
   * Filter providers by policy constraints
   *
   * @param availableProviders - List of available provider names
   * @param policy - Parsed policy
   * @returns Filter result with passed/filtered providers
   */
  async filterProviders(
    availableProviders: string[],
    policy: ParsedPolicy
  ): Promise<FilterResult> {
    const passed: string[] = [];
    const filtered: Array<{ provider: string; reason: string }> = [];

    for (const provider of availableProviders) {
      const metadata = this.metadataRegistry[provider];
      if (!metadata) {
        filtered.push({ provider, reason: 'Metadata not found' });
        continue;
      }

      // Apply cost constraints
      if (policy.constraints.cost) {
        const costResult = await this.checkCostConstraint(provider, policy.constraints.cost);
        if (!costResult.passed) {
          filtered.push({ provider, reason: costResult.reason });
          continue;
        }
      }

      // Apply latency constraints
      if (policy.constraints.latency) {
        const latencyResult = this.checkLatencyConstraint(metadata, policy.constraints.latency);
        if (!latencyResult.passed) {
          filtered.push({ provider, reason: latencyResult.reason });
          continue;
        }
      }

      // Apply privacy constraints
      if (policy.constraints.privacy) {
        const privacyResult = this.checkPrivacyConstraint(metadata, policy.constraints.privacy);
        if (!privacyResult.passed) {
          filtered.push({ provider, reason: privacyResult.reason });
          continue;
        }
      }

      // Apply reliability constraints
      if (policy.constraints.reliability) {
        const reliabilityResult = this.checkReliabilityConstraint(
          metadata,
          policy.constraints.reliability
        );
        if (!reliabilityResult.passed) {
          filtered.push({ provider, reason: reliabilityResult.reason });
          continue;
        }
      }

      // Passed all constraints
      passed.push(provider);
    }

    logger.debug('Providers filtered by policy', {
      total: availableProviders.length,
      passed: passed.length,
      filtered: filtered.length
    });

    return { passed, filtered };
  }

  /**
   * Score providers by optimization weights
   *
   * @param providers - List of provider names (should already be filtered)
   * @param policy - Parsed policy
   * @returns Sorted array of provider scores (highest first)
   */
  scoreProviders(providers: string[], policy: ParsedPolicy): ProviderScore[] {
    const scores: ProviderScore[] = [];

    for (const provider of providers) {
      const metadata = this.metadataRegistry[provider];
      if (!metadata) continue;

      const costScore = this.calculateCostScore(metadata);
      const latencyScore = this.calculateLatencyScore(metadata);
      const reliabilityScore = this.calculateReliabilityScore(metadata);

      const totalScore =
        costScore * policy.optimization.weights.cost +
        latencyScore * policy.optimization.weights.latency +
        reliabilityScore * policy.optimization.weights.reliability;

      scores.push({
        provider,
        totalScore,
        breakdown: {
          costScore,
          latencyScore,
          reliabilityScore
        },
        metadata
      });
    }

    // Sort by score (highest first)
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // FIXED: Protect toFixed() call from undefined with optional chaining AND nullish coalescing
    logger.debug('Providers scored', {
      count: scores.length,
      topProvider: scores[0]?.provider,
      topScore: scores[0]?.totalScore?.toFixed(3) ?? 'N/A'
    });

    return scores;
  }

  /**
   * Select best provider based on policy
   *
   * @param availableProviders - List of available provider names
   * @param policy - Parsed policy
   * @returns Selected provider name or null if no providers match
   */
  async selectProvider(
    availableProviders: string[],
    policy: ParsedPolicy
  ): Promise<string | null> {
    // Filter by constraints
    const filterResult = await this.filterProviders(availableProviders, policy);

    if (filterResult.passed.length === 0) {
      logger.warn('No providers passed policy constraints', {
        total: availableProviders.length,
        filtered: filterResult.filtered.map(f => `${f.provider}: ${f.reason}`)
      });
      return null;
    }

    // Score remaining providers
    const scores = this.scoreProviders(filterResult.passed, policy);

    const selected = scores[0]?.provider || null;

    if (selected && scores[0]) {
      logger.info('Provider selected by policy', {
        provider: selected,
        score: scores[0].totalScore.toFixed(3),
        breakdown: scores[0].breakdown
      });
    }

    return selected;
  }

  /**
   * Check cost constraint
   */
  private async checkCostConstraint(
    provider: string,
    constraint: CostConstraint
  ): Promise<{ passed: boolean; reason: string }> {
    // Check daily budget if cost tracker available
    if (constraint.maxDaily && this.costTracker) {
      // Get daily cost (last 24 hours)
      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);

      const dailyCost = await this.costTracker.getTotalCost({
        provider,
        startTime: dayAgo,
        endTime: now
      });

      if (dailyCost >= constraint.maxDaily) {
        return {
          passed: false,
          reason: `Daily budget exceeded ($${dailyCost.toFixed(2)} >= $${constraint.maxDaily})`
        };
      }
    }

    // Note: maxPerRequest is checked at execution time, not during selection

    return { passed: true, reason: '' };
  }

  /**
   * Check latency constraint
   */
  private checkLatencyConstraint(
    metadata: ProviderMetadata,
    constraint: LatencyConstraint
  ): { passed: boolean; reason: string } {
    if (constraint.p50 && metadata.latencyEstimate.p50 > constraint.p50) {
      return {
        passed: false,
        reason: `P50 latency too high (${metadata.latencyEstimate.p50}ms > ${constraint.p50}ms)`
      };
    }

    if (constraint.p95 && metadata.latencyEstimate.p95 > constraint.p95) {
      return {
        passed: false,
        reason: `P95 latency too high (${metadata.latencyEstimate.p95}ms > ${constraint.p95}ms)`
      };
    }

    if (constraint.p99 && metadata.latencyEstimate.p99 > constraint.p99) {
      return {
        passed: false,
        reason: `P99 latency too high (${metadata.latencyEstimate.p99}ms > ${constraint.p99}ms)`
      };
    }

    return { passed: true, reason: '' };
  }

  /**
   * Check privacy constraint
   */
  private checkPrivacyConstraint(
    metadata: ProviderMetadata,
    constraint: PrivacyConstraint
  ): { passed: boolean; reason: string } {
    // Check allowed clouds
    if (constraint.allowedClouds && constraint.allowedClouds.length > 0) {
      if (!constraint.allowedClouds.includes(metadata.cloud)) {
        return {
          passed: false,
          reason: `Cloud not allowed (${metadata.cloud} not in ${constraint.allowedClouds.join(', ')})`
        };
      }
    }

    // Check allowed regions
    if (constraint.allowedRegions && constraint.allowedRegions.length > 0) {
      const hasAllowedRegion = metadata.regions.some(r =>
        constraint.allowedRegions!.includes(r)
      );

      if (!hasAllowedRegion) {
        return {
          passed: false,
          reason: `No allowed regions (provider: ${metadata.regions.join(', ')}, allowed: ${constraint.allowedRegions.join(', ')})`
        };
      }
    }

    return { passed: true, reason: '' };
  }

  /**
   * Check reliability constraint
   */
  private checkReliabilityConstraint(
    metadata: ProviderMetadata,
    constraint: ReliabilityConstraint
  ): { passed: boolean; reason: string } {
    if (constraint.minAvailability && metadata.reliability.availability < constraint.minAvailability) {
      return {
        passed: false,
        reason: `Availability too low (${(metadata.reliability.availability * 100).toFixed(1)}% < ${(constraint.minAvailability * 100).toFixed(1)}%)`
      };
    }

    if (constraint.maxErrorRate && metadata.reliability.errorRate > constraint.maxErrorRate) {
      return {
        passed: false,
        reason: `Error rate too high (${(metadata.reliability.errorRate * 100).toFixed(1)}% > ${(constraint.maxErrorRate * 100).toFixed(1)}%)`
      };
    }

    return { passed: true, reason: '' };
  }

  /**
   * Calculate cost score (0-1, higher is better)
   * Lower cost = higher score
   */
  private calculateCostScore(metadata: ProviderMetadata): number {
    const avgCost = (metadata.costPerToken.input + metadata.costPerToken.output) / 2;
    const maxCost = 0.015; // $15 per 1M tokens as reference max

    // Invert: lower cost = higher score
    const score = Math.max(0, 1 - (avgCost / maxCost));

    return score;
  }

  /**
   * Calculate latency score (0-1, higher is better)
   * Lower latency = higher score
   */
  private calculateLatencyScore(metadata: ProviderMetadata): number {
    const maxLatency = 5000; // 5 seconds as reference max

    // Invert: lower latency = higher score
    const score = Math.max(0, 1 - (metadata.latencyEstimate.p95 / maxLatency));

    return score;
  }

  /**
   * Calculate reliability score (0-1, higher is better)
   * Higher availability = higher score
   */
  private calculateReliabilityScore(metadata: ProviderMetadata): number {
    // Availability is already 0-1, higher is better
    return metadata.reliability.availability;
  }

  /**
   * Estimate request cost before execution
   */
  estimateRequestCost(provider: string, inputTokens: number, outputTokens: number): number {
    const metadata = this.metadataRegistry[provider];
    if (!metadata) return 0;

    const cost =
      (inputTokens / 1000) * metadata.costPerToken.input +
      (outputTokens / 1000) * metadata.costPerToken.output;

    return cost;
  }

  /**
   * Check if request would exceed budget
   */
  async wouldExceedBudget(
    provider: string,
    estimatedCost: number,
    constraint?: CostConstraint
  ): Promise<boolean> {
    if (!constraint) return false;

    // Check per-request limit
    if (constraint.maxPerRequest && estimatedCost > constraint.maxPerRequest) {
      return true;
    }

    // Check daily limit
    if (constraint.maxDaily && this.costTracker) {
      // Get daily cost (last 24 hours)
      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);

      const dailyCost = await this.costTracker.getTotalCost({
        provider,
        startTime: dayAgo,
        endTime: now
      });

      if (dailyCost + estimatedCost > constraint.maxDaily) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create policy evaluator with cost tracker
 */
export function createPolicyEvaluator(
  metadataRegistry: ProviderMetadataRegistry,
  costTracker?: CostTracker
): PolicyEvaluator {
  return new PolicyEvaluator(metadataRegistry, costTracker);
}
