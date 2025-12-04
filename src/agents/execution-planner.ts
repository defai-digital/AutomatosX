import { cpus } from 'os';
import { logger } from '../shared/logging/logger.js';
import type { DependencyGraph } from './dependency-graph.js';
import type { ConcurrencyConfig } from '../types/config.js';

export interface ExecutionLevel {
  level: number;
  agents: string[];
  parallelBatches: string[][];
  executionMode: 'parallel' | 'sequential';
}

export interface ExecutionPlan {
  levels: ExecutionLevel[];
  totalAgents: number;
  maxConcurrency: number;
  estimatedDuration?: number;
}

export interface ExecutionPlannerOptions {
  maxConcurrentAgents?: number;  // DEPRECATED: use concurrency
  concurrency?: ConcurrencyConfig;  // v5.6.18: Advanced concurrency control
}

/**
 * v5.6.18: Calculate optimal concurrency based on CPU cores and configuration
 */
function calculateOptimalConcurrency(config?: ConcurrencyConfig): number {
  // If no config, use default of 4
  if (!config) {
    return 4;
  }

  // If explicit maxConcurrentAgents is set, use it (overrides autoDetect)
  if (config.maxConcurrentAgents !== undefined) {
    return Math.max(1, Math.min(config.maxConcurrentAgents, config.maxConcurrency || 16));
  }

  // If autoDetect is disabled, use default
  if (!config.autoDetect) {
    return 4;
  }

  // Auto-detect based on CPU cores
  const cpuCount = cpus().length;
  const multiplier = config.cpuMultiplier || 1.0;
  const calculated = Math.floor(cpuCount * multiplier);

  // Clamp to min/max bounds
  const minConcurrency = config.minConcurrency || 2;
  const maxConcurrency = config.maxConcurrency || 16;
  const result = Math.max(minConcurrency, Math.min(calculated, maxConcurrency));

  logger.debug('Calculated optimal concurrency', {
    cpuCount,
    multiplier,
    calculated,
    result,
    bounds: { min: minConcurrency, max: maxConcurrency }
  });

  return result;
}

export class ExecutionPlanner {
  constructor(private readonly defaults: ExecutionPlannerOptions = {}) {}

  createExecutionPlan(
    graph: DependencyGraph,
    options: ExecutionPlannerOptions = {}
  ): ExecutionPlan {
    const mergedOptions = { ...this.defaults, ...options };
    const maxConcurrency = this.resolveMaxConcurrency(mergedOptions);

    const plan: ExecutionPlan = {
      levels: [],
      totalAgents: graph.nodes.size,
      maxConcurrency
    };

    if (graph.nodes.size === 0) {
      return plan;
    }

    for (let level = 0; level <= graph.maxLevel; level++) {
      const agentNames = [...(graph.levels.get(level) ?? [])];
      if (agentNames.length === 0) {
        continue;
      }

      const canRunParallel = agentNames.every(name => {
        const node = graph.nodes.get(name);
        return node ? node.agent.parallel !== false : true;
      });

      const batches: string[][] = [];

      if (canRunParallel) {
        for (let i = 0; i < agentNames.length; i += maxConcurrency) {
          batches.push(agentNames.slice(i, i + maxConcurrency));
        }
      } else {
        for (const name of agentNames) {
          batches.push([name]);
        }
      }

      plan.levels.push({
        level,
        agents: agentNames,
        parallelBatches: batches,
        executionMode: canRunParallel ? 'parallel' : 'sequential'
      });
    }

    return plan;
  }

  private resolveMaxConcurrency(options: ExecutionPlannerOptions): number {
    // v5.6.18: Use concurrency config if available
    if (options.concurrency) {
      return calculateOptimalConcurrency(options.concurrency);
    }

    // DEPRECATED: Fallback to legacy maxConcurrentAgents
    const value = options.maxConcurrentAgents ?? 4;

    if (!Number.isInteger(value) || value < 1) {
      logger.warn('Invalid maxConcurrentAgents supplied, falling back to 1', {
        requested: value
      });
      return 1;
    }

    logger.debug('Using legacy maxConcurrentAgents (deprecated)', {
      value,
      suggestion: 'Use execution.concurrency configuration instead'
    });

    return value;
  }
}
