/**
 * AutomatosX v8.0.0 - Safety Evaluator
 *
 * Evaluates safety of continuing iterations based on:
 * - Cost limits
 * - Duration limits
 * - Risk level
 * - Failure patterns
 */

import type {
  SafetyEvaluation,
  Strategy,
  IterationResult
} from '../types/iterate.types.js';

/**
 * Safety level thresholds
 */
const SAFETY_THRESHOLDS = {
  permissive: {
    maxCostPerIteration: 10.0,
    maxTotalCost: 100.0,
    maxDurationPerIteration: 600000, // 10 minutes
    maxTotalDuration: 3600000, // 1 hour
    maxConsecutiveFailures: 10,
    riskTolerance: 0.8
  },
  normal: {
    maxCostPerIteration: 5.0,
    maxTotalCost: 50.0,
    maxDurationPerIteration: 300000, // 5 minutes
    maxTotalDuration: 1800000, // 30 minutes
    maxConsecutiveFailures: 5,
    riskTolerance: 0.5
  },
  paranoid: {
    maxCostPerIteration: 1.0,
    maxTotalCost: 10.0,
    maxDurationPerIteration: 120000, // 2 minutes
    maxTotalDuration: 600000, // 10 minutes
    maxConsecutiveFailures: 3,
    riskTolerance: 0.2
  }
};

/**
 * Safety Evaluator
 *
 * Determines if it's safe to continue iterating based on:
 * - Cost constraints
 * - Time constraints
 * - Risk assessment
 * - Failure patterns
 */
export class SafetyEvaluator {
  /**
   * Evaluate safety of continuing with given strategy
   */
  async evaluate(
    strategy: Strategy,
    safetyLevel: 'permissive' | 'normal' | 'paranoid',
    iterationHistory: IterationResult[]
  ): Promise<SafetyEvaluation> {
    const thresholds = SAFETY_THRESHOLDS[safetyLevel];
    const warnings: string[] = [];

    // Calculate totals
    const totalCost = this.calculateTotalCost(iterationHistory);
    const totalDuration = this.calculateTotalDuration(iterationHistory);

    // Check cost limit
    const costCheck = this.checkCostLimit(totalCost, thresholds, warnings);

    // Check duration limit
    const durationCheck = this.checkDurationLimit(totalDuration, thresholds, warnings);

    // Check failure pattern
    const failureCheck = this.checkFailurePattern(iterationHistory, thresholds, warnings);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      iterationHistory,
      totalCost,
      totalDuration,
      thresholds
    );

    // Check risk tolerance
    const riskCheck = riskScore <= thresholds.riskTolerance;
    if (!riskCheck) {
      warnings.push(`Risk score ${riskScore.toFixed(2)} exceeds tolerance ${thresholds.riskTolerance}`);
    }

    // Overall safety determination
    const safe = costCheck && durationCheck && failureCheck && riskCheck;

    // Generate reason if not safe
    let reason: string | undefined;
    if (!safe) {
      if (!costCheck) {
        reason = `Cost limit exceeded: $${totalCost.toFixed(2)} > $${thresholds.maxTotalCost}`;
      } else if (!durationCheck) {
        reason = `Duration limit exceeded: ${Math.round(totalDuration / 1000)}s > ${Math.round(thresholds.maxTotalDuration / 1000)}s`;
      } else if (!failureCheck) {
        const consecutiveFailures = this.countConsecutiveFailures(iterationHistory);
        reason = `Too many consecutive failures: ${consecutiveFailures} > ${thresholds.maxConsecutiveFailures}`;
      } else if (!riskCheck) {
        reason = `Risk score ${riskScore.toFixed(2)} exceeds ${safetyLevel} tolerance`;
      }
    }

    return {
      safe,
      reason,
      riskScore,
      warnings,
      costSoFar: totalCost,
      durationSoFar: totalDuration
    };
  }

  /**
   * Check if cost limit exceeded
   */
  private checkCostLimit(
    totalCost: number,
    thresholds: typeof SAFETY_THRESHOLDS.normal,
    warnings: string[]
  ): boolean {
    if (totalCost > thresholds.maxTotalCost * 0.8) {
      warnings.push(`Cost approaching limit: $${totalCost.toFixed(2)} / $${thresholds.maxTotalCost}`);
    }

    return totalCost <= thresholds.maxTotalCost;
  }

  /**
   * Check if duration limit exceeded
   */
  private checkDurationLimit(
    totalDuration: number,
    thresholds: typeof SAFETY_THRESHOLDS.normal,
    warnings: string[]
  ): boolean {
    if (totalDuration > thresholds.maxTotalDuration * 0.8) {
      const durationSeconds = Math.round(totalDuration / 1000);
      const limitSeconds = Math.round(thresholds.maxTotalDuration / 1000);
      warnings.push(`Duration approaching limit: ${durationSeconds}s / ${limitSeconds}s`);
    }

    return totalDuration <= thresholds.maxTotalDuration;
  }

  /**
   * Check failure pattern safety
   */
  private checkFailurePattern(
    iterationHistory: IterationResult[],
    thresholds: typeof SAFETY_THRESHOLDS.normal,
    warnings: string[]
  ): boolean {
    const consecutiveFailures = this.countConsecutiveFailures(iterationHistory);

    if (consecutiveFailures > thresholds.maxConsecutiveFailures * 0.7) {
      warnings.push(`Many consecutive failures: ${consecutiveFailures} / ${thresholds.maxConsecutiveFailures}`);
    }

    return consecutiveFailures <= thresholds.maxConsecutiveFailures;
  }

  /**
   * Calculate risk score (0.0-1.0)
   */
  private calculateRiskScore(
    iterationHistory: IterationResult[],
    totalCost: number,
    totalDuration: number,
    thresholds: typeof SAFETY_THRESHOLDS.normal
  ): number {
    let risk = 0.0;

    // Cost risk (0-0.3)
    const costRatio = totalCost / thresholds.maxTotalCost;
    risk += Math.min(costRatio, 1.0) * 0.3;

    // Duration risk (0-0.3)
    const durationRatio = totalDuration / thresholds.maxTotalDuration;
    risk += Math.min(durationRatio, 1.0) * 0.3;

    // Failure rate risk (0-0.4)
    const failureRate = this.calculateFailureRate(iterationHistory);
    risk += failureRate * 0.4;

    return Math.min(risk, 1.0);
  }

  /**
   * Calculate failure rate
   */
  private calculateFailureRate(iterationHistory: IterationResult[]): number {
    if (iterationHistory.length === 0) {
      return 0;
    }

    const failures = iterationHistory.filter(iter => !iter.success).length;
    return failures / iterationHistory.length;
  }

  /**
   * Count consecutive failures at end of history
   */
  private countConsecutiveFailures(iterationHistory: IterationResult[]): number {
    let count = 0;

    for (let i = iterationHistory.length - 1; i >= 0; i--) {
      if (iterationHistory[i].success) {
        break;
      }
      count++;
    }

    return count;
  }

  /**
   * Calculate total cost
   */
  private calculateTotalCost(iterationHistory: IterationResult[]): number {
    return iterationHistory.reduce((total, iter) => total + (iter.cost || 0), 0);
  }

  /**
   * Calculate total duration
   */
  private calculateTotalDuration(iterationHistory: IterationResult[]): number {
    return iterationHistory.reduce((total, iter) => total + iter.duration, 0);
  }

  /**
   * Get safety thresholds for level
   */
  getSafetyThresholds(safetyLevel: 'permissive' | 'normal' | 'paranoid') {
    return { ...SAFETY_THRESHOLDS[safetyLevel] };
  }
}
