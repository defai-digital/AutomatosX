/**
 * Policy Parser
 *
 * Parses policy configuration from YAML specs and converts to internal
 * representation for policy-driven routing.
 *
 * @module core/spec/PolicyParser
 */

import type {
  SpecYAML,
  PolicySpec,
  CostConstraint,
  LatencyConstraint,
  PrivacyConstraint,
  ReliabilityConstraint
} from '@/types/spec-yaml.js';
import { logger } from '@/utils/logger.js';

/**
 * Parsed policy representation
 */
export interface ParsedPolicy {
  /** Optimization goal */
  goal: 'cost' | 'latency' | 'reliability' | 'balanced';

  /** Optimization weights */
  optimization: {
    weights: {
      cost: number;
      latency: number;
      reliability: number;
    };
  };

  /** Policy constraints */
  constraints: {
    cost?: CostConstraint;
    latency?: LatencyConstraint;
    privacy?: PrivacyConstraint;
    reliability?: ReliabilityConstraint;
  };
}

/**
 * Policy parser for YAML specs
 */
export class PolicyParser {
  /**
   * Parse policy from spec YAML
   *
   * @param spec - YAML spec
   * @returns Parsed policy with defaults
   */
  parse(spec: SpecYAML): ParsedPolicy {
    const policy = spec.policy || {};

    const goal = policy.goal || 'balanced';
    const optimization = this.parseOptimization(policy, goal);
    const constraints = this.parseConstraints(policy);

    logger.debug('Policy parsed', {
      goal,
      weights: optimization.weights,
      hasConstraints: {
        cost: !!constraints.cost,
        latency: !!constraints.latency,
        privacy: !!constraints.privacy,
        reliability: !!constraints.reliability
      }
    });

    return {
      goal,
      optimization,
      constraints
    };
  }

  /**
   * Parse optimization weights
   *
   * FIXED (Bug #12): Added validation to prevent corrupted weights from invalid input
   */
  private parseOptimization(
    policy: PolicySpec | undefined,
    goal: string
  ): ParsedPolicy['optimization'] {
    // Use explicit weights if provided
    if (policy?.optimization?.weights) {
      const weights = policy.optimization.weights;

      // FIXED (Bug #12): Validate each weight is a non-negative finite number
      const cost = weights.cost ?? 0;
      const latency = weights.latency ?? 0;
      const reliability = weights.reliability ?? 0;

      if (!Number.isFinite(cost) || cost < 0) {
        logger.warn('Invalid cost weight, using defaults', { cost });
        return { weights: this.getDefaultWeights(goal) };
      }
      if (!Number.isFinite(latency) || latency < 0) {
        logger.warn('Invalid latency weight, using defaults', { latency });
        return { weights: this.getDefaultWeights(goal) };
      }
      if (!Number.isFinite(reliability) || reliability < 0) {
        logger.warn('Invalid reliability weight, using defaults', { reliability });
        return { weights: this.getDefaultWeights(goal) };
      }

      // Normalize weights to sum to 1.0
      const sum = cost + latency + reliability;

      // FIXED (Bug #12): Validate sum is a positive finite number before division
      if (!Number.isFinite(sum) || sum <= 0) {
        logger.warn('Invalid weight sum, using defaults', { sum, weights: { cost, latency, reliability } });
        return { weights: this.getDefaultWeights(goal) };
      }

      return {
        weights: {
          cost: cost / sum,
          latency: latency / sum,
          reliability: reliability / sum
        }
      };
    }

    // Use defaults based on goal
    return { weights: this.getDefaultWeights(goal) };
  }

  /**
   * Get default weights based on optimization goal
   */
  private getDefaultWeights(goal: string): { cost: number; latency: number; reliability: number } {
    switch (goal) {
      case 'cost':
        return {
          cost: 0.7,
          latency: 0.2,
          reliability: 0.1
        };

      case 'latency':
        return {
          cost: 0.1,
          latency: 0.7,
          reliability: 0.2
        };

      case 'reliability':
        return {
          cost: 0.1,
          latency: 0.2,
          reliability: 0.7
        };

      default: // 'balanced'
        return {
          cost: 0.33,
          latency: 0.34,
          reliability: 0.33
        };
    }
  }

  /**
   * Parse policy constraints
   */
  private parseConstraints(policy: PolicySpec | undefined): ParsedPolicy['constraints'] {
    return {
      cost: policy?.constraints?.cost,
      latency: policy?.constraints?.latency,
      privacy: policy?.constraints?.privacy,
      reliability: policy?.constraints?.reliability
    };
  }

