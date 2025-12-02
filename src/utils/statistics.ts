/**
 * Statistics Utilities
 *
 * Centralized statistical functions to ensure consistency across the codebase.
 *
 * @module utils/statistics
 */

/**
 * Calculate percentile index for a sorted array
 *
 * Uses the nearest-rank method (standard statistical method):
 * - index = ceil((percentile / 100) * length) - 1
 * - Ensures exactly p% of values are ≤ result
 * - Standard method used in statistics (R default, NumPy, etc.)
 *
 * @param length - Array length (must be > 0)
 * @param percentile - Percentile value (0-100)
 * @returns Zero-based index, clamped to valid array bounds
 *
 * @example
 * ```typescript
 * const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
 * const p95Index = getPercentileIndex(data.length, 95);
 * const p95Value = data[p95Index]; // 100
 * ```
 *
 * Mathematical correctness:
 * - For p95 with 100 values: index = ceil(95) - 1 = 94
 * - Returns element at index 94, so indices 0-94 (95 values) are ≤ result ✓
 */
export function getPercentileIndex(length: number, percentile: number): number {
  if (length === 0) {
    return 0;
  }

  // Clamp percentile to valid range [0, 100]
  const clampedPercentile = Math.max(0, Math.min(100, percentile));

  // FIXED Bug #145: Use ceil method (nearest-rank) for correct percentile calculation
  // This ensures exactly p% of values are ≤ the result
  const index = Math.ceil((clampedPercentile / 100) * length) - 1;

  // Clamp to array bounds [0, length-1]
  return Math.max(0, Math.min(index, length - 1));
}

/**
 * Get percentile value from a sorted array
 *
 * @param sortedArray - Array sorted in ascending order
 * @param percentile - Percentile value (0-100)
 * @param defaultValue - Value to return if array is empty (default: 0)
 * @returns Percentile value from the array
 *
 * @example
 * ```typescript
 * const latencies = [100, 200, 300, 400, 500].sort((a, b) => a - b);
 * const p95 = getPercentile(latencies, 95); // 500
 * const p50 = getPercentile(latencies, 50); // 300
 * ```
 */
export function getPercentile(
  sortedArray: number[],
  percentile: number,
  defaultValue: number = 0
): number {
  if (sortedArray.length === 0) {
    return defaultValue;
  }

  const index = getPercentileIndex(sortedArray.length, percentile);
  return sortedArray[index] ?? defaultValue;
}

/**
 * Calculate multiple percentiles from a sorted array
 *
 * More efficient than calling getPercentile multiple times
 * when you need several percentiles from the same data.
 *
 * @param sortedArray - Array sorted in ascending order
 * @param percentiles - Array of percentile values to calculate (0-100)
 * @param defaultValue - Value to return for empty array (default: 0)
 * @returns Object mapping percentile to value
 *
 * @example
 * ```typescript
 * const latencies = [100, 200, 300, 400, 500];
 * const percentiles = getPercentiles(latencies, [50, 95, 99]);
 * // { p50: 300, p95: 500, p99: 500 }
 * ```
 */
export function getPercentiles(
  sortedArray: number[],
  percentiles: number[],
  defaultValue: number = 0
): Record<string, number> {
  const result: Record<string, number> = {};

  if (sortedArray.length === 0) {
    for (const p of percentiles) {
      result[`p${p}`] = defaultValue;
    }
    return result;
  }

  for (const p of percentiles) {
    const index = getPercentileIndex(sortedArray.length, p);
    result[`p${p}`] = sortedArray[index] ?? defaultValue;
  }

  return result;
}

/**
 * Calculate common statistical metrics from an array
 *
 * @param values - Array of numeric values (will be sorted internally)
 * @returns Object with min, max, avg, median, p95, p99
 *
 * @example
 * ```typescript
 * const stats = getStatistics([100, 200, 150, 300, 250]);
 * // { min: 100, max: 300, avg: 200, median: 200, p95: 300, p99: 300 }
 * ```
 */
export function getStatistics(values: number[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;

  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    avg,
    median: getPercentile(sorted, 50),
    p95: getPercentile(sorted, 95),
    p99: getPercentile(sorted, 99)
  };
}
