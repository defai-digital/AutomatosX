/**
 * Result Aggregator
 *
 * Combines results from parallel agent execution based on configured strategy.
 *
 * Invariants:
 * - INV-APE-004: Result aggregation follows configured strategy
 */

import type { AgentParallelTaskResult } from '@defai.digital/contracts';
import type {
  ResultAggregator,
  ResultAggregatorOptions,
  CustomAggregator,
  AggregationStrategy,
} from './types.js';

/**
 * Deep merge two objects
 * Later values override earlier values
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      // Override with new value
      result[key] = value;
    }
  }

  return result;
}

/**
 * Merge strategy: Combine all outputs into single object
 * INV-APE-004: Later tasks override earlier for same keys
 */
function mergeResults(results: AgentParallelTaskResult[]): unknown {
  const merged: Record<string, unknown> = {};

  // Sort by layer then completion time to ensure deterministic merge order
  const sortedResults = [...results].sort((a, b) => {
    // First by layer
    const layerDiff = (a.layer ?? 0) - (b.layer ?? 0);
    if (layerDiff !== 0) return layerDiff;

    // Then by completion time
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return aTime - bTime;
  });

  for (const result of sortedResults) {
    if (result.success && result.output !== undefined) {
      if (typeof result.output === 'object' && result.output !== null && !Array.isArray(result.output)) {
        // Deep merge object outputs
        Object.assign(merged, deepMerge(merged, result.output as Record<string, unknown>));
      } else {
        // For non-object outputs, use agent ID as key
        merged[result.agentId] = result.output;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * List strategy: Return array of individual results
 * INV-APE-004: Ordered by task definition order (taskId)
 */
function listResults(results: AgentParallelTaskResult[]): unknown {
  return results
    .filter((r) => r.success)
    .sort((a, b) => a.taskId.localeCompare(b.taskId))
    .map((r) => ({
      taskId: r.taskId,
      agentId: r.agentId,
      output: r.output,
      durationMs: r.durationMs,
    }));
}

/**
 * First success strategy: Return first successful result
 * INV-APE-004: First by layer, then by completion time
 */
function firstSuccessResult(results: AgentParallelTaskResult[]): unknown {
  const successResults = results
    .filter((r) => r.success && r.output !== undefined)
    .sort((a, b) => {
      // First by layer
      const layerDiff = (a.layer ?? 0) - (b.layer ?? 0);
      if (layerDiff !== 0) return layerDiff;

      // Then by completion time
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return aTime - bTime;
    });

  return successResults[0]?.output;
}

/**
 * Creates a result aggregator
 */
export function createResultAggregator(): ResultAggregator {
  return {
    /**
     * Aggregate task results based on strategy
     * INV-APE-004: Follows configured strategy exactly
     */
    aggregate(
      results: AgentParallelTaskResult[],
      options: ResultAggregatorOptions
    ): unknown {
      const { strategy, customAggregator } = options;

      switch (strategy) {
        case 'merge':
          return mergeResults(results);

        case 'list':
          return listResults(results);

        case 'firstSuccess':
          return firstSuccessResult(results);

        case 'custom':
          if (!customAggregator) {
            throw new Error(
              'Custom aggregation strategy requires a customAggregator function'
            );
          }
          return customAggregator(results);

        default:
          // Exhaustive check
          const _exhaustive: never = strategy;
          throw new Error(`Unknown aggregation strategy: ${_exhaustive}`);
      }
    },
  };
}

/**
 * Built-in aggregation strategies for convenience
 */
export const AggregationStrategies = {
  /**
   * Merge all successful outputs into single object
   */
  merge: mergeResults,

  /**
   * Return array of all successful results
   */
  list: listResults,

  /**
   * Return first successful result only
   */
  firstSuccess: firstSuccessResult,

  /**
   * Create custom strategy from function
   */
  custom: (fn: CustomAggregator) => fn,
} as const;

/**
 * Utility: Create a keyed aggregator that groups results by a key
 */
export function createKeyedAggregator(
  keyFn: (result: AgentParallelTaskResult) => string
): CustomAggregator {
  return (results: AgentParallelTaskResult[]) => {
    const grouped: Record<string, unknown[]> = {};

    for (const result of results) {
      if (result.success && result.output !== undefined) {
        const key = keyFn(result);
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(result.output);
      }
    }

    return grouped;
  };
}

/**
 * Utility: Create aggregator that filters by success and transforms
 */
export function createTransformAggregator<T>(
  transform: (output: unknown, result: AgentParallelTaskResult) => T
): CustomAggregator {
  return (results: AgentParallelTaskResult[]) => {
    return results
      .filter((r) => r.success && r.output !== undefined)
      .map((r) => transform(r.output, r));
  };
}

/**
 * Get aggregation strategy from string
 */
export function getAggregationStrategy(
  name: string
): AggregationStrategy {
  const valid: AggregationStrategy[] = ['merge', 'list', 'firstSuccess', 'custom'];
  if (valid.includes(name as AggregationStrategy)) {
    return name as AggregationStrategy;
  }
  throw new Error(
    `Invalid aggregation strategy: ${name}. Valid strategies: ${valid.join(', ')}`
  );
}