  /**
   * Validate parsed policy
   */
  validate(policy: ParsedPolicy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate weights sum to 1.0 (within tolerance)
    const sum =
      policy.optimization.weights.cost +
      policy.optimization.weights.latency +
      policy.optimization.weights.reliability;

    if (Math.abs(sum - 1.0) > 0.01) {
      errors.push(`Optimization weights must sum to 1.0 (got ${sum.toFixed(3)})`);
    }

    // Validate weight ranges
    for (const [key, value] of Object.entries(policy.optimization.weights)) {
      if (value < 0 || value > 1) {
        errors.push(`${key} weight must be between 0 and 1 (got ${value})`);
      }
    }

    // Validate cost constraints
    if (policy.constraints.cost) {
      const cost = policy.constraints.cost;

      if (cost.maxPerRequest !== undefined && cost.maxPerRequest < 0) {
        errors.push('maxPerRequest must be >= 0');
      }

      if (cost.maxDaily !== undefined && cost.maxDaily < 0) {
        errors.push('maxDaily must be >= 0');
      }
    }

    // Validate latency constraints
    if (policy.constraints.latency) {
      const latency = policy.constraints.latency;

      if (latency.p50 !== undefined && latency.p50 < 0) {
        errors.push('p50 latency must be >= 0');
      }

      if (latency.p95 !== undefined && latency.p95 < 0) {
        errors.push('p95 latency must be >= 0');
      }

      if (latency.p99 !== undefined && latency.p99 < 0) {
        errors.push('p99 latency must be >= 0');
      }

      // p50 <= p95 <= p99
      if (latency.p50 !== undefined && latency.p95 !== undefined && latency.p50 > latency.p95) {
        errors.push('p50 latency must be <= p95 latency');
      }

      if (latency.p95 !== undefined && latency.p99 !== undefined && latency.p95 > latency.p99) {
        errors.push('p95 latency must be <= p99 latency');
      }
    }

    // Validate reliability constraints
    if (policy.constraints.reliability) {
      const reliability = policy.constraints.reliability;

      if (reliability.minAvailability !== undefined) {
        if (reliability.minAvailability < 0 || reliability.minAvailability > 1) {
          errors.push('minAvailability must be between 0 and 1');
        }
      }

      if (reliability.maxErrorRate !== undefined) {
        if (reliability.maxErrorRate < 0 || reliability.maxErrorRate > 1) {
          errors.push('maxErrorRate must be between 0 and 1');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get policy summary for logging/debugging
   */
  getSummary(policy: ParsedPolicy): string {
    const parts: string[] = [];

    parts.push(`Goal: ${policy.goal}`);
    parts.push(
      `Weights: cost=${(policy.optimization.weights.cost * 100).toFixed(0)}%, ` +
      `latency=${(policy.optimization.weights.latency * 100).toFixed(0)}%, ` +
      `reliability=${(policy.optimization.weights.reliability * 100).toFixed(0)}%`
    );

    if (policy.constraints.cost) {
      const c = policy.constraints.cost;
      parts.push(
        `Cost: max/request=$${c.maxPerRequest || 'none'}, max/daily=$${c.maxDaily || 'none'}`
      );
    }

    if (policy.constraints.latency) {
      const l = policy.constraints.latency;
      parts.push(
        `Latency: p95<=${l.p95 || 'none'}ms`
      );
    }

    if (policy.constraints.privacy) {
      const p = policy.constraints.privacy;
      parts.push(
        `Privacy: ${p.dataClassification || 'any'}, clouds=${p.allowedClouds?.join(',') || 'any'}`
      );
    }

    if (policy.constraints.reliability) {
      const r = policy.constraints.reliability;
      parts.push(
        `Reliability: availability>=${r.minAvailability || 'none'}`
      );
    }

    return parts.join(', ');
  }
}

/**
 * Default singleton instance
 */
let defaultPolicyParser: PolicyParser | null = null;

/**
 * Get default policy parser instance (singleton)
 */
export function getDefaultPolicyParser(): PolicyParser {
  if (!defaultPolicyParser) {
    defaultPolicyParser = new PolicyParser();
  }
  return defaultPolicyParser;
}

/**
 * Convenience function: parse policy from spec
 */
export function parsePolicy(spec: SpecYAML): ParsedPolicy {
  return getDefaultPolicyParser().parse(spec);
}
