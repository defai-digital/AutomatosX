/**
 * Resource Calculator - Dynamic resource allocation
 * v5.6.13: Phase 2.6 - Dynamic maxConcurrentAgents
 */

import os from 'os';

export interface SystemResources {
  cpuCount: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  loadAverage: number[];
}

export interface ResourceLimits {
  maxConcurrentAgents: number;
  reason: string;
}

/**
 * Get current system resources
 */
export function getSystemResources(): SystemResources {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const cpuCount = os.cpus().length;
  const loadAverage = os.loadavg();

  return {
    cpuCount,
    totalMemoryGB: totalMemory / (1024 ** 3),
    freeMemoryGB: freeMemory / (1024 ** 3),
    loadAverage
  };
}

/**
 * Calculate optimal maxConcurrentAgents based on system resources
 *
 * Strategy:
 * - Base on CPU count (conservative: cpuCount / 2)
 * - Adjust based on available memory
 * - Consider current system load
 * - Apply safety limits (min: 2, max: 16)
 *
 * @param staticLimit - User-configured static limit (if any)
 * @returns Optimal concurrent agent limit
 */
export function calculateMaxConcurrentAgents(staticLimit?: number): ResourceLimits {
  const resources = getSystemResources();

  // If user explicitly set a limit, respect it
  if (staticLimit !== undefined && staticLimit > 0) {
    return {
      maxConcurrentAgents: staticLimit,
      reason: 'user-configured'
    };
  }

  // Base calculation on CPU count (conservative approach)
  // Use half of available CPUs to leave room for system + provider processes
  const cpuBased = Math.max(2, Math.floor(resources.cpuCount / 2));

  // Adjust based on available memory
  // Each agent approximately uses 50MB, keep 2GB free for system
  const memoryAvailable = Math.max(0, resources.freeMemoryGB - 2);
  const memoryBased = Math.max(2, Math.floor(memoryAvailable / 0.05)); // 50MB per agent

  // Consider current system load (loadAvg[0] = 1-minute average)
  // If system is loaded (load > cpuCount), reduce concurrency
  const loadAvg1min = resources.loadAverage[0] || 0;
  const loadFactor = loadAvg1min > resources.cpuCount ? 0.5 : 1.0;

  // Take the minimum of CPU-based and memory-based limits
  const calculated = Math.min(cpuBased, memoryBased);
  const adjusted = Math.floor(calculated * loadFactor);

  // Apply safety limits: min 2, max 16
  const limited = Math.max(2, Math.min(16, adjusted));

  // Determine reason
  let reason = 'dynamic';
  if (limited === 2) {
    reason = 'minimum-safety-limit';
  } else if (limited === 16) {
    reason = 'maximum-safety-limit';
  } else if (loadFactor < 1.0) {
    reason = 'high-system-load';
  } else if (calculated === cpuBased) {
    reason = 'cpu-bound';
  } else {
    reason = 'memory-bound';
  }

  return {
    maxConcurrentAgents: limited,
    reason
  };
}

/**
 * Get recommended maxConcurrentAgents with explanation
 * Useful for diagnostics and logging
 */
export function getRecommendedConcurrency(staticLimit?: number): {
  limit: number;
  reason: string;
  resources: SystemResources;
  details: string;
} {
  const resources = getSystemResources();
  const result = calculateMaxConcurrentAgents(staticLimit);

  const details = [
    `CPU cores: ${resources.cpuCount}`,
    `Free memory: ${resources.freeMemoryGB.toFixed(1)}GB`,
    `Load average: ${resources.loadAverage[0]?.toFixed(2) || 'N/A'}`,
    `Calculated limit: ${result.maxConcurrentAgents}`,
    `Reason: ${result.reason}`
  ].join(', ');

  return {
    limit: result.maxConcurrentAgents,
    reason: result.reason,
    resources,
    details
  };
}
